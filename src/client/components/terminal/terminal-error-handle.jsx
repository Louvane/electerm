import { memo } from 'react'
import {
  Button,
  Alert
} from 'antd'

export default memo(function TerminalErrorHandle ({
  errorMessage,
  showEditBookmarkButton,
  onEditBookmark
}) {
  if (!errorMessage) {
    return null
  }

  function renderEditBookmarkButton () {
    if (!showEditBookmarkButton) {
      return null
    }
    return (
      <div className='terminal-error-actions pd1y'>
        <Button
          className='anchor-btn pri'
          onClick={onEditBookmark}
        >
          编辑主机
        </Button>
      </div>
    )
  }

  return (
    <Alert
      className='terminal-error-handle'
      title={errorMessage}
      type='error'
      showIcon
      banner
      description={renderEditBookmarkButton()}
    />
  )
})
