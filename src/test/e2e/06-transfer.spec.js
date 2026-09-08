// src/test/e2e/06-transfer.spec.js
// 用法: MODE=dl|up|mix|pause|limit|conflict|cancel|expand node src/test/e2e/06-transfer.spec.js
// 文件传输域参数化用例, 每个 MODE 独立进程跑, 防状态污染
const { execSync } = require('child_process')
const fs = require('fs')
const {
  launchAnchor,
  freshSession,
  pushDownload,
  pushUpload,
  cleanupTransfers
} = require('./helpers/anchor-e2e')

const MODE = process.env.MODE
// brief 中 echo@192.168.214 不可达(inet_aton 解析为 192.168.0.214),
// OrbStack 机器实际经 @orb 代理别名 + 同一密钥(echo@ubuntu@orb)可达, 仍纯密钥认证
const SSH_CMD = 'ssh -i ~/.orbstack/ssh/id_ed25519 -o StrictHostKeyChecking=no -o BatchMode=yes echo@ubuntu@orb'
const REMOTE_BIG = '/var/cache/apt/pkgcache.bin'
const LOCAL_BIG = '/Users/echo/Downloads/test1.jar'

function sh (cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    throw new Error(`cmd fail: ${cmd}\n${e.stderr || e.message}`)
  }
}

function ssh (cmd) {
  return sh(`${SSH_CMD} '${cmd}'`)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function poll (fn, timeoutMs, label) {
  const t0 = Date.now()
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting: ${label}`)
    await sleep(400)
  }
}

const getTr = (win, id) => win.evaluate(i => window.store.fileTransfers.find(t => t.id === i) || null, id)

async function waitSftpReady (win) {
  return poll(() => win.evaluate(() => {
    const tab = window.store.tabs[window.store.tabs.length - 1]
    const s = window.refs.get('sftp-' + tab.id)
    return !!(s && s.sftp)
  }), 30000, 'sftp session ready')
}

async function waitFinish (win, id, timeoutMs) {
  return poll(async () => !(await getTr(win, id)), timeoutMs, `transfer ${id} removed from fileTransfers`)
}

const domCount = (win, sel) => win.evaluate(s => document.querySelectorAll(s).length, sel)
const domText = (win, sel) => win.evaluate(s => {
  const el = document.querySelector(s)
  return el ? el.textContent : null
}, sel)

// 当前激活 session 内打开 sftp 面板(多 tab 时避免点到旧 session 的 type-tab)
async function openSftpPane (win) {
  await win.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.session-current .type-tab'))
    const sftp = tabs.find(t => t.innerText.toLowerCase().includes('sftp'))
    if (sftp) sftp.click()
  })
  await sleep(1500)
}

// MODE=dl: 下载 pkgcache.bin(54MB) 不限速 → 完成 → fileTransfers 清空 → /tmp/e2e_dl 存在且 md5 与远端一致
async function modeDl (win) {
  const size = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const rmd5 = ssh(`md5sum ${REMOTE_BIG}`).split(/\s+/)[0]
  const id = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_dl')
  await waitFinish(win, id, 180000)
  const st = fs.statSync('/tmp/e2e_dl')
  const lmd5 = sh('md5 -q /tmp/e2e_dl')
  if (st.size !== size) throw new Error(`size mismatch remote=${size} local=${st.size}`)
  if (lmd5 !== rmd5) throw new Error(`md5 mismatch remote=${rmd5} local=${lmd5}`)
  console.log(`XFER-DL evidence size=${st.size} md5=${lmd5}`)
}

// MODE=up: 上传 test1.jar(88MB) → 远端 /tmp/e2e_up.jar → ssh md5 比对 → 远端删除
async function modeUp (win) {
  const size = fs.statSync(LOCAL_BIG).size
  const lmd5 = sh(`md5 -q ${LOCAL_BIG}`)
  ssh('rm -f /tmp/e2e_up.jar')
  const id = await pushUpload(win, LOCAL_BIG, 'test1.jar', size, '/tmp/e2e_up.jar')
  await waitFinish(win, id, 180000)
  const rmd5 = ssh('md5sum /tmp/e2e_up.jar').split(/\s+/)[0]
  const rsize = parseInt(ssh('stat -c %s /tmp/e2e_up.jar'), 10)
  if (rsize !== size) throw new Error(`size mismatch local=${size} remote=${rsize}`)
  if (rmd5 !== lmd5) throw new Error(`md5 mismatch local=${lmd5} remote=${rmd5}`)
  console.log(`XFER-UP evidence size=${size} md5=${rmd5}`)
}

// MODE=mix: 上+下同时 → 聚合条 ⇅ → 明细 ↑/↓ 双色
async function modeMix (win) {
  await openSftpPane(win)
  await win.evaluate(() => window.store.setConfig({ transferRateLimitMB: 4 }))
  const rsize = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const lsize = fs.statSync(LOCAL_BIG).size
  ssh('rm -f /tmp/e2e_mix_up.jar /tmp/e2e_mix_dl')
  const upId = await pushUpload(win, LOCAL_BIG, 'test1.jar', lsize, '/tmp/e2e_mix_up.jar')
  const dlId = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', rsize, '/tmp/e2e_mix_dl')
  await poll(async () => {
    const u = await getTr(win, upId)
    const d = await getTr(win, dlId)
    return !!(u && d && u.inited && d.inited)
  }, 30000, 'both transfers inited')
  const label = await domText(win, '.sftp-progress-name')
  if (!label || !label.includes('⇅')) throw new Error(`aggregate bar missing ⇅: ${label}`)
  // 页内原生 click(绕开 Playwright 合成点击的可见性探测)
  await win.evaluate(() => { document.querySelector('.sftp-progress-top')?.click() })
  await poll(async () => {
    const down = await domCount(win, '.sftp-progress-row-dir.down')
    const up = await domCount(win, '.sftp-progress-row-dir.up')
    return down >= 1 && up >= 1
  }, 20000, 'expanded rows dual color(↑/↓)')
  const rows = await domCount(win, '.sftp-progress-row')
  await waitFinish(win, upId, 180000)
  await waitFinish(win, dlId, 180000)
  if (fs.statSync('/tmp/e2e_mix_dl').size !== rsize) throw new Error('mix download size mismatch')
  const rmd5 = ssh('md5sum /tmp/e2e_mix_up.jar').split(/\s+/)[0]
  if (rmd5 !== sh(`md5 -q ${LOCAL_BIG}`)) throw new Error('mix upload md5 mismatch')
  console.log(`XFER-MIX evidence bar="${String(label).trim()}" rows=${rows} upMd5=${rmd5}`)
}

// MODE=pause: 下载中暂停 → transferred 冻结 3s → 恢复 → 完成
// 与 UI ⏸ 按钮同路径: refs.get('transport-'+id).pause()/resume()
async function modePause (win) {
  await win.evaluate(() => window.store.setConfig({ transferRateLimitMB: 4 }))
  const size = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const id = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_pause')
  await poll(async () => {
    const t = await getTr(win, id)
    return !!(t && t.inited && (t.transferred || 0) > 0)
  }, 30000, 'pause: transfer progressing')
  await win.evaluate(i => window.refs.get('transport-' + i)?.pause(), id)
  await poll(async () => {
    const t = await getTr(win, id)
    return !!(t && t.pausing === true)
  }, 10000, 'pause: pausing flag set')
  await sleep(4000) // 等 onData 节流(3s)最后一次冲刷落地
  const t1 = (await getTr(win, id)).transferred
  await sleep(3000)
  const t2 = (await getTr(win, id)).transferred
  if (t2 - t1 > 131072) throw new Error(`transferred not frozen: t1=${t1} t2=${t2} delta=${t2 - t1}`)
  await win.evaluate(i => window.refs.get('transport-' + i)?.resume(), id)
  await poll(async () => {
    const t = await getTr(win, id)
    return !t || t.pausing !== true
  }, 10000, 'pause: resumed')
  await waitFinish(win, id, 180000)
  const st = fs.statSync('/tmp/e2e_pause')
  const lmd5 = sh('md5 -q /tmp/e2e_pause')
  const rmd5 = ssh(`md5sum ${REMOTE_BIG}`).split(/\s+/)[0]
  if (st.size !== size) throw new Error(`size mismatch remote=${size} local=${st.size}`)
  if (lmd5 !== rmd5) throw new Error(`md5 mismatch remote=${rmd5} local=${lmd5}`)
  console.log(`XFER-PAUSE evidence frozen t1=${t1} t2=${t2} md5=${lmd5}`)
}

// MODE=limit: 限速 2MB/s → 速率断言 1.5~2.8MB/s(窗口节流精度)
// speed 为累计均速(transferred/elapsed), 需 ≥8s 摊薄首发突发(concurrency×chunk 未节流)
async function modeLimit (win) {
  await win.evaluate(() => window.store.setConfig({ transferRateLimitMB: 2 }))
  const size = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const id = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_limit')
  await poll(async () => {
    const t = await getTr(win, id)
    return !!(t && t.inited && (t.transferred || 0) > 3 * 1024 * 1024)
  }, 30000, 'limit: transfer past warmup burst')
  await poll(async () => {
    const t = await getTr(win, id)
    return !t || (Date.now() - (t.startTime || 0) >= 8000 && !!t.speed)
  }, 30000, 'limit: 8s amortized')
  // 窗口增量测速: speed 字段是含建立开销的累计均速, 口径偏低, 不能用于精度判定
  const samples = []
  let prev = null
  let prevTs = 0
  for (let i = 0; i < 8; i++) {
    const t = await getTr(win, id)
    if (!t) break
    const now = Date.now()
    const tr = t.transferred || 0
    if (prev !== null) {
      const mbps = (tr - prev) / ((now - prevTs) / 1000) / (1000 * 1000)
      samples.push(mbps)
    }
    prev = tr
    prevTs = now
    await sleep(1500)
  }
  if (samples.length < 4) throw new Error(`insufficient speed samples: [${samples.join(',')}]`)
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length
  if (avg < 1.5 || avg > 2.8) throw new Error(`speed out of 1.5~2.8MB/s: avg=${avg.toFixed(2)} [${samples.map(v => v.toFixed(2)).join(',')}]`)
  await waitFinish(win, id, 180000)
  const st = fs.statSync('/tmp/e2e_limit')
  if (st.size !== size) throw new Error(`size mismatch remote=${size} local=${st.size}`)
  console.log(`XFER-LIMIT evidence avg=${avg.toFixed(2)}MB/s samples=[${samples.map(v => v.toFixed(2)).join(',')}] size=${st.size}`)
}

// MODE=conflict: 下载到已存在路径 → .custom-modal-wrap 出现 → 点「跳过」→ 传输取消无残留
async function modeConflict (win) {
  sh('printf conflict-e2e > /tmp/e2e_conflict')
  const size = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const id = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_conflict')
  await poll(() => domCount(win, '.custom-modal-wrap').then(n => n >= 1), 30000, 'conflict modal appears')
  const clicked = await win.evaluate(() => {
    const want = window.translate('skip')
    const btn = Array.from(document.querySelectorAll('.custom-modal-wrap .cr-btn'))
      .find(b => b.textContent.trim() === want)
    if (!btn) return false
    btn.click()
    return true
  })
  if (!clicked) throw new Error('skip button not found in conflict modal')
  await poll(() => domCount(win, '.custom-modal-wrap').then(n => n === 0), 15000, 'conflict modal closed')
  await poll(async () => !(await getTr(win, id)), 15000, 'conflict: transfer removed')
  const left = await win.evaluate(() => window.store.fileTransfers.length)
  if (left !== 0) throw new Error(`transfer list not empty after skip: ${left}`)
  const st = fs.statSync('/tmp/e2e_conflict')
  if (st.size !== 12) throw new Error(`local file overwritten after skip: size=${st.size}`)
  console.log('XFER-CONFLICT evidence modal→skip→list empty, local untouched (12B)')
}

// MODE=cancel: 下载中点 ✕ → fileTransfers 无此 id → 无假活行
// 与 UI ✕ 按钮同路径: refs.get('transport-'+id).cancel()
async function modeCancel (win) {
  await openSftpPane(win)
  await win.evaluate(() => window.store.setConfig({ transferRateLimitMB: 4 }))
  const size = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const id = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_cancel')
  await poll(async () => {
    const t = await getTr(win, id)
    return !!(t && t.inited && (t.transferred || 0) > 1024 * 1024)
  }, 30000, 'cancel: transfer progressing')
  const bar = await domCount(win, '.sftp-progress')
  if (bar < 1) throw new Error('progress bar not visible before cancel')
  await win.evaluate(i => {
    const inst = window.refs.get('transport-' + i)
    if (!inst) throw new Error('transport instance not found')
    inst.cancel()
  }, id)
  await poll(async () => !(await getTr(win, id)), 15000, 'cancel: id removed')
  await sleep(1500)
  const left = await win.evaluate(() => window.store.fileTransfers.length)
  const rows = await domCount(win, '.sftp-progress-row')
  const bars = await domCount(win, '.sftp-progress')
  if (left !== 0) throw new Error(`fake active row in store: ${left}`)
  if (rows !== 0 || bars !== 0) throw new Error(`fake active row in dom: rows=${rows} bars=${bars}`)
  console.log('XFER-CANCEL evidence id gone, store empty, dom rows=0 bars=0')
}

// MODE=expand: 展开 rows==任务数 → 完成后 bar 自动消失(尾帧修复回归)
async function modeExpand (win) {
  await openSftpPane(win)
  await win.evaluate(() => window.store.setConfig({ transferRateLimitMB: 4 }))
  const size = parseInt(ssh(`stat -c %s ${REMOTE_BIG}`), 10)
  const id1 = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_expand_1')
  const id2 = await pushDownload(win, REMOTE_BIG, 'pkgcache.bin', size, '/tmp/e2e_expand_2')
  await poll(async () => {
    const a = await getTr(win, id1)
    const b = await getTr(win, id2)
    return !!(a && b && a.inited && b.inited)
  }, 30000, 'expand: both transfers inited')
  await win.evaluate(() => { document.querySelector('.sftp-progress-top')?.click() })
  const rows = await poll(() => domCount(win, '.sftp-progress-row').then(n => (n === 2 ? n : 0)), 20000, 'expand: rows==2')
  const listLen = await win.evaluate(() => window.store.fileTransfers.length)
  if (rows !== listLen) throw new Error(`rows(${rows}) != tasks(${listLen})`)
  await waitFinish(win, id1, 180000)
  await waitFinish(win, id2, 180000)
  await poll(() => domCount(win, '.sftp-progress').then(n => (n === 0 ? 1 : 0)), 20000, 'expand: bar auto-hidden after finish')
  for (const p of ['/tmp/e2e_expand_1', '/tmp/e2e_expand_2']) {
    if (fs.statSync(p).size !== size) throw new Error(`${p} size mismatch`)
  }
  console.log(`XFER-EXPAND evidence rows=${rows}==tasks, bar auto-hidden after finish`)
}

const modes = {
  dl: modeDl,
  up: modeUp,
  mix: modeMix,
  pause: modePause,
  limit: modeLimit,
  conflict: modeConflict,
  cancel: modeCancel,
  expand: modeExpand
}

async function main () {
  if (!modes[MODE]) throw new Error(`unknown MODE: ${MODE}`)
  const { win } = await launchAnchor()
  let code = 1
  try {
    // 新建活跃 session, 传输挂 tabs[last](旧恢复 tab 的 session ws 已失效)
    await freshSession(win)
    await waitSftpReady(win)
    await cleanupTransfers(win)
    await modes[MODE](win)
    console.log(`XFER-${MODE.toUpperCase()}-PASS`)
    code = 0
  } catch (e) {
    console.log(`XFER-${MODE.toUpperCase()}-FAIL ${String(e.message).slice(0, 400)}`)
  } finally {
    try { await cleanupTransfers(win) } catch { }
    try { ssh('rm -f /tmp/e2e_up.jar /tmp/e2e_mix_up.jar /tmp/e2e_mix_dl') } catch { }
  }
  process.exit(code)
}

main().catch(e => {
  console.log(`XFER-${String(MODE).toUpperCase()}-ERR ${String(e.message).slice(0, 400)}`)
  process.exit(1)
})
