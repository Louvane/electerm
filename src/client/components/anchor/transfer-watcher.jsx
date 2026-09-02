/**
 * ANCHOR 全局传输观察者(P8)
 * - 传输引擎在 store.fileTransfers, 与 SFTP 面板解耦: 面板开/关/切模式不断传输
 * - 面板可见: 面板内顶部条(sftp-entry)看进度; 完成失败发全局 message
 * - 面板不可见: 右下角迷你浮条(文件名+%+速度+计数), 点击聚焦该 tab 并开 SFTP
 * - 完成批量合并通知(1.2s 窗口), 防多文件刷屏
 */
import React, { useEffect, useRef, useState } from 'react'
import { notify } from './anchor-notify'
import { CloudUploadOutlined, CloseOutlined } from '@ant-design/icons'

const POLL = 800
const FLUSH_MS = 1200

function fileNameOf (t) {
  const p = t.fromPathReal || t.fromPath || t.toPath || ''
  return String(p).split('/').pop() || String(p)
}

export default function TransferWatcher (props) {
  const { store } = props
  const [mini, setMini] = useState(null) // {tabId, name, count, pct, speed}
  const seenRef = useRef(new Map()) // id -> true
  const notifiedRef = useRef(new Set()) // 已通知 history id
  const pendingRef = useRef([])
  const flushRef = useRef(null)
  const closedRef = useRef(false)

  useEffect(() => {
    closedRef.current = false
    const tick = () => {
      const trs = (store.fileTransfers || []).filter(t => t.inited)
      // 1) 消失检测 -> 完成/失败(去 history 找结果)
      const ids = new Set(trs.map(t => t.id))
      for (const id of seenRef.current.keys()) {
        if (ids.has(id)) continue
        seenRef.current.delete(id)
        const h = (store.transferHistory || []).find(x => x.id === id)
        if (!h || notifiedRef.current.has(id)) continue
        notifiedRef.current.add(id)
        pendingRef.current.push({
          name: fileNameOf(h),
          error: h.error || null
        })
      }
      if (pendingRef.current.length && !flushRef.current) {
        flushRef.current = setTimeout(() => {
          flushRef.current = null
          const items = pendingRef.current
          pendingRef.current = []
          const ok = items.filter(i => !i.error)
          const bad = items.filter(i => i.error)
          if (ok.length === 1) notify('success', `传输完成 ${ok[0].name}`)
          else if (ok.length > 1) notify('success', `${ok.length} 个文件传输完成`)
          if (bad.length === 1) notify('error', `传输失败 ${bad[0].name} · ${String(bad[0].error).slice(0, 60)}`)
          else if (bad.length > 1) notify('error', `${bad.length} 个文件传输失败`)
        }, FLUSH_MS)
      }
      // 2) 迷你条: 仅当传输所属 tab 的 SFTP 面板不可见
      trs.forEach(t => seenRef.current.set(t.id, true))
      const invisible = trs.filter(t => {
        const tab = (store.tabs || []).find(x => x.id === t.tabId)
        if (!tab) return false
        const panelVisible = (tab.pane === 'fileManager' || tab.sshSftpSplitView) &&
          store.activeTabId === tab.id
        return !panelVisible
      })
      if (invisible.length) {
        let all = 0
        let done = 0
        invisible.forEach(t => {
          all += (t.fromFile && t.fromFile.size) || 0
          done += t.transferred || 0
        })
        const first = invisible[0]
        setMini({
          tabId: first.tabId,
          name: fileNameOf(first),
          count: invisible.length,
          pct: all > 0 ? Math.min(99, Math.floor(done * 100 / all)) : 0,
          speed: first.speed || ''
        })
      } else if (mini) {
        setMini(null)
      }
      if (!closedRef.current) timer = setTimeout(tick, POLL)
    }
    let timer = setTimeout(tick, POLL)
    return () => {
      closedRef.current = true
      clearTimeout(timer)
      clearTimeout(flushRef.current)
    }
  }, [store])

  if (!mini) return null

  const openPanel = () => {
    store.activeTabId = mini.tabId
    store.editTab(mini.tabId, { pane: 'fileManager' })
  }

  return (
    <div className='anchor-transfer-float' onClick={openPanel} title='点击打开 SFTP 面板'>
      <div className='atf-top'>
        <span className='atf-name'><CloudUploadOutlined /> {mini.name}{mini.count > 1 ? ` 等 ${mini.count} 项` : ''}</span>
        <span className='atf-meta'>{mini.pct}%{mini.speed ? ` · ${mini.speed}` : ''}</span>
      </div>
      <div className='atf-rail'><div className='atf-bar' style={{ width: mini.pct + '%' }} /></div>
      <span
        className='atf-close' title='隐藏(传输继续)'
        onClick={e => { e.stopPropagation(); setMini(null) }}
      >
        <CloseOutlined />
      </span>
    </div>
  )
}
