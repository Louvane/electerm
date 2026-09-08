// src/test/e2e/01-window.spec.js
// Task 2: 启动/窗口/退出域 — 只读验证，不改配置、不关窗、不碰持久化
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')
const pkg = require('../../../package.json')

const root = path.resolve(__dirname, '../../..')
function srcHas (rel, s) {
  return fs.readFileSync(path.join(root, rel), 'utf8').includes(s)
}

async function main () {
  const fails = []
  // 断言 1: splash 背景色 #eef1f5（主窗口 backgroundColor，静态只读）
  if (!srcHas('src/app/lib/create-window.js', "backgroundColor: '#eef1f5'")) {
    fails.push('SPLASH-BG-MISMATCH')
  }
  // 断言 2: 版本号与 package.json 一致（需求原文转录）
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const win = browser.contexts()[0].pages().find(p => p.url().includes('index.html'))
  const r = await win.evaluate(() => JSON.stringify({
    ver: window.et.version,
    railVer: (document.querySelector('.monitor-rail .app-version') || {}).innerText || null
  }))
  console.log('WIN:', r, 'pkg:', pkg.version)
  const j = JSON.parse(r)
  if (j.ver !== pkg.version) {
    console.log('VERSION-MISMATCH')
    fails.push('VERSION-MISMATCH')
  }
  // 断言 3: confirmBeforeExit 开时关窗弹确认 — 只验链路接线，不改配置、不弹框
  const wiring = await win.evaluate(() => JSON.stringify({
    hasBeforeExitApp: typeof (window.store && window.store.beforeExitApp) === 'function',
    confirmKey: !!(window.store && window.store.config && ('confirmBeforeExit' in window.store.config))
  }))
  console.log('EXIT-WIRING:', wiring)
  const w = JSON.parse(wiring)
  if (!w.hasBeforeExitApp || !w.confirmKey) fails.push('EXIT-WIRING-MISMATCH')
  if (!srcHas('src/app/lib/on-close.js', "send('confirm-exit'")) fails.push('EXIT-MAIN-MISMATCH')
  // 断言 4: 点×=退出无残留 — 共享 dev 实例不可真关，只静态验证退出路径杀子进程+quit
  if (!srcHas('src/app/lib/on-close.js', 'process.kill(childPid)') ||
    !srcHas('src/app/lib/on-close.js', 'app.quit')) {
    fails.push('EXIT-CLEANUP-MISMATCH')
  }
  if (fails.length) {
    console.log('WIN-FAIL', fails.join(','))
    process.exit(1)
  }
  console.log('WIN-PASS')
  process.exit(0)
}
main().catch(e => { console.log('WIN-ERR', e.message.slice(0, 60)); process.exit(1) })
