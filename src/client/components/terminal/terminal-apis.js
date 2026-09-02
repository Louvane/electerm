/**
 * terminal apis
 */

import fetch from '../../common/fetch-from-server'

export function createTerm (body) {
  return fetch({
    body,
    action: 'create-terminal'
  })
}

export function runCmd (pid, cmd, options) {
  return fetch({
    pid,
    cmd,
    action: 'run-cmd'
  }, options)
}

export function execCmd (pid, cmd, timeoutMs, options) {
  return fetch({
    pid,
    cmd,
    timeoutMs,
    action: 'exec-cmd'
  }, options)
}

export function resizeTerm (pid, cols, rows) {
  return fetch({
    pid,
    cols,
    rows,
    action: 'resize-terminal'
  })
}

export function toggleTerminalLog (pid) {
  return fetch({
    pid,
    action: 'toggle-terminal-log'
  })
}

export function toggleTerminalLogTimestamp (pid) {
  return fetch({
    pid,
    action: 'toggle-terminal-log-timestamp'
  })
}

export function setTerminalLogPath (pid, logPath) {
  return fetch({
    pid,
    logPath,
    action: 'set-terminal-log-path'
  })
}

export function startTerminalLogFile (pid, logFilePath, addTimeStampToTermLog) {
  return fetch({
    pid,
    logFilePath,
    addTimeStampToTermLog,
    action: 'start-terminal-log-file'
  })
}

// === 终端专属直连通道 ===
// 主进程 map 中转(utility->child)响应链不稳, run/exec 直连终端所在 session-server
const termPorts = {}

export function registerTermPort (pid, port) {
  if (pid && port) termPorts[pid] = port
}

export function unregisterTermPort (pid) {
  delete termPorts[pid]
}

function fetchViaTerm (pid, payload, timeoutMs = 12000) {
  const port = termPorts[pid]
  if (!port) return null
  const { host, tokenElecterm } = window.store.config
  return new Promise((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(`ws://${host}:${port}/x/${pid}?token=${tokenElecterm}`)
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { ws.close() } catch (e) {}
      reject(new Error('term-ws timeout'))
    }, timeoutMs)
    ws.onmessage = evt => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch (e) {}
      const r = JSON.parse(evt.data)
      if (r.error) { window.__fverr = 'resp:' + r.error.message; reject(new Error(r.error.message)) } else resolve(r.data)
    }
    ws.onerror = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('term-ws error'))
    }
    ws.onopen = () => {
      ws.send(JSON.stringify(payload))
    }
  })
}

export function runCmdDirect (pid, cmd, options = {}) {
  const p = fetchViaTerm(pid, { id: 'r' + Date.now() + Math.random(), action: 'run-cmd', body: { pid, cmd } })
  return p || runCmd(pid, cmd, options)
}

export function execCmdDirect (pid, cmd, timeoutMs, options = {}) {
  const p = fetchViaTerm(pid, {
    id: 'e' + Date.now() + Math.random(),
    action: 'exec-cmd',
    body: { pid, cmd, timeoutMs }
  }, (timeoutMs || 12000) + 4000)
  return p || execCmd(pid, cmd, timeoutMs, options)
}
