// src/test/e2e/05-sftp.spec.js
// Task 6: SFTP 浏览域 — 双栏/排序/过滤/右键/新建删改/权限/编辑器/对比
const { launchAnchor, gotoSftp } = require('./helpers/anchor-e2e')

async function main () {
  const fails = []
  const { win } = await launchAnchor()
  await gotoSftp(win)
  await win.waitForTimeout(8000)

  // Step 1: brief 原样转录（远端 mkdir→rename→rmdir，数值照抄）
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

  // 后续步骤用已连接实例查找（active 页签唯一挂载，不依赖 tabs 末位）
  const findSftp = () => {
    return win.evaluate(() => {
      for (const [k, v] of window.refs) {
        if (k.startsWith('sftp-') && v && v.sftp) return k.slice(5)
      }
      return null
    })
  }
  const tabId = await findSftp()
  if (!tabId) { console.log('SFTP-FAIL NO-INST'); process.exit(1) }

  // Step 2: 命名空间 /tmp/e2e_sftp_t6 — 新建文件/读写/删改/权限（用后删除）
  const r2 = await win.evaluate(async (id) => {
    const inst = window.refs.get('sftp-' + id)
    const sftp = inst.sftp
    const ns = '/tmp/e2e_sftp_t6'
    const out = {}
    await sftp.rm(ns + '/e2e_f2.txt').catch(() => {})
    await sftp.rm(ns + '/e2e_f.txt').catch(() => {})
    await sftp.rmdir(ns).catch(() => {})
    await sftp.mkdir(ns)
    out.mkdir = await sftp.list('/tmp').then(l => l.some(f => f.name === 'e2e_sftp_t6'))
    await sftp.touch(ns + '/e2e_f.txt')
    out.touch = await sftp.list(ns).then(l => l.some(f => f.name === 'e2e_f.txt'))
    await sftp.writeFile(ns + '/e2e_f.txt', 'hello-t6')
    out.read = await sftp.readFile(ns + '/e2e_f.txt').then(t => String(t).includes('hello-t6'))
    await sftp.chmod(ns + '/e2e_f.txt', '600')
    const st = await sftp.stat(ns + '/e2e_f.txt')
    out.chmod = (st.mode & 511) === 384
    await sftp.rename(ns + '/e2e_f.txt', ns + '/e2e_f2.txt')
    const names = await sftp.list(ns).then(l => l.map(f => f.name))
    out.rename = names.includes('e2e_f2.txt') && !names.includes('e2e_f.txt')
    await sftp.rm(ns + '/e2e_f2.txt')
    out.rm = await sftp.list(ns).then(l => !l.some(f => f.name === 'e2e_f2.txt'))
    await sftp.rmdir(ns)
    out.cleaned = await sftp.list('/tmp').then(l => !l.some(f => f.name === 'e2e_sftp_t6'))
    return JSON.stringify(out)
  }, tabId)
  console.log('SFTP-FILE:', r2)
  const j2 = JSON.parse(r2)
  for (const k of ['mkdir', 'touch', 'read', 'chmod', 'rename', 'rm', 'cleaned']) {
    if (!j2[k]) fails.push('FILE-' + k.toUpperCase())
  }

  // Step 3: 双栏/排序/过滤（DOM + inst 状态断言）
  const r3 = await win.evaluate(async (id) => {
    const inst = window.refs.get('sftp-' + id)
    const panes = document.querySelectorAll('.sftp-local-section, .sftp-remote-section').length
    const localRows = document.querySelectorAll('.sftp-local-section .sftp-item').length
    const remoteRows = document.querySelectorAll('.sftp-remote-section .sftp-item').length
    const sizeHd = document.querySelector('.sftp-remote-section [data-id="size"]')
    if (sizeHd) sizeHd.click()
    await new Promise(resolve => setTimeout(resolve, 600))
    const sortProp = inst.state['sortProp.remote']
    const sortingMark = !!document.querySelector('.sftp-remote-section .shi-size.is-sorting')
    const before = inst.getFileList('remote').length
    inst.updateKeyword('zzz-no-such-file-t6', 'remote')
    await new Promise(resolve => setTimeout(resolve, 800))
    const after = inst.getFileList('remote').length
    inst.updateKeyword('', 'remote')
    await new Promise(resolve => setTimeout(resolve, 800))
    const restored = inst.getFileList('remote').length
    return JSON.stringify({
      panes, localRows, remoteRows, sortProp, sortingMark, before, after, restored
    })
  }, tabId)
  console.log('SFTP-UI:', r3)
  const j3 = JSON.parse(r3)
  if (j3.panes < 2) fails.push('PANES-' + j3.panes)
  if (!j3.localRows || !j3.remoteRows) fails.push('ROWS-' + j3.localRows + '/' + j3.remoteRows)
  if (j3.sortProp !== 'size' && !j3.sortingMark) fails.push('SORT-' + j3.sortProp)
  if (!(j3.after < j3.before && j3.restored === j3.before)) {
    fails.push('FILTER-' + j3.before + '/' + j3.after + '/' + j3.restored)
  }

  // Step 4: 右键菜单 — 只读可见菜单；远端行出 Download，本地行出 Upload
  const readVisibleMenu = () => {
    return win.evaluate(() => {
      const menus = Array.from(document.querySelectorAll('.ant-dropdown-menu'))
        .filter(m => m.offsetParent !== null && !m.closest('.ant-dropdown-hidden'))
      return menus.map(m => Array.from(m.querySelectorAll('.ant-dropdown-menu-item'))
        .map(e => e.innerText.replace(/\n/g, '/').slice(0, 24)).join('|')).join('||')
    })
  }
  await win.locator('.sftp-remote-section .sftp-item.real-file-item').first().click({ button: 'right' })
  await win.waitForTimeout(800)
  const menuRemote = await readVisibleMenu()
  console.log('SFTP-CTX-REMOTE:', menuRemote.slice(0, 400))
  await win.keyboard.press('Escape')
  await win.waitForTimeout(400)
  await win.locator('.sftp-local-section .sftp-item.real-file-item').first().click({ button: 'right' })
  await win.waitForTimeout(800)
  const menuLocal = await readVisibleMenu()
  console.log('SFTP-CTX-LOCAL:', menuLocal.slice(0, 400))
  await win.keyboard.press('Escape')
  if (!menuRemote.includes('Download')) fails.push('CTX-REMOTE-NO-DOWNLOAD')
  if (menuRemote.includes('Upload')) fails.push('CTX-REMOTE-HAS-UPLOAD')
  if (!menuLocal.includes('Upload')) fails.push('CTX-LOCAL-NO-UPLOAD')
  if (!menuRemote.includes('Edit permission') && !menuLocal.includes('Edit permission')) {
    fails.push('CTX-NO-PERMISSION')
  }
  if (!menuRemote.includes('Info') && !menuLocal.includes('Info')) fails.push('CTX-NO-INFO')
  if (!menuRemote.includes('Edit') && !menuLocal.includes('Edit')) fails.push('CTX-NO-EDIT')

  // Step 5: 权限/信息/对比弹窗可开可关 + 编辑器接线（真实 UI 路径，不落盘）
  const visModals = () => {
    return win.evaluate(() => {
      return document.querySelectorAll('.custom-modal-wrap').length
    })
  }
  const clickCtxItem = (name) => {
    return win.evaluate((n) => {
      const items = Array.from(document.querySelectorAll('.ant-dropdown-menu'))
        .filter(m => m.offsetParent !== null && !m.closest('.ant-dropdown-hidden'))
        .flatMap(m => Array.from(m.querySelectorAll('.ant-dropdown-menu-item')))
      const it = items.find(e => e.innerText.trim() === n)
      if (it) { it.click(); return true }
      return false
    }, name)
  }
  // 信息弹窗：右键 → Info → 出现 → Escape 关闭
  await win.locator('.sftp-remote-section .sftp-item.real-file-item').first().click({ button: 'right' })
  await win.waitForTimeout(800)
  if (!await clickCtxItem('Info')) fails.push('CTX-CLICK-NO-INFO')
  await win.waitForTimeout(1000)
  const infoOpen = await visModals()
  console.log('SFTP-INFO-OPEN:', infoOpen)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(700)
  const infoClosed = await visModals()
  if (!infoOpen) fails.push('MODAL-INFO-NOT-OPEN')
  if (infoClosed) fails.push('MODAL-INFO-NOT-CLOSED')
  // 权限弹窗：右键 → Edit permission → 出现 → 关闭
  await win.locator('.sftp-remote-section .sftp-item.real-file-item').first().click({ button: 'right' })
  await win.waitForTimeout(800)
  if (!await clickCtxItem('Edit permission')) fails.push('CTX-CLICK-NO-PERM')
  await win.waitForTimeout(1000)
  const permOpen = await visModals()
  console.log('SFTP-PERM-OPEN:', permOpen)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(700)
  const permClosed = await visModals()
  if (!permOpen) fails.push('MODAL-PERM-NOT-OPEN')
  if (permClosed) fails.push('MODAL-PERM-NOT-CLOSED')
  // 对比弹窗：选中两个同扩展名远端文件 → 右键 → Compare → 出现 → 关闭
  const pair = await win.evaluate((id) => {
    const inst = window.refs.get('sftp-' + id)
    const getExt = (name = '') => {
      const parts = String(name).split('.')
      if (parts.length < 2) return ''
      return parts[parts.length - 1].toLowerCase()
    }
    const files = inst.getFileList('remote')
      .filter(f => !f.isDirectory && !f.isParent && !f.isEmpty).slice(0, 20)
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        if (getExt(files[i].name) === getExt(files[j].name)) {
          return JSON.stringify([files[i].id, files[j].id])
        }
      }
    }
    return JSON.stringify([])
  }, tabId)
  console.log('SFTP-PAIR:', pair)
  const ids = JSON.parse(pair)
  if (ids.length < 2) fails.push('CTX-NO-PAIR')
  else {
    await win.locator(`.sftp-remote-section .sftp-item.real-file-item[data-id="${ids[0]}"]`).click()
    await win.waitForTimeout(300)
    await win.locator(`.sftp-remote-section .sftp-item.real-file-item[data-id="${ids[1]}"]`).click({ modifiers: ['Meta'] })
    await win.waitForTimeout(300)
  }
  const selCount = await win.evaluate((id) => {
    return window.refs.get('sftp-' + id).getSelectedFiles().length
  }, tabId).catch(() => -1)
  console.log('SFTP-SELECTED:', selCount)
  await win.locator(`.sftp-remote-section .sftp-item.real-file-item[data-id="${ids[1]}"]`).click({ button: 'right' })
  await win.waitForTimeout(800)
  const cmpMenu = await readVisibleMenu()
  console.log('SFTP-CTX-CMP:', cmpMenu)
  if (!cmpMenu.includes('Selected(2)')) fails.push('CTX-NO-SELECTED2')
  // 对比走 file-item 真实路径（选中态菜单进「…」溢出子菜单，DOM 直点不可靠）
  const cmpWiring = await win.evaluate(() => {
    for (const [, v] of window.filesRef) {
      try {
        if (v && v.props && v.props.type === 'remote' && v.props.file &&
          !v.props.file.isDirectory && !v.props.file.isParent && !v.props.file.isEmpty) {
          const funcs = v.renderContextItems().map(i => i.func)
          if (funcs.includes('showCompare')) {
            v.showCompare()
            return JSON.stringify({ funcs, opened: true })
          }
          return JSON.stringify({ funcs, opened: false })
        }
      } catch (e) { return JSON.stringify({ err: e.message.slice(0, 60) }) }
    }
    return JSON.stringify({ funcs: [] })
  })
  console.log('SFTP-CMP-WIRING:', cmpWiring)
  const jcmp = JSON.parse(cmpWiring)
  if (!jcmp.funcs.includes('showCompare')) fails.push('CTX-NO-COMPARE')
  await win.waitForTimeout(1000)
  const cmpOpen = await visModals()
  console.log('SFTP-CMP-OPEN:', cmpOpen)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(700)
  const cmpClosed = await visModals()
  if (!cmpOpen) fails.push('MODAL-CMP-NOT-OPEN')
  if (cmpClosed) fails.push('MODAL-CMP-NOT-CLOSED')
  // 编辑器/右键接线：小文件含 editFile，text-editor 已注册（不下载不落盘）
  const r5 = await win.evaluate(async (id) => {
    const out = { funcs: [], smallFuncs: [] }
    const inst = window.refs.get('sftp-' + id)
    inst.modifier({ selectedFiles: new Set() })
    await new Promise(resolve => setTimeout(resolve, 500))
    const list = inst.getFileList('remote').filter(f => !f.isDirectory && !f.isParent && !f.isEmpty)
    out.hasFile = list.length > 0
    const small = list.filter(f => f.size < 1024 * 3000).slice(0, 2)
    out.small = small.map(f => f.name)
    for (const [, v] of window.filesRef) {
      try {
        if (v && v.props && v.props.type === 'remote' && v.props.file &&
          !v.props.file.isDirectory && !v.props.file.isParent && !v.props.file.isEmpty) {
          if (!out.funcs.length) out.funcs = v.renderContextItems().map(i => i.func)
          if (small.some(f => f.id === v.props.file.id)) {
            out.smallFuncs = v.renderContextItems().map(i => i.func)
          }
        }
      } catch (e) { out.funcErr = e.message.slice(0, 40) }
    }
    const editor = window.refsStatic.get('text-editor')
    const modal = window.refsStatic.get('file-modal')
    const cmp = window.refsStatic.get('file-compare-modal')
    out.modals = { info: !!modal, compare: !!cmp, editor: !!editor }
    return JSON.stringify(out)
  }, tabId)
  console.log('SFTP-WIRING:', r5)
  const j5 = JSON.parse(r5)
  if (!j5.modals.info) fails.push('MODAL-NO-INFO-REF')
  if (!j5.modals.compare) fails.push('MODAL-NO-CMP-REF')
  if (!j5.modals.editor) fails.push('MODAL-NO-EDITOR-REF')
  for (const f of ['doTransfer', 'editPermission', 'showInfo', 'del', 'doRename']) {
    if (j5.hasFile && !j5.funcs.includes(f)) fails.push('FUNC-NO-' + f)
  }
  if (j5.small.length && !j5.smallFuncs.includes('editFile')) fails.push('FUNC-NO-EDITFILE')

  if (fails.length) { console.log('SFTP-FAIL', fails.join(',')); process.exit(1) }
  console.log('SFTP-PASS')
  process.exit(0)
}

main().catch(e => { console.log('SFTP-ERR', e.message.slice(0, 80)); process.exit(1) })
