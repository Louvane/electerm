/**
 * ANCHOR 布局壳(P0)
 * 左遥测栏 + 右标签/内容区。P0 仅验证壳与 store 桥接,
 * 面板内容在 P1-P5 逐阶段填充(见 docs/PLAN.md)。
 */
import { auto } from 'manate/react'
import { useState } from 'react'
import ConnectionManager from '../anchor/connection-manager'
import QuickConnect from '../anchor/quick-connect'
import BookmarkFormDrawer from '../anchor/bookmark-form-drawer'
import './anchor.styl'
import '../anchor/anchor-ui.styl'

export default auto(function Layout (props) {
  const { store } = props
  const {
    tabs, currentTab, config
  } = store
  const [mgrOpen, setMgrOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formHost, setFormHost] = useState(null)

  return (
    <div className='anchor-shell'>
      <aside className='anchor-rail'>
        <div className='anchor-logo'>ANCHOR<i>锚点终端</i></div>
        <div className='anchor-rail-sec'>
          <div className='anchor-cap'>TARGET</div>
          <div className='anchor-kv'><span>标签</span><b>{currentTab ? currentTab.title : '—'}</b></div>
          <div className='anchor-kv'><span>主题</span><b>{config.theme}</b></div>
        </div>
        <div className='anchor-rail-foot'>P0 · 骨架冒烟</div>
      </aside>
      <main className='anchor-main'>
        <div className='anchor-tabbar'>
          <button className='anchor-mgr-btn' onClick={() => setMgrOpen(true)}>📁 连接管理器</button>
          <div className='anchor-tabs'>
            {
              tabs.map(t => {
                return (
                  <div
                    key={t.id}
                    className={'anchor-tab' + (currentTab && currentTab.id === t.id ? ' on' : '')}
                    onClick={() => { store.activeTabId = t.id }}
                  >
                    <span className='dot' />
                    <span>{t.title}</span>
                  </div>
                )
              })
            }
          </div>
          <button className='anchor-newtab'>+</button>
          <div className='anchor-spacer' />
        </div>
        <div className='anchor-content'>
          <QuickConnect
            store={store}
            onOpenManager={() => setMgrOpen(true)}
            onNewHost={() => { setFormHost(null); setFormOpen(true) }}
          />
        </div>
      </main>
      <ConnectionManager
        open={mgrOpen}
        onClose={() => setMgrOpen(false)}
        store={store}
        onNewHost={() => { setFormHost(null); setFormOpen(true) }}
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
