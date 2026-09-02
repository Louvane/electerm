/**
 * ANCHOR 应用主题(P6)
 * 双主题 token 注入 documentElement,antd 浮层用 CSS 覆盖适配。
 * 持久化 localStorage,首次跟随系统。
 */
export const ANCHOR_THEMES = {
  dark: {
    '--termBg': '#0f141d',
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
    '--termBg': '#ffffff',
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

// 终端配色预设(独立于应用主题), terminalPreset 存 store.config
export const TERM_PRESETS = {
  'anchor-dark': {
    name: '琥珀暗(默认)', bg: '#0f141d', fg: '#dce1f0',
    cursor: '#ffb454', cursorAccent: '#0f141d', selectionBackground: 'rgba(255,180,84,0.48)',
    black: '#3a3d52', red: '#ff6b6b', green: '#3fd68f', yellow: '#ffd483',
    blue: '#5c8dff', magenta: '#c792ea', cyan: '#7fdbca', white: '#e8ebf4',
    brightBlack: '#565a7a', brightRed: '#ff8b8b', brightGreen: '#6ee7a8', brightYellow: '#ffe3a3',
    brightBlue: '#8ab4ff', brightMagenta: '#ddb3f5', brightCyan: '#a8e8d8', brightWhite: '#f5f7fc'
  },
  'anchor-light': {
    name: '纸白', bg: '#ffffff', fg: '#1c2634',
    cursor: '#b26a00', cursorAccent: '#ffffff', selectionBackground: 'rgba(178,106,0,0.45)',
    black: '#3a4356', red: '#c04343', green: '#177a4c', yellow: '#9a5b00',
    blue: '#20599e', magenta: '#7a3f9e', cyan: '#0c6a74', white: '#77839a',
    brightBlack: '#5d6b7e', brightRed: '#d43741', brightGreen: '#1e9e63', brightYellow: '#b26a00',
    brightBlue: '#2f6fc4', brightMagenta: '#9350bd', brightCyan: '#128391', brightWhite: '#4a5568'
  },
  dracula: {
    name: 'Dracula', bg: '#282a36', fg: '#f8f8f2',
    cursor: '#f8f8f0', cursorAccent: '#282a36', selectionBackground: 'rgba(98,114,164,0.85)',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },
  'solarized-dark': {
    name: 'Solarized Dark', bg: '#002b36', fg: '#839496',
    cursor: '#93a1a1', cursorAccent: '#002b36', selectionBackground: 'rgba(181,137,0,0.55)', selectionForeground: '#fdf6e3',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
  },
  'solarized-light': {
    name: 'Solarized Light', bg: '#fdf6e3', fg: '#657b83',
    cursor: '#93a1a1', cursorAccent: '#fdf6e3', selectionBackground: 'rgba(181,137,0,0.45)', selectionForeground: '#073642',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#eee8d5', brightRed: '#cb4b16', brightGreen: '#93a1a1', brightYellow: '#839496',
    brightBlue: '#657b83', brightMagenta: '#6c71c4', brightCyan: '#586e75', brightWhite: '#002b36'
  },
  'one-dark': {
    name: 'One Dark', bg: '#282c34', fg: '#abb2bf',
    cursor: '#528bff', cursorAccent: '#282c34', selectionBackground: 'rgba(75,84,99,0.95)',
    black: '#282c34', red: '#e06c75', green: '#98c379', yellow: '#e5c07b',
    blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#abb2bf',
    brightBlack: '#5c6370', brightRed: '#e06c75', brightGreen: '#98c379', brightYellow: '#e5c07b',
    brightBlue: '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#ffffff'
  },
  nord: {
    name: 'Nord', bg: '#2e3440', fg: '#d8dee9',
    cursor: '#d8dee9', cursorAccent: '#2e3440', selectionBackground: 'rgba(136,192,208,0.75)', selectionForeground: '#2e3440',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
  }
}

export function getTermPreset (key) {
  return TERM_PRESETS[key] || TERM_PRESETS['anchor-dark']
}

// 终端底/字色 var 跟随配色方案(独立于应用主题)
export function applyTermBg () {
  const key = window.store?.config?.terminalPreset
  const p = getTermPreset(key)
  const root = document.documentElement
  root.style.setProperty('--termBg', p.bg)
  root.style.setProperty('--termFg', p.fg)
}

export function applyAnchorTheme (mode) {
  const tokens = ANCHOR_THEMES[mode] || ANCHOR_THEMES.dark
  const root = document.documentElement
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v))
  document.body.dataset.anchorTheme = mode
  window.localStorage.setItem('anchor-theme', mode)
  // 应用主题切换后, 终端配色仍跟自己的 preset
  try { applyTermBg() } catch (e) {}
}

export function initAnchorTheme () {
  const saved = window.localStorage.getItem('anchor-theme')
  // 默认白天
  const mode = saved || 'light'
  applyAnchorTheme(mode)
  applyTermBg()
  return mode
}

export function toggleAnchorTheme () {
  const next = document.body.dataset.anchorTheme === 'light' ? 'dark' : 'light'
  applyAnchorTheme(next)
  return next
}
