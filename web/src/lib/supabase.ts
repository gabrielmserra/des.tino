import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.local.',
  )
}

// "Lembrar de mim" (tela de login desktop): desmarcado guarda a sessão em
// sessionStorage (some ao fechar a aba/navegador) em vez de localStorage
// (sobrevive indefinidamente). Preferência default = lembrar, igual ao
// comportamento de sempre — só muda pra quem desmarcar explicitamente.
const REMEMBER_KEY = 'sb_remember_me'

export function getRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== '0'
  } catch {
    return true
  }
}

export function setRememberMe(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    // ignora — localStorage indisponível (modo privado etc.)
  }
}

const dynamicAuthStorage = {
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (getRememberMe()) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    } catch {
      // ignora
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      // ignora
    }
  },
}

// Mesmo projeto Supabase do app desktop → dados vinculados automaticamente.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: dynamicAuthStorage,
  },
})
