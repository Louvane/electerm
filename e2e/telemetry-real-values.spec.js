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
    s.bookmarks = s.bookmarks.filter(b => b.title !== 'real-ssh')
    const id = 'realssh' + Date.now()
    s.bookmarks.push({ id, title: 'real-ssh', type: 'ssh', host: '113.46.161.35', port: 17897, username: 'claude', authType: 'password', password: 'REDACTED' })
    const def = s.bookmarkGroups.find(g => g.id === 'default')
    def.bookmarkIds = [...(def.bookmarkIds || []), id]
    s.onSelectBookmark(id)
  })
  await sleep(3000)
  // 走真实 UI:点标签 → view=term → 会话建立
  await win.locator('.anchor-tab', { hasText: 'real-ssh' }).first().click()
  await sleep(8000)
  const txt = await win.evaluate(() => (document.querySelector('.anchor-rail') || {}).textContent || 'NO-RAIL')
  const flat = txt.replace(/\s+/g, ' ')
  console.log('RAIL:', flat.slice(0, 180))
  const mem = flat.match(/(\d+\.?\d*)G \/ (\d+\.?\d*)G/)
  T('内存真实值(GB 范围内,非 32G 假数据)', !!mem && +mem[2] < 64, mem && mem[0])
  T('运行时间有值', /运行时间 \d+d|\d+h|\d+m /.test(flat))
  T('负载有值', /负载 \d+\.\d+ \d+\.\d+ \d+\.\d+/.test(flat))
  T('CPU 有值', /CPU \d+%/.test(flat))
  T('网络有值(K 单位)', /[\d.]+K\/s/.test(flat))
  // 仪表宽度是百分比:取 width 样式检查
  const widths = await win.evaluate(() => [...document.querySelectorAll('.gauge .rail > div')].map(el => el.style.width))
  T('仪表宽度为 % 单位', widths.every(w => w.endsWith('%')), JSON.stringify(widths))
  await win.screenshot({ path: '/tmp/rail-final.png' })
  console.log('='.repeat(46))
  results.forEach(([s, n, d]) => console.log(s + '  ' + n + (d ? '  [' + d + ']' : '')))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
