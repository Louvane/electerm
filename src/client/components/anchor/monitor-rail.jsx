/**
 * ANCHOR 左侧遥测栏(P5)
 * 绑定当前活动会话:复用该会话的 exec 通道轮询 /proc(Linux 远程机),
 * 2s 刷新 CPU/内存/网络,TREND 画 60 点曲线,DISK 每 15 次轮询刷一次。
 * 非 Linux/未就绪:静默重试,显示占位。
 */
import React, { useEffect, useRef, useState } from 'react'
import { execCmdDirect } from '../terminal/terminal-apis.js'
import { SettingOutlined } from '@ant-design/icons'

const INTERVAL = 2000
// 跨平台采集: Linux /proc + Windows PowerShell(输出 KEY=VAL)
const STATS_LINUX = 'cat /proc/loadavg /proc/uptime /proc/stat /proc/meminfo /proc/net/dev | head -200'
const STATS_WIN = 'powershell -NoProfile -Command "\'CPU=\'+((Get-CimInstance Win32_Processor|Measure-Object LoadPercentage -Average).Average)+\';MT=\'+(Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize+\';MA=\'+(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory+\';UP=\'+[int](((Get-Date)-(Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalSeconds)+\';RX=\'+(Get-NetAdapterStatistics|Measure-Object ReceivedBytes -Sum).Sum+\';TX=\'+(Get-NetAdapterStatistics|Measure-Object SentBytes -Sum).Sum+\';ST=\'+(Get-CimInstance Win32_OperatingSystem).TotalVirtualMemorySize+\';SF=\'+(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory"'
const DISK_LINUX = 'df -kP -x tmpfs -x devtmpfs -x overlay -x shm | tail -n +2'
const DISK_WIN = 'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Name + \'|\' + [long]$_.Used + \'|\' + [long]$_.Free + \'|\' + $_.Root }"'

function statsCmdFor (os) {
  return os === 'win' ? STATS_WIN : STATS_LINUX
}

function diskCmdFor (os) {
  return os === 'win' ? DISK_WIN : DISK_LINUX
}

// Windows KEY=VAL 解析
function parseWinSample (txt) {
  const kv = {}
  String(txt).replace(/\r/g, '').split(';').forEach(seg => {
    const m = seg.match(/(CPU|MT|MA|UP|RX|TX|ST|SF)=(-?[\d.]+)/)
    if (m) kv[m[1]] = parseFloat(m[2])
  })
  if (!Object.keys(kv).length) return null
  return {
    cpuIdle: 0,
    cpuTotal: 0,
    cpuPct: isFinite(kv.CPU) ? kv.CPU : null,
    memTotal: kv.MT || 0,
    memAvail: kv.MA || 0,
    swapTotal: kv.ST || 0,
    swapFree: kv.SF || 0,
    rx: kv.RX || 0,
    tx: kv.TX || 0,
    load: '',
    uptimeSec: kv.UP || null
  }
}
const TIMEOUT = 4000
const MAX_POINTS = 60
// loadavg/uptime 放最前,防 net/dev 行多(K8s veth)把 head 配额吃光

function parseInt10 (n) {
  return parseInt(n, 10) || 0
}

// 解析一次采样
function parseSample (txt, os) {
  if (os === 'win') return parseWinSample(txt)
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
  sm.swapPct = null
  sm.uptimeSec = null
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
    } else if (line.startsWith('SwapTotal:')) {
      sm.swapTotal = parseInt10(line.split(/\s+/)[1])
    } else if (line.startsWith('SwapFree:')) {
      sm.swapFree = parseInt10(line.split(/\s+/)[1])
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
    } else if (sm.uptimeSec === null && /^\d+\.\d+\s+\d+\.\d+$/.test(line.trim())) {
      sm.uptimeSec = parseInt10(line.trim().split(/\s+/)[0])
    }
  }
  if (hasMem && sm.swapTotal > 0) {
    sm.swapPct = (sm.swapTotal - sm.swapFree) * 100 / sm.swapTotal
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
  if (cur.cpuPct != null) {
    p.cpu = cur.cpuPct
  } else if (prev && cur.cpuTotal > prev.cpuTotal) {
    p.cpu = (cur.cpuTotal - cur.cpuIdle - (prev.cpuTotal - prev.cpuIdle)) * 100 /
      (cur.cpuTotal - prev.cpuTotal)
  }
  if (prev && cur.rx >= prev.rx) {
    p.rxKb = (cur.rx - prev.rx) / INTERVAL * 1.024
    p.txKb = (cur.tx - prev.tx) / INTERVAL * 1.024
  }
  return p
}

// 输入为 KB/s(计算已含 1.024 系数),单位按 K/M 标注
function fmtB (n) {
  return n >= 1024 ? (n / 1024).toFixed(1) + 'M' : n.toFixed(0) + 'K'
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
      <polyline points={pts} fill='none' style={{ stroke: color }} strokeWidth='1.5' />
      <circle
        cx={(vals.length - 1) * w / (MAX_POINTS - 1)}
        cy={h - Math.min(vals[vals.length - 1], max) * h / max}
        r='2.5' style={{ fill: color }}
      />
    </svg>
  )
}

const shortMount = m => {
  if (m === '/') return '/'
  if (m.startsWith('/var/lib/')) return '…/' + m.split('/').pop()
  if (m.length > 16) return '…' + m.slice(-15)
  return m
}

export default function MonitorRail (props) {
  const { store, tab, onOpenSettings } = props
  const [points, setPoints] = useState([])
  const [disks, setDisks] = useState([])
  const [diskPop, setDiskPop] = useState(null) // null | {x,y}
  const [live, setLive] = useState(false)
  const [chartMode, setChartMode] = useState('cpu')
  const prevRef = useRef(null)
  const aliveRef = useRef(false)
  const osRef = useRef('')

  // 本地终端也显示遥测(资源本机同样适用); 网络指标对本地为相对值
  const isActive = !!(tab && store.tabs.some(t => t.id === tab.id) && (tab.host || tab.type === 'local'))

  useEffect(() => {
    if (!isActive) return undefined
    const pid = tab.id
    setPoints([])
    setLive(false)
    osRef.current = ''
    aliveRef.current = true
    let timer = null
    const tick = async () => {
      try {
        if (!osRef.current) {
          const probe = await execCmdDirect(pid, 'uname -s', TIMEOUT, { silent: true }).catch(() => null)
          const po = probe && typeof probe === 'object' && ('stdout' in probe || 'stderr' in probe)
            ? `${probe.stdout || ''}${probe.stderr || ''}`
            : probe
          const txt = String(po || '').trim()
          if (txt) {
            osRef.current = /linux/i.test(txt) ? 'linux' : 'win'
          }
        }
        const res = await execCmdDirect(pid, statsCmdFor(osRef.current), TIMEOUT, { silent: true }).catch(() => '')
        const out = res && typeof res === 'object' && 'stdout' in res ? res.stdout : res
        const sample = parseSample(out, osRef.current)
        if (sample && aliveRef.current) {
          const point = computePoint(prevRef.current, sample)
          point.swap = sample.swapPct
          point.swapTotal = sample.swapTotal
          point.load = sample.load
          point.memTotalKb = sample.memTotal
          point.memAvailKb = sample.memAvail
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
    setDisks([])
    const tick = async () => {
      try {
        const os = osRef.current || 'linux'
        const res = await execCmdDirect(tab.id, diskCmdFor(os), TIMEOUT, { silent: true }).catch(() => null)
        const out = res && typeof res === 'object' && 'stdout' in res ? res.stdout : res
        const rows = []
        if (os === 'win') {
          String(out).replace(/\r/g, '').trim().split('\n').forEach(line => {
            const [name, used, free, root] = line.split('|')
            const u = parseInt10(used); const fr = parseInt10(free)
            if (!name || !isFinite(u) || !isFinite(fr) || u + fr === 0) return
            rows.push({ mount: (root || name + ':').replace(/\\$/, ''), usedG: u / 1073741824, totalG: (u + fr) / 1073741824 })
          })
        } else {
          String(out).trim().split('\n').forEach(line => {
            const f = line.trim().split(/\s+/)
            if (f.length < 6) return
            const mount = f[5]
            // 极端过滤: k8s 容器内部挂载 + 伪挂载兜底(df -x 已滤大部分)
            if (mount === '/dev' || mount === '/dev/shm' || mount === '/run' || mount.startsWith('/run/user') || mount === '/sys/fs/cgroup' || mount === '/tmp' || mount.includes('kubelet/pods') || mount.includes('containers/storage') || mount.includes('docker/containers') || mount.endsWith('/mounts/shm') || mount.includes('overlay2')) return
            const total = parseInt10(f[1]); const used = parseInt10(f[2])
            if (!isFinite(total) || !isFinite(used) || total === 0) return
            rows.push({ mount, usedG: used / 1048576, totalG: total / 1048576 })
          })
        }
        rows.sort((a, b) => b.totalG - a.totalG)
        setDisks(rows)
      } catch (e) {}
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [isActive, tab && tab.id])

  const last = points[points.length - 1] || {}
  const sample = prevRef.current
  const upSec = sample ? sample.uptimeSec : null
  const upStr = upSec != null
    ? (upSec >= 86400
        ? Math.floor(upSec / 86400) + 'd ' + Math.floor(upSec % 86400 / 3600) + 'h'
        : Math.floor(upSec / 3600) + 'h ' + Math.floor(upSec % 3600 / 60) + 'm')
    : '—'
  const cpu = last.cpu == null ? '—' : last.cpu.toFixed(0) + '%'
  const mem = last.mem == null ? '—' : last.mem.toFixed(0) + '%'
  const memSub = last.memTotalKb > 0
    ? `${((last.memTotalKb - last.memAvailKb) / 1048576).toFixed(1)}G / ${(last.memTotalKb / 1048576).toFixed(1)}G`
    : '— / —'
  const swapOff = last.swapTotal === 0
  const swap = last.swapPct == null ? '未启用' : last.swapPct.toFixed(0) + '%'
  const rx = last.rxKb == null ? '—' : fmtB(last.rxKb) + '/s'
  const tx = last.txKb == null ? '—' : fmtB(last.txKb) + '/s'
  const userHost = tab && tab.username ? tab.username + '@' + tab.host : (tab && tab.host ? tab.host : '—')
  const lv = pct => pct >= 85 ? 'var(--alert,#f2555a)' : pct >= 70 ? 'var(--amber,#ffb454)' : 'var(--signal,#3fd68f)'
  const cpuPct = last.cpu || 0
  const memPct = last.mem || 0
  const disksSorted = [...disks].sort((a, b) => {
    const pa = a.totalG > 0 ? a.usedG / a.totalG : 0
    const pb = b.totalG > 0 ? b.usedG / b.totalG : 0
    return pb - pa
  })
  const disksHot = disksSorted.filter(d => d.totalG > 0 && d.usedG * 100 / d.totalG >= 70)
  const disksCold = disksSorted.filter(d => !(d.totalG > 0 && d.usedG * 100 / d.totalG >= 70))
  const disksShow = [...disksHot, ...disksCold.slice(0, Math.max(0, 3 - disksHot.length))]
  const disksMore = disks.length - disksShow.length

  if (!isActive) {
    return (
      <aside className='anchor-rail'>
        <div className='anchor-rail-sec'>
          <div className='anchor-cap'>TARGET</div>
          <div className='anchor-hint'>暂无活动会话</div>
        </div>
        <div className='anchor-rail-foot'>
          <button className='anchor-rail-settings' onClick={onOpenSettings} title='设置'><SettingOutlined /> 设置</button>
        </div>
      </aside>
    )
  }
  return (
    <aside className='anchor-rail'>
      <div className='anchor-rail-sec anchor-rail-target'>
        <div className='anchor-cap'>TARGET{live ? <span className='live-dot' /> : null}</div>
        <div className='anchor-kv'><span>用户</span><b>{tab && tab.username ? tab.username : '—'}</b></div>
        <div className='anchor-kv'><span>IP</span><b className='ip' title={userHost}>{tab && tab.host ? tab.host : '—'}</b></div>
        <div className='anchor-kv'><span>运行/负载</span><b title={'运行 ' + upStr}>{(last.load || '—').split(' ')[0]}</b></div>
        {
          !live && <div className='anchor-hint'>连接后显示遥测</div>
        }
      </div>
      <div className='anchor-rail-sec anchor-rail-health'>
        <div className='anchor-cap'>HEALTH</div>
        <div className='gauge'>
          <div className='top'><span className='k'>CPU</span><div className='rail'><div style={{ width: cpuPct + '%', background: lv(cpuPct) }} /></div><span className='v' style={{ color: lv(cpuPct) }}>{cpu}</span></div>
        </div>
        <div className='gauge'>
          <div className='top'><span className='k'>内存</span><div className='rail'><div style={{ width: memPct + '%', background: lv(memPct) }} /></div><span className='v' style={{ color: lv(memPct) }}>{mem}</span></div>
        </div>
        <div className='gauge'>
          <div className='top'><span className='k'>{swapOff ? '交换(未启用)' : '交换'}</span><div className='rail'>{swapOff ? null : <div style={{ width: (last.swapPct || 0) + '%', background: lv(last.swapPct || 0) }} />}</div><span className='v' style={{ color: swapOff ? 'var(--fog,#8b98ab)' : lv(last.swapPct || 0) }}>{swapOff ? '—' : swap}</span></div>
        </div>
        {disksHot.length > 0 && (
          <div className='gauge disk-warn'>
            <div className='top'><span className='k'>磁盘告警</span><span className='v' style={{ color: 'var(--alert,#f2555a)' }}>{disksHot.length}</span></div>
          </div>
        )}
      </div>
      <div className='anchor-rail-sec anchor-rail-disk'>
        <div className='anchor-cap'>DISK</div>
        {(() => {
          if (!disks.length) return <div className='anchor-kv'><span>/</span><b>—</b></div>
          const rows = disksShow
          return (
            <>
              {rows.map(d => {
                const pct = d.totalG > 0 ? (d.usedG * 100 / d.totalG) : 0
                const c = lv(pct)
                return (
                  <div className={'anchor-kv disk-line' + (pct > 85 ? ' crit-row' : '')} key={d.mount} title={d.mount + ' ' + d.usedG.toFixed(1) + '/' + d.totalG.toFixed(0) + 'G'}>
                    <span>{shortMount(d.mount)}</span>
                    <div className='rail'><div style={{ width: pct + '%', background: c }} /></div>
                    <b style={{ color: c }}>{pct.toFixed(0)}%</b>
                  </div>
                )
              })}
              {disksMore > 0 && (
                <button className='disk-toggle' onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setDiskPop({ x: r.right + 8, y: Math.min(r.top, window.innerHeight - 420) })
                }}>
                  其他 {disksMore} 个挂载 ▸
                </button>
              )}
              {diskPop && (
                <div className='disk-pop' style={{ left: diskPop.x, top: diskPop.y }}>
                  <div className='disk-pop-cap'>全部挂载 ({disks.length})</div>
                  <div className='disk-pop-list'>
                    {disksSorted.map(d => {
                      const pct = d.totalG > 0 ? (d.usedG * 100 / d.totalG) : 0
                      const c = lv(pct)
                      return (
                        <div className='disk-row' key={d.mount}>
                          <span className='disk-name' title={d.mount}>{d.mount.replace(/\/$/, '')}</span>
                          <div className='disk-col'>
                            <div className='disk-top'>
                              <span className='disk-meta'>{d.usedG.toFixed(1)}/{d.totalG.toFixed(0)}G</span>
                              <span className='disk-pct' style={{ color: c }}>{pct.toFixed(0)}%</span>
                            </div>
                            <div className='disk-rail'><div style={{ width: pct + '%', background: c }} /></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button className='disk-pop-close' onClick={() => setDiskPop(null)}>关闭</button>
                </div>
              )}
            </>
          )
        })()}
      </div>
      <div className='anchor-rail-sec anchor-rail-trend'>
        <div className='anchor-cap'>TREND</div>
        <div className='anchor-tabs'>
          {
            [['cpu', 'CPU'], ['mem', '内存'], ['net', '网络']].map(([k, label]) => (
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
          chartMode === 'net'
            ? (
              <div className='anchor-chart anchor-chart-net'>
                <div className='net-line'>
                  <span className='dir up'>↑</span>
                  <Spark data={points.map(p => p.rxKb)} color='var(--signal,#3fd68f)' />
                </div>
                <div className='net-line'>
                  <span className='dir down'>↓</span>
                  <Spark data={points.map(p => p.txKb)} color='var(--alert,#f2555a)' />
                </div>
              </div>
              )
            : <div className='anchor-chart anchor-chart-sm'><Spark data={points.map(p => p[chartMode])} color={chartMode === 'cpu' ? 'var(--alert,#ff6b6b)' : 'var(--amber,#5c8dff)'} /></div>
        }
      </div>
      <div className='anchor-rail-sec anchor-rail-net'>
        <div className='anchor-cap'>NETWORK</div>
        <div className='net-compact'>
          <span className='pair'><span className='dir up'>↑</span><b>{tx}</b></span>
          <span className='pair'><span className='dir down'>↓</span><b>{rx}</b></span>
        </div>
      </div>
      <div className='anchor-rail-foot'>
        <button className='anchor-rail-settings' onClick={onOpenSettings} title='设置'><SettingOutlined /> 设置</button>
        <div className='foot-version'>ANCHOR v{(window.et && window.et.version) || ''}</div>
      </div>
    </aside>
  )
}
