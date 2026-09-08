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
