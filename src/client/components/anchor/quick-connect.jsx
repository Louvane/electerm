/**
 * ANCHOR 快速连接页(P3)
 * 历史列表(anchor-api.getRecents,新在前)+ 双击连接 + 清空 + 空状态引导。
 * 状态点 = 该主机当前有活跃会话标签(srcId 匹配)。
 */
import React from 'react'
import { auto } from 'manate/react'
import message from '../common/message'
import { getRecents, clearRecents } from '../../common/anchor-api'

export default auto(function QuickConnect (props) {
  const { store, onOpenManager, onNewHost } = props
  const recents = getRecents(store)
  const openIds = new Set(
    store.tabs.filter(t => t.srcId).map(t => t.srcId)
  )
  // 去重:同一 host:port:username 仅保留最新一条
  const dedupedRecents = (() => {
    const seen = new Set()
    const out = []
    for (const h of recents) {
      const k = `${h.host}:${h.port || 22}:${h.username || ''}`
      if (!seen.has(k)) {
        seen.add(k)
        out.push(h)
      }
    }
    return out
  })()
  // 无历史时回退展示全部主机(按名称排序),消灭空尴尬态
  const allHosts = store.bookmarks.filter(b => !b.folder)
  const useAll = dedupedRecents.length === 0 && allHosts.length > 0
  const rows = useAll
    ? [...allHosts].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    : dedupedRecents
  // history 的 tab 副本不含 srcId(被 tabPropertiesExcludes 剥离),
  // 按 host+username 反查书签 id
  const bidOf = (h) => {
    const b = store.bookmarks.find(b => b.host === h.host && (b.username || '') === (h.username || ''))
    return b ? b.id : null
  }

  return (
    <div className='page-home'>
      <div className='home-head'>
        <h1>快速连接</h1>
      </div>
      <div className='qc-panel'>
        <div className='qc-toolbar'>
          <span className='cap'>{useAll ? 'ALL HOSTS' : 'RECENT'}</span>
          <span className='n'>{rows.length}</span>
          <span className='sp' />
          <button className='hint' onClick={onOpenManager}>全部主机</button>
          {
            !useAll && <button className='hint' onClick={() => clearRecents(store)}>清空记录</button>
          }
        </div>
        {
          rows.length
            ? rows.map(h => {
              return (
                <div
                  key={h.historyId}
                  className={'qc-row' + (openIds.has(bidOf(h)) ? ' open' : '')}
                  onDoubleClick={() => {
                    const bid = bidOf(h)
                    if (bid) {
                      store.onSelectBookmark(bid)
                      props.onConnect && props.onConnect()
                    } else {
                      message.info('该记录对应的主机已不存在')
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (h.id && store.bookmarks.find(b => b.id === h.id)) {
                      // 仅书签主机支持右键编辑(历史可能来自已删除主机)
                      props.onHostContext && props.onHostContext(e, h.id)
                    }
                  }}
                >
                  <span className='st' />
                  <span className='nm'>{h.title || h.host}</span>
                  <span className='ip mono'>{h.host}</span>
                  <span className='usr mono'>{h.username || ''}</span>
                </div>
              )
            })
            : (
              <div className='qc-empty'>
                <div className='big'>暂无主机</div>
                <div className='acts'>
                  <button className='anchor-btn pri' onClick={onOpenManager}>打开连接管理器</button>
                  <button className='anchor-btn' onClick={onNewHost}>新建主机</button>
                </div>
              </div>
              )
        }
      </div>

    </div>
  )
})
