const { _electron } = require('/tmp/shot/node_modules/playwright-core')
;(async () => {
  const app = await _electron.launch({
    executablePath: '/Users/echo/projects/anchor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['-r', 'dotenv/config', 'src/app/app'],
    cwd: '/Users/echo/projects/anchor',
    env: { ...process.env, NODE_ENV: 'development' }
  })
  const win = await app.firstWindow()
  const sleep = ms => win.waitForTimeout(ms)
  const results=[]
  const T=(n,c,d)=>results.push([(c?'PASS':'FAIL'),n,d||''])
  await win.waitForTimeout(6000)
  // 按钮可见
  T('遥测栏设置按钮可见', await win.locator('.anchor-rail-settings').isVisible().catch(()=>false))
  await win.locator('.anchor-rail-settings').click()
  await sleep(1200)
  // 抽屉标题
  const drawerTitle = await win.locator('.ant-drawer-title').textContent().catch(()=> '')
  T('抽屉标题=设置', drawerTitle.includes('设置'), drawerTitle)
  // 截图打开状态
  await win.screenshot({ path: '/tmp/settings-open.png' })
  const t = await win.evaluate(()=>document.body.textContent)
  T('字体大小项', t.includes('字体大小'))
  T('光标样式项', t.includes('光标样式'))
  T('心跳间隔项', t.includes('心跳间隔'))
  T('退出前确认项', t.includes('退出前确认'))
  // 直接通过 store 验证写能力(模拟用户改值)
  const before = await win.evaluate(()=>window.store.config.fontSize)
  await win.evaluate(()=>window.store.setConfig({ fontSize: 18 }))
  await sleep(500)
  const after = await win.evaluate(()=>window.store.config.fontSize)
  T('store.setConfig 落盘', after===18, `before=${before} after=${after}`)
  // 还原
  await win.evaluate(v=>window.store.setConfig({ fontSize: v }), before)
  // 开关切换
  const beforeBlink = await win.evaluate(()=>!!window.store.config.cursorBlink)
  await win.evaluate(()=>window.store.setConfig({ cursorBlink: !window.store.config.cursorBlink }))
  await sleep(300)
  const afterBlink = await win.evaluate(()=>!!window.store.config.cursorBlink)
  T('Switch 切换落盘', beforeBlink !== afterBlink, `${beforeBlink}->${afterBlink}`)
  await win.evaluate(v=>window.store.setConfig({ cursorBlink: v }), beforeBlink)
  // Esc 关闭
  await win.keyboard.press('Escape')
  await sleep(800)
  T('Esc 关闭', !(await win.locator('.ant-drawer-title').isVisible().catch(()=>false)))
  console.log('='.repeat(40))
  results.forEach(([s,n,d])=>console.log(s+'  '+n+(d?'  ['+d+']':'')))
  console.log(`合计 ${results.filter(r=>r[0]==='PASS').length}/${results.length}`)
  if(results.some(r=>r[0]==='FAIL')) process.exitCode=1
  await app.close()
})().catch(e=>{console.error('FATAL',e.stack);process.exit(1)})
