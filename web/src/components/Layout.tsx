import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  CreditCard,
  HandCoins,
  Plus,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useMonths } from '../lib/month'
import { useAuth } from '../lib/auth'
import { useTxForm } from '../lib/txform'
import { TxForm } from './TxForm'
import { AddMonthDialog } from './AddMonthDialog'
import { applyAllDueRenewals } from '../lib/api'
import { formatCurrency } from '../lib/format'
import type { RenewalSummary } from '../lib/types'

function MonthSelector() {
  const { months, selectedId, setSelectedId } = useMonths()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="flex items-center gap-1.5">
      {months.length > 0 && (
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
      )}
      <button
        onClick={() => setShowAdd(true)}
        aria-label="Novo período"
        className="flex items-center justify-center rounded-lg border p-2"
        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
      >
        <Plus size={16} strokeWidth={2} />
      </button>
      {showAdd && (
        <AddMonthDialog
          months={months}
          onClose={() => setShowAdd(false)}
          onCreated={async (id) => {
            await qc.invalidateQueries({ queryKey: ['months'] })
            setSelectedId(id)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

function NavTab({
  to,
  end,
  icon: Icon,
  label,
}: {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
}) {
  return (
    <NavLink to={to} end={end} className="flex flex-1 flex-col items-center gap-1 py-2.5">
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={2} color={isActive ? 'var(--primary)' : 'var(--muted)'} />
          <span style={{ color: isActive ? 'var(--primary)' : 'var(--muted)', fontSize: 11, fontWeight: 600 }}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

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
            aria-label="Sair"
            className="flex items-center justify-center rounded-lg border p-2"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            <LogOut size={16} strokeWidth={2} />
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
        className="fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
        style={{ background: 'var(--primary)' }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Formulário (modal) */}
      <TxForm />

      {/* Navegação inferior */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavTab to="/" end icon={LayoutDashboard} label="Dashboard" />
        <NavTab to="/planejamento" icon={ClipboardList} label="Plano" />
        <NavTab to="/lancamentos" icon={Receipt} label="Lançamentos" />
        <NavTab to="/cartoes" icon={CreditCard} label="Cartões" />
        <NavTab to="/dividas" icon={HandCoins} label="Dívidas" />
      </nav>
    </div>
  )
}
