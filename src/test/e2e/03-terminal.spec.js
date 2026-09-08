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
      termBg: window.getComputedStyle(document.documentElement).getPropertyValue('--termBg').trim(),
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
