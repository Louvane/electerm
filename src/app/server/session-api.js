/**
 * run cmd with terminal
 */

const {
  terminals
} = require('./remote-common')
const { startSession } = require('./session')

async function runCmd (body) {
  const { pid, cmd } = body
  const term = terminals(pid)
  let txt = ''
  if (term) {
    txt = await term.runCmd(cmd)
  }
  return txt
}

async function execCmd (body) {
  const { pid, cmd, timeoutMs } = body
  const term = terminals(pid)
  if (!term || typeof term.execCommand !== 'function') {
    require('../common/log').info('== MISS3 pid=', pid, 'proc=', process.pid)
    throw new Error('Exec channel not supported for this session type')
  }
  return term.execCommand(cmd, { timeoutMs })
}

async function resize (body) {
  const { pid, cols, rows } = body
  const term = terminals(pid)
  if (term) {
    term.resize(cols, rows)
  }
  return 'ok'
}

async function toggleTerminalLog (body) {
  const { pid } = body
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLog()
  }
  return 'ok'
}

async function toggleTerminalLogTimestamp (body) {
  const { pid } = body
  const term = terminals(pid)
  if (term) {
    term.toggleTerminalLogTimestamp()
  }
  return 'ok'
}

async function createTerm (body, ws) {
  const t = await startSession(body, ws)
  // 注册实例: 主进程的 run/exec 包装会把请求转发到本进程,
  // 没有注册则 terminals(pid) 永远为空 -> 'Exec channel not supported'
  // (上游 MCP 重构丢失的注册)
  terminals(body.uid || body.tabId, t)
  return t.pid
}

async function testTerm (body, ws) {
  const r = await startSession(body, ws, 'test')
  if (r && r.pid) terminals(r.pid, r)
  if (r) {
    return r
  } else {
    throw new Error('test failed')
  }
}

async function setTerminalLogPath (body) {
  const { pid, logPath } = body
  const term = terminals(pid)
  if (term) {
    term.setTerminalLogPath(logPath)
  }
  return 'ok'
}

async function startTerminalLogFile (body) {
  const { pid, logFilePath, addTimeStampToTermLog } = body
  const term = terminals(pid)
  if (term) {
    term.startTerminalLogFile(logFilePath, addTimeStampToTermLog)
  }
  return 'ok'
}

exports.createTerm = createTerm
exports.testTerm = testTerm
exports.resize = resize
exports.runCmd = runCmd
exports.execCmd = execCmd
exports.toggleTerminalLog = toggleTerminalLog
exports.toggleTerminalLogTimestamp = toggleTerminalLogTimestamp
exports.setTerminalLogPath = setTerminalLogPath
exports.startTerminalLogFile = startTerminalLogFile
