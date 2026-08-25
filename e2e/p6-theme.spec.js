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
  const errs = []
  win.on('pageerror', e => errs.push(e.message))
  const T = (n, c) => results.push([(c ? 'PASS' : 'FAIL'), n])
  const sleep = ms => win.waitForTimeout(ms)

  await win.waitForTimeout(6000)
  await win.evaluate(() => window.localStorage.removeItem('anchor-theme'))
  await win.reload()
  await win.waitForTimeout(2000)

  const theme0 = await win.evaluate(() => document.body.dataset.anchorTheme)
  T('默认主题存在(dark 或 light)', theme0 === 'dark' || theme0 === 'light')
  const ink0 = await win.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink0').trim())
  T('ink0 token 已注入', ink0.length > 0)

  await win.click('.anchor-theme-btn')
  await sleep(300)
  const theme1 = await win.evaluate(() => document.body.dataset.anchorTheme)
  T('切换生效', theme1 !== theme0)
  const ink0b = await win.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink0').trim())
  T('token 随主题变化', ink0b !== ink0)

  await win.reload()
  await win.waitForTimeout(2000)
  T('reload 后主题保持', await win.evaluate(() => document.body.dataset.anchorTheme) === theme1)

  if (theme1 === 'light') {
    await win.click('.anchor-theme-btn')
    await sleep(200)
  }
  await win.evaluate(() => window.store.addTab({ title: '本地' }))
  await sleep(300)
  await win.locator('.anchor-tab', { hasText: '本地' }).first().click()
  await sleep(2500)
  const dbg = await win.evaluate(() => ({
    view: document.body.querySelectorAll('.page-home').length,
    termWraps: document.querySelectorAll('.term-wrap').length,
    loading: document.querySelectorAll('.loading-wrapper').length,
    xterm: document.querySelectorAll('.xterm').length,
    wraps: document.querySelectorAll('.session-wrap').length,
    tabs: window.store.tabs.map(t => t.title + ':' + t.status),
    hasNodePty: window.store.hasNodePty
  }))
  console.log('DBG:', JSON.stringify(dbg))
  const xterms = await win.evaluate(() => document.querySelectorAll('.xterm-screen').length)
  T('light 模式下终端正常渲染', xterms >= 2)

  await win.click('.anchor-mgr-btn')
  await sleep(300)
  await win.click('.mg-tools .tl >> text=＋ 主机')
  await sleep(300)
  await win.locator('.ant-drawer .ant-select').first().click()
  await sleep(300)
  const ddBg = await win.evaluate(() => {
    const dd = [...document.querySelectorAll('.ant-select-dropdown')].find(d => d.offsetParent !== null || d.classList.contains('ant-select-dropdown-open'))
    return dd ? getComputedStyle(dd).backgroundColor : 'none'
  })
  const isDark = await win.evaluate(() => document.body.dataset.anchorTheme === 'dark')
  T('下拉浮层随主题', isDark ? ddBg === 'rgb(28, 37, 52)' : ddBg !== 'rgb(28, 37, 52)')

  await win.screenshot({ path: '/tmp/p6-theme.png' })
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}` + (errs.length ? ' | JS错误:' + errs[0] : ' | 无JS错误'))
  if (results.some(r => r[0] === 'FAIL') || errs.length) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
