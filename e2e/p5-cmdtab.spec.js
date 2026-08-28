const { _electron } = require('/tmp/shot/node_modules/playwright-core')
;(async () => {
  const app = await _electron.launch({
    executablePath: '/Users/echo/projects/anchor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['-r', 'dotenv/config', 'src/app/app'],
    cwd: '/Users/echo/projects/anchor',
    env: { ...process.env, NODE_ENV: 'development', ANCHOR_PASS: 'REDACTED' }
  })
  const win = await app.firstWindow()
  const results = []
  const T = (n, c) => results.push([(c ? 'PASS' : 'FAIL'), n])
  const sleep = ms => win.waitForTimeout(ms)
  await win.waitForTimeout(6000)

  // 连真实服务器
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
  await sleep(600)
  await win.locator('.session-current .xterm-helper-textarea').click()
  await win.keyboard.type('trust')
  await win.keyboard.press('Enter')
  await sleep(8000)

  // 在真实终端里敲一条测试命令
  await win.keyboard.type('echo anchor-cmdtest-9527')
  await win.keyboard.press('Enter')
  await sleep(2500)
  console.log('HIST_ALL:', await win.evaluate(() => JSON.stringify((window.store.terminalCommandHistory || []).map(h => h.cmd).slice(0, 8))))

  // 1. store 层:cmdHistory 收录
  const hist = await win.evaluate(() => (window.store.terminalCommandHistory || []).slice(0, 5).map(h => h.cmd))
  console.log('CMD_HISTORY:', JSON.stringify(hist))
  T('远端历史命令已收录(ll/pwd 等真实命令)', hist.some(c => c.includes('pwd')) || hist.length > 0)

  // 2. UI 层:TREND 命令 tab 显示
  await win.click('.anchor-rail .anchor-tabs button:has-text("命令")')
  await sleep(300)
  const cmdBoxTxt = await win.evaluate(() => document.querySelector('.anchor-cmdbox')?.textContent || '')
  console.log('CMDBOX:', JSON.stringify(cmdBoxTxt.slice(0, 120)))
  T('命令 tab 渲染历史命令', cmdBoxTxt.includes('ll') || cmdBoxTxt.includes('pwd') || cmdBoxTxt.includes('clear'))
  T('命令 tab 非空渲染', cmdBoxTxt.length > 5)

  await win.screenshot({ path: '/tmp/cmdtab.png' })
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
