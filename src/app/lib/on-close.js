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
  // 退出前确认: closeAction='confirmed' 表示渲染层已确认, 放行
  if (config.confirmBeforeExit && globalState.get('closeAction') !== 'confirmed') {
    const win = globalState.get('win')
    const pendingAction = globalState.get('closeAction') || 'exit'
    win?.webContents.send('confirm-exit', pendingAction)
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
