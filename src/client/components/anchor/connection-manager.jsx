/**
 * ANCHOR 连接管理器(P2)
 * 树(分组实体+主机)/ 搜索高亮 / 右键菜单 / 内联编辑 / 键盘导航 / 移动到…
 * 数据操作全部走 anchor-api(见 SPEC.md §4 交互规格)。
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Modal, message } from 'antd'
import { FolderOutlined, DesktopOutlined, CaretRightOutlined, PlusOutlined } from '@ant-design/icons'
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

export default function ConnectionManager (props) {
  const { open, onClose, store } = props
  const [kw, setKw] = useState('')
  const [expanded, setExpanded] = useState({ default: true })
  const [sel, setSel] = useState(() => { window._mounts = (window._mounts || 0) + 1; return null }) // {kind:'dir'|'host', id}
  const [multiSel, setMultiSel] = useState(new Set()) // Set<kind:id>
  const anchorRef = useRef(null)
  const [editId, setEditId] = useState(null) // 内联重命名的节点 id
  const [pendingDir, setPendingDir] = useState(null) // 内联新建文件夹的父 id
  const [menu, setMenu] = useState(null) // {x,y,node,view:'main'|'move'}
  const [formOpen, setFormOpen] = useState(false)
  const [formHost, setFormHost] = useState(null) // null=新建
  const [formGroupId, setFormGroupId] = useState(null)
  const treeRef = useRef(null)

  if (typeof window !== 'undefined') window._kw = kw // debug
  const tree = open ? getBookmarkTree(store) : []
  const bookmarks = open ? getBookmarks(store) : []

  // 展平可见节点(键盘导航用)
  const flat = []
  const walk = (nodes, expandedMap, kwArg) => {
    for (const n of nodes) {
      const all = JSON.stringify(n).toLowerCase()
      if (kwArg && !all.includes(kwArg.toLowerCase())) continue
      const isOpen = expandedMap[n.id] || !!kwArg
      flat.push({ kind: 'dir', id: n.id, title: n.title, isOpen })
      if (isOpen) {
        walk(n.children, expandedMap, kwArg)
        for (const h of n.hosts) {
          if (kwArg && !((h.title || '') + (h.host || '') + (h.username || '')).toLowerCase().includes(kwArg.toLowerCase())) continue
          flat.push({ kind: 'host', id: h.id, title: h.title, host: h.host, username: h.username })
        }
      }
    }
  }
  if (open) walk(tree, expanded, kw)

  const closeMenu = useCallback(() => setMenu(null), [])
  useEffect(() => {
    if (!menu) return undefined
    const h = () => closeMenu()
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [menu, closeMenu])

  // 键盘导航(管理器打开、焦点不在输入框时)
  useEffect(() => {
    if (!open) return undefined
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
        sel.kind === 'host' ? (multiSel.size > 1 && multiSel.has(`${sel.kind}:${sel.id}`) ? delHosts(new Set(multiSel)) : delHost(sel.id)) : askDelDir(sel.id)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  function connect (hostId) {
    store.onSelectBookmark(hostId)
    message.success('已连接')
    props.onConnect && props.onConnect()
    if (closeAfterRef.current) onClose()
  }
  const closeAfterRef = useRef(true)

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

  function keyOf (node) { return `${node.kind}:${node.id}` }
  function handleNodeClick (e, node) {
    const key = keyOf(node)
    const isMulti = e.metaKey || e.ctrlKey
    const isRange = e.shiftKey && anchorRef.current
    if (isRange) {
      const a = flat.findIndex(n => keyOf(n) === anchorRef.current)
      const b = flat.findIndex(n => keyOf(n) === key)
      if (a >= 0 && b >= 0) {
        const [s0, s1] = a < b ? [a, b] : [b, a]
        const ids = new Set(flat.slice(s0, s1 + 1).map(n => keyOf(n)))
        setMultiSel(ids)
        setSel(node)
        return
      }
    }
    if (isMulti) {
      const ns = new Set(multiSel)
      if (ns.has(key)) ns.delete(key); else ns.add(key)
      if (ns.size === 0) { setMultiSel(new Set()); setSel(node); anchorRef.current = key; return }
      setMultiSel(ns)
      setSel(node)
      anchorRef.current = key
      return
    }
    setMultiSel(new Set())
    setSel(node)
    anchorRef.current = key
  }
  function handleHostClick (e, id) { handleNodeClick(e, { kind: 'host', id }) }
  function handleDirClick (e, id) { handleNodeClick(e, { kind: 'dir', id }) }
  function delSelected (keys) {
    const arr = [...keys]
    const hosts = []
    const dirs = []
    arr.forEach(k => {
      const [kind, id] = k.split(':')
      if (kind === 'host') {
        const h = bookmarks.find(b => b.id === id)
        if (h) hosts.push(h)
      } else if (kind === 'dir') dirs.push(id)
    })
    hosts.forEach(h => delBookmark(store, h.id))
    let dirDel = 0
    dirs.forEach(id => {
      const g = store.bookmarkGroups.find(x => x.id === id)
      if (g && !(g.bookmarkIds || []).length && !(g.bookmarkGroupIds || []).length) { delGroup(store, id); dirDel++ }
    })
    const n = hosts.length + dirDel
    if (!n) { message.info('仅可批量删除主机及空文件夹'); return }
    message.open({
      duration: 5,
      content: (
        <span style={{ display: 'inline-flex', gap: 14, alignItems: 'center' }}>
          已删除 {hosts.length ? `${hosts.length} 台主机` : ''}{hosts.length && dirDel ? '、' : ''}{dirDel ? `${dirDel} 个空文件夹` : ''}
          <button
            style={{ border: 'none', background: 'none', color: '#ffb454', cursor: 'pointer' }}
            onClick={() => {
              hosts.forEach(h => {
                const gid = getBookmarkGroupId(store, h.id) || 'default'
                upsertBookmark(store, h, gid)
              })
              message.success('已恢复主机')
            }}
          >撤销
          </button>
        </span>
      )
    })
    setMultiSel(new Set())
  }
  function delHosts (ids) {
    const keys = new Set([...ids].map(id => `host:${id}`))
    delSelected(keys)
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
            style={{ border: 'none', background: 'none', color: '#ffb454', cursor: 'pointer' }}
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
    // 统计子树规模
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

  function renderTree (nodes, depth, path) {
    return nodes.map(n => {
      const p = path + '/' + n.title
      const all = JSON.stringify(n).toLowerCase()
      if (kw && !all.includes(kw.toLowerCase())) return null
      const isOpen = n.id === 'root' ? true : (expanded[n.id] || !!kw)
      const isSel = multiSel.has(`dir:${n.id}`) || (sel && sel.kind === 'dir' && sel.id === n.id)
      const empty = !n.children.length && !n.hosts.length && !kw
      return (
        <React.Fragment key={n.id}>
          <div
            className={'tnode' + (isSel ? ' sel' : '')}
            style={{ paddingLeft: depth * 18 + 4 }}
            onClick={(e) => handleDirClick(e, n.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setSel({ kind: 'dir', id: n.id })
              setMenu({ x: e.clientX, y: e.clientY, node: { kind: 'dir', id: n.id, path: p }, view: 'main' })
            }}
          >
            <span
              className={'arrow' + (isOpen ? ' open' : '')}
              onClick={(e) => { e.stopPropagation(); setExpanded(m => ({ ...m, [n.id]: !m[n.id] })) }}
            ><CaretRightOutlined />
            </span>
            <span className='ticon'><FolderOutlined /></span>
            {
              editId === n.id
                ? <InlineInput initial={n.title} onCommit={v => commitRename(n.id, 'dir', v)} onCancel={() => setEditId(null)} />
                : <span className='lbl dir' dangerouslySetInnerHTML={{ __html: hl(n.title, kw) }} />
            }
            <span className='cnt'>{n.hosts.length + n.children.reduce((a, c) => a + countAll(c), 0)}</span>
          </div>
          {
            isOpen && (
              <>
                {
                  pendingDir === n.id && (
                    <div className='tnode' style={{ paddingLeft: (depth + 1) * 18 + 4 }}>
                      <span className='arrow leaf'><CaretRightOutlined /></span><span className='ticon'><FolderOutlined /></span>
                      <InlineInput
                        initial='' onCommit={(v) => {
                          if (v.trim()) {
                            addGroup(store, v.trim(), n.id)
                            setSel({ kind: 'dir', id: null })
                          }
                          setPendingDir(null)
                        }} onCancel={() => setPendingDir(null)} autoFocus placeholder='文件夹名称,Enter 确认 · Esc 取消'
                      />
                    </div>
                  )
                }
                {renderTree(n.children, depth + 1, p)}
                {
                  n.hosts.map(h => {
                    const hostSel = multiSel.has(`host:${h.id}`) || (sel && sel.kind === 'host' && sel.id === h.id)
                    const editing = editId === h.id
                    return (
                      <div
                        key={h.id}
                        className={'tnode' + (hostSel ? ' sel' : '')}
                        style={{ paddingLeft: (depth + 1) * 18 + 4 }}
                        onClick={(e) => handleHostClick(e, h.id)}
                        onDoubleClick={() => connect(h.id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          if (!multiSel.has(`host:${h.id}`)) handleHostClick(e, h.id)
                          setMenu({ x: e.clientX, y: e.clientY, node: { kind: 'host', id: h.id }, view: 'main' })
                        }}
                      >
                        <span className='arrow leaf'><CaretRightOutlined /></span><span className='ticon'><DesktopOutlined /></span>
                        {
                          editing
                            ? <InlineInput initial={h.title} onCommit={v => commitRename(h.id, 'host', v)} onCancel={() => setEditId(null)} />
                            : <span className='lbl' dangerouslySetInnerHTML={{ __html: hl(h.title, kw) }} />
                        }
                        <span className='cnt'>{hl(h.host, kw)}</span>
                        <span className='usr'>{hl(h.username, kw)}</span>
                      </div>
                    )
                  })
                }
                {
                  empty && <div className='empty-dir' style={{ paddingLeft: (depth + 1) * 18 + 10 }}>空分组 · 右键新建主机</div>
                }
              </>
            )
          }
        </React.Fragment>
      )
    })
  }

  function countAll (n) {
    return n.hosts.length + n.children.reduce((a, c) => a + countAll(c), 0)
  }

  // 右键菜单渲染
  function renderMenu () {
    if (!menu) return null
    const { node, view } = menu
    if (view === 'move') {
      const isDir = node.kind === 'dir'
      const targets = groupPaths(store).filter(p => {
        if (isDir) {
          if (p.id === node.id) return false
          // 排除自己子树:粗略用标题路径判断
          return !p.path.startsWith(menu.node.path + '/')
        }
        return true
      })
      return (
        <div className='anchor-ctx' style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
          <div className='cap'>移动到</div>
          <div onClick={() => { doMove(node, 'default') }}>/(默认分组)</div>
          {
            targets.map(t => (
              <div key={t.id} onClick={() => doMove(node, t.id)}>{t.path}</div>
            ))
          }
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
          <div onClick={() => setMenu({ ...menu, view: 'move' })}>移动到… <span className='sub'>›</span></div>
          <div className='sep' />
          {multiSel.size > 1 && multiSel.has(`dir:${node.id}`)
            ? <div className='danger' onClick={() => { setMenu(null); delSelected(new Set(multiSel)) }}>删除 ({[...multiSel].filter(k => k.startsWith('host:')).length + [...multiSel].filter(k => k.startsWith('dir:')).length}) <span className='sub'>Del</span></div>
            : <div className='danger' onClick={() => { setMenu(null); askDelDir(node.id) }}>删除 <span className='sub'>Del</span></div>}
        </div>
      )
    }
    return (
      <div className='anchor-ctx' style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
        <div className='cap'>HOST</div>
        <div onClick={() => { setMenu(null); connect(node.id) }}>连接 <span className='sub'>↵</span></div>
        <div onClick={() => { setMenu(null); setFormHost(selHost(node.id)); setFormOpen(true) }}>编辑</div>
        <div onClick={() => { copyBookmark(store, node.id); setMenu(null); message.success('已创建副本') }}>复制主机</div>
        <div onClick={() => setMenu({ ...menu, view: 'move' })}>移动到… <span className='sub'>›</span></div>
        <div className='sep' />
        {multiSel.size > 1 && multiSel.has(`${node.kind}:${node.id}`)
          ? <div className='danger' onClick={() => { setMenu(null); delHosts(new Set(multiSel)) }}>删除 ({multiSel.size}) <span className='sub'>Del</span></div>
          : <div className='danger' onClick={() => { setMenu(null); delHost(node.id) }}>删除 <span className='sub'>Del</span></div>}
      </div>
    )
  }

  function doMove (node, toGroupId) {
    node.kind === 'dir' ? moveGroup(store, node.id, toGroupId) : moveBookmark(store, node.id, toGroupId)
    setMenu(null)
    message.success('已移动')
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={660}
      styles={{ body: { padding: 0 } }}
      title={<><FolderOutlined /> 连接管理器</>}
      destroyOnHidden
    >
      <div className='anchor-mgr'>
        <div className='mg-tools'>
          <button className='tl' onClick={() => { setFormHost(null); setFormGroupId(sel && sel.kind === 'dir' ? sel.id : null); setFormOpen(true) }}><PlusOutlined /> 主机</button>
          <button
            className='tl' onClick={() => {
              const parent = sel && sel.kind === 'dir' ? sel.id : 'default'
              setPendingDir(parent)
              setExpanded(m => ({ ...m, [parent]: true }))
            }}
          ><PlusOutlined /> 文件夹
          </button>
          <input
            className='mg-search'
            placeholder='搜索名称 / IP / 用户…'
            value={kw}
            onChange={e => { console.log('[anchor:search-change]', JSON.stringify(e.target.value)); setKw(e.target.value) }}
          />
        </div>
        <div className='mg-tree' ref={treeRef} tabIndex={0}>
          {
            renderTree([{
              kind: 'dir',
              id: 'root',
              title: '连接',
              children: tree,
              hosts: []
            }], 0, '')
          }
        </div>
        <div className='mg-foot'>
          <span>双击主机建立连接</span>
          <span className='kbd'>↑↓ 选择 · Enter 连接 · F2 重命名 · Del 删除</span>
          <label>
            <input
              type='checkbox'
              defaultChecked
              onChange={e => { closeAfterRef.current = e.target.checked }}
            /> 连接后关闭窗口
          </label>
        </div>
      </div>
      {renderMenu()}
      <BookmarkFormDrawer
        open={formOpen}
        host={formHost}
        defaultGroupId={formGroupId}
        store={store}
        onClose={() => setFormOpen(false)}
      />
    </Modal>
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
      onBlur={() => (v.trim() ? onCommit(v) : onCancel())}
    />
  )
}
