/**
 * ANCHOR 遥测视图(P8):侧栏「遥测」图标对应的主区仪表盘(宽版)
 * 数据由壳的 useTelemetry 传入。
 */
import React from 'react'

function Spark ({ data, color }) {
  const vals = data.filter(v => v !== null && v !== undefined)
  const w = 100
  const h = 40
  if (vals.length < 2) return <svg width="100%" height={h} />
  const max = Math.max(...vals, 1) * 1.1
  const pts = data.map((v, i) => {
    if (v === null || v === undefined) return null
    return `${i * w / 59},${h - Math.min(v, max) * h / max}`
  }).filter(Boolean).join(' ')
  const lx = (vals.length - 1) * w / 59
  const ly = h - Math.min(vals[vals.length - 1], max) * h / max
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="1.5" />
      <circle cx={lx} cy={ly} r="2.5" style={{ fill: color }} />
    </svg>
  )
}

export default function TelemetryView (props) {
  const { store, telemetry, tab } = props
  const { points, last } = telemetry || {}
  const cpu = last.cpu == null ? '—' : last.cpu.toFixed(0) + '%'
  const mem = last.mem == null ? '—' : last.mem.toFixed(0) + '%'
  const swap = last.swap == null ? '—' : last.swap.toFixed(0) + '%'
  const fmtB = n => n > 1024 ? (n / 1024).toFixed(1) + 'K' : n.toFixed(0) + 'B'
  const rx = last.rxKb == null ? '—' : fmtB(last.rxKb) + '/s'
  const tx = last.txKb == null ? '—' : fmtB(last.txKb) + '/s'

  return (
    <div className="telemetry-view">
      <div className="tv-head">
        <span className="tv-title">{tab ? tab.title : ''} · 遥测</span>
        <span className="tv-host">{tab && tab.host ? tab.host : ''}</span>
      </div>
      <div className="tv-grid">
        <div className="tv-card">
          <div className="tv-cap">CPU</div>
          <Spark data={points.map(p => p.cpu)} color="#5c8dff" />
          <div className="tv-val">{cpu}</div>
        </div>
        <div className="tv-card">
          <div className="tv-cap">内存</div>
          <Spark data={points.map(p => p.mem)} color="#3fd68f" />
          <div className="tv-val">{mem}</div>
        </div>
        <div className="tv-card">
          <div className="tv-cap">网络 ↓</div>
          <Spark data={points.map(p => p.rxKb)} color="#7fdbca" />
          <div className="tv-val">{rx}</div>
        </div>
        <div className="tv-card">
          <div className="tv-cap">负载</div>
          <div className="tv-big">{last.load || '—'}</div>
          <div className="tv-sub">交换 {swap}</div>
        </div>
      </div>
    </div>
  )
}
