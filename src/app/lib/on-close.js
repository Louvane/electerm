/**
 * on close app
 */

const { dbAction } = require('./db')
const log = require('../common/log')
const globalState = require('./glob-state')

exports.getExitStatus = async () => {
  const res = await dbAction('data', 'findOne', {
    _id: 'exitStatus'
  })
  return res && res.value ? res.value : ''
}

exports.onClose = async function (e) {
  const config = globalState.get('config')
  // 主流关窗语义: 默认最小化到托盘; 除非「退出程序」模式或托盘/菜单显式退出(closeAction=exit)
  const closeBehavior = config.closeBehavior || 'tray'
  const forceExit = globalState.get('closeAction') === 'exit'
  if (closeBehavior === 'tray' && !forceExit) {
    const win = globalState.get('win')
    if (win && !win.isDestroyed()) {
      win.hide()
    }
    return e.preventDefault()
  }
  if (config.confirmBeforeExit && globalState.get('closeAction')) {
    const win = globalState.get('win')
    win?.webContents.send(
      'confirm-exit',
      globalState.get('closeAction')
    )
    globalState.set('closeAction', '')
    return e.preventDefault()
  }
  log.debug('Closing app')
  const childPid = globalState.get('childPid')
  childPid && process.kill(childPid)
  globalState.set('serverInited', false)
  process.on('uncaughtException', function () {
    const childPid = globalState.get('childPid')
    childPid && process.kill(childPid)
    process.exit(0)
  })
  log.debug('Child process killed')
  // await dbAction('data', 'update', {
  //   _id: 'exitStatus'
  // }, {
  //   value: 'ok',
  //   _id: 'exitStatus'
  // }, {
  //   upsert: true
  // })
  // await dbAction('data', 'update', {
  //   _id: 'sessions'
  // }, {
  //   value: null,
  //   _id: 'sessions'
  // }, {
  //   upsert: true
  // })
  // log.debug('session saved')
  clearTimeout(globalState.get('timer'))
  globalState.set('win', null)
  const app = globalState.get('app')
  app.quit && app.quit()
}
