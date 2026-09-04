/**
 * ANCHOR 布局壳(P0)
 * 左遥测栏 + 右标签/内容区。P0 仅验证壳与 store 桥接,
 * 面板内容在 P1-P5 逐阶段填充(见 docs/PLAN.md)。
 */
import { auto } from 'manate/react'
import { useState, useEffect } from 'react'
import { pick } from 'lodash-es'
import TermSearch from '../terminal/term-search'
import ConnectionManager from '../anchor/connection-manager'
import QuickConnect from '../anchor/quick-connect'
import TermView from '../anchor/term-view'
import BookmarkFormDrawer from '../anchor/bookmark-form-drawer'
import SettingsDrawer from '../anchor/settings-drawer'
import CommandPalette from '../anchor/command-palette'
import MonitorRail from '../anchor/monitor-rail'
import TransferWatcher from '../anchor/transfer-watcher'
import TransferQueue from '../file-transfer/transfer-queue'
import { FolderOpenOutlined, ThunderboltOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { ConfigProvider } from 'antd'
import { isMacJs } from '../../common/constants'
import WindowControl from '../tabs/window-control'
import { initAnchorTheme, toggleAnchorTheme } from '../anchor/anchor-theme'
import './anchor.styl'
import '../anchor/anchor-ui.styl'

export default auto(function Layout (props) {
  const { store } = props
  const {
    tabs
  } = store
  // 自绘标签栏不注册 electerm 的 refsTabs,自行解析当前标签
  const currentTab = tabs.find(t => t.id === store.activeTabId) || null
  const [mgrOpen, setMgrOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formHost, setFormHost] = useState(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState('home') // home=快速连接 | term=终端
  const [theme, setTheme] = useState('dark')
  useEffect(() => {
    setTheme(initAnchorTheme())
  }, [])
  // antd token 跟 ANCHOR 主题(css-var 模式下 body 级覆盖无效, 须内嵌 Provider)
  const antdTheme = {
    token: theme === 'light'
      ? {
          colorPrimary: '#b26a00',
          colorInfo: '#b26a00',
          colorLink: '#b26a00',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorText: '#1c2634',
          colorBorder: '#d4dbe4',
          colorBorderSecondary: '#e6ebf1',
          colorFillSecondary: '#f0f3f7',
          colorFillTertiary: '#f7f9fb',
          colorFillQuaternary: '#fafbfd',
          colorFillContentHover: '#e6ebf1',
          colorTextTertiary: '#8b98ab',
          colorTextQuaternary: '#aab4c2',
          // 动效: 抽屉/弹窗进场更快更跟手
          motionDurationMid: '0.15s',
          motionDurationSlow: '0.2s'
        }
      : {
          colorPrimary: '#ffb454',
          colorInfo: '#ffb454',
          colorLink: '#ffb454',
          colorFillContentHover: '#2a3547',
          colorFillSecondary: '#1c2534',
          colorFillTertiary: '#151c28',
          colorTextTertiary: '#8b98ab',
          // 动效: 抽屉/弹窗进场更快更跟手
          motionDurationMid: '0.15s',
          motionDurationSlow: '0.2s'
        }
  }
  // 劫持旧版“编辑书签”入口(HOST 失败→编辑)，统一走 ANCHOR 主机抽屉
  useEffect(() => {
    const orig = store.openBookmarkEdit
    store.openBookmarkEdit = (item) => {
      setFormHost(item || null)
      setFormOpen(true)
    }
    return () => { store.openBookmarkEdit = orig }
  }, [])
  // Esc 退出全屏(与右上角按钮、alt+f 三条退出路径)
  // capture 阶段监听:window 捕获是事件链第一环,不被任何 stopPropagation 拦截;
  // keyCode 27 兜底(IME 下 key 可能变形为 'Process'/229)
  useEffect(() => {
    const onKey = e => {
      const isEsc = e.key === 'Escape' || e.keyCode === 27
      if (isEsc && store.fullscreen) {
        e.stopPropagation()
        store.toggleSessFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <ConfigProvider theme={antdTheme}>
      <div className='anchor-shell'>
        <div className={`anchor-titlebar ${isMacJs ? 'mac' : 'win'}`}>
          <span className='anchor-titlebar-text'>ANCHOR<i>锚点终端</i></span>
          {!isMacJs ? <WindowControl store={store} /> : null}
        </div>
        <div className='anchor-body'>
          <MonitorRail store={store} tab={currentTab} onOpenSettings={() => setSettingsOpen(true)} />
          <main className='anchor-main'>
            <div className='anchor-tabbar'>
              <button className='anchor-mgr-btn' onClick={() => setMgrOpen(true)}><FolderOpenOutlined /> 连接管理器</button>
              <div className='anchor-tabs'>
                {
              tabs.map(t => {
                return (
                  <div
                    key={t.id}
                    className={'anchor-tab' + (currentTab && currentTab.id === t.id ? ' on' : '')}
                    onClick={() => { store.clickTab(t.id, t.batch ?? store.currentLayoutBatch); setView('term') }}
                  >
                    <span className='dot' />
                    <span>{t.title}</span>
                    <span
                      className='anchor-tab-close'
                      title='关闭'
                      onClick={e => {
                        e.stopPropagation()
                        store.delTab(t.id)
                        if (store.tabs.length === 0) setView('home')
                      }}
                    >
                      ×
                    </span>
                  </div>
                )
              })
            }
              </div>
              <button className='anchor-newtab' title='快速连接' onClick={() => setView('home')}>+</button>
              <div className='anchor-spacer' />
              <button
                className='anchor-theme-btn'
                title='常用命令'
                onClick={() => setCmdOpen(true)}
              >
                <ThunderboltOutlined /> 命令
              </button>
              <button
                className='anchor-theme-btn'
                title='切换昼夜主题'
                onClick={() => setTheme(toggleAnchorTheme())}
              >
                {theme === 'light' ? <><MoonOutlined /> 黑夜</> : <><SunOutlined /> 白天</>}
              </button>
            </div>
            <div className='anchor-content'>
              {
            view === 'term' && store.tabs.length
              ? <TermView store={store} />
              : (
                <QuickConnect
                  store={store}
                  onOpenManager={() => setMgrOpen(true)}
                  onNewHost={() => { setFormHost(null); setFormOpen(true) }}
                  onConnect={() => setView('term')}
                />
                )
          }
            </div>
          </main>
        </div>
        <ConnectionManager
          open={mgrOpen}
          onClose={() => setMgrOpen(false)}
          store={store}
          onNewHost={() => { setFormHost(null); setFormOpen(true) }}
          onConnect={() => setView('term')}
        />
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          store={store}
        />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} store={store} />
        <TransferWatcher store={store} />
        <TransferQueue />
        <BookmarkFormDrawer
          open={formOpen}
          host={formHost}
          store={store}
          onClose={() => setFormOpen(false)}
        />
        {
        store.fullscreen && (
          <button
            className='anchor-fs-exit'
            title='退出全屏 (Esc / alt+f)'
            // onMouseDown 触发:不等 mouseup,避免任何重渲染竞态吞掉 click
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
              store.toggleSessFullscreen(false)
            }}
          >
            ⤡ 退出全屏
          </button>
        )
      }
        <TermSearch
          currentTab={currentTab}
          config={store.config}
          {...pick(store, [
            'activeTabId',
            'termSearchOpen',
            'termSearch',
            'termSearchOptions',
            'termSearchMatchCount',
            'termSearchMatchIndex'
          ])}
        />
      </div>
    </ConfigProvider>
  )
})
