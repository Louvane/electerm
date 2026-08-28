/**
 * ANCHOR 命令面板(P6.5):常用命令的保存与执行
 * 数据/执行复用 electerm:store.quickCommands + runQuickCommandItem
 * (支持 {{clipboard}}/{{time}}/{{date}} 模板、多命令延迟执行)
 */
import React, { useState, useEffect, useRef } from 'react'
import { auto } from 'manate/react'
import { CloseOutlined, ThunderboltOutlined, FormOutlined, EditOutlined } from '@ant-design/icons'
import message from '../common/message'
import { addQuickCommand, editQuickCommand, delQuickCommand } from './anchor-qm-api'

export default auto(function CommandPalette (props) {
  const { open, onClose, store } = props
  const [kw, setKw] = useState('')
  const [selIdx, setSelIdx] = useState(0)
  const [editing, setEditing] = useState(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const freq = (() => {
    try { return JSON.parse(window.localStorage.getItem('anchor-cmd-freq') || '{}') } catch (e) { return {} }
  })()
  const bumpFreq = (id) => {
    freq[id] = (freq[id] || 0) + 1
    window.localStorage.setItem('anchor-cmd-freq', JSON.stringify(freq))
  }

  useEffect(() => {
    if (open) {
      setKw('')
      setSelIdx(0)
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('.cp-item.sel')
    el && el.scrollIntoView({ block: 'nearest' })
  }, [selIdx, kw])

  // 键盘导航(搜索框内捕获):↑↓ 选中 / Enter 执行选中
  function onSearchKey (e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = cmds.length
      if (!n) return
      const i = selIdx >= n ? 0 : selIdx
      setSelIdx(e.key === 'ArrowDown' ? Math.min(n - 1, i + 1) : Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      if (cmds[selIdx]) run(cmds[selIdx].id)
    }
  }

  const cmds = (store.quickCommands || []).filter(q => {
    if (!kw) return true
    return ((q.name || '') + (q.command || '')).toLowerCase().includes(kw.toLowerCase())
  }).sort((a, b) => {
    const fa = freq[a.id] || 0
    const fb = freq[b.id] || 0
    if (fa !== fb) return fb - fa
    return (a.name || '').localeCompare(b.name || '')
  })

  function run (id) {
    if (!store.tabs.some(t => t.id === store.activeTabId)) {
      message.warning('请先连接一个会话')
      return
    }
    bumpFreq(id)
    store.runQuickCommandItem(id)
    onClose()
  }

  function saveEditing () {
    const command = (editing.command || '').trim()
    if (!command) { message.warning('命令不能为空'); return }
    const name = (editing.name || '').trim() || command
    if (editing.id) {
      editQuickCommand(store, editing.id, { name, command })
      message.success('已保存')
    } else {
      addQuickCommand(store, { name, command })
      message.success('已添加')
    }
    setEditing(null)
  }

  function delCmd (id, e) {
    console.log('[anchor:delCmd]', id)
    e.stopPropagation()
    const q = (store.quickCommands || []).find(x => x.id === id)
    delQuickCommand(store, { id })
    message.open({
      duration: 5,
      content: '已删除 ' + (q ? (q.name || q.command) : ''),
      action: {
        label: '撤销',
        onClick: () => {
          addQuickCommand(store, q)
          message.success('已恢复')
        }
      }
    })
  }

  if (!open) return null

  return (
    <div className='cmd-palette' onClick={onClose}>
      <div className='cmd-palette-box' onClick={e => e.stopPropagation()}>
        <div className='cp-head'>
          <ThunderboltOutlined style={{ color: 'var(--amber,#5c8dff)' }} />
          <input
            ref={inputRef}
            className='cp-search'
            placeholder='搜索命令…'
            value={kw}
            onChange={e => { setKw(e.target.value); setSelIdx(0) }}
            onKeyDown={onSearchKey}
          />
          <CloseOutlined className='cp-close' onClick={onClose} />
        </div>
        <div className='cp-list'>
          {
            editing && (
              <div className='cp-edit'>
                <input
                  className='cp-edit-name'
                  placeholder='名称'
                  value={editing.name}
                  onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Escape' && setEditing(null)}
                />
                <input
                  className='cp-edit-cmd mono'
                  placeholder='命令,如 df -h'
                  value={editing.command}
                  onChange={e => setEditing(ed => ({ ...ed, command: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEditing()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
                <div className='cp-edit-ops'>
                  <button onClick={saveEditing}>保存 (Enter)</button>
                  <button onClick={() => setEditing(null)}>取消 (Esc)</button>
                </div>
              </div>
            )
          }
          {
            cmds.length
              ? cmds.map((q, i) => (
                <div
                  key={q.id}
                  className={'cp-item' + (i === Math.min(selIdx, cmds.length - 1) ? ' sel' : '')}
                  onClick={() => run(q.id)}
                  title={(q.command || '')}
                >
                  <div className='cp-row'>
                    <div className='cp-name'>{q.name || '未命名'}</div>
                    <span className='cp-ops'>
                      <EditOutlined
                        onClick={(e) => { e.stopPropagation(); setEditing({ id: q.id, name: q.name || '', command: q.command || '' }) }}
                      />
                      <CloseOutlined onClick={(e) => delCmd(q.id, e)} />
                    </span>
                  </div>
                  <div className='cp-cmd mono'>
                    {q.command}
                    {freq[q.id] ? <span className='cp-freq'>×{freq[q.id]}</span> : null}
                  </div>
                </div>
              ))
              : (
                <div className='cp-empty'>
                  <div>{(store.quickCommands || []).length ? '无匹配命令' : '还没有常用命令'}</div>
                  <button className='cp-manage' onClick={() => setEditing({ id: null, name: '', command: '' })}>
                    新建命令
                  </button>
                </div>
                )
          }
        </div>
        <div className='cp-foot'>
          <span>点击发送到当前终端 · Enter 执行首个</span>
          <button className='cp-manage' onClick={() => setEditing({ id: null, name: '', command: '' })}>
            <FormOutlined /> 新建命令
          </button>
        </div>
      </div>
    </div>
  )
})
