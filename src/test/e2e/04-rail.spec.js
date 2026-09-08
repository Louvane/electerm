// src/test/e2e/04-rail.spec.js
// Task 5: 遥测侧栏域 — HEALTH/DISK/TREND/NETWORK/无滚动/浮层/Tooltip，只读验证
const fs = require('fs')
const path = require('path')
const { launchAnchor } = require('./helpers/anchor-e2e')

const root = path.resolve(__dirname, '../../..')
function srcHas (rel, s) {
  return fs.readFileSync(path.join(root, rel), 'utf8').includes(s)
}

async function main () {
  const fails = []
  const { win } = await launchAnchor()
  await win.waitForTimeout(8000) // 等遥测 points
  const r = await win.evaluate(() => {
    const rail = document.querySelector('.anchor-rail') || document.querySelector('.monitor-rail')
    if (!rail) return JSON.stringify({ rail: false })
    const secs = Array.from(rail.querySelectorAll('.anchor-rail-sec, .rail-section')).map(s => {
      const m = s.className.match(/anchor-rail-(target|health|disk|trend|net)/)
      if (m) return m[1].toUpperCase()
      return s.getAttribute('data-sec') || s.className.slice(0, 24)
    })
    const trend = rail.querySelector('.anchor-rail-trend .anchor-chart') || rail.querySelector('.rail-trend')
    const caps = Array.from(rail.querySelectorAll('.anchor-cap')).map(c => c.innerText.replace(/●/g, '').trim())
    return JSON.stringify({
      rail: true,
      noScroll: rail.scrollHeight <= rail.clientHeight + 1,
      order: secs,
      trendH: trend ? Math.round(trend.getBoundingClientRect().height) : -1,
      version: (rail.querySelector('.foot-version') || rail.querySelector('.app-version') || {}).innerText || null,
      caps,
      tabs: Array.from(rail.querySelectorAll('.anchor-tabbtn')).map(b => b.innerText).join(','),
      net: (rail.querySelector('.anchor-rail-net') || {}).innerText
        ? rail.querySelector('.anchor-rail-net').innerText.replace(/\n/g, '/').slice(0, 40)
        : null,
      diskToggle: (rail.querySelector('.disk-toggle') || {}).innerText
        ? rail.querySelector('.disk-toggle').innerText.trim().slice(0, 30)
        : null
    })
  })
  console.log('RAIL:', r)
  const j = JSON.parse(r)
  if (!j.rail || !j.noScroll || j.trendH !== 100) { console.log('RAIL-FAIL'); process.exit(1) }
  for (const sec of ['TARGET', 'HEALTH', 'DISK', 'TREND', 'NET']) {
    if (!j.order.includes(sec)) fails.push('RAIL-ORDER-MISSING-' + sec)
  }
  if (j.order.join(',') !== 'TARGET,HEALTH,DISK,TREND,NET') fails.push('RAIL-ORDER-MISMATCH:' + j.order.join(','))
  if (!j.caps.includes('NETWORK')) fails.push('RAIL-CAP-MISSING-NETWORK')
  // DISK 浮层：挂载>4→▸按钮→点击→380px 浮层出现→max-height 内滚→关闭
  const pop = await win.evaluate(async () => {
    const btn = document.querySelector('.disk-toggle')
    if (!btn) return JSON.stringify({ toggle: false })
    btn.click()
    await new Promise(resolve => setTimeout(resolve, 800))
    const el = document.querySelector('.disk-pop')
    if (!el) return JSON.stringify({ toggle: true, pop: false })
    const cs = window.getComputedStyle(el)
    const out = JSON.stringify({
      toggle: true,
      pop: true,
      w: Math.round(el.getBoundingClientRect().width),
      maxH: cs.maxHeight,
      ovY: cs.overflowY,
      rows: el.querySelectorAll('.disk-row').length
    })
    const close = el.querySelector('.disk-pop-close')
    if (close) close.click()
    return out
  })
  console.log('DISKPOP:', pop)
  const p = JSON.parse(pop)
  if (p.toggle && (!p.pop || p.w !== 380 || p.ovY !== 'auto' || !p.maxH || p.maxH === 'none')) {
    fails.push('DISKPOP-MISMATCH')
  }
  // Tooltip：截断 250ms（静态接线验证：截断 guard + 250ms 定时）
  if (!srcHas('src/client/components/anchor/monitor-rail.jsx', 'scrollWidth <= t.clientWidth + 1') ||
    !srcHas('src/client/components/anchor/monitor-rail.jsx', 'setTimeout(() => setTip({ x, y, text }), 250)')) {
    fails.push('TOOLTIP-WIRING-MISMATCH')
  }
  if (fails.length) { console.log('RAIL-FAIL', fails.join(',')); process.exit(1) }
  await win.locator('.anchor-rail').screenshot({ path: '/tmp/e2e-rail.png' })
  console.log('RAIL-PASS')
  process.exit(0)
}
main().catch(e => { console.log('RAIL-ERR', e.message.slice(0, 80)); process.exit(1) })
