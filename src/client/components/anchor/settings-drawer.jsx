/**
 * ANCHOR 设置抽屉(A档精简 7项)
 * 直读 store.config, 写 store.setConfig 即落盘
 */
import React from 'react'
import { auto } from 'manate/react'
import { Drawer, Select, Switch, InputNumber } from 'antd'
import { TERM_PRESETS, applyTermBg } from './anchor-theme.js'

export default auto(function SettingsDrawer (props) {
  const { open, onClose, store } = props
  const cfg = store.config || {}
  const set = (k, v) => {
    store.setConfig({ [k]: v })
    if (k === 'terminalPreset') {
      // 终端底/字色 var 即时跟 preset
      applyTermBg()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      closable
      maskClosable
      keyboard
      zIndex={1100}
      styles={{ wrapper: { width: 410 } }}
      title='设置'
      className='settings-drawer'
      destroyOnHidden
    >
      <details className='dr-sec' open>
        <summary>终端</summary>
        <div className='inner'>
          <div className='fld'>
            <label>终端配色</label>
            <Select style={{ flex: 1 }} value={cfg.terminalPreset || 'anchor-dark'} onChange={v => set('terminalPreset', v)}>
              {Object.entries(TERM_PRESETS).map(([k, p]) => (
                <Select.Option key={k} value={k}>{p.name}</Select.Option>
              ))}
            </Select>
          </div>
          <div className='fld'>
            <label>字体大小</label>
            <InputNumber min={10} max={24} value={cfg.fontSize || 16} onChange={v => set('fontSize', v || 16)} style={{ flex: 1 }} />
          </div>
          <div className='fld'>
            <label>字体</label>
            <Select style={{ flex: 1 }} value={cfg.fontFamily || 'Maple Mono, mono, courier-new, courier, monospace'} onChange={v => set('fontFamily', v)}>
              <Select.Option value='Maple Mono, mono, courier-new, courier, monospace'>Maple Mono</Select.Option>
              <Select.Option value='JetBrains Mono, monospace'>JetBrains Mono</Select.Option>
              <Select.Option value='Fira Code, monospace'>Fira Code</Select.Option>
              <Select.Option value='Cascadia Code, monospace'>Cascadia Code</Select.Option>
              <Select.Option value='IBM Plex Mono, monospace'>IBM Plex Mono</Select.Option>
              <Select.Option value='SF Mono, Menlo, monospace'>SF Mono</Select.Option>
              <Select.Option value='Menlo, monospace'>Menlo</Select.Option>
              <Select.Option value='Consolas, monospace'>Consolas</Select.Option>
            </Select>
          </div>
          <div className='fld'>
            <label>光标样式</label>
            <Select style={{ flex: 1 }} value={cfg.cursorStyle || 'block'} onChange={v => set('cursorStyle', v)}>
              <Select.Option value='block'>块状</Select.Option>
              <Select.Option value='underline'>下划线</Select.Option>
              <Select.Option value='bar'>竖线</Select.Option>
            </Select>
          </div>
          <div className='fld'>
            <label>光标闪烁</label>
            <Switch checked={!!cfg.cursorBlink} onChange={v => set('cursorBlink', v)} />
          </div>
          <div className='fld'>
            <label>回滚行数</label>
            <InputNumber min={500} max={50000} step={500} value={cfg.scrollback || 3000} onChange={v => set('scrollback', v || 3000)} style={{ flex: 1 }} />
          </div>
        </div>
      </details>

      <details className='dr-sec' open>
        <summary>连接</summary>
        <div className='inner'>
          <div className='fld'>
            <label>心跳间隔</label>
            <InputNumber min={5000} max={60000} step={1000} value={cfg.keepaliveInterval || 10000} onChange={v => set('keepaliveInterval', v || 10000)} style={{ flex: 1 }} />
          </div>
          <div className='fld'>
            <label>SSH 超时</label>
            <InputNumber min={10000} max={120000} step={5000} value={cfg.sshReadyTimeout || 50000} onChange={v => set('sshReadyTimeout', v || 50000)} style={{ flex: 1 }} />
          </div>
        </div>
      </details>

      <details className='dr-sec' open>
        <summary>行为</summary>
        <div className='inner'>
          <div className='fld'>
            <label>关闭窗口时</label>
            <Select
              style={{ flex: 1 }}
              value={cfg.closeBehavior || 'tray'}
              onChange={v => {
                set('closeBehavior', v)
                // 切到退出程序时, 建议默认开确认(可再手动关)
                if (v === 'quit' && !cfg.confirmBeforeExit) {
                  set('confirmBeforeExit', true)
                }
              }}
            >
              <Select.Option value='tray'>最小化到托盘</Select.Option>
              <Select.Option value='quit'>退出程序</Select.Option>
            </Select>
          </div>
          {(
            (cfg.closeBehavior || 'tray') === 'quit'
              ? (
                <div className='fld'>
                  <label>退出前确认</label>
                  <Switch checked={!!cfg.confirmBeforeExit} onChange={v => set('confirmBeforeExit', v)} />
                </div>
                )
              : null
          )}
        </div>
      </details>
      <div style={{ padding: '14px 4px 4px', color: 'var(--fog,#8b98ab)', fontSize: 11, letterSpacing: 1 }}>
        ANCHOR v{(window.et && window.et.version) || '5.3.3'}
      </div>
    </Drawer>
  )
})
