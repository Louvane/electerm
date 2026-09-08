// src/test/e2e/helpers/anchor-e2e.js
const { chromium } = require('playwright-core')
const { execSync } = require('child_process')

// 新建一个连接 session(保证活跃), 返回新 tab id
async function freshSession (win, bookmarkId = 'EGZ_VPT') {
  await win.evaluate(id => { window.store.onSelectBookmark(id) }, bookmarkId)
  await win.waitForTimeout(12000)
  return win.evaluate(() => window.store.tabs[window.store.tabs.length - 1].id)
}

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
    // 传输挂到最新 tab(由 freshSession 新建, session 必活)
    const tab = window.store.tabs[window.store.tabs.length - 1]
    const id = 'e2e-dl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
    await window.store.addTransferList([{
      id,
      tabId: tab.id,
      typeFrom: 'remote',
      typeTo: 'local',
      fromPath: a.fromPath,
      toPath: a.toPath,
      fromFile: { name: a.name, size: a.size, isDirectory: false, mode: 420, type: 'remote', modifyTime: Date.now() },
      toFile: { name: 'x', isDirectory: false, type: 'local', modifyTime: Date.now() },
      path: a.fromPath.split('/').slice(0, -1).join('/')
    }])
    return id
  }, { fromPath, name, size, toPath })
}

// 上传版 pushDownload: 本地 fromPath → 远端 toPath
async function pushUpload (win, fromPath, name, size, toPath) {
  return win.evaluate(async (a) => {
    // 传输挂到最新 tab(由 freshSession 新建, session 必活)
    const tab = window.store.tabs[window.store.tabs.length - 1]
    const id = 'e2e-up-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
    await window.store.addTransferList([{
      id,
      tabId: tab.id,
      typeFrom: 'local',
      typeTo: 'remote',
      fromPath: a.fromPath,
      toPath: a.toPath,
      fromFile: { name: a.name, size: a.size, isDirectory: false, mode: 420, type: 'local', modifyTime: Date.now() },
      toFile: { name: 'x', isDirectory: false, type: 'remote', modifyTime: Date.now() },
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

module.exports = { launchAnchor, freshSession, gotoSftp, pushDownload, pushUpload, cleanupTransfers }
