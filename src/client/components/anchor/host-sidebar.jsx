/**
 * ANCHOR 主机侧栏(P8):常驻树,替代原连接管理器弹窗
 * 搜索/右键菜单/内联编辑/键盘导航全部保留;连接后关闭窗口逻辑随弹窗退役
 */
import React, { useState, useEffect, useRef } from 'react'
import { Search, Plus, FolderPlus, Folder, HardDrive } from 'lucide-react'
import { Modal, message } from 'antd'
import {
  getBookmarkTree,
  getBookmarks,
  upsertBookmark,
  delBookmark,
  copyBookmark,
  addGroup,
  renameGroup,
  moveBookmark,
  moveGroup,
  delGroup,
  groupPaths,
  getBookmarkGroupId
} from '../../common/anchor-api'
import BookmarkFormDrawer from './bookmark-form-drawer'

const esc = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function hl (text, kw) {
  const t = String(text || '')
  if (!kw) return esc(t)
  const i = t.toLowerCase().indexOf(kw.toLowerCase())
  if (i < 0) return esc(t)
  return esc(t.slice(0, i)) + '<mark>' + esc(t.substr(i, kw.length)) + '</mark>' + esc(t.slice(i + kw.length))
}

export default function HostSidebar (props) {
  const { store } = props
  const [kw, setKw] = useState('')
  const [expanded, setExpanded] = useState({ default: true })
  const [sel, setSel] = useState(null)
  const [editId, setEditId] = useState(null)
  const [pendingDir, setPendingDir] = useState(null)
  const [menu, setMenu] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formHost, setFormHost] = useState(null)
  const [formGroupId, setFormGroupId] = useState(null)
  const treeRef = useRef(null)

  const tree = getBookmarkTree(store)
  const bookmarks = getBookmarks(store)

  const flat = []
  const walkFlat = (nodes, expandedMap, kwArg) => {
    for (const n of nodes) {
      const all = JSON.stringify(n).toLowerCase()
      if (kwArg && !all.includes(kwArg.toLowerCase())) continue
      const isOpen = expandedMap[n.id] || !!kwArg
      flat.push({ kind: 'dir', id: n.id, title: n.title, isOpen })
      if (isOpen) {
        walkFlat(n.children, expandedMap, kwArg)
        for (const h of n.hosts) {
          if (kwArg && !((h.title || '') + (h.host || '') + (h.username || '')).toLowerCase().includes(kwArg.toLowerCase())) continue
          flat.push({ kind: 'host', id: h.id, title: h.title, host: h.host, username: h.username })
        }
      }
    }
  }
  walkFlat(tree, expanded, kw)

  useEffect(() => {
    const h = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return
      const idx = sel ? flat.findIndex(n => n.kind === sel.kind && n.id === sel.id) : -1
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const ni = e.key === 'ArrowDown' ? Math.min(flat.length - 1, idx + 1) : Math.max(0, idx <= 0 ? 0 : idx - 1)
        setSel(flat[ni])
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!sel || sel.kind !== 'dir') return
        e.preventDefault()
        setExpanded(m => ({ ...m, [sel.id]: e.key === 'ArrowRight' }))
      } else if (e.key === 'Enter') {
        if (!sel) return
        e.preventDefault()
        if (sel.kind === 'host') connect(sel.id)
        else setExpanded(m => ({ ...m, [sel.id]: !m[sel.id] }))
      } else if (e.key === 'F2') {
        if (!sel) return
        e.preventDefault()
        setEditId(sel.id)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!sel) return
        e.preventDefault()
        sel.kind === 'host' ? delHost(sel.id) : askDelDir(sel.id)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  useEffect(() => {
    if (!menu) return undefined
    const h = () => setMenu(null)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [menu])

  function connect (hostId) {
    store.onSelectBookmark(hostId)
    props.onConnect && props.onConnect()
  }

  function selHost (id) {
    return bookmarks.find(b => b.id === id)
  }
  function dirTitle (id) {
    const found = (function find (nodes) {
      for (const n of nodes) {
        if (n.kind === 'dir' && n.id === id) return n.title
        const r = find(n.children)
        if (r) return r
      }
      return null
    })(tree)
    return found || ''
  }

  function delHost (id) {
    const h = selHost(id)
    if (!h) return
    const gid = getBookmarkGroupId(store, id)
    delBookmark(store, id)
    message.open({
      duration: 5,
      content: (
        <span style={{ display: 'inline-flex', gap: 14, alignItems: 'center' }}>
          已删除 {h.title || h.host}
          <button
            style={{ border: 'none', background: 'none', color: '#5c8dff', cursor: 'pointer' }}
            onClick={() => {
              upsertBookmark(store, h, gid)
              message.success('已恢复')
            }}
          >撤销
          </button>
        </span>
      )
    })
  }

  function askDelDir (id) {
    const title = dirTitle(id)
    let hosts = 0
    let dirs = 0
    const count = (nodes) => {
      for (const n of nodes) {
        if (n.id === id) {
          const walkCnt = (x) => {
            hosts += x.hosts.length
            dirs += x.children.length
            x.children.forEach(walkCnt)
          }
          walkCnt(n)
          break
        }
        count(n.children)
      }
    }
    count(tree)
    if (!hosts && !dirs) {
      delGroup(store, id)
      message.success('已删除空分组')
      return
    }
    Modal.confirm({
      title: '确认删除分组',
      content: `「${title}」内含 ${hosts} 台主机、${dirs} 个子分组。删除后它们将上移一级。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        delGroup(store, id)
        message.success('已删除分组,子项已上移')
      }
    })
  }

  function commitRename (id, kind, value) {
    const name = value.trim()
    if (name) {
      kind === 'dir' ? renameGroup(store, id, name) : upsertBookmark(store, { id, title: name })
    }
    setEditId(null)
  }

  function countAll (n) {
    return n.hosts.length + n.children.reduce((a, c) => a + countAll(c), 0)
  }

  function renderTree (nodes, depth, path) {
    return nodes.map(n => {
      const p = path + '/' + n.title
      const all = JSON.stringify(n).toLowerCase()
      if (kw && !all.includes(kw.toLowerCase())) return null
      const isOpen = n.id === 'root' ? true : (expanded[n.id] || !!kw)
      const isSel = sel && sel.kind === 'dir' && sel.id === n.id
      const empty = !n.children.length && !n.hosts.length && !kw
      return (
        <React.Fragment key={n.id}>
          <div
            className={'tnode' + (isSel ? ' sel' : '')}
            style={{ paddingLeft: depth * 14 + 4 }}
            onClick={() => setSel({ kind: 'dir', id: n.id })}
            onContextMenu={(e) => {
              e.preventDefault()
              setSel({ kind: 'dir', id: n.id })
              setMenu({ x: e.clientX, y: e.clientY, node: { kind: 'dir', id: n.id, path: p }, view: 'main' })
            }}
          >
            <span
              className={'arrow' + (isOpen ? ' open' : '')}
              onClick={(e) => { e.stopPropagation(); setExpanded(m => ({ ...m, [n.id]: !m[n.id] })) }}
            >▶
            </span>
            <Folder size={14} />
            <span className='lbl dir' dangerouslySetInnerHTML={{ __html: hl(n.title, kw) }} />
            <span className='cnt'>{countAll(n)}</span>
          </div>
          {
            isOpen && (
              <>
                {
                  pendingDir === n.id && (
                    <div className='tnode' style={{ paddingLeft: (depth + 1) * 14 + 4 }}>
                      <span className='arrow leaf'>▶</span>
                      <Folder size={14} />
                      <InlineInput
                        initial='' onCommit={(v) => {
                          if (v.trim()) {
                            addGroup(store, v.trim(), n.id)
                            setSel({ kind: 'dir', id: null })
                          }
                          setPendingDir(null)
                        }} onCancel={() => setPendingDir(null)} autoFocus placeholder='名称,Enter 确认'
                      />
                    </div>
                  )
                }
                {renderTree(n.children, depth + 1, p)}
                {
                  n.hosts.map(h => {
                    const hostSel = sel && sel.kind === 'host' && sel.id === h.id
                    const editing = editId === h.id
                    return (
                      <div
                        key={h.id}
                        className={'tnode' + (hostSel ? ' sel' : '')}
                        style={{ paddingLeft: (depth + 1) * 14 + 4 }}
                        onClick={() => setSel({ kind: 'host', id: h.id })}
                        onDoubleClick={() => connect(h.id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setSel({ kind: 'host', id: h.id })
                          setMenu({ x: e.clientX, y: e.clientY, node: { kind: 'host', id: h.id }, view: 'main' })
                        }}
                      >
                        <span className='arrow leaf'>▶</span>
                        <HardDrive size={14} />
                        {
                          editing
                            ? (
                              <InlineInput
                                initial={h.title}
                                onCommit={v => commitRename(h.id, 'host', v)}
                                onCancel={() => setEditId(null)}
                              />
                              )
                            : <span className='lbl' dangerouslySetInnerHTML={{ __html: hl(h.title, kw) }} />
                        }
                        <span className='cnt'>{hl(h.host, kw)}</span>
                      </div>
                    )
                  })
                }
                {
                  empty && <div className='empty-dir' style={{ paddingLeft: (depth + 1) * 14 + 10 }}>空分组</div>
                }
              </>
            )
          }
        </React.Fragment>
      )
    })
  }

  function renderMenu () {
    if (!menu) return null
    const { node, view } = menu
    if (view === 'move') {
      const isDir = node.kind === 'dir'
      const targets = groupPaths(store).filter(p => {
        if (isDir) {
          if (p.id === node.id) return false
          return !p.path.startsWith(menu.node.path + '/')
        }
        return true
      })
      return (
        <div className='anchor-ctx' style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
          <div className='cap'>移动到</div>
          <div onClick={() => doMove(node, 'default')}>/(默认分组)</div>
          {targets.map(t => <div key={t.id} onClick={() => doMove(node, t.id)}>{t.path}</div>)}
          <div className='sep' />
          <div onClick={() => setMenu({ ...menu, view: 'main' })}>‹ 返回</div>
        </div>
      )
    }
    if (node.kind === 'dir') {
      return (
        <div className='anchor-ctx' style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
          <div className='cap'>FOLDER</div>
          <div onClick={() => { setMenu(null); setFormGroupId(node.id); setFormHost(null); setFormOpen(true) }}>新建主机(此分组)</div>
          <div onClick={() => { setMenu(null); setPendingDir(node.id); setExpanded(m => ({ ...m, [node.id]: true })) }}>新建子文件夹</div>
          <div className='sep' />
          <div onClick={() => { setMenu(null); setEditId(node.id); setExpanded(m => ({ ...m, [node.id]: true })) }}>重命名 <span className='sub'>F2</span></div>
          <div onClick={() => setMenu({ ...menu, view: 'move' })}>移动到 <span className='sub'>›</span></div>
          <div className='sep' />
          <div className='danger' onClick={() => { setMenu(null); askDelDir(node.id) }}>删除 <span className='sub'>Del</span></div>
        </div>
      )
    }
    return (
      <div className='anchor-ctx' style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
        <div className='cap'>HOST</div>
        <div onClick={() => { setMenu(null); connect(node.id) }}>连接 <span className='sub'>↵</span></div>
        <div onClick={() => { setMenu(null); setFormHost(selHost(node.id)); setFormOpen(true) }}>编辑</div>
        <div onClick={() => { copyBookmark(store, node.id); setMenu(null); message.success('已创建副本') }}>复制主机</div>
        <div onClick={() => setMenu({ ...menu, view: 'move' })}>移动到 <span className='sub'>›</span></div>
        <div className='sep' />
        <div className='danger' onClick={() => { setMenu(null); delHost(node.id) }}>删除 <span className='sub'>Del</span></div>
      </div>
    )
  }

  function doMove (node, toGroupId) {
    node.kind === 'dir' ? moveGroup(store, node.id, toGroupId) : moveBookmark(store, node.id, toGroupId)
    setMenu(null)
    message.success('已移动')
  }

  return (
    <aside className='host-sidebar'>
      <div className='hs-search'>
        <Search size={14} />
        <input
          placeholder='搜索主机'
          value={kw}
          onChange={e => setKw(e.target.value)}
        />
      </div>
      <div className='hs-tree' ref={treeRef} tabIndex={0}>
        {
          renderTree([{
            kind: 'dir',
            id: 'root',
            title: '主机',
            children: tree,
            hosts: []
          }], 0, '')
        }
      </div>
      <div className='hs-foot'>
        <button onClick={() => { setFormHost(null); setFormGroupId(sel && sel.kind === 'dir' ? sel.id : null); setFormOpen(true) }}>
          <Plus size={14} /> 新建主机
        </button>
        <button onClick={() => {
          const parent = sel && sel.kind === 'dir' ? sel.id : 'default'
          setPendingDir(parent)
          setExpanded(m => ({ ...m, [parent]: true }))
        }}
        >
          <FolderPlus size={14} /> 新建分组
        </button>
      </div>
      {renderMenu()}
      <BookmarkFormDrawer
        open={formOpen}
        host={formHost}
        defaultGroupId={formGroupId}
        store={store}
        onClose={() => setFormOpen(false)}
      />
    </aside>
  )
}

function InlineInput ({ initial, onCommit, onCancel, autoFocus, placeholder }) {
  const [v, setV] = useState(initial)
  const ref = useRef(null)
  useEffect(() => {
    ref.current && ref.current.focus()
    ref.current && ref.current.select()
  }, [])
  return (
    <input
      ref={ref}
      className='rename'
      value={v}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit(v)
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => setTimeout(onCancel, 0)}
    />
  )
}
