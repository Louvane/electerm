/**
 * ANCHOR 图标导航栏(P8):主机 / 遥测 / 设置
 */
import React from 'react'
import { Server, Activity, Settings } from 'lucide-react'

export default function IconRail (props) {
  const { view, onView, onOpenSettings, hasLive } = props
  const items = [
    { id: 'hosts', icon: <Server size={18} />, label: '主机' },
    { id: 'telemetry', icon: <Activity size={18} />, label: '遥测', live: hasLive }
  ]
  return (
    <nav className="icon-rail">
      {
        items.map(it => (
          <button
            key={it.id}
            className={'icon-rail-btn' + (view === it.id ? ' on' : '')}
            title={it.label}
            onClick={() => onView(it.id)}
          >
            {it.icon}
            {it.live && <span className="rail-live-dot" />}
          </button>
        ))
      }
      <div className="icon-rail-spacer" />
      <button className="icon-rail-btn" title="设置" onClick={onOpenSettings}>
        <Settings size={18} />
      </button>
    </nav>
  )
}
