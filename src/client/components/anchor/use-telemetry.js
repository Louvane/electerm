/**
 * ANCHOR 遥测轮询 hook(P8c):抽自 monitor-rail
 * 绑定活动 ssh 会话,2s exec 轮询 /proc,返回曲线数据与当前值
 */
import { useEffect, useRef, useState } from 'react'
import { execCmd } from '../terminal/terminal-apis'

const INTERVAL = 2000
const TIMEOUT = 4000
const MAX_POINTS = 60
// loadavg/uptime 放最前,防 net/dev 行多(K8s veth)把 head 配额吃光
const STATS_CMD = 'cat /proc/loadavg /proc/uptime /proc/stat /proc/meminfo /proc/net/dev 2>/dev/null | head -200'

function parseInt10 (n) {
  return parseInt(n, 10) || 0
}

function parseSample (txt) {
  if (!txt) return null
  const sm = {
    cpuTotal: 0,
    cpuIdle: 0,
    memTotal: 0,
    memAvail: 0,
    rx: 0,
    tx: 0,
    load: '',
    swapPct: null,
    uptimeSec: null
  }
  let hasMem = false
  let hasNet = false
  let hasCpu = false
  let swapTotal = 0
  let swapFree = 0
  for (const line of String(txt).split('\n')) {
    if (!hasCpu && line.startsWith('cpu ')) {
      const p = line.trim().split(/\s+/).slice(1).map(parseInt10)
      sm.cpuIdle = (p[3] || 0) + (p[4] || 0)
      sm.cpuTotal = p.reduce((a, b) => a + (b || 0), 0)
      hasCpu = true
    } else if (line.startsWith('MemTotal:')) {
      sm.memTotal = parseInt10(line.split(/\s+/)[1])
    } else if (line.startsWith('MemAvailable:')) {
      sm.memAvail = parseInt10(line.split(/\s+/)[1])
      hasMem = true
    } else if (line.startsWith('SwapTotal:')) {
      swapTotal = parseInt10(line.split(/\s+/)[1])
    } else if (line.startsWith('SwapFree:')) {
      swapFree = parseInt10(line.split(/\s+/)[1])
    } else if (sm.load === '' && /^\d+\.\d+\s+\d+\.\d+\s+\d+\.\d+/.test(line)) {
      sm.load = line.trim().split(/\s+/).slice(0, 3).join(' ')
    } else if (sm.uptimeSec === null && /^\d+\.\d+\s+\d+\.\d+$/.test(line.trim())) {
      sm.uptimeSec = parseInt10(line.trim().split(/\s+/)[0])
    } else if (line.includes(':') && /\d/.test(line) && !line.startsWith('Mem')) {
      const [iface, rest] = line.split(':')
      const f = rest.trim().split(/\s+/)
      if (f.length >= 16 && iface.trim() !== 'lo') {
        sm.rx += parseInt10(f[0])
        sm.tx += parseInt10(f[8])
        hasNet = true
      }
    }
  }
  if (hasMem && swapTotal > 0) {
    sm.swapPct = (swapTotal - swapFree) * 100 / swapTotal
  }
  if (!hasCpu && !hasMem && !hasNet) return null
  return sm
}

function computePoint (prev, cur) {
  const p = {
    cpu: null,
    mem: cur.memTotal > 0 ? (cur.memTotal - cur.memAvail) * 100 / cur.memTotal : null,
    swap: cur.swapPct,
    load: cur.load,
    rxKb: null,
    txKb: null
  }
  if (prev && cur.cpuTotal > prev.cpuTotal) {
    p.cpu = (cur.cpuTotal - cur.cpuIdle - (prev.cpuTotal - prev.cpuIdle)) * 100 /
      (cur.cpuTotal - prev.cpuTotal)
  }
  if (prev && cur.rx >= prev.rx) {
    p.rxKb = (cur.rx - prev.rx) / INTERVAL * 1.024
    p.txKb = (cur.tx - prev.tx) / INTERVAL * 1.024
  }
  return p
}

export default function useTelemetry (pid, enabled) {
  const [points, setPoints] = useState([])
  const prevRef = useRef(null)
  const aliveRef = useRef(false)

  useEffect(() => {
    if (!pid || !enabled) return undefined
    aliveRef.current = true
    let timer = null
    const tick = async () => {
      try {
        const res = await execCmd(pid, STATS_CMD, TIMEOUT)
        const out = res && typeof res === 'object' && 'stdout' in res ? res.stdout : res
        const sample = parseSample(out)
        if (sample && aliveRef.current) {
          const point = computePoint(prevRef.current, sample)
          prevRef.current = sample
          setPoints(pts => [...pts.slice(-(MAX_POINTS - 1)), point])
        }
      } catch (e) {
        // 会话未就绪或非 Linux:静默重试
      }
      if (aliveRef.current) timer = setTimeout(tick, INTERVAL)
    }
    tick()
    return () => {
      aliveRef.current = false
      clearTimeout(timer)
      prevRef.current = null
    }
  }, [pid, enabled])

  const last = points[points.length - 1] || {}
  return { points, last, live: points.length > 0 }
}
