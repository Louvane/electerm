/**
 * 常驻系统托盘(主流关窗语义配套)
 * 图标点击=显示窗口; 右键=打开/退出
 */
const { Tray, Menu } = require('electron')
const globalState = require('./glob-state')
const path = require('path')

let tray = null

function iconPath () {
  // Windows 托盘必须用 ico, 且不能读 asar 包内路径 → 走 unpacked
  if (process.env.NODE_ENV === 'development') {
    return process.platform === 'win32'
      ? path.resolve(__dirname, '../../../build/resources/anchor.ico')
      : path.resolve(__dirname, '../../../build/resources/anchor512.png')
  }
  const base = path.resolve(__dirname, '../assets/images/anchor-app.png')
    .replace('app.asar', 'app.asar.unpacked')
  return process.platform === 'win32'
    ? base.replace(/\.png$/, '.ico')
    : base
}

function createTray () {
  if (tray) return tray
  try {
    tray = new Tray(iconPath())
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
  } catch (e) {
    return null
  }
}

function showWin () {
  const win = globalState.get('win')
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
  }
}

exports.showWin = showWin

exports.createTray = createTray
