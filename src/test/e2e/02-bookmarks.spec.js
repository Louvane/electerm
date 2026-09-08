// src/test/e2e/02-bookmarks.spec.js
// Task 3: 连接管理域 书签 CRUD/分组/搜索/快连/面板/跳板
// root cause(前人 BOOKMARK-FAIL): 双层——
//  1) 数据层: addItem 只 push store.bookmarks, 不挂分组; 而 getBookmarkTree 只从
//     group.bookmarkIds 组 hosts (src/client/common/anchor-api.js upsertBookmark)。
//     故直调 addItem 的书签永不进管理器树。测试用 upsert 同语义建/删。
//  2) 探针层: ConnectionManager 仅 open 时渲染树 (open ? getBookmarkTree : []),
//     且 ANCHOR 壳无 electerm 侧栏 (.sidebar 不存在)。body 文本探针永远抓不到。
//     故点 .anchor-mgr-btn 开真实 Modal 断言 .anchor-mgr。
// 数值按 brief 原样照抄: title/host/port/user/key。
const { launchAnchor } = require('./helpers/anchor-e2e')

async function main () {
  const { win } = await launchAnchor()
  const TITLE = 'e2e-tmp-bookmark'
  const EDITED = 'e2e-tmp-bookmark-edited'
  const HOST = '192.168.139.214'
  const results = []
  const check = (name, ok) => { results.push(name + ':' + (ok ? 'OK' : 'FAIL')); if (!ok) throw new Error(name + '-FAIL') }
  let bid = null
  let gid = null
  const mgrText = () => win.evaluate(() => document.querySelector('.anchor-mgr').innerText)
  async function openMgr () {
    await win.evaluate(() => window.localStorage.removeItem('anchor-mgr-expanded'))
    await win.click('.anchor-mgr-btn')
    await win.waitForSelector('.anchor-mgr', { timeout: 8000 })
    await win.waitForTimeout(600)
  }
  async function closeMgr () {
    await win.keyboard.press('Escape')
    await win.waitForTimeout(500)
  }
  // Manager 为纯组件, store 嵌套 mutation 不自刷新; 经搜索框走一次本地 state 变更强制重渲染
  async function refreshMgr () {
    await win.fill('.mg-search', 'e2e-refresh-probe')
    await win.waitForTimeout(300)
    await win.fill('.mg-search', '')
    await win.waitForTimeout(400)
  }
  try {
    // 1. 新建测试书签(指向 orb 真机, 用后删除; upsert 语义: 入库 + 挂 default 分组)
    bid = await win.evaluate((a) => {
      const id = 'e2e-tmp-' + Date.now()
      window.store.bookmarks.push({
        type: 'ssh',
        id,
        title: a.title,
        host: a.host,
        port: 22,
        username: 'echo',
        password: '',
        privateKey: '~/.orbstack/ssh/id_ed25519'
      })
      const g = window.store.bookmarkGroups.find(x => x.id === 'default')
      if (g) g.bookmarkIds = [...(g.bookmarkIds || []), id]
      return id
    }, { title: TITLE, host: HOST })
    console.log('CREATED:', bid)
    // 2. 连接管理器出现该书签(真实 Modal)
    await openMgr()
    let t = await mgrText()
    check('manager-shows-bookmark', t.includes(TITLE))
    // 3. 搜索过滤: 输入标题命中, 输入无匹配则消失, 清空恢复
    await win.fill('.mg-search', TITLE)
    await win.waitForTimeout(400)
    t = await mgrText()
    const hit = t.includes(TITLE)
    await win.fill('.mg-search', 'zzz-no-such-host')
    await win.waitForTimeout(400)
    t = await mgrText()
    const miss = !t.includes(TITLE)
    await win.fill('.mg-search', '')
    await win.waitForTimeout(400)
    check('search-filter', hit && miss)
    // 4. 编辑: 改标题后管理器 UI 更新(改回原标题供后续校验)
    // 注: ConnectionManager 为纯组件, 嵌套 mutation 不自刷新(与抽屉保存走壳 state 刷新一致),
    // 测试经一次搜索框输入(本地 state 变更)触发重渲染后断言
    await win.evaluate(({ id, title }) => {
      Object.assign(window.store.bookmarks.find(b => b.id === id), { title })
    }, { id: bid, title: EDITED })
    await win.fill('.mg-search', EDITED)
    await win.waitForTimeout(400)
    t = await mgrText()
    check('edit-bookmark', t.includes(EDITED))
    await win.fill('.mg-search', '')
    await win.waitForTimeout(400)
    await win.evaluate(({ id, title }) => {
      Object.assign(window.store.bookmarks.find(b => b.id === id), { title })
    }, { id: bid, title: TITLE })
    await win.waitForTimeout(500)
    // 5. 分组: 新建分组含该书签 → 收起藏主机显分组 → 展开恢复
    gid = 'e2e-tmp-group-' + Date.now()
    await win.evaluate(({ gid, bid }) => {
      window.store.addBookmarkGroup({ id: gid, title: 'e2e-tmp-group', bookmarkIds: [bid], bookmarkGroupIds: [] })
      const d = window.store.bookmarkGroups.find(x => x.id === 'default')
      if (d) d.bookmarkIds = (d.bookmarkIds || []).filter(x => x !== bid)
    }, { gid, bid })
    await refreshMgr()
    t = await mgrText()
    check('group-create', t.includes('e2e-tmp-group'))
    await win.click('.anchor-mgr button:has-text("收起")')
    await win.waitForTimeout(400)
    t = await mgrText()
    const folded = t.includes('e2e-tmp-group') && !t.includes(TITLE)
    await win.click('.anchor-mgr button:has-text("展开")')
    await win.waitForTimeout(400)
    t = await mgrText()
    check('group-collapse-expand', folded && t.includes(TITLE))
    await closeMgr()
    // 6. 快连解析(不建连)
    const qc = await win.evaluate(() => window.store.parseQuickConnect('echo@192.168.139.214:22'))
    check('quick-connect-parse', qc && qc.host === HOST && qc.username === 'echo')
    console.log('QUICK-CONNECT:', JSON.stringify({ host: qc.host, port: qc.port, username: qc.username }))
    // 7. 快连页 + 命令面板探针(仅存在性, 不硬断言)
    await win.click('.anchor-newtab')
    await win.waitForSelector('.page-home', { timeout: 8000 })
    const qcProbe = await win.evaluate(() => document.querySelector('.qc-panel').innerText.slice(0, 120))
    console.log('QC-PANEL-PROBE:', JSON.stringify(qcProbe))
    await win.click('.anchor-theme-btn[title="常用命令"]')
    await win.waitForSelector('.cmd-palette', { timeout: 8000 })
    const cpProbe = await win.evaluate(() => ({
      hasSearch: !!document.querySelector('.cp-search'),
      note: '命令面板搜常用命令, 不搜书签(书签搜索在管理器 .mg-search)'
    }))
    console.log('PANEL-PROBE:', JSON.stringify(cpProbe))
    await win.evaluate(() => document.querySelector('.cmd-palette').click())
    await win.waitForTimeout(400)
    // 8. 跳板链: resolveHops 单测已覆盖(src/test/unit-ci/anchor-api.spec.js), e2e 跳过实拨
    console.log('HOPS:SKIP-单测已覆盖resolveHops, 两跳实测需用户环境, 未实拨')
    // 9. 删除(书签 + 分组), 管理器 UI 与 store 双消失
    await win.evaluate((id) => {
      const i = window.store.bookmarks.findIndex(b => b.id === id)
      if (i >= 0) window.store.bookmarks.splice(i, 1)
      window.store.bookmarkGroups.forEach(g => {
        if ((g.bookmarkIds || []).includes(id)) g.bookmarkIds = g.bookmarkIds.filter(x => x !== id)
      })
    }, bid)
    await win.evaluate((gid) => {
      const g = (window.store.bookmarkGroups || []).find(x => x.id === gid)
      if (g) window.store.delBookmarkGroup(g)
    }, gid)
    bid = null; gid = null
    await openMgr()
    t = await mgrText()
    const goneUI = !t.includes(TITLE) && !t.includes('e2e-tmp-group')
    await closeMgr()
    check('delete-bookmark-ui', goneUI)
    const goneStore = await win.evaluate((x) => !window.store.bookmarks.some(b => (b.title || '').includes(x)), 'e2e-tmp-bookmark')
    check('delete-bookmark-store', goneStore)
    console.log('BOOKMARK-PASS')
    console.log(results.join(' '))
    process.exit(0)
  } catch (e) {
    try { await win.keyboard.press('Escape'); await win.waitForTimeout(400) } catch (_) {}
    try {
      if (bid) {
        await win.evaluate((id) => {
          const i = window.store.bookmarks.findIndex(b => b.id === id)
          if (i >= 0) window.store.bookmarks.splice(i, 1)
          window.store.bookmarkGroups.forEach(g => {
            if ((g.bookmarkIds || []).includes(id)) g.bookmarkIds = g.bookmarkIds.filter(x => x !== id)
          })
        }, bid).catch(() => {})
      }
      if (gid) {
        await win.evaluate((g) => {
          const x = (window.store.bookmarkGroups || []).find(y => y.id === g)
          if (x) window.store.delBookmarkGroup(x)
        }, gid).catch(() => {})
      }
    } catch (_) {}
    console.log('BOOKMARK-ERR', String((e && e.message) || e).slice(0, 120))
    console.log(results.join(' '))
    console.log('BOOKMARK-FAIL')
    process.exit(1)
  }
}
main().catch(e => { console.log('BOOKMARK-ERR', String((e && e.message) || e).slice(0, 80)); process.exit(1) })
