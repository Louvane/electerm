/**
 * slim stub: vnc disabled
 */
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class TerminalVnc extends TerminalBase {
  init = async () => {
    throw new Error('slim: vnc disabled')
  }

  start = async () => {
    throw new Error('slim: vnc disabled')
  }

  resize () {}

  test = async () => false

  kill = () => {
    if (this.sessionLogger) this.sessionLogger.destroy()
    globalState.removeSession(this.pid)
  }
}

exports.session = async function (initOptions, ws) {
  throw new Error('slim: vnc disabled')
}

exports.test = async () => false
