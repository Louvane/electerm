/**
 * slim stub: telnet disabled
 */
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class TerminalTelnet extends TerminalBase {
  async init () {
    throw new Error('slim: telnet disabled')
  }

  resize () {}

  kill () {
    if (this.sessionLogger) this.sessionLogger.destroy()
    globalState.removeSession(this.pid)
  }
}

exports.session = async function (initOptions, ws) {
  throw new Error('slim: telnet disabled')
}

exports.test = async () => false
