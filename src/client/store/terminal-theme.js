/**
 * theme related functions
 */

import {
  settingMap
} from '../common/constants'
import { convertTheme } from '../common/terminal-theme'
import {
  defaultTheme,
  defaultThemeLight
} from '../common/theme-defaults'

export default Store => {
  Store.prototype.getTerminalThemes = function () {
    const t1 = defaultTheme()
    const t2 = defaultThemeLight()
    // ANCHOR 内置:Termius 风格终端配色(默认)
    const t0 = {
      id: 'anchorTermius',
      name: 'ANCHOR Termius',
      themeConfig: {
        foreground: '#dce1f0',
        background: '#141622',
        cursor: '#5c8dff',
        cursorAccent: '#141622',
        selectionBackground: 'rgba(92, 141, 255, 0.35)',
        black: '#3a3d52',
        red: '#ff6b6b',
        green: '#3fd68f',
        yellow: '#ffd483',
        blue: '#5c8dff',
        magenta: '#c792ea',
        cyan: '#7fdbca',
        white: '#e8ebf4',
        brightBlack: '#565a7a',
        brightRed: '#ff8b8b',
        brightGreen: '#6ee7a8',
        brightYellow: '#ffe3a3',
        brightBlue: '#8ab4ff',
        brightMagenta: '#ddb3f5',
        brightCyan: '#a8e8d8',
        brightWhite: '#f5f7fc'
      },
      uiThemeConfig: t1.uiThemeConfig
    }
    return [
      t0,
      t1,
      t2,
      ...window.store.getItems(settingMap.terminalThemes).filter(d => {
        return d && d.id !== t1.id && d.id !== t2.id
      })
    ]
  }

  Store.prototype.setTheme = function (id) {
    window.store.updateConfig({
      theme: id
    })
  }

  Store.prototype.addTheme = function (theme) {
    window.store.addItem(theme, settingMap.terminalThemes)
  }

  Store.prototype.editTheme = function (id, updates) {
    return window.store.editItem(
      id, updates, settingMap.terminalThemes
    )
  }

  Store.prototype.delTheme = function ({ id }) {
    window.store.delItem({ id }, settingMap.terminalThemes)
  }

  Store.prototype.getThemeConfig = function () {
    const { store } = window
    const all = store.getSidebarList(settingMap.terminalThemes)
    return (all.find(d => d.id === store.config.theme) || {}).themeConfig || {}
  }

  Store.prototype.fixThemes = function (themes) {
    return themes.map(t => {
      const d1 = defaultTheme()
      const d2 = defaultThemeLight()
      const isDefaultTheme = t.id === d1.id
      const isDefaultThemeLight = t.id === d2.id
      if (isDefaultTheme) {
        Object.assign(t, d1)
      } else if (isDefaultThemeLight) {
        Object.assign(t, d2)
      } else if (!t.uiThemeConfig) {
        t.uiThemeConfig = d1.uiThemeConfig
      }
      return t
    })
  }

  Store.prototype.setItermThemes = function (arr) {
    window.store.itermThemes = arr
  }

  Store.prototype.fetchItermThemes = async function () {
    const list = await window.pre.runGlobalAsync('listItermThemes')
    window.store.setItermThemes(
      list.map(d => {
        const obj = convertTheme(d)
        return {
          ...obj,
          id: 'iterm#' + obj.name,
          readonly: true,
          type: 'iterm'
        }
      })
    )
  }
}
