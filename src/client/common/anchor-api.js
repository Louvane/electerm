/**
 * ANCHOR 数据层:对 electerm store(bookmarks / bookmarkGroups / history)
 * 的读写封装,供连接管理器与快速连接页使用。
 *
 * 数据模型(electerm 原生):
 * - bookmark:  { id, title, type:'ssh', host, port, username, ... }
 * - group:     { id, title, bookmarkIds:[], bookmarkGroupIds:[] } 树形嵌套
 * - history:   [{ id, tab, time, count }] 新的在前
 *
 * 所有函数第一个参数为 store 实例(默认 window.store),便于单测注入。
 */
import uid from './uid.js'

// 与 src/client/common/constants.js 的 defaultBookmarkGroupId 保持一致
// (内联以解除对 constants 链的依赖,便于 node --test 直测)
export const defaultBookmarkGroupId = 'default'

const st = s => s || window.store

export function getBookmarks (s) {
  return st(s).bookmarks
}

export function getGroups (s) {
  return st(s).bookmarkGroups
}

/**
 * 构建树:根 = 未被任何分组引用的分组。
 * 节点:{ kind:'dir', id, title, children:[], hosts:[bookmark] }
 */
export function getBookmarkTree (s) {
  const store = st(s)
  const groups = store.bookmarkGroups
  const referenced = new Set()
  groups.forEach(g => (g.bookmarkGroupIds || []).forEach(id => referenced.add(id)))
  const byId = Object.fromEntries(groups.map(g => [g.id, {
    kind: 'dir',
    id: g.id,
    title: g.title,
    children: [],
    hosts: (g.bookmarkIds || [])
      .map(id => store.bookmarks.find(b => b.id === id))
      .filter(Boolean)
  }]))
  const roots = []
  groups.forEach(g => {
    const node = byId[g.id]
    if (referenced.has(g.id)) {
      // 挂到第一个引用它的父组(数据正常时只有一个)
      for (const p of groups) {
        if ((p.bookmarkGroupIds || []).includes(g.id)) {
          byId[p.id].children.push(node)
          break
        }
      }
    } else {
      roots.push(node)
    }
  })
  return roots
}

/** 新增或编辑主机;新增时挂入 groupId(默认 default 分组) */
export function upsertBookmark (s, item, groupId) {
  const store = st(s)
  if (item.id && store.bookmarks.find(b => b.id === item.id)) {
    Object.assign(store.bookmarks.find(b => b.id === item.id), item)
    return item.id
  }
  const id = item.id || uid()
  store.bookmarks.push({ type: 'ssh', ...item, id })
  const gid = groupId || defaultBookmarkGroupId
  const g = store.bookmarkGroups.find(x => x.id === gid)
  if (g) {
    g.bookmarkIds = [...(g.bookmarkIds || []), id]
  }
  return id
}

/** 删除主机并从所有分组的 bookmarkIds 摘除 */
export function delBookmark (s, id) {
  const store = st(s)
  const i = store.bookmarks.findIndex(b => b.id === id)
  if (i >= 0) store.bookmarks.splice(i, 1)
  store.bookmarkGroups.forEach(g => {
    if ((g.bookmarkIds || []).includes(id)) {
      g.bookmarkIds = g.bookmarkIds.filter(x => x !== id)
    }
  })
}

/** 复制主机,返回新 id */
export function copyBookmark (s, id) {
  const store = st(s)
  const src = store.bookmarks.find(b => b.id === id)
  if (!src) return null
  const nid = uid()
  store.bookmarks.push({ ...src, id: nid, title: (src.title || '主机') + ' 副本' })
  const gid = findGroupOf(store, id)
  if (gid) {
    const g = store.bookmarkGroups.find(x => x.id === gid)
    g.bookmarkIds = [...(g.bookmarkIds || []), nid]
  }
  return nid
}

/** 主机所在分组 id(无则 null) */
export function getBookmarkGroupId (s, bookmarkId) {
  return findGroupOf(st(s), bookmarkId)
}

function findGroupOf (store, bookmarkId) {
  const g = store.bookmarkGroups.find(x => (x.bookmarkIds || []).includes(bookmarkId))
  return g ? g.id : null
}

/** 新建分组,注册进父组;parentId 缺省挂 default。返回新 id */
export function addGroup (s, title, parentId) {
  const store = st(s)
  const id = uid()
  store.bookmarkGroups.push({ id, title, bookmarkIds: [], bookmarkGroupIds: [] })
  const pid = parentId || defaultBookmarkGroupId
  const parent = store.bookmarkGroups.find(g => g.id === pid)
  if (parent) {
    parent.bookmarkGroupIds = [...(parent.bookmarkGroupIds || []), id]
  }
  return id
}

export function renameGroup (s, id, title) {
  const g = st(s).bookmarkGroups.find(x => x.id === id)
  if (g) g.title = title
}

/** 主机跨组迁移 */
export function moveBookmark (s, bookmarkId, toGroupId) {
  const store = st(s)
  const from = findGroupOf(store, bookmarkId)
  if (from === toGroupId) return
  if (from) {
    const g = store.bookmarkGroups.find(x => x.id === from)
    g.bookmarkIds = (g.bookmarkIds || []).filter(x => x !== bookmarkId)
  }
  const to = store.bookmarkGroups.find(x => x.id === toGroupId)
  if (to) {
    to.bookmarkIds = [...(to.bookmarkIds || []), bookmarkId]
  }
}

/** 分组重新挂父;环检测(toParent 在 groupId 子树内则拒绝) */
export function moveGroup (s, groupId, toParentId) {
  const store = st(s)
  if (isDescendant(store, groupId, toParentId)) {
    throw new Error('cannot move group into its own subtree')
  }
  detachGroup(store, groupId)
  const to = store.bookmarkGroups.find(g => g.id === toParentId)
  if (to) {
    to.bookmarkGroupIds = [...(to.bookmarkGroupIds || []), groupId]
  }
}

/** 删除分组:空组直接删;非空子项(主机+子分组)上移一级 */
export function delGroup (s, id) {
  const store = st(s)
  const group = store.bookmarkGroups.find(g => g.id === id)
  if (!group) return
  const hasChildren = (group.bookmarkIds || []).length || (group.bookmarkGroupIds || []).length
  const parent = findGroupOfGroup(store, id)
  detachGroup(store, id)
  if (hasChildren && parent) {
    const p = store.bookmarkGroups.find(g => g.id === parent)
    if (p) {
      p.bookmarkIds = [...(p.bookmarkIds || []), ...(group.bookmarkIds || [])]
      p.bookmarkGroupIds = [...(p.bookmarkGroupIds || []), ...(group.bookmarkGroupIds || [])]
    }
  }
  const i = store.bookmarkGroups.findIndex(g => g.id === id)
  if (i >= 0) store.bookmarkGroups.splice(i, 1)
}

function findGroupOfGroup (store, groupId) {
  const g = store.bookmarkGroups.find(x => (x.bookmarkGroupIds || []).includes(groupId))
  return g ? g.id : null
}

function detachGroup (store, groupId) {
  store.bookmarkGroups.forEach(g => {
    if ((g.bookmarkGroupIds || []).includes(groupId)) {
      g.bookmarkGroupIds = g.bookmarkGroupIds.filter(x => x !== groupId)
    }
  })
}

/** toParentId 是否在 groupId 的子树内 */
function isDescendant (store, groupId, toParentId) {
  if (groupId === toParentId) return true
  const g = store.bookmarkGroups.find(x => x.id === groupId)
  if (!g) return false
  return (g.bookmarkGroupIds || []).some(id => isDescendant(store, id, toParentId))
}

/** 最近连接:history → [{...tab, time, count, historyId}] */
export function getRecents (s, limit = 50) {
  return st(s).history.slice(0, limit).map(h => ({
    ...h.tab,
    time: h.time,
    count: h.count || 1,
    historyId: h.id
  }))
}

export function clearRecents (s) {
  st(s).history = []
}

/** 全部分组路径:[{ id, path }]。path 形如 /CMI-SC/西云,用于展示与下拉 */
export function groupPaths (s) {
  const out = [{ id: defaultBookmarkGroupId, path: '/(默认分组)' }]
  const walk = (node, path) => {
    for (const c of node.children) {
      if (c.id === defaultBookmarkGroupId) {
        // 默认分组深入但不作为路径项(它已映射为 /(默认分组))
        walk(c, path)
        continue
      }
      const p = path + '/' + c.title
      out.push({ id: c.id, path: p })
      walk(c, p)
    }
  }
  walk({ children: getBookmarkTree(s) }, '')
  return out
}

/** 把表单里引用的跳板主机 id 列表解析成 connectionHoppings 配置 */
export function resolveHops (s, bookmarkIds) {
  const store = st(s)
  return (bookmarkIds || [])
    .filter(Boolean)
    .map(id => store.bookmarks.find(b => b.id === id))
    .filter(Boolean)
    .map(b => ({
      host: b.host,
      port: b.port,
      username: b.username,
      authType: b.authType,
      password: b.password,
      privateKey: b.privateKey,
      passphrase: b.passphrase
    }))
}
