/**
 * ANCHOR 命令面板(P6.5):常用命令的保存与执行
 * 数据/执行复用 electerm:store.quickCommands + runQuickCommandItem
 * (支持 {{clipboard}}/{{time}}/{{date}} 模板、多命令延迟执行)
 */
import React, { useState, useEffect, useRef } from 'react'
import { auto } from 'manate/react'
import { SettingOutlined, CloseOutlined, ThunderboltOutlined } from '@ant-design/icons'
import message from '../common/message'

export default auto(function CommandPalette (props) {
  const { open, onClose, store } = props
  const [kw, setKw] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setKw('')
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50)
    }
  }, [open])

  const cmds = (store.quickCommands || []).filter(q => {
    if (!kw) return true
    return ((q.name || '') + (q.command || '')).toLowerCase().includes(kw.toLowerCase())
  })

  function run (id) {
    // 需有活动终端标签
    if (!store.tabs.some(t => t.id === store.activeTabId)) {
      message.warning('请先连接一个会话')
      return
    }
    store.runQuickCommandItem(id)
    onClose()
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
            onChange={e => setKw(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && cmds.length) run(cmds[0].id)
              if (e.key === 'Escape') onClose()
            }}
          />
          <CloseOutlined className='cp-close' onClick={onClose} />
        </div>
        <div className='cp-list'>
          {
            cmds.length
              ? cmds.map(q => (
                <div
                  key={q.id}
                  className='cp-item'
                  onClick={() => run(q.id)}
                  title={(q.command || '')}
                >
                  <div className='cp-name'>{q.name || '未命名'}</div>
                  <div className='cp-cmd mono'>{q.command}</div>
                </div>
              ))
              : (
                <div className='cp-empty'>
                  <div>{(store.quickCommands || []).length ? '无匹配命令' : '还没有常用命令'}</div>
                  <button className='cp-manage' onClick={() => { onClose(); window.store.openSettingModal(); window.store.settingTab = 'quickCommands' }}>
                    去添加
                  </button>
                </div>
                )
          }
        </div>
        <div className='cp-foot'>
          <span>点击命令发送到当前终端</span>
          <button
            className='cp-manage'
            onClick={() => { onClose(); window.store.openSettingModal(); window.store.settingTab = 'quickCommands' }}
          ><SettingOutlined /> 管理
          </button>
        </div>
      </div>
    </div>
  )
})
