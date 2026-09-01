import { memo } from 'react'

// ANCHOR: 连接失败居中卡片(纯 token, 明暗自适应; 弃 antd Alert 避开暗色 token 泄漏)
export default memo(function TerminalErrorHandle ({
  errorMessage,
  showEditBookmarkButton,
  onEditBookmark
}) {
  if (!errorMessage) {
    return null
  }
  return (
    <div className='terminal-error-handle'>
      <div className='teh-card'>
        <div className='teh-icon'>⨯</div>
        <div className='teh-title'>连接失败</div>
        <div className='teh-msg'>{errorMessage}</div>
        <div className='teh-actions'>
          {
            showEditBookmarkButton
              ? (
                <button className='anchor-btn pri' onClick={onEditBookmark}>编辑主机</button>
              )
              : null
          }
          <button
            className='anchor-btn' onClick={() => {
              const tab = window.store?.tabs?.find(t => t.id === window.store?.activeTabId)
              if (tab) window.store.delTab(tab.id)
            }}
          >关闭标签</button>
        </div>
      </div>
    </div>
  )
})
