import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchTheme, saveTheme } from './api'
import { applyTheme, THEME_NAMES, type ThemeName } from './themes'

type ThemeContextValue = {
  theme: ThemeName
  setTheme: (name: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('Esmeralda')

  useEffect(() => {
    let cancelled = false
    fetchTheme()
      .then((name) => {
        if (cancelled) return
        setThemeState(name as ThemeName)
        applyTheme(name)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const setTheme = (name: ThemeName) => {
    setThemeState(name)
    applyTheme(name)
    saveTheme(name).catch(() => {})
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export { THEME_NAMES }
export type { ThemeName }
