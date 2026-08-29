/**
 * slim stub: rdp disabled
 */
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class TerminalRdp extends TerminalBase {
  init = async () => {
    throw new Error('slim: rdp disabled')
  }

  start = async () => {
    throw new Error('slim: rdp disabled')
  }

  resize () {}

  test = async () => false

  kill = () => {
    if (this.sessionLogger) this.sessionLogger.destroy()
    globalState.removeSession(this.pid)
  }
}

exports.session = async function (initOptions, ws) {
  throw new Error('slim: rdp disabled')
}

exports.test = async () => false
