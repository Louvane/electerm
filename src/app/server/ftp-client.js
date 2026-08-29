/**
 * slim stub: ftp-client disabled
 */
class FtpClientWrapper {
  async access () { throw new Error('slim: ftp disabled') }
  async close () {}
  setEncoding () {}
}

module.exports = FtpClientWrapper
