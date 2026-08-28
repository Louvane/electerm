/**
 * ANCHOR 应用主题(P6)
 * 双主题 token 注入 documentElement,antd 浮层用 CSS 覆盖适配。
 * 持久化 localStorage,首次跟随系统。
 */
export const ANCHOR_THEMES = {
  dark: {
    '--ink0': '#0f141d',
    '--ink1': '#151c28',
    '--ink2': '#1c2534',
    '--line': '#2a3547',
    '--fog': '#8b98ab',
    '--snow': '#e6edf5',
    '--amber': '#ffb454',
    '--signal': '#3fd68f',
    '--alert': '#f2555a',
    '--wave': '#5aa9e6',
    '--rail': '#232d3e',
    '--dot': '#3a465a'
  },
  light: {
    '--ink0': '#eef1f5',
    '--ink1': '#f7f9fb',
    '--ink2': '#ffffff',
    '--line': '#d4dbe4',
    '--fog': '#5d6b7e',
    '--snow': '#1c2634',
    '--amber': '#b26a00',
    '--signal': '#1e9e63',
    '--alert': '#d43741',
    '--wave': '#2563c4',
    '--rail': '#d9e0e8',
    '--dot': '#c3ccd8'
  }
}

export function applyAnchorTheme (mode) {
  const tokens = ANCHOR_THEMES[mode] || ANCHOR_THEMES.dark
  const root = document.documentElement
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v))
  document.body.dataset.anchorTheme = mode
  window.localStorage.setItem('anchor-theme', mode)
}

export function initAnchorTheme () {
  const saved = window.localStorage.getItem('anchor-theme')
  const mode = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  applyAnchorTheme(mode)
  return mode
}

export function toggleAnchorTheme () {
  const next = document.body.dataset.anchorTheme === 'light' ? 'dark' : 'light'
  applyAnchorTheme(next)
  return next
}
