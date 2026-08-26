/**
 * ANCHOR 应用主题(P6)
 * 双主题 token 注入 documentElement,antd 浮层用 CSS 覆盖适配。
 * 持久化 localStorage,首次跟随系统。
 */
// Termius 风格:深夜蓝 / 清爽浅色,蓝色主 accent,大圆角柔和阴影
export const ANCHOR_THEMES = {
  dark: {
    '--ink0': '#1a1c2e',
    '--ink1': '#22243a',
    '--ink2': '#2a2d45',
    '--line': '#34374f',
    '--fog': '#9aa0b5',
    '--snow': '#e8ebf4',
    '--amber': '#5c8dff',
    '--signal': '#3fd68f',
    '--alert': '#ff6b6b',
    '--wave': '#5c8dff',
    '--rail': '#31344e',
    '--dot': '#454968',
    '--radius': '10px',
    '--shadow': '0 8px 28px rgba(10, 12, 24, 0.45)'
  },
  light: {
    '--ink0': '#f3f5fa',
    '--ink1': '#ffffff',
    '--ink2': '#ffffff',
    '--line': '#e1e6f0',
    '--fog': '#6b7280',
    '--snow': '#1d2433',
    '--amber': '#2b6cee',
    '--signal': '#18a05c',
    '--alert': '#e04848',
    '--wave': '#2b6cee',
    '--rail': '#e7ebf4',
    '--dot': '#c9d2e3',
    '--radius': '10px',
    '--shadow': '0 6px 24px rgba(29, 36, 51, 0.08)'
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
