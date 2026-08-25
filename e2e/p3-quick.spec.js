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
  const T = (n, c) => results.push([(c ? 'PASS' : 'FAIL'), n])
  const sleep = ms => win.waitForTimeout(ms)

  await win.waitForTimeout(6000)

  // 清场:清空历史(持久化 userData)
  await win.evaluate(() => { window.store.history = [] })
  await sleep(200)

  // 1. 空状态
  T('空状态显示', await win.locator('.qc-empty').count() === 1)
  const eb = await win.locator('.qc-empty').boundingBox()
  const cb = await win.locator('.anchor-content').boundingBox()
  T('空状态居中', eb && cb && Math.abs((eb.x + eb.width / 2) - (cb.x + cb.width / 2)) < 40)

  // 2. 空状态按钮打开管理器
  await win.click('.qc-empty button:has-text("打开连接管理器")')
  await sleep(300)
  T('空状态按钮 → 管理器', await win.evaluate(() => document.querySelector('.anchor-mgr') !== null))

  // 3. 管理器里建一台主机并连接(产生历史)
  await win.click('.mg-tools .tl >> text=＋ 主机')
  await sleep(300)
  await win.fill('#fName', 'qc-机')
  await win.fill('#fIp', '10.1.1.1')
  await win.click('button:has-text("保存主机")')
  await sleep(300)
  // 关管理器
  await win.keyboard.press('Escape')
  await sleep(200)
  await win.evaluate(() => { window.store.onSelectBookmark(window.store.bookmarks.find(b => b.title === 'qc-机').id) })
  await sleep(500)
  T('连接后产生历史', await win.evaluate(() => window.store.history.length >= 1))
  T('会话标签出现', await win.locator('.anchor-tab', { hasText: 'qc-机' }).count() >= 1)

  // 4. 回到快速连接页(新标签 = 主页视图)——P3 内容区常显 QC
  T('快速连接列表出现记录', await win.locator('.qc-row').count() === 1)
  const rowTxt = await win.locator('.qc-row').first().textContent()
  T('行内容完整', rowTxt.includes('qc-机') && rowTxt.includes('10.1.1.1'))
  T('活跃会话状态点', await win.locator('.qc-row.open').count() === 1)

  // 5. 双击行 → 再开一个会话标签
  const tabsBefore = await win.evaluate(() => window.store.tabs.length)
  await win.dblclick('.qc-row')
  await sleep(400)
  T('双击行新建会话', await win.evaluate(() => window.store.tabs.length) === tabsBefore + 1)

  // 6. 清空记录
  await win.click('button.hint >> text=清空记录')
  await sleep(200)
  T('清空后空状态', await win.locator('.qc-empty').count() === 1)

  // 7. 新建主机按钮 → 抽屉
  await win.click('.qc-empty button:has-text("新建主机")')
  await sleep(300)
  T('新建主机抽屉打开', await win.evaluate(() => document.querySelector('.ant-drawer-open') !== null))

  await win.screenshot({ path: '/tmp/p3-qc.png' })
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}` + (errs.length ? ' | JS错误:' + errs[0] : ' | 无JS错误'))
  if (results.some(r => r[0] === 'FAIL') || errs.length) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
