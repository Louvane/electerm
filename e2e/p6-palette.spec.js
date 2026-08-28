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
  await win.evaluate(() => localStorage.removeItem('anchor-cmd-freq'))
  await win.reload()
  await win.waitForTimeout(3000)
  await win.evaluate(() => {
    window.store.quickCommands = [
      { id: 'c1', name: '甲命令', command: 'cmd-a' },
      { id: 'c2', name: '乙命令', command: 'cmd-b' },
      { id: 'c3', name: '丙命令', command: 'cmd-c' }
    ]
  })
  await win.click('button:has-text("⚡ 命令")')
  await sleep(300)
  console.log('DBG sel:', await win.evaluate(() => document.querySelector('.cp-item.sel')?.textContent || 'NONE'),
    '| items:', await win.locator('.cp-item').count(),
    '| kw:', await win.evaluate(() => window._kw === undefined ? 'n/a' : 'x'))
  // 排序后首项(中文 localeCompare:丙→甲→乙)
  T('默认选中第 0 项', await win.evaluate(() => document.querySelector('.cp-item.sel .cp-name')?.textContent) === '丙命令')
  await win.keyboard.press('ArrowDown')
  await win.keyboard.press('ArrowDown')
  await sleep(150)
  T('↓↓ 选中第三项', await win.evaluate(() => document.querySelector('.cp-item.sel .cp-name')?.textContent) === '乙命令')
  await win.keyboard.press('Enter')
  await sleep(300)
  T('Enter 执行选中项', await win.evaluate(() => document.body.textContent.includes('请先连接')))
  await win.keyboard.press('Escape')
  await sleep(300)
  // 频次:c3 执行 1 次 → 浮顶
  await win.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('anchor-cmd-freq') || '{}')
    f.c3 = (f.c3 || 0) + 1
    localStorage.setItem('anchor-cmd-freq', JSON.stringify(f))
  })
  await win.click('button:has-text("⚡ 命令")')
  await sleep(300)
  T('频次浮顶', await win.evaluate(() => document.querySelector('.cp-item .cp-name')?.textContent === '丙命令'))
  await win.fill('.cp-search', '甲')
  await sleep(200)
  await win.keyboard.press('Enter')
  await sleep(200)
  T('搜索+Enter 触发执行(无会话警告)', await win.evaluate(() => document.body.textContent.includes('请先连接')))
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
