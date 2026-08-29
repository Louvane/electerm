/**
 * slim stub: spice disabled
 */
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class TerminalSpice extends TerminalBase {
  init = async () => {
    throw new Error('slim: spice disabled')
  }

  start = async () => {
    throw new Error('slim: spice disabled')
  }

  resize () {}

  test = async () => false

  kill = () => {
    if (this.sessionLogger) this.sessionLogger.destroy()
    globalState.removeSession(this.pid)
  }
}

exports.session = async function (initOptions, ws) {
  throw new Error('slim: spice disabled')
}

exports.test = async () => false
