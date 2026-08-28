/**
 * init app data then write main script to html body
 */
import '../css/basic.styl'
import '../css/mobile.styl'
import { get as _get } from 'lodash-es'
import '../common/pre'

const { isDev } = window.et
// dev 诊断:资源 404(undefined 路径)时打印元素 + React 组件链
if (isDev) {
  window.addEventListener('error', e => {
    const t = e.target
    if (!t || !t.tagName || !['IMG', 'LINK', 'SCRIPT'].includes(t.tagName)) return
    const u = t.src || t.href || ''
    if (!u.includes('undefined')) return
    const comp = []
    try {
      const k = Object.keys(t).find(k => k.startsWith('__reactFiber$'))
      let f = k && t[k]
      while (f && comp.length < 8) {
        if (f.type && typeof f.type === 'function' && f.type.name) comp.push(f.type.name)
        f = f.return
      }
    } catch (err) {}
    console.warn('[anchor:bad-asset]', u, '| components:', comp.join(' < ') || 'unknown')
  }, true)
}
const { version } = window.pre.packInfo

async function loadWorker () {
  return new Promise((resolve) => {
    const url = !isDev ? `js/worker-${version}.js` : 'js/worker.js'
    window.worker = new window.Worker(url)
    function onInit (e) {
      if (!e || !e.data) {
        return false
      }
      const {
        action
      } = e.data
      if (action === 'worker-init') {
        window.worker.removeEventListener('message', onInit)
        resolve(1)
      }
    }
    window.worker.addEventListener('message', onInit)
  })
}

async function load () {
  window.capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }
  function loadScript () {
    const rcs = document.createElement('script')
    const url = !isDev ? `js/electerm-${version}.js` : 'js/electerm.js'
    rcs.src = url
    rcs.type = 'module'
    rcs.onload = () => {
      const loadingEl = document.getElementById('content-loading')
      if (loadingEl) {
        document.body.removeChild(loadingEl)
      }
    }
    document.body.appendChild(rcs)
  }
  const initLocale = window.pre.runSync('getInitLocale') || {}
  window.langMap = initLocale.langMap
  window.initLanguage = initLocale.language
  window.getLang = (lang = window.store?.config.language || window.initLanguage || 'en_us') => {
    return _get(window.langMap, `[${lang}].lang`)
  }
  window.translate = txt => {
    const lang = window.getLang()
    const str = _get(lang, `[${txt}]`) || txt
    return window.capitalizeFirstLetter(str)
  }
  await loadWorker()
  loadScript()
}

// window.addEventListener('load', load)
load()
