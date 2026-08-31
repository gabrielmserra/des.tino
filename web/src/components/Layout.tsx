import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  CreditCard,
  HandCoins,
  MoreHorizontal,
  Plus,
  Pencil,
  LogOut,
  Palette,
  type LucideIcon,
} from 'lucide-react'
import { useMonths } from '../lib/month'
import { useAuth } from '../lib/auth'
import { useTxForm } from '../lib/txform'
import { useTheme } from '../lib/theme'
import { TxForm } from './TxForm'
import { AddMonthDialog } from './AddMonthDialog'
import { EditMonthDialog } from './EditMonthDialog'
import { ThemeDialog } from './ThemeDialog'
import { applyAllDueRenewals } from '../lib/api'
import { formatCurrency } from '../lib/format'
import type { RenewalSummary } from '../lib/types'

function MonthSelector({ onAdd, onEdit }: { onAdd: () => void; onEdit: () => void }) {
  const { months, selectedId, setSelectedId } = useMonths()

  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
      {months.length > 0 && (
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          className="min-w-0 rounded-lg border px-1.5 py-1.5 text-xs font-semibold outline-none sm:px-3 sm:py-2 sm:text-sm"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          {months.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      {months.length > 0 && (
        <button
          onClick={onEdit}
          aria-label="Editar período"
          className="flex shrink-0 items-center justify-center rounded-lg border p-1.5 sm:p-2"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          <Pencil size={14} strokeWidth={2} className="sm:hidden" />
          <Pencil size={16} strokeWidth={2} className="hidden sm:block" />
        </button>
      )}
      <button
        onClick={onAdd}
        aria-label="Novo período"
        className="flex shrink-0 items-center justify-center rounded-lg border p-1.5 sm:p-2"
        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
      >
        <Plus size={14} strokeWidth={2} className="sm:hidden" />
        <Plus size={16} strokeWidth={2} className="hidden sm:block" />
      </button>
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
  const { theme, setTheme } = useTheme()
  const { months, selected, setSelectedId } = useMonths()
  const qc = useQueryClient()
  const renewalSummary = useRenewalCheck()
  const [showToast, setShowToast] = useState(true)
  const [showTheme, setShowTheme] = useState(false)
  const [showAddMonth, setShowAddMonth] = useState(false)
  const [showEditMonth, setShowEditMonth] = useState(false)

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-3 sm:px-4"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <span className="shrink-0 text-base font-bold sm:text-lg">
          des<span style={{ color: 'var(--primary)' }}>.</span>tino
        </span>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <MonthSelector onAdd={() => setShowAddMonth(true)} onEdit={() => setShowEditMonth(true)} />
          <button
            onClick={() => setShowTheme(true)}
            aria-label="Escolher tema"
            className="flex shrink-0 items-center justify-center rounded-lg border p-1.5 sm:p-2"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            <Palette size={14} strokeWidth={2} className="sm:hidden" />
            <Palette size={16} strokeWidth={2} className="hidden sm:block" />
          </button>
          <button
            onClick={() => signOut()}
            aria-label="Sair"
            className="flex shrink-0 items-center justify-center rounded-lg border p-1.5 sm:p-2"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            <LogOut size={14} strokeWidth={2} className="sm:hidden" />
            <LogOut size={16} strokeWidth={2} className="hidden sm:block" />
          </button>
        </div>
      </header>

      {/* Diálogos ficam fora do header (sticky+z-10 cria stacking context próprio, que a nav de baixo sempre venceria) */}
      {showAddMonth && (
        <AddMonthDialog
          months={months}
          onClose={() => setShowAddMonth(false)}
          onCreated={async (id) => {
            await qc.invalidateQueries({ queryKey: ['months'] })
            setSelectedId(id)
            setShowAddMonth(false)
          }}
        />
      )}

      {showTheme && (
        <ThemeDialog current={theme} onClose={() => setShowTheme(false)} onSelect={setTheme} />
      )}

      {showEditMonth && selected && (
        <EditMonthDialog
          current={selected}
          months={months}
          onClose={() => setShowEditMonth(false)}
          onRenamed={async () => {
            await qc.invalidateQueries({ queryKey: ['months'] })
            setShowEditMonth(false)
          }}
          onDeleted={async () => {
            await qc.invalidateQueries({ queryKey: ['months'] })
            setShowEditMonth(false)
          }}
        />
      )}

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
        <NavTab to="/compromissos" icon={HandCoins} label="Compromissos" />
        <NavTab to="/mais" icon={MoreHorizontal} label="Mais" />
      </nav>
    </div>
  )
}
