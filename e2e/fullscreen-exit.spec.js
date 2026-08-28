const { _electron } = require('/tmp/shot/node_modules/playwright-core')
;(async () => {
  const app = await _electron.launch({
    executablePath: '/Users/echo/projects/anchor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['-r', 'dotenv/config', 'src/app/app'],
    cwd: '/Users/echo/projects/anchor',
    env: { ...process.env, NODE_ENV: 'development' }
  })
  const win = await app.firstWindow()
  const results = []
  const T = (n, c) => results.push([(c ? 'PASS' : 'FAIL'), n])
  const sleep = ms => win.waitForTimeout(ms)
  await win.waitForTimeout(6000)
  await win.evaluate(() => {
    const s = window.store
    let b = s.bookmarks.find(x => x.title === 'real-ssh')
    if (!b) {
      const id = 'realssh' + Date.now()
      s.bookmarks.push({ id, title: 'real-ssh', type: 'ssh', host: '113.46.161.35', port: 17897, username: 'claude', authType: 'password', password: 'REDACTED' })
      const def = s.bookmarkGroups.find(g => g.id === 'default')
      def.bookmarkIds = [...(def.bookmarkIds || []), id]
    }
    s.onSelectBookmark(s.bookmarks.find(b => b.title === 'real-ssh').id)
  })
  await sleep(4000)
  await win.locator('.anchor-tab', { hasText: 'real-ssh' }).first().click()
  await sleep(4000)
  await win.locator('.session-current .anticon-fullscreen').first().click()
  await sleep(1500)
  T('进全屏', await win.evaluate(() => window.store.fullscreen === true))
  // Esc 退出
  await win.keyboard.press('Escape')
  await sleep(1500)
  T('Esc 退出全屏', await win.evaluate(() => window.store.fullscreen === false))
  // 再进,按钮点击退出
  await win.locator('.session-current .anticon-fullscreen').first().click()
  await sleep(1500)
  const box = await win.locator('.anchor-fs-exit').boundingBox()
  await win.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await sleep(1500)
  T('按钮点击退出', await win.evaluate(() => window.store.fullscreen === false))
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
