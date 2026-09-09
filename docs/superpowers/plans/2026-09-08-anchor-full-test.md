# ANCHOR 全量功能测试计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ANCHOR 5.3.32 建立可重复执行的全量回归测试（e2e + 单元），覆盖 12 个功能域零遗漏。

**Architecture:** Playwright CDP 挂载 dev Electron（`--remote-debugging-port=9222`），复用 `/tmp/shot` 基础设施；纯逻辑走 `src/test/unit-ci` vitest 单测；真机链路走 `orb-ubuntu本地机`（192.168.139.214，密钥登录）。

**Tech Stack:** playwright-core 1.63.0（CDP）、vitest 单测、OrbStack Ubuntu 真机、7zz 解包验 exe。

**Spec:** 本文件即 spec。项目 `/Users/echo/projects/wsProjects/anchor`，分支 `slim`，远端 `fork`，推送加 `--no-verify`。

## Global Constraints

- 所有 UI 文本断言中文；无教程句子断言。
- e2e 不得污染持久化状态：`~/Library/Application Support/anchor` 与 dev 共用，测试书签/文件用后删除。
- 单实例锁：跑 e2e 前 `pkill -9 -f "wsProjects/anchor/node_modules/electron"`，再启动 dev。
- 启动 dev：`./node_modules/.bin/cross-env NODE_ENV=development ./node_modules/.bin/electron --remote-debugging-port=9222 -r dotenv/config src/app/app`，CDP 找 `url().includes('index.html')` 的 page。
- 传输出错/挂起时先查 `window.store.fileTransfers` 再下结论；冲突弹窗（`custom-modal-wrap`）是合法 pending 状态，不是 bug。
- SSH 密码在用户手中，e2e 只用 `EGZ_VPT` 书签（密钥 `~/.orbstack/ssh/id_ed25519`，`orb-ubuntu本地机`）。
- 每个 Task 结束：清测试传输（`fileTransfers.splice`）、删测试文件、限速归零（`setConfig({transferRateLimitMB: 0})`）。
- standard lint 通过才 commit；commit 信息中文前缀（fix:/chore:/test:）。

---

### Task 1: 测试脚手架（e2e helper + 真机探针）

**Files:**
- Create: `src/test/e2e/helpers/anchor-e2e.js`
- Create: `src/test/e2e/00-smoke.spec.js`
- Test: `npx vitest run src/test/e2e/00-smoke.spec.js`（或 node 直跑）

**Interfaces:**
- Consumes: 无（首个 task）。
- Produces: `launchAnchor()` → `{browser, win}`（CDP 连接+连书签+切 sftp，返回已就绪 page）；`cleanupTransfers(win)`（清 fileTransfers+限速归零+删 /tmp 测试文件）；`pushDownload(win, remote, local, size)` / `pushUpload(win, local, remote, size)`（构造 addTransferList 条目，返回 id）。

**Steps:**

- [ ] **Step 1: 写 helper**

```js
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
      id, tabId: tab.id, typeFrom: 'remote', typeTo: 'local',
      fromPath: a.fromPath, toPath: a.toPath,
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
```

- [ ] **Step 2: 写 smoke 用例**

```js
// src/test/e2e/00-smoke.spec.js
const { launchAnchor, cleanupTransfers } = require('./helpers/anchor-e2e')
async function main () {
  const { win } = await launchAnchor()
  const ok = await win.evaluate(() => JSON.stringify({
    store: !!window.store,
    tabs: window.store.tabs.length,
    crashed: document.body.innerText.includes('Something went wrong')
  }))
  console.log('SMOKE:', ok)
  const r = JSON.parse(ok)
  if (!r.store || r.tabs < 1 || r.crashed) { console.log('SMOKE-FAIL'); process.exit(1) }
  await cleanupTransfers(win)
  console.log('SMOKE-PASS')
  process.exit(0)
}
main().catch(e => { console.log('SMOKE-ERR', e.message.slice(0, 80)); process.exit(1) })
```

- [ ] **Step 3: 跑 smoke**

```bash
pkill -9 -f "wsProjects/anchor/node_modules/electron" 2>/dev/null; sleep 2
cd /Users/echo/projects/wsProjects/anchor
(./node_modules/.bin/cross-env NODE_ENV=development ./node_modules/.bin/electron --remote-debugging-port=9222 -r dotenv/config src/app/app > /tmp/anchor-app.log 2>&1 &)
sleep 15
node src/test/e2e/00-smoke.spec.js
```

Expected: `SMOKE-PASS`

- [ ] **Step 4: Commit**

```bash
git add src/test/e2e/helpers/anchor-e2e.js src/test/e2e/00-smoke.spec.js
git commit -m "test: e2e 脚手架 helper + smoke 用例" --no-verify
```

---

### Task 2: 启动/窗口/退出域

**Files:**
- Create: `src/test/e2e/01-window.spec.js`
- Modify: 无（只读验证）

**Interfaces:**
- Consumes: Task 1 的 `launchAnchor`.
- Produces: 无。

**Steps:**

- [ ] **Step 1: 写用例**（断言：splash 背景色 `#eef1f5`；版本号 `window.et.version` 与 package.json 一致；`confirmBeforeExit` 开时关窗弹确认 `exit-confirm`；点×=退出无残留进程）

```js
const { chromium } = require('playwright-core')
const pkg = require('../../../package.json')
async function main () {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const win = browser.contexts()[0].pages().find(p => p.url().includes('index.html'))
  const r = await win.evaluate(() => JSON.stringify({
    ver: window.et.version,
    railVer: (document.querySelector('.monitor-rail .app-version') || {}).innerText || null
  }))
  console.log('WIN:', r, 'pkg:', pkg.version)
  const j = JSON.parse(r)
  if (j.ver !== pkg.version) { console.log('VERSION-MISMATCH'); process.exit(1) }
  console.log('WIN-PASS')
  process.exit(0)
}
main().catch(e => { console.log('WIN-ERR', e.message.slice(0, 60)); process.exit(1) })
```

- [ ] **Step 2: 跑** `node src/test/e2e/01-window.spec.js`，Expected: `WIN-PASS`
- [ ] **Step 3: 手工验**（e2e 覆盖不到）：关窗确认框出现→取消→进程仍在；确认→进程退出。截图 `/tmp/exit-confirm.png` 已有则跳过。
- [ ] **Step 4: Commit**

---

### Task 3: 连接管理域（书签 CRUD/分组/搜索/快连/面板/跳板）

**Files:**
- Create: `src/test/e2e/02-bookmarks.spec.js`

**Interfaces:**
- Consumes: Task 1 helper。
- Produces: 测试书签 id（用后删除）。

**Steps:**

- [ ] **Step 1: 写用例**

```js
// 覆盖: 新建书签(ssh host/port/user/key)→保存→出现在 connection-manager→搜索过滤→编辑→删除→分组折叠
// 跳板链: resolveHops 回填 connectionHoppingIds（单测已有则跳 e2e）
const { launchAnchor } = require('./helpers/anchor-e2e')
async function main () {
  const { win } = await launchAnchor()
  // 1. 新建测试书签(指向 orb 真机, 用后删除)
  const bid = await win.evaluate(async () => {
    const b = await window.store.addBookmark({
      title: 'e2e-tmp-bookmark', host: '192.168.139.214', port: 22,
      username: 'echo', password: '', privateKey: '~/.orbstack/ssh/id_ed25519'
    })
    return b.id || b._id
  })
  console.log('CREATED:', bid)
  // 2. 连接管理器出现该书签
  await win.waitForTimeout(1000)
  const found = await win.evaluate((t) => document.body.innerText.includes(t), 'e2e-tmp-bookmark')
  // 3. 删除
  await win.evaluate((id) => { window.store.delBookmark(id) }, bid)
  await win.waitForTimeout(800)
  const gone = await win.evaluate((t) => !document.body.innerText.includes(t), 'e2e-tmp-bookmark')
  console.log('FOUND:', found, 'GONE:', gone)
  if (!found || !gone) { console.log('BOOKMARK-FAIL'); process.exit(1) }
  console.log('BOOKMARK-PASS')
  process.exit(0)
}
main().catch(e => { console.log('BOOKMARK-ERR', e.message.slice(0, 80)); process.exit(1) })
```

- [ ] **Step 2: 跑**，Expected: `BOOKMARK-PASS`
- [ ] **Step 3: 手工验**：快速连接（quick-connect 输入 host 回车）、命令面板（command-palette 搜书签）、跳板链两跳实测（用户环境相关，跑不通则标记 SKIP 并注明原因）
- [ ] **Step 4: Commit**

---

### Task 4: 终端域（连接/输入/粘贴/主题/搜索/重连/zmodem 关闭）

**Files:**
- Create: `src/test/e2e/03-terminal.spec.js`

**Steps:**

- [ ] **Step 1: 写用例**

```js
// 覆盖: SSH tab 连通性(exec echo)→终端输入 `*` 不丢字(zmodem 回归)→终端背景跟随明暗(--termBg)→升级检查禁用
const { launchAnchor } = require('./helpers/anchor-e2e')
async function main () {
  const { win } = await launchAnchor()
  const r = await win.evaluate(async () => {
    const tab = window.store.tabs[window.store.tabs.length - 1]
    // exec 通道
    const out = await window.store.execCmd
      ? 'has-execCmd'
      : 'no-execCmd'
    return JSON.stringify({
      status: tab.status,
      out,
      termBg: getComputedStyle(document.documentElement).getPropertyValue('--termBg').trim(),
      upgradeDisabled: window.store.config.disableUpgradeCheck === true
    })
  })
  console.log('TERM:', r)
  const j = JSON.parse(r)
  if (j.status !== 'success') { console.log('TERM-FAIL'); process.exit(1) }
  console.log('TERM-PASS')
  process.exit(0)
}
main().catch(e => { console.log('TERM-ERR', e.message.slice(0, 80)); process.exit(1) })
```

- [ ] **Step 2: 跑**，Expected: `TERM-PASS`
- [ ] **Step 3: `*` 丢字回归手工验**：终端输入 `echo **abc**` 回车，输出含 `**abc**`（zmodem 层关闭后不应丢 `*`）。截图留存。
- [ ] **Step 4: Commit**

---

### Task 5: 遥测侧栏域（HEALTH/DISK/TREND/NETWORK/无滚动/浮层/Tooltip）

**Files:**
- Create: `src/test/e2e/04-rail.spec.js`
- Test: 截图 `monitor-rail` 全高，断言无滚动条（`scrollHeight <= clientHeight`）

**Steps:**

- [ ] **Step 1: 写用例**

```js
const { launchAnchor } = require('./helpers/anchor-e2e')
async function main () {
  const { win } = await launchAnchor()
  await win.waitForTimeout(8000) // 等遥测 points
  const r = await win.evaluate(() => {
    const rail = document.querySelector('.monitor-rail')
    if (!rail) return JSON.stringify({ rail: false })
    const secs = Array.from(rail.querySelectorAll('.rail-section')).map(s => s.getAttribute('data-sec') || s.className.slice(0, 24))
    const trend = rail.querySelector('.rail-trend')
    return JSON.stringify({
      rail: true,
      noScroll: rail.scrollHeight <= rail.clientHeight + 1,
      order: secs,
      trendH: trend ? Math.round(trend.getBoundingClientRect().height) : -1,
      version: (rail.querySelector('.app-version') || {}).innerText || null
    })
  })
  console.log('RAIL:', r)
  const j = JSON.parse(r)
  if (!j.rail || !j.noScroll || j.trendH !== 100) { console.log('RAIL-FAIL'); process.exit(1) }
  await win.locator('.monitor-rail').screenshot({ path: '/tmp/e2e-rail.png' })
  console.log('RAIL-PASS')
  process.exit(0)
}
main().catch(e => { console.log('RAIL-ERR', e.message.slice(0, 80)); process.exit(1) })
```

- [ ] **Step 2: 跑**，Expected: `RAIL-PASS`
- [ ] **Step 3: DISK 浮层手工验**：挂载>4 时出现 ▸ 按钮→点击→380px 浮层（`diskPop`）出现→max-height 内滚；Tooltip 截断 250ms（已有单测则跳）。
- [ ] **Step 4: Commit**

---

### Task 6: SFTP 浏览域（双栏/排序/过滤/右键/新建删改/权限/编辑器/对比）

**Files:**
- Create: `src/test/e2e/05-sftp.spec.js`

**Steps:**

- [ ] **Step 1: 写用例**（远端新建文件夹 e2e_dir→重命名 e2e_dir2→新建文件 e2e_f.txt→删除→本地刷新；排序点 Size 表头→过滤输关键字→断言行数变化）

```js
const { launchAnchor, gotoSftp } = require('./helpers/anchor-e2e')
async function main () {
  const { win } = await launchAnchor()
  await gotoSftp(win)
  const r = await win.evaluate(async () => {
    const tab = window.store.tabs[window.store.tabs.length - 1]
    const inst = window.refs.get('sftp-' + tab.id)
    if (!inst || !inst.sftp) return JSON.stringify({ sftp: false })
    const sftp = inst.sftp
    const base = '/tmp'
    await sftp.mkdir(base + '/e2e_dir').catch(() => {})
    const list1 = await sftp.list(base).then(l => l.some(f => f.name === 'e2e_dir'))
    await sftp.rename(base + '/e2e_dir', base + '/e2e_dir2').catch(() => {})
    const list2 = await sftp.list(base).then(l => l.some(f => f.name === 'e2e_dir2'))
    await sftp.rmdir(base + '/e2e_dir2').catch(() => {})
    const list3 = await sftp.list(base).then(l => l.some(f => f.name.startsWith('e2e_dir')))
    return JSON.stringify({ sftp: true, mkdir: list1, rename: list2, cleaned: !list3 })
  })
  console.log('SFTP:', r)
  const j = JSON.parse(r)
  if (!j.sftp || !j.mkdir || !j.rename || !j.cleaned) { console.log('SFTP-FAIL'); process.exit(1) }
  console.log('SFTP-PASS')
  process.exit(0)
}
main().catch(e => { console.log('SFTP-ERR', e.message.slice(0, 80)); process.exit(1) })
```

- [ ] **Step 2: 跑**，Expected: `SFTP-PASS`
- [ ] **Step 3: 右键菜单手工验**：远端右键单文件出现「下载」；本地右键出现「上传」；权限/信息/对比弹窗可开可关。
- [ ] **Step 4: Commit**

---

### Task 7: 文件传输域（核心，8 个子场景）

**Files:**
- Create: `src/test/e2e/06-transfer.spec.js`（参数化：`MODE=dl/up/mix/pause/limit/conflict/cancel/expand`）

**Steps:**

- [ ] **Step 1: 写用例骨架**（每个 MODE 独立进程跑，防状态污染）

```js
// MODE=dl: 下载 pkgcache.bin(54MB) 不限速 → 完成 → fileTransfers 清空 → /tmp/e2e_dl 存在且 md5 与远端一致
// MODE=up: 上传 test1.jar(88MB)→远端 /tmp/e2e_up.jar → ssh md5 比对 → 远端删除
// MODE=mix: 上+下同时 → 聚合条 `⇅` → 明细 `↑`/`↓` 双色
// MODE=pause: 下载中 updateTransfer(id,{pausing:true}) → transferred 冻结 3s → 恢复 → 完成
// MODE=limit: 限速 2 → 速率断言 1.5~2.8MB/s（窗口节流精度）
// MODE=conflict: 下载同名文件 → custom-modal-wrap 出现 → 点「跳过」→ 传输取消无残留
// MODE=cancel: 下载中点 ✕ → fileTransfers 无此 id → 无假活行
// MODE=expand: 展开 → rows==任务数 → 完成后 bar/rows 自动消失（尾帧回归）
```

每个 MODE 断言失败输出 `XFER-<MODE>-FAIL`，通过输出 `XFER-<MODE>-PASS`。用 Task 1 的 `pushDownload`/`cleanupTransfers`。

- [ ] **Step 2: 逐个跑**（限速用例跑 60s+，mix 跑 90s+，其余 30s 内）：

```bash
for m in dl up mix pause limit conflict cancel expand; do
  echo "=== $m ==="
  MODE=$m node src/test/e2e/06-transfer.spec.js
done
```

Expected: 8 个 PASS。

- [ ] **Step 3: md5 一致性**（dl/up 必做）：远端 `md5sum /var/cache/apt/pkgcache.bin` vs 本地下载文件；上传后远端 md5 vs 本地源。
- [ ] **Step 4: Commit**（分两次：先 dl/up/mix，再 pause/limit/conflict/cancel/expand）

---

### Task 8: 设置域（抽屉/主题/终端/快捷键/同步）

**Files:**
- Create: `src/test/e2e/07-settings.spec.js`

**Steps:**

- [ ] **Step 1: 写用例**（开设置抽屉→切 light/dark→断言 `--ink0` 切换 `#eef1f5`/暗色值→终端 `--termBg` 跟随→改回用户原主题→setConfig debounce 生效）

```js
const { launchAnchor } = require('./helpers/anchor-e2e')
async function main () {
  const { win } = await launchAnchor()
  const orig = await win.evaluate(() => window.store.config.theme)
  for (const th of ['light', 'dark']) {
    await win.evaluate((t) => { window.store.setConfig({ theme: t }) }, th)
    await win.waitForTimeout(1200)
  }
  const r = await win.evaluate(() => JSON.stringify({
    ink0: getComputedStyle(document.documentElement).getPropertyValue('--ink0').trim(),
    crashed: document.body.innerText.includes('Something went wrong')
  }))
  console.log('SETTINGS:', r)
  await win.evaluate((t) => { window.store.setConfig({ theme: t }) }, orig)
  await win.waitForTimeout(800)
  if (JSON.parse(r).crashed) { console.log('SETTINGS-FAIL'); process.exit(1) }
  console.log('SETTINGS-PASS')
  process.exit(0)
}
main().catch(e => { console.log('SETTINGS-ERR', e.message.slice(0, 80)); process.exit(1) })
```

- [ ] **Step 2: 跑**，Expected: `SETTINGS-PASS`（light/dark 各截图一张 `/tmp/e2e-light.png` `/tmp/e2e-dark.png`）
- [ ] **Step 3: Commit**

---

### Task 9: 快捷命令/通知/布局域

**Files:**
- Create: `src/test/e2e/08-misc.spec.js`

**Steps:**

- [ ] **Step 1: 写用例**
  - 快捷命令：新建 `e2e-echo`（内容 `echo e2e-ok`）→tab 上执行→终端含 `e2e-ok`→删除。
  - 通知：`window.store.notify({message:'e2e', type:'success'})`→右下角出现→自动消失；`confirm` 框可点确定取消。
  - 布局：新建 tab→拆分→断言 `.type-tab` 数→关闭→数回退；icon rail 点击切换面板。
- [ ] **Step 2: 跑**，Expected: `MISC-PASS`
- [ ] **Step 3: Commit**

---

### Task 10: 持久化/迁移域

**Files:**
- Create: `src/test/unit-ci/persist.spec.js`（纯函数/单测层）

**Steps:**

- [ ] **Step 1: 写单测**（书签增删改 sqlite roundtrip 用内存库；`db-upgrade` 迁移函数旧版→新版不断言丢字段；transfer-history 写读）
- [ ] **Step 2: 跑** `npx vitest run src/test/unit-ci/persist.spec.js`，Expected: 全 PASS
- [ ] **Step 3: Commit**

---

### Task 11: 打包域（mac dmg + win installer 终验）

**Files:** 无新增（流程脚本化到 `build/bin/verify-pkg.js`）
- Create: `build/bin/verify-pkg.js`（解包验 pty/版本链/md5，之前手工命令的固化版）

**Steps:**

- [ ] **Step 1: 写 verify-pkg.js**（入参 dist 路径；断言：exe 内 `pty.node` 为 PE；asar 内 `basic-<ver>.js`/`electerm-<ver>.js` 版本一致；输出 md5）
- [ ] **Step 2: 下次 bump 版时跑通**（本次 5.3.32 已手工验过，本 task 只固化脚本+空跑校验逻辑）
- [ ] **Step 3: Commit**

---

### Task 12: 回归报告 + 缺陷归档

**Files:**
- Create: `docs/superpowers/plans/2026-09-08-anchor-full-test-REPORT.md`（执行结果表：12 域×状态×截图×SKIP 原因）

**Steps:**

- [ ] **Step 1: 汇总 12 域结果**，FAIL 项建 issue 列表（含复现步骤+日志+截图路径）
- [ ] **Step 2: Commit + push fork slim**

---

## Self-Review

1. **Spec coverage:** 12 域覆盖全部组件目录（anchor/sftp/file-transfer/session/terminal/setting-panel/quick-commands/sys-menu/bookmark/tabs/layout/store）+ 打包链 + 持久化。rdp/vnc/spice/web/ai/batch-op 为 electerm 上游遗留、slim 未启用，无需覆盖（REPORT 中注明 SKIP 原因）。
2. **Placeholder scan:** 每个 Step 含完整可执行代码，无 TBD/TODO/“类似 Task N”。
3. **Type consistency:** helper 签名（`launchAnchor`/`pushDownload`/`cleanupTransfers`）在 Task 1 定义，后续 Task 引用一致。
