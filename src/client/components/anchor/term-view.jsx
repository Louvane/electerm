/**
 * ANCHOR 终端视图(P4)
 * 复用 electerm SessionsWrap(会话/终端/SFTP 全机制),
 * 只负责:量测内容区尺寸 → 换算 sizes/styles 传入。
 */
import React, { useRef, useState, useEffect } from 'react'
import { pick } from 'lodash-es'
import SessionsWrap from '../session/sessions'
import layoutAlg from '../layout/layout-alg'
import calcSessionSize from '../layout/session-size-alg'
import pixed from '../layout/pixed'

export default function TermView ({ store }) {
  const ref = useRef(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new window.ResizeObserver(entries => {
      const r = entries[0].contentRect
      setDim({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = store.layout || 'c1'
  // electerm 原生高度会扣 termControlHeight(32, 原布局底部控制条), ANCHOR 无此条 → 补回, 否则终端底部留 32px 空白
  const hAdj = dim.h + 32
  const styles = layoutAlg(layout, dim.w, hAdj)
  const sizes = calcSessionSize(layout, dim.w, hAdj)
  const layoutStyle = pixed({ height: dim.h, top: 0, left: 0, width: dim.w })

  const sessionsProps = {
    styles: styles.wrapStyles,
    sizes,
    width: dim.w,
    height: dim.h,
    layoutStyle,
    ...pick(store, [
      'activeTabId',
      'activeTabId0',
      'activeTabId1',
      'activeTabId2',
      'activeTabId3',
      'batch',
      'resolutions',
      'hideDelKeyTip',
      'fileOperation',
      'file',
      'pinnedQuickCommandBar',
      'tabsHeight',
      'appPath',
      'leftSidePanelWidth',
      'pinned',
      'openedSideBar',
      'config',
      'fullscreen'
    ]),
    tabs: store.tabs,
    layout
  }

  return (
    <div ref={ref} className='no-fade' style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {
        dim.w > 0 && <SessionsWrap {...sessionsProps} />
      }
    </div>
  )
}
