/**
 * btns
 */

import { CloseOutlined, MinusOutlined, BorderOutlined } from '@ant-design/icons'
import { auto } from 'manate/react'
import {
  isMacJs
} from '../../common/constants'

const e = window.translate

export default auto(function WindowControl (props) {
  const {
    isMaximized,
    config
  } = props.store
  if (config.useSystemTitleBar || isMacJs) {
    return null
  }
  const minimize = () => {
    window.pre.runGlobalAsync('minimize')
  }
  const maximize = () => {
    window.pre.runGlobalAsync('maximize')
    window.store.isMaximized = true
  }
  const unmaximize = () => {
    window.pre.runGlobalAsync('unmaximize')
    window.store.isMaximized = false
  }
  const closeApp = () => {
    // 纯关窗意图(不带 exit): tray 模式 hide, quit 模式走确认/退出
    window.pre.runGlobalAsync('closeApp')
  }
  return (
    <div className='window-controls'>
      <div className='window-control-box window-control-minimize' onClick={minimize}>
        <MinusOutlined title={e('minimize')} className='iblock font12 widnow-control-icon' />
      </div>
      <div
        className='window-control-box window-control-maximize'
        onClick={
          isMaximized ? unmaximize : maximize
        }
      >
        <BorderOutlined
          title={isMaximized ? e('unmaximize') : e('maximize')}
          className='iblock font12 widnow-control-icon'
        />
      </div>
      <div className='window-control-box window-control-close' onClick={closeApp}>
        <CloseOutlined title={e('close')} className='iblock font12 widnow-control-icon' />
      </div>
    </div>
  )
})
