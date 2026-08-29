/**
 * slim stub: serial disabled
 */
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class TerminalSerial extends TerminalBase {
  async init () {
    throw new Error('slim: serial disabled')
  }

  resize () {}

  on () {}

  write () {}

  writeRaw () {}

  kill () {
    if (this.sessionLogger) {
      this.sessionLogger.destroy()
    }
    globalState.removeSession(this.pid)
  }
}

exports.session = async function (initOptions, ws) {
  throw new Error('slim: serial disabled')
}

exports.test = async () => false
