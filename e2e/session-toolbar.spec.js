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
  const T = (n, c, d) => results.push([(c ? 'PASS' : 'FAIL'), n, d || ''])
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
  await sleep(5000)
  await win.locator('.session-current .xterm-helper-textarea').click()

  // 搜索:开 → 输入 → 关
  await win.locator('.session-current .anticon-search').first().click()
  await sleep(600)
  T('搜索条打开', await win.evaluate(() => !!document.querySelector('.term-search-wrap input')))
  await win.keyboard.type('Cloud')
  await sleep(800)
  const matched = await win.evaluate(() => window.store.termSearchMatchCount)
  T('搜索命中计数', matched > 0, 'count=' + matched)
  await win.screenshot({ path: '/tmp/audit-search.png' })
  await win.evaluate(() => [...document.querySelectorAll('.term-search-act')].pop().click())
  await sleep(400)
  T('搜索图标关闭', await win.evaluate(() => !window.store.termSearchOpen))
  await sleep(400)
  T('搜索条关闭', await win.evaluate(() => !window.store.termSearchOpen))

  // 全屏:store.fullscreen 全局态(class 挂载依据)
  const fsBefore = await win.evaluate(() => window.store.fullscreen)
  await win.locator('.session-current .anticon-fullscreen').first().click()
  await sleep(1500)
  const fsAfter = await win.evaluate(() => window.store.fullscreen)
  T('进入全屏', !fsBefore && fsAfter, fsBefore + '->' + fsAfter)
  await win.screenshot({ path: '/tmp/audit-fs.png' })
  await win.evaluate(() => window.store.toggleSessFullscreen(false))
  await sleep(2000)

  // keepalive:electerm 设计默认关,验证开→关切换
  console.log('VIS after fs-exit:', await win.evaluate(() => {
    const el = document.querySelector('.keepalive-icon')
    const tabs = document.querySelector('.term-sftp-tabs')
    const ctrl = el ? el.closest('.term-controls, .session-control, [class*=control]') : null
    const r = el ? el.getBoundingClientRect() : null
    const st = el ? getComputedStyle(el) : null
    return {
      icon: r ? { w: r.width, h: r.height, fs: st.fontSize } : 'MISSING',
      tabsBox: tabs ? Math.round(tabs.getBoundingClientRect().width) + 'x' + Math.round(tabs.getBoundingClientRect().height) : 'MISSING',
      ctrlCls: ctrl ? ctrl.className.toString().slice(0, 50) : 'n/a',
      hasFsCls: !!document.querySelector('.fullscreen'),
      tabFs: window.store.tabs[0].fullscreen
    }
  }))
  const k1 = await win.evaluate(() => document.querySelector('.keepalive-icon').className.includes('active'))
  await win.locator('.keepalive-icon').click()
  await sleep(600)
  const k2 = await win.evaluate(() => document.querySelector('.keepalive-icon').className.includes('active'))
  T('keepalive 切换', k1 !== k2, k1 + '->' + k2)
  await win.locator('.keepalive-icon').click()

  // 广播输入切换
  const b1 = await win.evaluate(() => document.querySelector('.broadcast-icon').className.includes('active'))
  await win.locator('.broadcast-icon').click()
  await sleep(600)
  const b2 = await win.evaluate(() => document.querySelector('.broadcast-icon').className.includes('active'))
  T('广播输入切换', b1 !== b2, b1 + '->' + b2)
  await win.locator('.broadcast-icon').click()

  // Sftp 切换 + 回切(前面已 PASS,复验一次简版)
  await win.locator('.term-sftp-tabs .type-tab.sftp').click()
  await sleep(2000)
  T('Sftp 面板', await win.evaluate(() => {
    const f = document.querySelector('[class*=sftp]')
    return !!f && f.getBoundingClientRect().width > 100
  }))
  await win.locator('.term-sftp-tabs .type-tab.ssh').click()
  await sleep(1200)

  console.log('='.repeat(46))
  results.forEach(([s, n, d]) => console.log(s + '  ' + n + (d ? '  [' + d + ']' : '')))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
