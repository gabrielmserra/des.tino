import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import { useAuth } from '../lib/auth'
import { useTxForm } from '../lib/txform'
import { TxForm } from './TxForm'
import { applyAllDueRenewals } from '../lib/api'
import { formatCurrency } from '../lib/format'
import type { RenewalSummary } from '../lib/types'

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

// Roda uma vez por sessão do site (igual ao app desktop na abertura): aplica
// renovações de VR/VA pendentes e mostra um toast quando algo foi renovado.
function useRenewalCheck() {
  const qc = useQueryClient()
  const [summary, setSummary] = useState<RenewalSummary[] | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    applyAllDueRenewals()
      .then((result) => {
        if (result.length > 0) {
          setSummary(result)
          qc.invalidateQueries({ queryKey: ['benefitsOverview'] })
          qc.invalidateQueries({ queryKey: ['benefitsBasic'] })
          qc.invalidateQueries({ queryKey: ['benefitTotal'] })
        }
      })
      .catch(() => {})
  }, [qc])

  return summary
}

function RenewalToast({ summary, onDismiss }: { summary: RenewalSummary[]; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const text = summary
    .map((s) => `${s.name} (${s.benefit_type}): +${formatCurrency(s.total)}${s.count > 1 ? ` (${s.count}x)` : ''}`)
    .join('  •  ')

  return (
    <div
      className="fixed left-1/2 top-16 z-30 w-[92%] max-w-md -translate-x-1/2 rounded-xl border p-3 text-center text-xs font-bold shadow-lg"
      style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }}
      onClick={onDismiss}
    >
      🔄 Benefício renovado: {text}
    </div>
  )
}

export function Layout() {
  const { signOut } = useAuth()
  const { openNew } = useTxForm()
  const renewalSummary = useRenewalCheck()
  const [showToast, setShowToast] = useState(true)

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

      {renewalSummary && renewalSummary.length > 0 && showToast && (
        <RenewalToast summary={renewalSummary} onDismiss={() => setShowToast(false)} />
      )}

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
        <NavLink to="/planejamento" style={tabStyle}>
          📋<br />Plano
        </NavLink>
        <NavLink to="/lancamentos" style={tabStyle}>
          📄<br />Lançamentos
        </NavLink>
        <NavLink to="/cartoes" style={tabStyle}>
          💳<br />Cartões
        </NavLink>
        <NavLink to="/beneficios" style={tabStyle}>
          🍽️<br />VR/VA
        </NavLink>
      </nav>
    </div>
  )
}
