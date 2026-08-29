/**
 * slim stub: ftp-file disabled
 */
async function readRemoteFile () { throw new Error('slim: ftp disabled') }
async function writeRemoteFile () { throw new Error('slim: ftp disabled') }
module.exports = { readRemoteFile, writeRemoteFile }
