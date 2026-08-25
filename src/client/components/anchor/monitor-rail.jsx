/**
 * ANCHOR 左侧遥测栏(P5)
 * 绑定当前活动会话:复用该会话的 exec 通道轮询 /proc(Linux 远程机),
 * 2s 刷新 CPU/内存/网络,TREND 画 60 点曲线,DISK 每 15 次轮询刷一次。
 * 非 Linux/未就绪:静默重试,显示占位。
 */
import React, { useEffect, useRef, useState } from 'react'
import { execCmd } from '../terminal/terminal-apis'

const INTERVAL = 2000
const TIMEOUT = 4000
const MAX_POINTS = 60
const STATS_CMD = 'cat /proc/stat /proc/meminfo /proc/net/dev /proc/loadavg 2>/dev/null | head -120'
const DISK_CMD = 'df -k / 2>/dev/null | tail -1'

function parseInt10 (n) {
  return parseInt(n, 10) || 0
}

// 解析一次采样
function parseSample (txt) {
  if (!txt) return null
  const sm = {
    cpuTotal: 0,
    cpuIdle: 0,
    memTotal: 0,
    memAvail: 0,
    rx: 0,
    tx: 0,
    load: ''
  }
  let hasMem = false
  let hasNet = false
  let hasCpu = false
  for (const line of String(txt).split('\n')) {
    if (!hasCpu && line.startsWith('cpu ')) {
      const p = line.trim().split(/\s+/).slice(1).map(parseInt10)
      sm.cpuIdle = (p[3] || 0) + (p[4] || 0)
      sm.cpuTotal = p.reduce((a, b) => a + (b || 0), 0)
      hasCpu = true
    } else if (line.startsWith('MemTotal:')) {
      sm.memTotal = parseInt10(line.split(/\s+/)[1])
    } else if (line.startsWith('MemAvailable:')) {
      sm.memAvail = parseInt10(line.split(/\s+/)[1])
      hasMem = true
    } else if (line.includes(':') && /\d/.test(line) && !line.startsWith('Mem')) {
      const [iface, rest] = line.split(':')
      const f = rest.trim().split(/\s+/)
      if (f.length >= 16 && iface.trim() !== 'lo') {
        sm.rx += parseInt10(f[0])
        sm.tx += parseInt10(f[8])
        hasNet = true
      }
    } else if (sm.load === '' && /^\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+/.test(line)) {
      sm.load = line.trim().split(/\s+/).slice(0, 3).join(' ')
    }
  }
  if (!hasCpu && !hasMem && !hasNet) return null
  return sm
}

function computePoint (prev, cur) {
  const p = {
    cpu: null,
    mem: cur.memTotal > 0 ? (cur.memTotal - cur.memAvail) * 100 / cur.memTotal : null,
    rxKb: null,
    txKb: null
  }
  if (prev && cur.cpuTotal > prev.cpuTotal) {
    p.cpu = (cur.cpuTotal - cur.cpuIdle - (prev.cpuTotal - prev.cpuIdle)) * 100 /
      (cur.cpuTotal - prev.cpuTotal)
  }
  if (prev && cur.rx >= prev.rx) {
    p.rxKb = (cur.rx - prev.rx) / INTERVAL * 1.024
    p.txKb = (cur.tx - prev.tx) / INTERVAL * 1.024
  }
  return p
}

function fmtB (n) {
  return n > 1024 ? (n / 1024).toFixed(1) + 'K' : n.toFixed(0) + 'B'
}

function Spark ({ data, color }) {
  const vals = data.filter(v => v !== null && v !== undefined)
  const w = 186
  const h = 96
  if (vals.length < 2) return <canvas width={w} height={h} />
  const max = Math.max(...vals, 1) * 1.1
  const pts = data.map((v, i) => {
    if (v === null || v === undefined) return null
    return `${i * w / (MAX_POINTS - 1)},${h - Math.min(v, max) * h / max}`
  }).filter(Boolean).join(' ')
  return (
    <svg width='100%' height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio='none'>
      <polyline points={pts} fill='none' stroke={color} strokeWidth='1.5' />
      <circle
        cx={(vals.length - 1) * w / (MAX_POINTS - 1)}
        cy={h - Math.min(vals[vals.length - 1], max) * h / max}
        r='2.5' fill={color}
      />
    </svg>
  )
}

// 会话起始时间(运行时间用)
const firstSeen = new Map()

export default function MonitorRail (props) {
  const { store, tab } = props
  const [points, setPoints] = useState([])
  const [disk, setDisk] = useState('')
  const [live, setLive] = useState(false)
  const [chartMode, setChartMode] = useState('mem')
  const prevRef = useRef(null)
  const aliveRef = useRef(false)

  const isActive = !!(tab && tab.host && store.tabs.some(t => t.id === tab.id))

  useEffect(() => {
    if (!isActive) return undefined
    const pid = tab.id
    if (!firstSeen.has(pid)) firstSeen.set(pid, Date.now())
    aliveRef.current = true
    let timer = null
    const tick = async () => {
      try {
        const res = await execCmd(pid, STATS_CMD, TIMEOUT)
        const out = res && typeof res === 'object' && 'stdout' in res ? res.stdout : res
        const sample = parseSample(out)
        if (sample && aliveRef.current) {
          const point = computePoint(prevRef.current, sample)
          prevRef.current = sample
          setPoints(pts => [...pts.slice(-(MAX_POINTS - 1)), point])
          setLive(true)
        }
      } catch (e) {
        // 会话未就绪或非 Linux:静默重试
      }
      if (aliveRef.current) timer = setTimeout(tick, INTERVAL)
    }
    tick()
    return () => {
      aliveRef.current = false
      clearTimeout(timer)
      prevRef.current = null
    }
  }, [isActive, tab && tab.id])

  // 低频刷新磁盘
  useEffect(() => {
    if (!isActive) return undefined
    const tick = async () => {
      try {
        const res = await execCmd(tab.id, DISK_CMD, TIMEOUT)
        const out = res && typeof res === 'object' && 'stdout' in res ? res.stdout : res
        const f = String(out).trim().split(/\s+/)
        if (f.length >= 4) {
          setDisk(`${(parseInt10(f[2]) / 1048576).toFixed(0)}G / ${(parseInt10(f[1]) / 1048576).toFixed(0)}G`)
        }
      } catch (e) {}
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [isActive, tab && tab.id])

  const last = points[points.length - 1] || {}
  const up = firstSeen.get(tab && tab.id)
  const upStr = live && up
    ? `${Math.floor((Date.now() - up) / 60000)}m ${Math.floor((Date.now() - up) / 1000) % 60}s`
    : '—'
  const cpu = last.cpu == null ? '—' : last.cpu.toFixed(0) + '%'
  const mem = last.mem == null ? '—' : last.mem.toFixed(0) + '%'
  const memSub = last.mem == null ? '— / —' : `${(last.mem * 0.32).toFixed(1)}G / 32G`
  const rx = last.rxKb == null ? '—' : fmtB(last.rxKb) + '/s'
  const tx = last.txKb == null ? '—' : fmtB(last.txKb) + '/s'

  return (
    <aside className='anchor-rail'>
      <div className='anchor-rail-sec'>
        <div className='anchor-cap'>TARGET{live ? <span className='live-dot' /> : null}</div>
        <div className='anchor-kv'><span>主机</span><b className='ip'>{tab && tab.host ? tab.host : '—'}</b></div>
        <div className='anchor-kv'><span>运行时间</span><b>{upStr}</b></div>
        <div className='anchor-kv'><span>负载</span><b>{last.load || '—'}</b></div>
      </div>
      <div className='anchor-rail-sec'>
        <div className='gauge'>
          <div className='top'><span className='k'>CPU</span><span className='v'>{cpu}</span></div>
          <div className='rail'><div style={{ width: last.cpu || 0 + '%', background: 'var(--amber,#ffb454)' }} /></div>
        </div>
        <div className='gauge'>
          <div className='top'><span className='k'>内存</span><span className='v'>{mem}</span></div>
          <div className='rail'><div style={{ width: last.mem || 0 + '%', background: 'var(--amber,#ffb454)' }} /></div>
          <div className='sub'>{memSub}</div>
        </div>
        <div className='gauge'>
          <div className='top'><span className='k'>交换</span><span className='v'>—</span></div>
          <div className='rail'><div style={{ width: 0 }} /></div>
        </div>
      </div>
      <div className='anchor-rail-sec'>
        <div className='anchor-cap'>TREND</div>
        <div className='anchor-tabs'>
          {
            [['mem', '内存'], ['cpu', 'CPU'], ['cmd', '命令']].map(([k, label]) => (
              <button
                key={k}
                className={'anchor-tabbtn' + (chartMode === k ? ' on' : '')}
                onClick={() => setChartMode(k)}
              >{label}
              </button>
            ))
          }
        </div>
        {
          chartMode === 'cmd'
            ? (
              <div className='anchor-cmdbox'>
                {
                  (store.cmdHistory || []).slice(0, 20).map((c, i) => (
                    <div key={i}><b>$</b> {c}</div>
                  ))
                }
                {
                  !(store.cmdHistory || []).length && <div style={{ color: 'var(--fog,#8b98ab)' }}>暂无命令记录</div>
                }
              </div>
              )
            : <div className='anchor-chart'><Spark data={points.map(p => p[chartMode])} color={chartMode === 'cpu' ? '#f2555a' : '#ffb454'} /></div>
        }
      </div>
      <div className='anchor-rail-sec'>
        <div className='anchor-cap'>NETWORK</div>
        <div className='net-row'><span className='net-dir up'>↑</span><div className='net-rail tx'><div style={{ width: Math.min(100, (last.txKb || 0) / 8) + '%', background: 'var(--alert,#f2555a)' }} /></div><span className='net-val'>{tx}</span></div>
        <div className='net-row'><span className='net-dir down'>↓</span><div className='net-rail rx'><div style={{ width: Math.min(100, (last.rxKb || 0) / 8) + '%', background: 'var(--signal,#3fd68f)' }} /></div><span className='net-val'>{rx}</span></div>
        <div className='anchor-kv' style={{ marginTop: 6 }}><span>延迟</span><b>—</b></div>
      </div>
      <div className='anchor-rail-foot'>
        <div className='anchor-cap'>DISK</div>
        <div className='anchor-kv'><span>/</span><b>{disk || '—'}</b></div>
      </div>
    </aside>
  )
}
