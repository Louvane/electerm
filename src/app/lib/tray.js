/**
 * 常驻系统托盘(主流关窗语义配套)
 * 图标点击=显示窗口; 右键=打开/退出
 */
const { Tray, Menu } = require('electron')
const globalState = require('./glob-state')
const path = require('path')

let tray = null

function createTray () {
  if (tray) return tray
  const iconPath = path.resolve(__dirname, process.env.NODE_ENV === 'development' ? '../../../build/resources/anchor512.png' : '../assets/images/anchor-app.png')
  try {
    tray = new Tray(iconPath)
  } catch (e) {
    return null
  }
  tray.setToolTip('ANCHOR 锚点终端')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 ANCHOR', click: () => showWin() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        globalState.set('closeAction', 'exit')
        const win = globalState.get('win')
        win && win.close()
      }
    }
  ]))
  tray.on('click', () => showWin())
  return tray
}

function showWin () {
  const win = globalState.get('win')
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
  }
}

exports.createTray = createTray
