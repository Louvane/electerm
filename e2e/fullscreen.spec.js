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
      s.bookmarks.push({ id, title: 'real-ssh', type: 'ssh', host: '113.46.161.35', port: 17897, username: 'claude', authType: 'password', password: process.env.ANCHOR_PASS })
      const def = s.bookmarkGroups.find(g => g.id === 'default')
      def.bookmarkIds = [...(def.bookmarkIds || []), id]
    }
    s.onSelectBookmark(s.bookmarks.find(b => b.title === 'real-ssh').id)
  })
  await sleep(4000)
  await win.locator('.anchor-tab', { hasText: 'real-ssh' }).first().click()
  await sleep(4000)
  // 进全屏
  await win.locator('.session-current .anticon-fullscreen').first().click()
  await sleep(1500)
  T('进全屏:退出按钮出现', await win.locator('.anchor-fs-exit').count() === 1)
  // 终端首行下移避开红绿灯
  const top = await win.evaluate(() => {
    const el = document.querySelector('[class*=term-wrap-]')
    return el ? el.getBoundingClientRect().top : -1
  })
  T('终端下移避让红绿灯', top >= 39, 'top=' + Math.round(top))
  // 点退出
  await win.locator('.anchor-fs-exit').click()
  await sleep(1800)
  T('点击退出:全屏解除', await win.evaluate(() => window.store.fullscreen === false))
  T('布局恢复:控制条回归', await win.evaluate(() => {
    const el = document.querySelector('.keepalive-icon')
    return el && el.getBoundingClientRect().width > 5
  }))
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
