// src/test/e2e/07-settings.spec.js
// 设置域: 抽屉/主题(昼夜)/终端配色跟随/同步 debounce
// 用法: node src/test/e2e/07-settings.spec.js
// 约束: 不改实现; 测试结束把主题/终端配色恢复用户原值(持久化配置不能留脏)
const { chromium } = require('playwright-core')

// 数值与 anchor-theme.js ANCHOR_THEMES / TERM_PRESETS 原样一致
const INK = { light: '#eef1f5', dark: '#0f141d' }
const PRESET_BG = { 'anchor-dark': '#0f141d', 'anchor-light': '#ffffff' }
const TOPIC = { 'anchor-light': '纸白', 'anchor-dark': '琥珀暗(默认)' }

const fails = []
function assert (cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + ':', msg)
  if (!cond) fails.push(msg)
}

async function main () {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const win = b.contexts()[0].pages().find(p => p.url().includes('index.html'))
  for (let i = 0; i < 20 && !(await win.evaluate(() => !!window.store).catch(() => false)); i++) {
    await win.waitForTimeout(1000)
  }

  // 用户原值(昼夜主题/终端配色/terminalTheme id), 结束必须恢复
  const O = JSON.parse(await win.evaluate(() => JSON.stringify({
    theme: document.body.dataset.anchorTheme,
    ls: window.localStorage.getItem('anchor-theme'),
    configTheme: window.store.config.theme,
    preset: window.store.config.terminalPreset || 'anchor-dark'
  })))

  const readVars = () => win.evaluate(() => JSON.stringify({
    crashed: document.body.innerText.includes('Something went wrong'),
    ink0: window.getComputedStyle(document.documentElement).getPropertyValue('--ink0').trim(),
    termBg: window.getComputedStyle(document.documentElement).getPropertyValue('--termBg').trim(),
    theme: document.body.dataset.anchorTheme,
    ls: window.localStorage.getItem('anchor-theme')
  }))

  const setPresetViaDrawer = async (preset) => {
    await win.evaluate(() => {
      const sel = document.querySelector('.settings-drawer .ant-select')
      if (!sel) return
      sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      sel.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      sel.click()
    })
    await win.waitForTimeout(500)
    const hit = await win.evaluate((name) => {
      const o = Array.from(document.querySelectorAll('.ant-select-dropdown .ant-select-item-option'))
        .find(x => x.innerText.includes(name))
      if (o) o.click()
      return !!o
    }, TOPIC[preset])
    await win.waitForTimeout(400)
    return hit
  }

  try {
    const s0 = JSON.parse(await readVars())
    assert(!s0.crashed, '页面未崩溃(store 就绪)')

    // Step 1a: 开设置抽屉
    await win.evaluate(() => { document.querySelector('.anchor-rail-settings').click() })
    await win.waitForTimeout(700)
    const d = JSON.parse(await win.evaluate(() => JSON.stringify({
      shown: !!document.querySelector('.settings-drawer'),
      title: (document.querySelector('.settings-drawer .ant-drawer-title') || {}).innerText || ''
    })))
    assert(d.shown, '设置抽屉打开(.settings-drawer)')
    assert(d.title === '设置', `抽屉标题=设置 (实际 ${JSON.stringify(d.title)})`)
    await win.screenshot({ path: '/tmp/e2e-settings-drawer.png' })
    // 关闭抽屉(点 mask, maskClosable)
    await win.evaluate(() => { const m = document.querySelector('.ant-drawer-mask'); if (m) m.click() })
    await win.waitForTimeout(500)

    // Step 1b: 切换 light/dark → --ink0 切换; --termBg 仍随 preset 不变
    const seq = O.theme === 'light' ? ['dark', 'light'] : ['light', 'dark']
    for (const want of seq) {
      await win.evaluate(() => { document.querySelector('.anchor-theme-btn[title="切换昼夜主题"]').click() })
      await win.waitForTimeout(500)
      const v = JSON.parse(await readVars())
      assert(v.theme === want, `主题切到 ${want} (dataset=${v.theme})`)
      assert(v.ink0 === INK[want], `--ink0==${INK[want]} (实际 ${v.ink0})`)
      assert(v.ls === want, `localStorage anchor-theme==${want}`)
      assert(v.termBg === PRESET_BG[O.preset], `--termBg 仍随 preset(${O.preset}=${PRESET_BG[O.preset]}, 实际 ${v.termBg})`)
      await win.waitForTimeout(300)
      await win.screenshot({ path: want === 'light' ? '/tmp/e2e-light.png' : '/tmp/e2e-dark.png' })
    }

    // Step 1c: 抽屉改终端配色 → --termBg 即时跟随(light 预设 #ffffff)
    await win.evaluate(() => { document.querySelector('.anchor-rail-settings').click() })
    await win.waitForTimeout(600)
    const hitLight = await setPresetViaDrawer('anchor-light')
    assert(hitLight, '抽屉 终端配色 下拉可选(纸白)')
    await win.waitForTimeout(900)
    const v1 = JSON.parse(await readVars())
    assert(v1.termBg === PRESET_BG['anchor-light'], `--termBg 跟随 preset=#ffffff (实际 ${v1.termBg})`)
    const cfgP = await win.evaluate(() => window.store.config.terminalPreset)
    assert(cfgP === 'anchor-light', `store.config.terminalPreset==anchor-light (实际 ${cfgP})`)

    // 恢复 preset(用户原值)
    const hitBack = await setPresetViaDrawer(O.preset)
    assert(hitBack, `抽屉 终端配色 恢复到 ${O.preset}(${TOPIC[O.preset]})`)
    await win.waitForTimeout(900)
    const v2 = JSON.parse(await readVars())
    assert(v2.termBg === PRESET_BG[O.preset], `--termBg 恢复=#${PRESET_BG[O.preset].slice(1)} (实际 ${v2.termBg})`)

    // Step 1d: setConfig debounce 生效(同步心跳 lastDataUpdateTime 有防抖)
    const t0 = await win.evaluate(() => window.store.lastDataUpdateTime)
    await win.evaluate(() => window.store.setConfig({ theme: 'probe-x' }))
    const tIm = await win.evaluate(() => window.store.lastDataUpdateTime)
    assert(tIm === t0, `setConfig 立即读 lastDataUpdateTime 未变(debounce 未触发, ${tIm})`)
    await win.waitForTimeout(1600)
    const t1 = await win.evaluate(() => window.store.lastDataUpdateTime)
    assert(t1 > tIm, `1.6s 后 lastDataUpdateTime 已更新(${tIm}→${t1}, debounce 生效)`)
  } finally {
    // 恢复用户原值(持久化配置, 不留脏): terminalTheme id 与昼夜主题分开恢复
    await win.evaluate((th) => { window.store.setConfig({ theme: th }) }, O.configTheme)
    await win.evaluate((want) => {
      let n = 0
      while (document.body.dataset.anchorTheme !== want && n < 4) {
        const btn = document.querySelector('.anchor-theme-btn[title="切换昼夜主题"]')
        if (!btn) break
        btn.click()
        n++
      }
    }, O.theme)
    await win.waitForTimeout(600)
    if (!(await win.evaluate(() => !!window.store).catch(() => false))) {
      assert(false, '恢复后 store 存活')
    }
  }

  // 恢复后终态校验
  const fin = JSON.parse(await readVars())
  assert(fin.theme === O.theme, `主题已恢复 ${O.theme} (实际 ${fin.theme})`)
  assert(fin.ls === O.ls, `localStorage 主题已恢复 ${O.ls} (实际 ${fin.ls})`)
  assert(fin.ink0 === INK[O.theme], `--ink0 已随原主题恢复 ${INK[O.theme]} (实际 ${fin.ink0})`)
  assert(fin.termBg === PRESET_BG[O.preset], `--termBg 已恢复 ${PRESET_BG[O.preset]} (实际 ${fin.termBg})`)
  assert(!fin.crashed, '结束时页面未崩溃')

  await b.close()
}

main().catch(e => {
  console.log('SETTINGS-ERR', e.message.slice(0, 80))
  process.exit(1)
}).then(() => {
  if (fails.length) {
    console.log('SETTINGS-FAIL', fails.length, fails.join(' | '))
    process.exit(1)
  }
  console.log('SETTINGS-PASS')
  process.exit(0)
})
