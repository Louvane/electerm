/**
 * slim stub: ftp disabled, keep SFTP
 */
const { TerminalBase } = require('./session-base')
const globalState = require('./global-state')

class Ftp extends TerminalBase {
  constructor (initOptions) {
    super({ ...initOptions, type: 'ftp' })
  }

  async connect () {
    throw new Error('slim: ftp disabled')
  }

  kill () {
    super.onEndConn && super.onEndConn()
    globalState.removeSession(this.pid)
  }
}

module.exports = { Ftp }
module.exports.Ftp = Ftp
