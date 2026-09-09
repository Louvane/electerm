// src/test/e2e/08-misc.spec.js
// Task 9: 快捷命令/通知/布局域 — CDP 模式(连 dev Electron 9222)
// 跑法: node src/test/e2e/08-misc.spec.js
const { chromium } = require('playwright-core')
const { freshSession } = require('./helpers/anchor-e2e')

const fails = []
function check (cond, tag) {
  if (!cond) fails.push(tag)
  return cond
}

async function evalJson (win, fn, arg) {
  const r = await win.evaluate(fn, arg)
  return JSON.parse(r)
}

// 读 xterm buffer 全文
function termText (win, tabId) {
  return evalJson(win, (id) => {
    const t = window.refs.get('term-' + id)
    if (!t || !t.term) return JSON.stringify(null)
    const buf = t.term.buffer.active
    let out = ''
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i)
      if (line) out += line.translateToString(true) + '\n'
    }
    return JSON.stringify(out)
  }, tabId)
}

async function main () {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const win = browser.contexts()[0].pages().find(p => p.url().includes('index.html'))
  if (!win) throw new Error('no index.html page')

  // 页面崩溃态防护: evaluate 超时 → reload
  let alive = false
  try {
    alive = await win.evaluate(() => !!window.store)
  } catch (e) {
    alive = false
  }
  if (!alive) {
    await win.reload()
    await win.waitForTimeout(10000)
    for (let i = 0; i < 20; i++) {
      if (await win.evaluate(() => !!window.store).catch(() => false)) break
      await win.waitForTimeout(1000)
    }
  }

  // ========== 1. 快捷命令 + 通知 ==========
  // brief 里的 window.store.notify({...}) 运行时不存在, 走等效 UI 通道:
  // palette 保存 → notify('success','已添加') → 自研 message 容器
  const notifyApi = await win.evaluate(() => typeof window.store.notify)

  // 建活跃会话(旧恢复 tab 的 ws 已失效)
  const tabId = await freshSession(win)
  const tabStatus = await win.evaluate(id => {
    const t = window.store.tabs.find(x => x.id === id)
    return t ? t.status : 'missing'
  }, tabId)
  check(tabStatus === 'success', 'QM-SESSION-NOT-SUCCESS:' + tabStatus)

  // 打开命令面板(tabbar title=常用命令)
  await win.evaluate(() => {
    document.querySelector('[title="常用命令"]').click()
  })
  await win.waitForTimeout(800)
  const palOpen = await win.evaluate(() => !!document.querySelector('.cmd-palette'))
  check(palOpen, 'QM-PALETTE-NOT-OPEN')

  // 新建 e2e-echo
  await win.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.cmd-palette .cp-manage'))
    btns[btns.length - 1].click()
  })
  await win.waitForTimeout(300)
  await win.evaluate(() => {
    const name = document.querySelector('.cp-edit-name')
    const cmd = document.querySelector('.cp-edit-cmd')
    const setV = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setV(name, 'e2e-echo')
    setV(cmd, 'echo e2e-ok')
  })
  await win.waitForTimeout(200)
  await win.evaluate(() => {
    Array.from(document.querySelectorAll('.cp-edit-ops button'))
      .find(b => b.innerText.includes('保存'))
      .click()
  })
  await win.waitForTimeout(600)

  // 通知出现(自研 message 容器, 顶部居中)且含"已添加"
  const msgShown = await evalJson(win, () => {
    const items = Array.from(document.querySelectorAll('.message-item'))
    const el = items.find(i => i.innerText.includes('已添加'))
    if (!el) return JSON.stringify({ found: false })
    const r = el.getBoundingClientRect()
    return JSON.stringify({
      found: true,
      cls: el.className,
      text: el.innerText.trim().slice(0, 30),
      top: Math.round(r.top),
      centerOff: Math.round(Math.abs(r.left + r.width / 2 - window.innerWidth / 2))
    })
  })
  check(msgShown.found, 'NOTIFY-NOT-SHOWN')
  if (msgShown.found) {
    check(msgShown.cls.includes('success'), 'NOTIFY-NOT-SUCCESS:' + msgShown.cls)
    check(msgShown.top >= 0 && msgShown.top <= 120, 'NOTIFY-NOT-TOP:' + msgShown.top)
    check(msgShown.centerOff <= 80, 'NOTIFY-NOT-CENTER:' + msgShown.centerOff)
  }

  // 通知自动消失(success 1.5s)
  await win.waitForTimeout(3500)
  const msgGone = await win.evaluate(() => {
    return !Array.from(document.querySelectorAll('.message-item')).find(i => i.innerText.includes('已添加'))
  })
  check(msgGone, 'NOTIFY-NOT-AUTO-DISMISS')

  // 命令已持久化
  const saved = await win.evaluate(() => {
    return window.store.quickCommands.filter(q => (q.name || '') === 'e2e-echo' || (q.command || '') === 'echo e2e-ok').length
  })
  check(saved >= 1, 'QM-NOT-SAVED')
  // 捕获 uid(快捷命令 id 由 generate() 生成, 非名称)供收尾 freq 清理
  const cmdId = await win.evaluate(() => {
    const q = window.store.quickCommands.find(q => (q.name || '') === 'e2e-echo')
    return q ? q.id : ''
  })

  // 在 tab 上执行: 搜索并点击
  await win.evaluate(() => {
    const s = document.querySelector('.cp-search')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(s, 'e2e-echo')
    s.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await win.waitForTimeout(400)
  const itemFound = await win.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.cp-item'))
    const it = items.find(i => i.innerText.includes('e2e-echo'))
    if (!it) return false
    it.click()
    return true
  })
  check(itemFound, 'QM-ITEM-NOT-FOUND')

  // 等执行落到终端(runQuickCommandItem debounce 200ms + ssh 往返)
  let out = ''
  for (let i = 0; i < 15; i++) {
    await win.waitForTimeout(1000)
    out = await termText(win, tabId)
    if (out && out.includes('e2e-ok')) break
  }
  check(!!out && out.includes('e2e-ok'), 'QM-EXEC-NO-OUTPUT')
  console.log('QM-EXEC bufLen:', out ? out.length : 'null', 'has-e2e-ok:', !!out && out.includes('e2e-ok'))
  const palClosed = await win.evaluate(() => !document.querySelector('.cmd-palette'))
  check(palClosed, 'QM-PALETTE-NOT-CLOSED-ON-RUN')

  // 删除 → 撤销 → 再删(持久化清理)
  const delAndVerify = async () => {
    await win.evaluate(() => {
      document.querySelector('[title="常用命令"]').click()
    })
    await win.waitForTimeout(600)
    await win.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.cp-item'))
      const it = items.find(i => i.innerText.includes('e2e-echo'))
      it.querySelector('.cp-ops .anticon-close').click()
    })
    await win.waitForTimeout(500)
    const delMsg = await win.evaluate(() => {
      return !!Array.from(document.querySelectorAll('.message-item')).find(i => i.innerText.includes('已删除'))
    })
    check(delMsg, 'QM-DEL-NO-MESSAGE')
    const after = await win.evaluate(() => {
      return window.store.quickCommands.filter(q => (q.name || '') === 'e2e-echo' || (q.command || '') === 'echo e2e-ok').length
    })
    await win.evaluate(() => {
      document.querySelector('.cmd-palette .cp-close')?.click()
    })
    return after
  }
  const after1 = await delAndVerify()
  check(after1 === 0, 'QM-DEL-FAILED:' + after1)

  await win.evaluate(() => {
    document.querySelector('[title="常用命令"]').click()
  })
  await win.waitForTimeout(600)
  await win.evaluate(() => {
    document.querySelector('.cp-edit-name')?.focus()
  })
  const undoShown = await evalJson(win, () => {
    const el = document.querySelector('.message-action')
    if (!el) return JSON.stringify({ found: false })
    el.click()
    return JSON.stringify({ found: true, label: el.innerText.trim() })
  })
  check(undoShown.found, 'QM-UNDO-BTN-MISSING')
  if (undoShown.found) {
    check(undoShown.label === '撤销', 'QM-UNDO-LABEL:' + undoShown.label)
  }
  await win.waitForTimeout(600)
  const restored = await win.evaluate(() => {
    return window.store.quickCommands.filter(q => (q.name || '') === 'e2e-echo' || (q.command || '') === 'echo e2e-ok').length
  })
  check(restored === 1, 'QM-UNDO-NOT-RESTORED:' + restored)
  await win.evaluate(() => {
    document.querySelector('.cmd-palette .cp-close')?.click()
  })
  await win.waitForTimeout(300)

  // 再删一次收尾(不撤销)
  const after2 = await delAndVerify()
  check(after2 === 0, 'QM-REDEL-FAILED:' + after2)

  // ========== 2. confirm 弹窗(粘贴长文本确认) ==========
  // 通知关闭后残留的 message 由 5s 自动消失兜底, 主动清掉避免干扰
  await win.waitForTimeout(5200)
  const bigText = 'e2epastex'.repeat(60) // 540 字符 > 500 阈值
  await win.evaluate(t => { window.pre.writeClipboard(t) }, bigText)

  const openPasteConfirm = async () => {
    // xterm 拦截 Playwright 合成 click, 直接派发原生 contextmenu(antd Dropdown trigger)
    await win.evaluate(() => {
      const el = document.querySelector('.session-current .term-wrap')
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    await win.waitForTimeout(700)
    return win.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.ant-dropdown-menu-item'))
      // dev 环境翻译可能未映射, 菜单首行 label 兼容中英文(排除 Paste selected)
      const paste = items.find(i => {
        const t = i.innerText.split('\n')[0].trim()
        return t === '粘贴' || t === 'Paste'
      })
      if (!paste) return false
      paste.click()
      return true
    })
  }
  let menuOk = await openPasteConfirm()
  check(menuOk, 'CONFIRM-PASTE-MENU-NOT-FOUND')
  await win.waitForTimeout(600)

  const confirmShown = await evalJson(win, () => {
    const el = document.querySelector('.custom-modal-wrap')
    if (!el) return JSON.stringify({ found: false })
    return JSON.stringify({
      found: true,
      title: (el.querySelector('.custom-modal-title, .ant-modal-title, h2, [class*=title]') || {}).innerText || el.innerText.slice(0, 20),
      hasOk: !!el.querySelector('.custom-modal-ok-btn'),
      hasCancel: !!el.querySelector('.custom-modal-cancel-btn'),
      okText: (el.querySelector('.custom-modal-ok-btn') || {}).innerText,
      cancelText: (el.querySelector('.custom-modal-cancel-btn') || {}).innerText
    })
  })
  check(confirmShown.found, 'CONFIRM-NOT-SHOWN')
  if (confirmShown.found) {
    check(confirmShown.hasOk && confirmShown.hasCancel, 'CONFIRM-BTNS-MISSING')
    check(confirmShown.okText === '粘贴', 'CONFIRM-OK-TEXT:' + confirmShown.okText)
    check(confirmShown.cancelText === '取消', 'CONFIRM-CANCEL-TEXT:' + confirmShown.cancelText)
  }

  // 点取消 → 弹窗消失, 终端未收到文本
  if (confirmShown.found) {
    await win.evaluate(() => {
      document.querySelector('.custom-modal-wrap .custom-modal-cancel-btn')?.click()
    })
  }
  await win.waitForTimeout(500)
  const cancelGone = await win.evaluate(() => !document.querySelector('.custom-modal-wrap'))
  check(cancelGone, 'CONFIRM-CANCEL-NOT-CLOSE')
  const buf1 = await termText(win, tabId)
  check(!(buf1 && buf1.includes('e2epastex')), 'CONFIRM-CANCEL-LEAKED')

  // 再来一次点确定 → 终端收到文本
  menuOk = await openPasteConfirm()
  check(menuOk, 'CONFIRM-PASTE-MENU-2-NOT-FOUND')
  await win.waitForTimeout(600)
  const okBtnThere = await win.evaluate(() => !!document.querySelector('.custom-modal-wrap .custom-modal-ok-btn'))
  check(okBtnThere, 'CONFIRM-2-NOT-SHOWN')
  if (okBtnThere) {
    await win.evaluate(() => {
      document.querySelector('.custom-modal-wrap .custom-modal-ok-btn').click()
    })
  }
  await win.waitForTimeout(800)
  const okGone = await win.evaluate(() => !document.querySelector('.custom-modal-wrap'))
  check(okGone, 'CONFIRM-OK-NOT-CLOSE')
  let buf2 = ''
  for (let i = 0; i < 10; i++) {
    await win.waitForTimeout(800)
    buf2 = await termText(win, tabId)
    if (buf2 && buf2.includes('e2epastex')) break
  }
  check(!!buf2 && buf2.includes('e2epastex'), 'CONFIRM-OK-NOT-PASTED')
  await win.evaluate(() => { window.pre.writeClipboard('') })

  // ========== 3. 布局域 ==========
  const baseJ = await evalJson(win, () => JSON.stringify({
    tabs: window.store.tabs.length,
    layout: window.store.layout,
    typeTab: document.querySelectorAll('.type-tab').length,
    layoutItem: document.querySelectorAll('.layout-item').length
  }))

  // 拆分: cloneToNextLayout(克隆到下一布局) — c1 下自动切 c2, 新 tab 落 batch1
  // slim 布局下 store.currentTab 依赖 refsTabs(未挂), 直接传 activeTabId 对应 tab
  await win.evaluate(() => {
    const t = window.store.tabs.find(x => x.id === window.store.activeTabId)
    window.store.cloneToNextLayout(t)
  })
  await win.waitForTimeout(1500)
  const layoutTabId = await win.evaluate(() => window.store.tabs[window.store.tabs.length - 1].id)
  const splitJ = await evalJson(win, () => JSON.stringify({
    layout: window.store.layout,
    // 两个 batch 的 pane 几何(slim 无 .layout-item, 按绝对定位验证左右分栏)
    panes: [0, 1].map(b => {
      const id = window.store['activeTabId' + b]
      const el = id ? document.querySelector('.session-' + id) : null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), left: Math.round(r.left) }
    }),
    typeTab: document.querySelectorAll('.type-tab').length,
    tabs: window.store.tabs.length
  }))
  check(splitJ.layout === 'c2', 'LAYOUT-NOT-C2:' + splitJ.layout)
  const p0 = splitJ.panes[0]
  const p1 = splitJ.panes[1]
  check(p0 && p1, 'LAYOUT-PANE-MISSING:' + JSON.stringify(splitJ.panes))
  if (p0 && p1) {
    check(p0.left !== p1.left, 'LAYOUT-PANES-OVERLAP:' + JSON.stringify(splitJ.panes))
    check(p1.left > p0.left, 'LAYOUT-PANE-ORDER:' + JSON.stringify(splitJ.panes))
    check(p0.w < 900 || p1.w < 900, 'LAYOUT-PANE-NOT-HALF:' + JSON.stringify(splitJ.panes))
  }
  check(splitJ.tabs === baseJ.tabs + 1, 'LAYOUT-TABS-NOT-PLUS1:' + splitJ.tabs + 'vs' + baseJ.tabs)
  check(splitJ.typeTab === baseJ.typeTab + 2, 'LAYOUT-TYPETAB-NOT-PLUS2:' + splitJ.typeTab + 'vs' + baseJ.typeTab)

  // 关闭新 tab → 回退 c1 → 数回退
  await win.evaluate(id => { window.store.delTab(id) }, layoutTabId)
  await win.waitForTimeout(800)
  await win.evaluate(() => { window.store.setLayout('c1') })
  await win.waitForTimeout(800)
  const backJ = await evalJson(win, () => JSON.stringify({
    layout: window.store.layout,
    layoutItem: document.querySelectorAll('.layout-item').length,
    typeTab: document.querySelectorAll('.type-tab').length,
    tabs: window.store.tabs.length
  }))
  check(backJ.layout === 'c1', 'LAYOUT-NOT-BACK-C1:' + backJ.layout)
  check(backJ.typeTab === baseJ.typeTab, 'LAYOUT-TYPETAB-NOT-RESTORED:' + backJ.typeTab + 'vs' + baseJ.typeTab)
  check(backJ.tabs === baseJ.tabs, 'LAYOUT-TABS-NOT-RESTORED:' + backJ.tabs)

  // QM 会话 tab 也关掉, 回到基线
  await win.evaluate(id => { window.store.delTab(id) }, tabId)
  await win.waitForTimeout(600)

  // icon rail 点击切换面板(TREND 区 chartMode CPU/内存/网络)
  const rail = await evalJson(win, async () => {
    const btns = Array.from(document.querySelectorAll('.anchor-tabbtn'))
    if (!btns.length) return JSON.stringify({ found: false })
    const onBefore = (btns.find(b => b.classList.contains('on')) || {}).innerText
    const net = btns.find(b => b.innerText.includes('网络'))
    if (!net) return JSON.stringify({ found: true, net: false })
    net.click()
    await new Promise(resolve => setTimeout(resolve, 400))
    const btns2 = Array.from(document.querySelectorAll('.anchor-tabbtn'))
    const onAfter = (btns2.find(b => b.classList.contains('on')) || {}).innerText
    // 切回 CPU 收尾
    const cpu = btns2.find(b => b.innerText.includes('CPU'))
    if (cpu) cpu.click()
    await new Promise(resolve => setTimeout(resolve, 300))
    return JSON.stringify({ found: true, net: true, onBefore, onAfter })
  })
  check(rail.found, 'RAIL-BTN-NOT-FOUND')
  if (rail.found) {
    check(rail.net, 'RAIL-NET-BTN-MISSING')
    if (rail.net) {
      check(rail.onAfter === '网络', 'RAIL-SWITCH-FAILED:' + rail.onBefore + '->' + rail.onAfter)
    }
  }

  // 收尾: 清 localStorage 的 e2e-echo 频次记录
  const cleanupRes = await win.evaluate(cid => {
    let freqDeleted = false
    try {
      const f = JSON.parse(window.localStorage.getItem('anchor-cmd-freq') || '{}')
      if (cid && cid in f) {
        delete f[cid]
        window.localStorage.setItem('anchor-cmd-freq', JSON.stringify(f))
        freqDeleted = true
      }
    } catch (e) {}
    window.pre.writeClipboard('')
    // 真实断言: 清理后该 cmdId(uid) 记录须已删除
    const f2 = JSON.parse(window.localStorage.getItem('anchor-cmd-freq') || '{}')
    return JSON.stringify({ freqGone: cid ? !(cid in f2) : true, freqDeleted })
  }, cmdId)
  const freqJ = JSON.parse(cleanupRes)
  check(freqJ.freqGone, 'FREQ-NOT-CLEANED:' + JSON.stringify(freqJ))

  console.log('NOTIFY-API(store.notify):', notifyApi, '(brief 假设的 API, 实际走自研 message 通道)')
  console.log('LAYOUT base:', JSON.stringify(baseJ), 'split:', JSON.stringify(splitJ), 'back:', JSON.stringify(backJ))
  if (fails.length) {
    console.log('MISC-FAIL', fails.join(','))
    process.exit(1)
  }
  console.log('MISC-PASS')
  process.exit(0)
}

main().catch(e => {
  console.log('MISC-ERR', ((e && e.message) || e).toString().slice(0, 200))
  process.exit(1)
})
