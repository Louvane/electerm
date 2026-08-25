const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

// ANCHOR 数据层(ESM)——CJS 测试里动态导入
let api
before(async () => {
  api = await import('../../../src/client/common/anchor-api.js')
})

function mockStore () {
  return {
    bookmarks: [
      { id: 'b1', title: 'h1', host: '1.1.1.1', username: 'root' },
      { id: 'b2', title: 'h2', host: '2.2.2.2', username: 'root' }
    ],
    bookmarkGroups: [
      { id: 'default', title: '默认', bookmarkIds: ['b1', 'b2'], bookmarkGroupIds: ['g1'] },
      { id: 'g1', title: 'G1', bookmarkIds: [], bookmarkGroupIds: ['g2'] },
      { id: 'g2', title: 'G2', bookmarkIds: [], bookmarkGroupIds: [] }
    ],
    history: [
      { id: 'hh1', tab: { id: 't1', title: 't1', host: '1.1.1.1' }, time: 2, count: 1 },
      { id: 'hh2', tab: { id: 't2', title: 't2', host: '2.2.2.2' }, time: 1, count: 2 }
    ]
  }
}

describe('anchor-api: buildTree', () => {
  it('识别根分组并嵌套子分组', () => {
    const st = mockStore()
    const tree = api.getBookmarkTree(st)
    assert.strictEqual(tree.length, 1) // 只有 default 是根
    assert.strictEqual(tree[0].id, 'default')
    assert.strictEqual(tree[0].children.length, 1) // g1
    assert.strictEqual(tree[0].children[0].children.length, 1) // g2
  })
  it('主机挂到所在分组', () => {
    const st = mockStore()
    const tree = api.getBookmarkTree(st)
    assert.strictEqual(tree[0].hosts.length, 2)
    assert.strictEqual(tree[0].hosts[0].title, 'h1')
  })
})

describe('anchor-api: bookmark CRUD', () => {
  it('upsert 新增:进默认分组', () => {
    const st = mockStore()
    api.upsertBookmark(st, { title: 'h3', host: '3.3.3.3' })
    assert.strictEqual(st.bookmarks.length, 3)
    const def = st.bookmarkGroups.find(g => g.id === 'default')
    assert.ok(def.bookmarkIds.includes(st.bookmarks[2].id))
  })
  it('upsert 编辑:不新增', () => {
    const st = mockStore()
    api.upsertBookmark(st, { id: 'b1', title: 'h1-改' })
    assert.strictEqual(st.bookmarks.length, 2)
    assert.strictEqual(st.bookmarks[0].title, 'h1-改')
  })
  it('delBookmark:同时从分组摘除', () => {
    const st = mockStore()
    api.delBookmark(st, 'b1')
    assert.strictEqual(st.bookmarks.length, 1)
    const def = st.bookmarkGroups.find(g => g.id === 'default')
    assert.ok(!def.bookmarkIds.includes('b1'))
  })
  it('copyBookmark:标题加副本后缀', () => {
    const st = mockStore()
    const nid = api.copyBookmark(st, 'b1')
    const c = st.bookmarks.find(b => b.id === nid)
    assert.strictEqual(c.title, 'h1 副本')
  })
})

describe('anchor-api: 分组操作', () => {
  it('addGroup:注册进父组 bookmarkGroupIds', () => {
    const st = mockStore()
    const id = api.addGroup(st, '子组', 'g1')
    const g1 = st.bookmarkGroups.find(g => g.id === 'g1')
    assert.ok(g1.bookmarkGroupIds.includes(id))
  })
  it('renameGroup', () => {
    const st = mockStore()
    api.renameGroup(st, 'g1', '改名')
    assert.strictEqual(st.bookmarkGroups.find(g => g.id === 'g1').title, '改名')
  })
  it('moveBookmark:跨组迁移', () => {
    const st = mockStore()
    api.moveBookmark(st, 'b1', 'g2')
    const g2 = st.bookmarkGroups.find(g => g.id === 'g2')
    const def = st.bookmarkGroups.find(g => g.id === 'default')
    assert.ok(g2.bookmarkIds.includes('b1'))
    assert.ok(!def.bookmarkIds.includes('b1'))
  })
  it('moveGroup:重新挂父 + 环检测', () => {
    const st = mockStore()
    api.moveGroup(st, 'g2', 'default') // g2 从 g1 挂到 default
    const def = st.bookmarkGroups.find(g => g.id === 'default')
    assert.ok(def.bookmarkGroupIds.includes('g2'))
    // 环:把 default 挂到自己的子孙 g2 下 → 拒绝
    assert.throws(() => api.moveGroup(st, 'default', 'g2'))
  })
  it('delGroup:空组直接删', () => {
    const st = mockStore()
    api.delGroup(st, 'g2')
    assert.ok(!st.bookmarkGroups.find(g => g.id === 'g2'))
    const g1 = st.bookmarkGroups.find(g => g.id === 'g1')
    assert.ok(!g1.bookmarkGroupIds.includes('g2'))
  })
  it('delGroup:非空子项上移一级', () => {
    const st = mockStore()
    // g1 内放一台主机,删 g1 → 主机上移到 default
    api.moveBookmark(st, 'b2', 'g1')
    api.delGroup(st, 'g1')
    const def = st.bookmarkGroups.find(g => g.id === 'default')
    assert.ok(!st.bookmarkGroups.find(g => g.id === 'g1'))
    assert.ok(def.bookmarkIds.includes('b2'))
    assert.ok(def.bookmarkGroupIds.includes('g2')) // 子分组也上移
  })
})

describe('anchor-api: 历史记录', () => {
  it('getRecents:按时间倒序', () => {
    const st = mockStore()
    const r = api.getRecents(st)
    assert.strictEqual(r[0].title, 't1')
  })
  it('clearRecents', () => {
    const st = mockStore()
    api.clearRecents(st)
    assert.strictEqual(st.history.length, 0)
  })
})
