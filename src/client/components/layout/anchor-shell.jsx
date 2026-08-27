/**
 * ANCHOR 壳(P8 布局重构)
 * titlebar(拖拽/红绿灯避让)
 * ┬ IconRail 48px:主机/遥测/设置
 * ├ Sidebar 260px:hosts=主机树 | telemetry=遥测仪表盘
 * ├ Main:tabbar + 终端/快速连接
 * ┴ StatusBar 28px:活动会话摘要
 */
import { auto } from 'manate/react'
import { useState, useEffect, useRef } from 'react'
import { Server, Activity, Settings as SettingsIcon } from 'lucide-react'
import TermView from '../anchor/term-view'
import QuickConnect from '../anchor/quick-connect'
import HostSidebar from '../anchor/host-sidebar'
import TelemetryView from '../anchor/telemetry-view'
import StatusBar from '../anchor/status-bar'
import CommandPalette from '../anchor/command-palette'
import BookmarkFormDrawer from '../anchor/bookmark-form-drawer'
import { initAnchorTheme, toggleAnchorTheme } from '../anchor/anchor-theme'
import useTelemetry from '../anchor/use-telemetry'
import { isMacJs } from '../../common/constants'
import './anchor.styl'
import '../anchor/anchor-ui.styl'

export default auto(function Layout (props) {
  const { store } = props
  const { tabs, config } = store
  // 自绘标签栏不注册 electerm 的 refsTabs,自行解析当前标签
  const currentTab = tabs.find(t => t.id === store.activeTabId) || null
  const [formOpen, setFormOpen] = useState(false)
  const [formHost, setFormHost] = useState(null)
  const [view, setView] = useState('home') // home=快速连接 | term=终端
  const [theme, setTheme] = useState('dark')
  const [cmdOpen, setCmdOpen] = useState(false)
  const [sideView, setSideView] = useState('hosts') // hosts | telemetry
  const tabsRef = useRef(null)

  useEffect(() => {
    setTheme(initAnchorTheme())
  }, [])

  const cfgTheme = store.config.theme
  useEffect(() => {
    // 迁移:旧默认终端主题 → ANCHOR Termius(config 异步加载完成后触发)
    if (cfgTheme === 'default') {
      store.updateConfig({ theme: 'anchorTermius' })
    }
  }, [cfgTheme])

  // 遥测:绑定当前 ssh 会话(侧栏遥测视图或状态条需要)
  const activeSshTab = currentTab && currentTab.host ? currentTab : null
  const telemetry = useTelemetry(activeSshTab ? activeSshTab.id : null, !!activeSshTab)

  // 激活标签滚入可见区(标签多溢出时)
  useEffect(() => {
    const el = tabsRef.current && tabsRef.current.querySelector('.anchor-tab.on')
    el && el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [store.activeTabId, tabs.length])

  return (
    <div className='anchor-shell'>
      {
        !config.useSystemTitleBar && (
          <div className={'anchor-titlebar' + (isMacJs ? ' mac' : '')}>
            <span className='anchor-titlebar-text'>ANCHOR</span>
          </div>
        )
      }
      <div className='anchor-body'>
        {/* 图标导航栏 */}
        <nav className='icon-rail'>
          <button
            className={'icon-rail-btn' + (sideView === 'hosts' ? ' on' : '')}
            title='主机'
            onClick={() => { setSideView('hosts'); setView('home') }}
          >
            <Server size={18} />
          </button>
          <button
            className={'icon-rail-btn' + (sideView === 'telemetry' ? ' on' : '')}
            title='遥测'
            onClick={() => setSideView('telemetry')}
          >
            <Activity size={18} />
          </button>
          <div className='icon-rail-spacer' />
          <button className='icon-rail-btn' title='设置' onClick={() => window.store.openSettingModal()}>
            <SettingsIcon size={18} />
          </button>
        </nav>

        {/* 侧栏:主机树 或 遥测仪表盘 */}
        {
          sideView === 'hosts'
            ? (
              <HostSidebar
                store={store}
                onConnect={() => { setView('term') }}
              />
              )
            : (
              <aside className='host-sidebar telemetry-side'>
                <TelemetryView store={store} telemetry={telemetry} tab={activeSshTab} />
              </aside>
              )
        }

        {/* 主区 */}
        <main className='anchor-main'>
          <div className='anchor-tabbar'>
            <div className='anchor-tabs' ref={tabsRef}>
              {
                tabs.map(t => {
                  return (
                    <div
                      key={t.id}
                      className={'anchor-tab' + (currentTab && currentTab.id === t.id ? ' on' : '')}
                      onClick={() => { store.activeTabId = t.id; setView('term') }}
                    >
                      <span className='dot' />
                      <span>{t.title}</span>
                      <span
                        className='x'
                        title='关闭'
                        onClick={(e) => { e.stopPropagation(); window.store.delTab(t.id) }}
                      >✕
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
              ⚡ 命令
            </button>
            <button
              className='anchor-theme-btn'
              title='切换昼夜主题'
              onClick={() => setTheme(toggleAnchorTheme())}
            >
              {theme === 'light' ? '☾ 黑夜' : '☀ 白天'}
            </button>
          </div>
          <div className='anchor-content'>
            {
              view === 'term' && store.tabs.length
                ? <TermView store={store} />
                : (
                  <QuickConnect
                    store={store}
                    onOpenManager={() => { setSideView('hosts') }}
                    onNewHost={() => { setFormHost(null); setFormOpen(true) }}
                    onConnect={() => setView('term')}
                  />
                  )
            }
          </div>
        </main>
      </div>
      <StatusBar store={store} telemetry={telemetry} tab={activeSshTab} />
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        store={store}
      />
      <BookmarkFormDrawer
        open={formOpen}
        host={formHost}
        store={store}
        onClose={() => setFormOpen(false)}
      />
    </div>
  )
})
