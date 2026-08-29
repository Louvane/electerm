/**
 * slim stub: local ftp server disabled
 */
const widgetInfo = {
  name: 'Local FTP Server',
  description: 'Slim: disabled',
  version: '1.0.0',
  author: 'slim',
  type: 'instance',
  builtin: false,
  configs: []
}

function getDefaultConfig () { return {} }
async function start () { throw new Error('slim: ftp disabled') }
async function stop () {}
function isRunning () { return false }

module.exports = { widgetInfo, getDefaultConfig, start, stop, isRunning }
