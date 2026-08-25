// 真实服务器连接查看测试(只读,不执行任何命令)。凭据不入库。
const { _electron } = require('/tmp/shot/node_modules/playwright-core')
const HOST = process.env.ANCHOR_HOST || '113.46.161.35'
const USER = process.env.ANCHOR_USER || 'claude'
const PASS = process.env.ANCHOR_PASS || ''
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

  // 种入真实服务器书签
  await win.evaluate(([host, user, pass]) => {
    const s = window.store
    const old = s.bookmarks.find(b => b.title === 'real-ssh')
    if (old) s.delItem({ id: old.id }, 'bookmarks')
    const id = 'realssh' + Date.now()
    s.bookmarks.push({
      id, title: 'real-ssh', type: 'ssh',
      host, port: 17897, username: user,
      authType: 'password', password: pass
    })
    const def = s.bookmarkGroups.find(g => g.id === 'default')
    def.bookmarkIds = [...(def.bookmarkIds || []), id]
  }, [HOST, USER, PASS])
  await sleep(200)

  // 连接
  await win.evaluate(() => {
    window.store.onSelectBookmark(window.store.bookmarks.find(b => b.title === 'real-ssh').id)
  })
  await sleep(300)
  const tab = win.locator('.anchor-tab', { hasText: 'real-ssh' }).first()
  await tab.click()
  await sleep(300)
  T('会话标签出现', await win.evaluate(() => !!document.querySelector('.session-wrap')))

  // 首连:终端内出现主机指纹确认,输入 trust 应答(写入本地 known_hosts)
  await sleep(4000)
  await win.locator('.session-current .xterm-helper-textarea').click()
  await win.keyboard.type('trust')
  await win.keyboard.press('Enter')
  // 等待 SSH 握手 + 认证 + 远端输出
  await sleep(15000)
  console.log('STATUS:', await win.evaluate(() => window.store.tabs.map(t => t.title + ':' + t.status).join(', ')))
  console.log('DIALOG:', await win.evaluate(() => document.querySelectorAll('.ant-modal').length))
  const rendered = await win.evaluate(() => ({
    xterm: document.querySelectorAll('.xterm').length,
    screen: document.querySelectorAll('.xterm-screen').length,
    canvas: document.querySelectorAll('.xterm canvas').length,
    webgl: document.querySelectorAll('.xterm canvas, .xterm .webgl-render layers, .xterm-helper-textarea').length,
    rows: document.querySelectorAll('.xterm-rows > div').length,
    rowsText: (document.querySelector('.xterm-rows') || {}).textContent || '',
    sessions: window.store ? window.store.tabs.map(t => ({ t: t.title, st: t.status })) : []
  }))
  console.log('DBG:', JSON.stringify(rendered.sessions), '| rows:', rendered.rows, '| screen:', rendered.screen)
  T('xterm 挂载', rendered.xterm >= 1)
  T('渲染层就绪(screen/canvas/rows 任一)', rendered.screen >= 1 || rendered.canvas >= 1 || rendered.rows >= 1)
  T('SSH 会话连接成功(status=success)', rendered.sessions.some(x => x.t === 'real-ssh' && x.st === 'success'))

  await win.screenshot({ path: '/tmp/p4-real.png' })
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
