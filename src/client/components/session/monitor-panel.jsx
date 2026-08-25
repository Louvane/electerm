/**
 * FinalShell 风格实时监控条:CPU / 内存 / 网络速率迷你曲线
 *
 * 数据源:复用当前 SSH 会话的 exec 通道(cat /proc/*),无需新建连接。
 * 仅支持 Linux 远程机;命令失败时静默重试,显示等待文案。
 */
import React, { useEffect, useRef, useState } from 'react'
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { execCmd } from '../terminal/terminal-apis'

const INTERVAL = 2000
const TIMEOUT = 4000
const MAX_POINTS = 60
const CMD = 'cat /proc/stat /proc/meminfo /proc/net/dev 2>/dev/null | head -120'

// 单次采样:cpu jiffies 累计值、内存 kB、网络字节累计值
function parseSample (txt) {
  if (!txt) return null
  const s = {
    cpuTotal: 0,
    cpuIdle: 0,
    memUsedPct: null,
    rx: 0,
    tx: 0
  }
  let memTotal = 0
  let memAvail = 0
  let hasMem = false
  let hasNet = false
  for (const line of String(txt).split('\n')) {
    if (!s.cpuTotal && line.startsWith('cpu ')) {
      const p = line.trim().split(/\s+/).slice(1).map(n => parseInt10(n))
      s.cpuIdle = (p[3] || 0) + (p[4] || 0)
      s.cpuTotal = p.reduce((a, b) => a + (b || 0), 0)
    } else if (line.startsWith('MemTotal:')) {
      memTotal = parseInt10(line.split(/\s+/)[1])
    } else if (line.startsWith('MemAvailable:')) {
      memAvail = parseInt10(line.split(/\s+/)[1])
      hasMem = true
    } else if (line.includes(':') && /\d+/.test(line) && !line.startsWith('Mem')) {
      // /proc/net/dev 行:"  eth0: rx_bytes packets ... tx_bytes ..."
      const [iface, rest] = line.split(':')
      const f = rest.trim().split(/\s+/)
      if (f.length >= 16 && iface.trim() !== 'lo') {
        s.rx += parseInt10(f[0])
        s.tx += parseInt10(f[8])
        hasNet = true
      }
    }
  }
  if (hasMem && memTotal > 0) {
    s.memUsedPct = (memTotal - memAvail) * 100 / memTotal
  }
  return hasNet || s.cpuTotal || hasMem ? s : null
}

function parseInt10 (n) {
  return parseInt(n, 10) || 0
}

// 由相邻两次采样算出一个数据点
function computePoint (prev, cur) {
  const p = {
    cpu: null,
    mem: cur.memUsedPct,
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

// 迷你曲线:纯 SVG polyline,零图表依赖
function Spark ({ data, color }) {
  const vals = data.filter(v => v !== null && v !== undefined)
  const w = 100
  const h = 26
  if (vals.length < 2) {
    return <svg width='100%' height={h} />
  }
  const max = Math.max(...vals, 1) * 1.1
  const pts = data.map((v, i) => {
    const x = i * w / (MAX_POINTS - 1)
    return v === null || v === undefined
      ? null
      : `${x},${h - Math.min(v, max) * h / max}`
  }).filter(p => p).join(' ')
  return (
    <svg width='100%' height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio='none'>
      <polyline points={pts} fill='none' stroke={color} strokeWidth='1.5' />
    </svg>
  )
}

export default function MonitorPanel (props) {
  const { pid, collapsed, onToggle, onClose } = props
  const [points, setPoints] = useState([])
  const prevRef = useRef(null)

  useEffect(() => {
    if (!pid) return undefined
    let alive = true
    let timer = null
    const tick = async () => {
      try {
        const res = await execCmd(pid, CMD, TIMEOUT)
        const out = res && typeof res === 'object' && 'stdout' in res ? res.stdout : res
        const sample = parseSample(out)
        if (sample) {
          const point = computePoint(prevRef.current, sample)
          prevRef.current = sample
          if (alive) {
            setPoints(pts => [...pts.slice(-(MAX_POINTS - 1)), point])
          }
        }
      } catch (e) {
        // 会话未就绪或非 Linux 远程机:静默重试
      }
      if (alive) {
        timer = setTimeout(tick, INTERVAL)
      }
    }
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [pid])

  const last = points[points.length - 1] || {}
  const cpu = last.cpu == null ? '--' : `${last.cpu.toFixed(0)}%`
  const mem = last.mem == null ? '--' : `${last.mem.toFixed(0)}%`
  const net = last.rxKb == null
    ? '--'
    : `↓${last.rxKb < 1024 ? last.rxKb.toFixed(1) + 'K' : (last.rxKb / 1024).toFixed(1) + 'M'} ↑${
        last.txKb < 1024 ? last.txKb.toFixed(1) + 'K' : (last.txKb / 1024).toFixed(1) + 'M'}`

  if (collapsed) {
    return (
      <div className='monitor-strip collapsed' onClick={onToggle}>
        <CaretRightOutlined /> 监控
        <span className='monitor-val'>{cpu}</span>
        <span className='monitor-val'>{mem}</span>
        <span className='monitor-val'>{net}</span>
      </div>
    )
  }

  return (
    <div className='monitor-strip'>
      <div className='monitor-header'>
        <span className='monitor-title pointer' onClick={onToggle}>
          <CaretDownOutlined /> 监控
        </span>
        <CloseOutlined className='pointer monitor-close' onClick={onClose} />
      </div>
      <div className='monitor-body'>
        <div className='monitor-item'>
          <div className='monitor-label'>CPU <span className='monitor-val'>{cpu}</span></div>
          <Spark data={points.map(p => p.cpu)} color='var(--success)' />
        </div>
        <div className='monitor-item'>
          <div className='monitor-label'>MEM <span className='monitor-val'>{mem}</span></div>
          <Spark data={points.map(p => p.mem)} color='var(--primary)' />
        </div>
        <div className='monitor-item'>
          <div className='monitor-label'>NET <span className='monitor-val'>{net}</span></div>
          <Spark data={points.map(p => p.rxKb)} color='var(--warn)' />
        </div>
      </div>
    </div>
  )
}
