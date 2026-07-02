import { NavLink, Outlet } from 'react-router-dom'
import { useMonths } from '../lib/month'
import { useAuth } from '../lib/auth'
import { useTxForm } from '../lib/txform'
import { TxForm } from './TxForm'

function MonthSelector() {
  const { months, selectedId, setSelectedId } = useMonths()
  if (months.length === 0) return null
  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => setSelectedId(Number(e.target.value))}
      className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
      style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
    >
      {months.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  )
}

const tabStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? 'var(--primary)' : 'var(--muted)',
  flex: 1,
  textAlign: 'center' as const,
  padding: '10px 0',
  fontSize: 12,
  fontWeight: 600,
})

export function Layout() {
  const { signOut } = useAuth()
  const { openNew } = useTxForm()

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <span className="text-lg font-bold">
          des<span style={{ color: 'var(--primary)' }}>.</span>tino
        </span>
        <div className="flex items-center gap-2">
          <MonthSelector />
          <button
            onClick={() => signOut()}
            className="rounded-lg border px-2 py-2 text-xs"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Botão flutuante: novo lançamento */}
      <button
        onClick={openNew}
        aria-label="Novo lançamento"
        className="fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full text-3xl font-light text-white shadow-lg"
        style={{ background: 'var(--primary)' }}
      >
        +
      </button>

      {/* Formulário (modal) */}
      <TxForm />

      {/* Navegação inferior */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink to="/" end style={tabStyle}>
          📊<br />Dashboard
        </NavLink>
        <NavLink to="/lancamentos" style={tabStyle}>
          📄<br />Lançamentos
        </NavLink>
        <NavLink to="/cartoes" style={tabStyle}>
          💳<br />Cartões
        </NavLink>
      </nav>
    </div>
  )
}
