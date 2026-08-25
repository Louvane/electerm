const { _electron } = require('playwright-core')
;(async () => {
  const app = await _electron.launch({
    executablePath: '/Users/echo/projects/anchor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['-r', 'dotenv/config', 'src/app/app'],
    cwd: '/Users/echo/projects/anchor',
    env: { ...process.env, NODE_ENV: 'development' }
  })
  const win = await app.firstWindow()
  const results = []
  const errs = []
  win.on('pageerror', e => errs.push(e.message))
  win.on('console', m => {
    if (m.text().includes('[anchor:')) console.log('[console]', m.text())
  })
  const T = (n, c) => results.push([(c ? 'PASS' : 'FAIL'), n])
  const sleep = ms => win.waitForTimeout(ms)

  await win.waitForTimeout(6000)
  await win.click('.anchor-mgr-btn')
  await sleep(400)
  T('管理器打开', await win.evaluate(() => !!document.querySelector('.anchor-mgr')))

  // 清场上次残留
  await win.evaluate(() => {
    const s = window.store
    const ids = s.bookmarks.filter(b => b.title.includes('e2e机')).map(b => b.id)
    s.bookmarks = s.bookmarks.filter(b => !b.title.includes('e2e机'))
    s.bookmarkGroups = s.bookmarkGroups.filter(g => g.title !== '测试组')
    s.bookmarkGroups.forEach(g => { g.bookmarkIds = (g.bookmarkIds || []).filter(x => !ids.includes(x)) })
  })
  await sleep(200)

  // 新建文件夹
  await win.click('.mg-tools .tl >> text=＋ 文件夹')
  await sleep(300)
  const inlineInput = win.locator('.mg-tree .rename').first()
  await inlineInput.fill('测试组')
  await inlineInput.press('Enter')
  await sleep(300)
  T('新建文件夹', (await win.textContent('.mg-tree')).includes('测试组'))

  // 新建主机
  await win.click('.mg-tools .tl >> text=＋ 主机')
  await sleep(400)
  await win.fill('#fName', 'e2e机')
  await win.fill('#fIp', '192.168.1.66')
  await win.fill('#fUser', 'deploy')
  await win.locator('.ant-drawer .ant-select').first().click()
  await sleep(200)
  await win.locator('.ant-select-dropdown').last().locator('text=测试组').first().click()
  await win.click('button:has-text("保存主机")')
  await sleep(400)
  T('主机创建', await win.evaluate(() => window.store.bookmarks.some(b => b.title === 'e2e机')))

  // 搜索
  console.log('KW@before-fill:', await win.evaluate(() => window._kw))
  await win.fill('.mg-search', 'e2e机')
  await sleep(250)
  console.log('KW@after-fill:', await win.evaluate(() => window._kw),
    '| TREE:', (await win.textContent('.mg-tree')).slice(0, 200))
  T('搜索:树中出现主机', (await win.textContent('.mg-tree')).includes('e2e机'))
  T('搜索:高亮 mark', await win.evaluate(() => document.querySelectorAll('.mg-tree mark').length >= 1))

  // 编辑预填
  const hostNode = win.locator('.tnode', { hasText: 'e2e机' }).first()
  await hostNode.click({ button: 'right' })
  await sleep(150)
  await win.click('.anchor-ctx div >> text=编辑')
  await sleep(400)
  T('编辑预填', (await win.inputValue('#fIp')) === '192.168.1.66')
  await win.click('.ant-drawer-close')
  await sleep(300)

  // 复制
  await hostNode.click({ button: 'right' })
  await sleep(150)
  await win.click('.anchor-ctx div >> text=复制主机')
  await sleep(300)
  T('复制副本', await win.evaluate(() => window.store.bookmarks.filter(b => b.title.includes('e2e机')).length === 2))

  // 删除 + 撤销
  await win.locator('.tnode', { hasText: 'e2e机 副本' }).first().click({ button: 'right' })
  await sleep(150)
  await win.click('.anchor-ctx div.danger')
  await sleep(300)
  await win.click('.ant-message button:has-text("撤销")')
  await sleep(300)
  T('删除可撤销', await win.evaluate(() => window.store.bookmarks.filter(b => b.title.includes('e2e机')).length === 2))

  // 移动
  await win.fill('.mg-search', 'e2e机')
  await sleep(200)
  await hostNode.click({ button: 'right' })
  await sleep(150)
  await win.click('.anchor-ctx div >> text=移动到')
  await sleep(200)
  await win.locator('.anchor-ctx div').filter({ hasText: '(默认分组)' }).first().click()
  await sleep(250)
  T('移动到默认分组', await win.evaluate(() => {
    const b = window.store.bookmarks.find(x => x.title === 'e2e机')
    const g = window.store.bookmarkGroups.find(g2 => (g2.bookmarkIds || []).includes(b.id))
    return g.id === 'default'
  }))

  await win.screenshot({ path: '/tmp/p2-mgr.png' })
  console.log('='.repeat(40))
  results.forEach(([s2, n]) => console.log(s2 + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}` + (errs.length ? ' | JS错误:' + errs[0] : ' | 无JS错误'))
  if (results.some(r => r[0] === 'FAIL') || errs.length) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
