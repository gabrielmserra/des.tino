// Paletas do app — espelham exatamente ui/theme.py (THEMES) do desktop.
export const THEME_NAMES = ['Esmeralda', 'Grafite', 'Oceano', 'Vinho', 'Areia', 'Carvão'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

type ThemeVars = {
  bg: string
  card: string
  card2: string
  border: string
  borderL: string
  text: string
  muted: string
  primary: string
  primaryHover: string
  accent: string
  scheme: 'dark' | 'light'
}

export const THEMES: Record<ThemeName, ThemeVars> = {
  Esmeralda: {
    bg: '#0D1F1A', card: '#112318', card2: '#162D1E',
    border: '#1A3D2A', borderL: '#224D35',
    text: '#E8F5F0', muted: '#7AAF95',
    primary: '#2EAF7D', primaryHover: '#249A6C', accent: '#F5A623',
    scheme: 'dark',
  },
  Grafite: {
    bg: '#111214', card: '#18191C', card2: '#1E2023',
    border: '#2A2B2F', borderL: '#323438',
    text: '#F1F2F4', muted: '#8A8D94',
    primary: '#6C8EFF', primaryHover: '#5070E0', accent: '#FFB347',
    scheme: 'dark',
  },
  Oceano: {
    bg: '#0A0F1E', card: '#0E1628', card2: '#121D33',
    border: '#1A2A4A', borderL: '#1E3055',
    text: '#E8EEFF', muted: '#6E8AB5',
    primary: '#4A9EFF', primaryHover: '#2E85E0', accent: '#7FFFD4',
    scheme: 'dark',
  },
  Vinho: {
    bg: '#120A18', card: '#1A0F22', card2: '#20132A',
    border: '#321A45', borderL: '#3D2055',
    text: '#F0E8FF', muted: '#9070BB',
    primary: '#B07FFF', primaryHover: '#9060E0', accent: '#FF8FA3',
    scheme: 'dark',
  },
  Areia: {
    bg: '#F5F3EE', card: '#FFFFFF', card2: '#F0EDE8',
    border: '#D8D3CA', borderL: '#E4E0D8',
    text: '#1A1814', muted: '#6B6560',
    primary: '#2EAF7D', primaryHover: '#249A6C', accent: '#D4820A',
    scheme: 'light',
  },
  Carvão: {
    bg: '#080809', card: '#0F0F11', card2: '#141416',
    border: '#1E1E22', borderL: '#252528',
    text: '#EBEBEF', muted: '#70707A',
    primary: '#FF6B6B', primaryHover: '#E05050', accent: '#FFD166',
    scheme: 'dark',
  },
}

export function applyTheme(name: string): void {
  const t = THEMES[name as ThemeName] ?? THEMES.Esmeralda
  const root = document.documentElement
  root.style.setProperty('--bg', t.bg)
  root.style.setProperty('--card', t.card)
  root.style.setProperty('--card2', t.card2)
  root.style.setProperty('--border', t.border)
  root.style.setProperty('--border-l', t.borderL)
  root.style.setProperty('--text', t.text)
  root.style.setProperty('--muted', t.muted)
  root.style.setProperty('--primary', t.primary)
  root.style.setProperty('--primary-hover', t.primaryHover)
  root.style.setProperty('--accent', t.accent)
  root.style.colorScheme = t.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg)
}
