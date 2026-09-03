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
  T('关闭按钮存在', await win.locator('.anchor-tab .anchor-tab-close').count() >= 1)
  // 点击 ✕(不是标签本身)→ 标签被删
  const before = await win.evaluate(() => window.store.tabs.length)
  await win.locator('.anchor-tab .anchor-tab-close').first().click({ force: true })
  await sleep(1500)
  const after = await win.evaluate(() => window.store.tabs.length)
  console.log('tabs:', before, '->', after, '| view:', await win.evaluate(() => document.querySelector('.anchor-content').innerHTML.slice(0, 80)))
  T('点 ✕ 关闭标签', after === before - 1, before + '->' + after)
  // ✕ 点击不应切换/影响其它逻辑(标签数正确即通过)
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
