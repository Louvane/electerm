/**
 * ANCHOR 底部状态条(P8):活动会话摘要常驻(FinalShell 灵魂)
 * 数据复用 useTelemetry 轮询结果,由壳传入。
 */
import React from 'react'
import { Activity } from 'lucide-react'

function fmtB (n) {
  return n > 1024 ? (n / 1024).toFixed(1) + 'K' : n.toFixed(0) + 'B'
}

export default function StatusBar (props) {
  const { store, telemetry } = props
  const tab = store.tabs.find(t => t.id === store.activeTabId)
  const isSsh = !!(tab && tab.host)
  const { last, live } = telemetry || {}

  if (!isSsh || !tab) {
    return (
      <div className="anchor-statusbar idle">
        <span>就绪</span>
        <span className="sb-right">{store.tabs.length} 个标签</span>
      </div>
    )
  }

  return (
    <div className="anchor-statusbar">
      <span className={'sb-dot' + (live ? ' on' : '')} />
      <span className="sb-host">{tab.username || ''}@{tab.host}</span>
      {
        live
          ? (
            <>
              <span className="sb-item">CPU <b>{last.cpu == null ? '—' : last.cpu.toFixed(0) + '%'}</b></span>
              <span className="sb-item">内存 <b>{last.mem == null ? '—' : last.mem.toFixed(0) + '%'}</b></span>
              <span className="sb-item net">
                ↑ <b>{last.txKb == null ? '—' : fmtB(last.txKb) + '/s'}</b>
                {'  '}↓ <b>{last.rxKb == null ? '—' : fmtB(last.rxKb) + '/s'}</b>
              </span>
            </>
            )
          : <span className="sb-item dim">遥测连接中…</span>
      }
      <span className="sb-right mono">{tab.status || ''}</span>
    </div>
  )
}
