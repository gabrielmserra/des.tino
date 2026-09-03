import { Component, type ReactNode } from 'react'

const RELOAD_AT_KEY = 'chunk_reload_at'
const RELOAD_COOLDOWN_MS = 10_000

// Falha ao baixar um chunk carregado sob demanda (import() dinâmico, hoje só
// a tela de Importar Extrato usa isso) acontece quando a aba já estava
// aberta de antes e um novo deploy trocou os arquivos — o hash do chunk
// antigo não existe mais no servidor (404). Sem isso, o erro derrubava a
// árvore React inteira e deixava a tela em branco/preta até o usuário dar
// F5 manualmente. Recarrega sozinho quando detecta esse tipo de erro
// (com um intervalo mínimo entre tentativas, pra não entrar em loop se o
// erro for outra coisa persistente).
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Failed to fetch|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(
    message,
  )
}

function shouldAutoReload(): boolean {
  const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || '0')
  return Date.now() - last > RELOAD_COOLDOWN_MS
}

interface State {
  failed: boolean
}

export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && shouldAutoReload()) {
      try {
        sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()))
      } catch {
        // ignora — sessionStorage indisponível não deve impedir o reload
      }
      window.location.reload()
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p style={{ color: 'var(--text)' }}>Não foi possível carregar esta tela.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg px-4 py-2 text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
