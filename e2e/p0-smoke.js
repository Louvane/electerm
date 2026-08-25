const { _electron } = require('playwright-core')
;(async () => {
  const app = await _electron.launch({
    executablePath: '/Users/echo/projects/anchor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
    args: ['-r', 'dotenv/config', 'src/app/app'],
    cwd: '/Users/echo/projects/anchor',
    env: { ...process.env, NODE_ENV: 'development' }
  })
  const win = await app.firstWindow()
  await win.waitForTimeout(10000)
  await win.screenshot({ path: '/tmp/p0-shell.png' })
  const bridge = await win.evaluate(() => ({
    hasStore: !!window.store,
    tabs: window.store ? window.store.tabs.length : -1,
    tabTitle: window.store && window.store.tabs[0] ? window.store.tabs[0].title : null,
    theme: window.store && window.store.config ? window.store.config.theme : null,
    shellMounted: !!document.querySelector('.anchor-shell'),
    railText: document.querySelector('.anchor-rail') ? document.querySelector('.anchor-rail').textContent.slice(0, 60) : null
  }))
  console.log(JSON.stringify(bridge, null, 1))
  await app.close()
})().catch(e => { console.error('FATAL', e.message); process.exit(1) })
