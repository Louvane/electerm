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

  // 清历史,进 ALL HOSTS 态
  await win.evaluate(() => { window.store.history = [] })
  await sleep(300)
  T('ALL HOSTS 态', await win.evaluate(() => document.body.textContent.includes('ALL HOSTS')))
  T('清空按钮常显', await win.locator('button.hint', { hasText: '清空记录' }).count() === 1)

  // ALL 模式点清空 → 引导态
  await win.click('button.hint >> text=清空记录')
  await sleep(300)
  T('ALL 模式清空 → 引导态', await win.locator('.qc-empty').count() === 1)

  // 新建主机 → 列表恢复(非引导)
  await win.click('.qc-empty button:has-text("新建主机")')
  await sleep(300)
  await win.fill('#fName', '恢复机')
  await win.fill('#fIp', '10.9.9.9')
  await win.click('button:has-text("保存主机")')
  await sleep(300)
  T('新主机后列表恢复', await win.evaluate(() => document.body.textContent.includes('ALL HOSTS') && document.body.textContent.includes('恢复机')))

  await win.screenshot({ path: '/tmp/qc-cleared.png' })
  console.log('='.repeat(40))
  results.forEach(([s, n]) => console.log(s + '  ' + n))
  console.log(`合计 ${results.filter(r => r[0] === 'PASS').length}/${results.length}`)
  if (results.some(r => r[0] === 'FAIL')) process.exitCode = 1
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
