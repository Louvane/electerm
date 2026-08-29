window.xtermAddons = window.xtermAddons || {}

let xtermCssLoaded = false

function loadXtermCss () {
  if (xtermCssLoaded) return
  xtermCssLoaded = true
  import('@xterm/xterm/css/xterm.css')
}

export async function loadTerminal () {
  if (window.xtermAddons.Terminal) return window.xtermAddons.Terminal
  loadXtermCss()
  const mod = await import('@xterm/xterm')
  window.xtermAddons.Terminal = mod.Terminal
  return window.xtermAddons.Terminal
}

export async function loadFitAddon () {
  if (window.xtermAddons.FitAddon) return window.xtermAddons.FitAddon
  const mod = await import('@xterm/addon-fit')
  window.xtermAddons.FitAddon = mod.FitAddon
  return window.xtermAddons.FitAddon
}

export async function loadAttachAddon () {
  if (window.xtermAddons.AttachAddon) return window.xtermAddons.AttachAddon
  const mod = await import('@xterm/addon-attach')
  window.xtermAddons.AttachAddon = mod.AttachAddon
  return window.xtermAddons.AttachAddon
}

export async function loadWebLinksAddon () {
  if (window.xtermAddons.WebLinksAddon) return window.xtermAddons.WebLinksAddon
  const mod = await import('@xterm/addon-web-links')
  window.xtermAddons.WebLinksAddon = mod.WebLinksAddon
  return window.xtermAddons.WebLinksAddon
}

// slim: webgl/ligatures/image disabled, fallback to dom renderer
export async function loadWebglAddon () {
  throw new Error('slim: webgl disabled')
}

export async function loadSearchAddon () {
  if (window.xtermAddons.SearchAddon) return window.xtermAddons.SearchAddon
  const mod = await import('@xterm/addon-search')
  window.xtermAddons.SearchAddon = mod.SearchAddon
  return window.xtermAddons.SearchAddon
}

export async function loadLigaturesAddon () {
  throw new Error('slim: ligatures disabled')
}

export async function loadUnicode11Addon () {
  if (window.xtermAddons.Unicode11Addon) return window.xtermAddons.Unicode11Addon
  const mod = await import('@xterm/addon-unicode11')
  window.xtermAddons.Unicode11Addon = mod.Unicode11Addon
  return window.xtermAddons.Unicode11Addon
}

export async function loadImageAddon () {
  throw new Error('slim: image disabled')
}

export function getTerminal () {
  return window.xtermAddons.Terminal
}

export function getFitAddon () {
  return window.xtermAddons.FitAddon
}

export function getAttachAddon () {
  return window.xtermAddons.AttachAddon
}

export function getWebLinksAddon () {
  return window.xtermAddons.WebLinksAddon
}

export function getWebglAddon () {
  return null
}

export function getSearchAddon () {
  return window.xtermAddons.SearchAddon
}

export function getLigaturesAddon () {
  return null
}

export function getUnicode11Addon () {
  return window.xtermAddons.Unicode11Addon
}

export function getImageAddon () {
  return null
}
