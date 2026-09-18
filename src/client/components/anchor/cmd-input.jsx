/**
 * ANCHOR 终端命令输入条
 * 交互终端下方常驻输入框:回车发送到当前激活终端(走 attachAddon,同键盘输入);
 * 历史按钮弹出最近命令,点击回填;↑/↓ 在输入框内翻历史。
 */
import React, { useState, useRef, useCallback } from 'react'
import { HistoryOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { refs } from '../common/ref'

const HIS_KEY = 'anchor-cmd-input-history'

function loadHis () {
  try {
    const arr = JSON.parse(window.localStorage.getItem(HIS_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

export default function CmdInput ({ store }) {
  const [cmd, setCmd] = useState('')
  const [hisOpen, setHisOpen] = useState(false)
  const [hisIdx, setHisIdx] = useState(-1) // -1 = 未进入历史浏览
  const his = useRef(loadHis())
  const inputRef = useRef(null)

  const send = useCallback(() => {
    const c = cmd.trim()
    if (!c) return
    const tabId = store.activeTabId
    const term = tabId && refs.get('term-' + tabId)
    if (!term || !term.batchInput) return
    term.batchInput(c)
    // 写历史(去重,最新在前,上限 200)
    his.current = [c, ...his.current.filter(x => x !== c)].slice(0, 200)
    try {
      window.localStorage.setItem(HIS_KEY, JSON.stringify(his.current))
    } catch (e) {}
    setCmd('')
    setHisIdx(-1)
  }, [cmd, store.activeTabId])

  const pickHis = useCallback((c) => {
    setCmd(c)
    setHisOpen(false)
    setHisIdx(-1)
    setTimeout(() => inputRef.current && inputRef.current.focus(), 30)
  }, [])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      send()
    } else if (e.key === 'ArrowUp') {
      // 已输入内容时优先让光标移动(多行不适用,单行输入框直接翻历史)
      e.preventDefault()
      const h = his.current
      if (!h.length) return
      const ni = Math.min(hisIdx + 1, h.length - 1)
      setHisIdx(ni)
      setCmd(h[ni])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (hisIdx < 0) return
      const ni = hisIdx - 1
      setHisIdx(ni)
      setCmd(ni < 0 ? '' : his.current[ni])
    }
  }, [send, hisIdx])

  const tabOk = !!(store.activeTabId && store.tabs.some(t => t.id === store.activeTabId && (t.host || t.type === 'local')))

  return (
    <div className='anchor-cmd-input'>
      <button
        className={'anchor-cmd-his-btn' + (hisOpen ? ' on' : '')}
        title='历史命令'
        onClick={() => setHisOpen(o => !o)}
      >
        <HistoryOutlined />
      </button>
      <input
        ref={inputRef}
        className='anchor-cmd-field'
        placeholder={tabOk ? '输入命令,Enter 发送到当前终端' : '无活动终端'}
        value={cmd}
        disabled={!tabOk}
        onChange={e => { setCmd(e.target.value); setHisIdx(-1) }}
        onKeyDown={onKeyDown}
      />
      <button
        className={'anchor-cmd-send-btn' + (cmd.trim() && tabOk ? ' ready' : '')}
        title='发送 (Enter)'
        onClick={send}
        disabled={!cmd.trim() || !tabOk}
      >
        <ThunderboltOutlined />
      </button>
      {
        hisOpen && (
          <div className='anchor-cmd-his-pop'>
            <div className='anchor-cmd-his-head'>
              <span>历史命令</span>
              <button
                className='anchor-cmd-his-clear'
                title='清空历史'
                onClick={() => { his.current = []; window.localStorage.removeItem(HIS_KEY); setHisOpen(false) }}
              >
                清空
              </button>
            </div>
            <div className='anchor-cmd-his-list'>
              {
                his.current.length
                  ? his.current.map((c, i) => (
                    <div key={c + i} className='anchor-cmd-his-item' onClick={() => pickHis(c)}>
                      {c}
                    </div>
                  ))
                  : <div className='anchor-cmd-his-empty'>暂无历史</div>
              }
            </div>
          </div>
        )
      }
    </div>
  )
}
