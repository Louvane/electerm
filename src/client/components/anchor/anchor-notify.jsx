/**
 * ANCHOR 统一提示入口(分级体系)
 * L1 success 绿 1.5s / L2 info 灰 2s / L3 warning 琥珀 3s / L4 error 红 4s
 * 全部走 antd message, 定制 class 跟琥珀 token, top 48px 避开标题栏。
 */
import React from 'react'
import message from '../common/message'

const LEVELS = {
  success: { dur: 1.5 },
  info: { dur: 2 },
  warning: { dur: 3 },
  error: { dur: 4 }
}

/**
 * notify(level, text[, opts])
 * opts.duration 覆盖时长; opts.action ReactNode 渲染右侧操作区(如 撤销/重试)
 */
export function notify (level, text, opts = {}) {
  const conf = LEVELS[level] || LEVELS.info
  const content = opts.action
    ? (
      <span className='anchor-notify-row'>
        {text}
        <span className='anchor-notify-act'>{opts.action}</span>
      </span>
      )
    : text
  message.open({
    type: level,
    content,
    duration: opts.duration != null ? opts.duration : conf.dur
  })
}
