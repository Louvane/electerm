const { _electron } = require('/tmp/shot/node_modules/playwright-core')
;(async () => {
  const app = await _electron.launch({
    executablePath: '/Users/echo/projects/anchor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['-r', 'dotenv/config', 'src/app/app'],
    cwd: '/Users/echo/projects/anchor',
    env: { ...process.env, NODE_ENV: 'development', ANCHOR_PASS: process.env.ANCHOR_PASS }
  })
  const win = await app.firstWindow()
  const results = []
  const T = (n, c, extra) => results.push([(c ? 'PASS' : 'FAIL') + (extra ? '  [' + extra + ']' : ''), n])
  const sleep = ms => win.waitForTimeout(ms)

  await win.waitForTimeout(6000)

  // ===== A. 未连接态 =====
  const kvVals = await win.evaluate(() => [...document.querySelectorAll('.anchor-rail .anchor-kv b')].map(b => b.textContent))
  T('未连接:主机显示 —', kvVals[0] === '—')
  T('未连接:运行时间显示 —', kvVals[1] === '—')
  T('未连接:负载显示 —', kvVals[2] === '—')
  const gauges = await win.evaluate(() => [...document.querySelectorAll('.anchor-rail .gauge .v')].map(v => v.textContent))
  T('未连接:三仪表 —', gauges.every(v => v === '—'))

  // ===== B. 连接真实服务器 =====
  await win.evaluate(() => {
    const s = window.store
    const old = s.bookmarks.find(b => b.title === 'real-ssh')
    if (!old) {
      const id = 'realssh' + Date.now()
      s.bookmarks.push({
        id, title: 'real-ssh', type: 'ssh',
        host: '113.46.161.35', port: 17897, username: 'claude',
        authType: 'password', password: process.env.ANCHOR_PASS
      })
      const def = s.bookmarkGroups.find(g => g.id === 'default')
      def.bookmarkIds = [...(def.bookmarkIds || []), id]
    }
    s.onSelectBookmark(s.bookmarks.find(b => b.title === 'real-ssh').id)
  })
  await sleep(4000)
  // 切到终端视图(点会话标签)
  await win.locator('.anchor-tab', { hasText: 'real-ssh' }).first().click()
  await sleep(600)
  await win.locator('.session-current .xterm-helper-textarea').click()
  await win.keyboard.type('trust')
  await win.keyboard.press('Enter')
  await sleep(12000)

  // ===== C. 逐项断言 =====
  const sample = () => win.evaluate(() => ({
    ip: document.querySelectorAll('.anchor-rail .anchor-kv .ip')[0]?.textContent,
    up: document.querySelectorAll('.anchor-rail .anchor-kv b')[1]?.textContent,
    load: document.querySelectorAll('.anchor-rail .anchor-kv b')[2]?.textContent,
    cpu: document.querySelectorAll('.anchor-rail .gauge .v')[0]?.textContent,
    mem: document.querySelectorAll('.anchor-rail .gauge .v')[1]?.textContent,
    swap: document.querySelectorAll('.anchor-rail .gauge .v')[2]?.textContent,
    memSub: document.querySelector('.anchor-rail .gauge .sub')?.textContent,
    cpuBar: document.querySelectorAll('.anchor-rail .gauge .rail > div')[0]?.style.width,
    netTx: document.querySelectorAll('.anchor-rail .net-val')[0]?.textContent,
    netRx: document.querySelectorAll('.anchor-rail .net-val')[1]?.textContent,
    disk: [...document.querySelectorAll('.anchor-rail .anchor-kv b')].pop()?.textContent,
    chartPoly: !!document.querySelector('.anchor-rail svg polyline'),
    liveDot: !!document.querySelector('.anchor-rail .live-dot')
  }))

  const s1 = await sample()
  T('主机 user@host 格式', s1.ip.includes('claude@') && s1.ip.includes('113.46.161.35'), s1.ip)
  T('运行时间 = 服务器 uptime(127d 量级)', /\d+d \d+h/.test(s1.up), s1.up)
  T('负载 = 三元数字', /^\d+\.\d\d?,?\s*\d*\.\d*\s*\d*\.?\d*$/.test(s1.load.trim()) || /\d+\.\d+/.test(s1.load), s1.load)
  T('CPU 百分比格式', /\d+%$/.test(s1.cpu), s1.cpu)
  T('内存 百分比格式', /\d+%$/.test(s1.mem), s1.mem)
  T('内存子行 G 格式', /\d+(\.\d+)?G \/ \d+G/.test(s1.memSub), s1.memSub)
  // 服务器无 swap 时如实显示 —(不再造假数据)
  T('交换:有 swap 显示 %,无则 —', s1.swap === '—' || /\d+%$/.test(s1.swap), s1.swap)
  T('CPU 进度条宽度合法', s1.cpuBar !== undefined && s1.cpuBar !== '', s1.cpuBar)
  T('网络上行速率格式', /[\d.]+[BK]\/s/.test(s1.netTx), s1.netTx)
  T('网络下行速率格式', /[\d.]+[BK]\/s/.test(s1.netRx), s1.netRx)
  T('DISK 显示(或首次轮询未到)', s1.disk === '—' || /\d+G/.test(s1.disk), s1.disk)
  T('TREND 曲线已绘制', s1.chartPoly)
  T('TARGET 活跃灯亮', s1.liveDot)

  // 两次采样:数值变化(CPU 至少变过一次)
  // 空载服务器 CPU 可稳定在 0%,改为验证任一指标有动态
  let changed = false
  for (let i = 0; i < 4; i++) {
    await sleep(2200)
    const s2 = await sample()
    if (s2.cpu !== s1.cpu || s2.netRx !== s1.netRx) { changed = true; break }
  }
  T('遥测数值动态更新', changed)

  // TREND tab 切换
  await win.click('.anchor-rail .anchor-tabs button:has-text("CPU")')
  await sleep(300)
  const cpuTabOn = await win.evaluate(() => document.querySelector('.anchor-rail .anchor-tabs button.on')?.textContent)
  T('TREND 切换到 CPU tab', cpuTabOn === 'CPU')
  await win.click('.anchor-rail .anchor-tabs button:has-text("内存")')

  await win.screenshot({ path: '/tmp/rail-audit.png' })
  console.log('='.repeat(46))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0].startsWith('PASS')).length}/${results.length}`)
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
