// src/test/e2e/helpers/anchor-e2e.js
const { chromium } = require('playwright-core')
const { execSync } = require('child_process')

async function launchAnchor (bookmarkId = 'EGZ_VPT') {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const win = browser.contexts()[0].pages().find(p => p.url().includes('index.html'))
  for (let i = 0; i < 20; i++) {
    if (await win.evaluate(() => !!window.store).catch(() => false)) break
    await win.waitForTimeout(1000)
  }
  await win.evaluate(id => { window.store.onSelectBookmark(id) }, bookmarkId)
  await win.waitForTimeout(3000)
  await win.evaluate(() => { const el = document.querySelector('.anchor-tab'); if (el) el.click() })
  await win.waitForTimeout(10000)
  return { browser, win }
}

async function gotoSftp (win) {
  await win.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.type-tab'))
    const sftp = tabs.find(t => t.innerText.toLowerCase().includes('sftp'))
    if (sftp) sftp.click()
  })
  await win.waitForTimeout(2000)
}

async function pushDownload (win, fromPath, name, size, toPath) {
  return win.evaluate(async (a) => {
    const tab = window.store.tabs[window.store.tabs.length - 1]
    const id = 'e2e-dl-' + Date.now()
    await window.store.addTransferList([{
      id,
      tabId: tab.id,
      typeFrom: 'remote',
      typeTo: 'local',
      fromPath: a.fromPath,
      toPath: a.toPath,
      fromFile: { name: a.name, size: a.size, isDirectory: false, mode: 420 },
      toFile: { name: 'x', isDirectory: false },
      path: a.fromPath.split('/').slice(0, -1).join('/')
    }])
    return id
  }, { fromPath, name, size, toPath })
}

async function cleanupTransfers (win) {
  await win.evaluate(() => {
    window.store.setConfig({ transferRateLimitMB: 0 })
    window.store.fileTransfers.splice(0, window.store.fileTransfers.length)
  })
  execSync('rm -f /tmp/e2e_* /tmp/pk_* 2>/dev/null; true')
}

module.exports = { launchAnchor, gotoSftp, pushDownload, cleanupTransfers }
