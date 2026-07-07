import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import {
  fetchInvestments,
  fetchAllInvestmentMovements,
  createInvestment,
  addInvestmentMovement,
  updateInvestment,
  updateInvestmentMovement,
  deleteInvestmentMovement,
  archiveInvestment,
  deleteInvestment,
} from '../lib/api'
import { calcInvestmentBalance } from '../lib/investmentBalance'
import { formatCurrency } from '../lib/format'
import { INVESTMENT_CATEGORIES } from '../lib/constants'
import { Skeleton } from '../components/Skeleton'
import {
  MovementDialog,
  EditInvestmentDialog,
  EditMovementDialog,
  ConfirmDialog,
} from '../components/InvestmentDialogs'
import type { Investment, InvestmentMovement, MovementType } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

const MOVEMENT_LABEL: Record<MovementType, string> = {
  aporte_inicial: 'Aporte Inicial',
  aporte: 'Aporte',
  saque: 'Saque',
}

const inputStyle = { background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }

type PendingAction =
  | { kind: 'movement'; mode: 'aporte' | 'saque'; inv: Investment }
  | { kind: 'editInv'; inv: Investment }
  | { kind: 'editMov'; mov: InvestmentMovement }
  | { kind: 'archive'; inv: Investment }
  | { kind: 'deleteInv'; inv: Investment }
  | { kind: 'deleteMov'; mov: InvestmentMovement }

export function Investments() {
  const { months } = useMonths()
  const qc = useQueryClient()

  const invQ = useQuery({ queryKey: ['investments'], queryFn: () => fetchInvestments() })
  const movQ = useQuery({ queryKey: ['investmentMovements'], queryFn: fetchAllInvestmentMovements })

  const investments = invQ.data ?? []
  const movements = movQ.data ?? []
  const loading = invQ.isLoading || movQ.isLoading

  const [name, setName] = useState('')
  const [category, setCategory] = useState(INVESTMENT_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [monthId, setMonthId] = useState<number | null>(months[0]?.id ?? null)
  const [note, setNote] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const [monthFilter, setMonthFilter] = useState<'todos' | number>('todos')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [action, setAction] = useState<PendingAction | null>(null)
  const [error, setError] = useState('')

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['investments'] }),
      qc.invalidateQueries({ queryKey: ['investmentMovements'] }),
      qc.invalidateQueries({ queryKey: ['summary'] }),
      qc.invalidateQueries({ queryKey: ['totalInv'] }),
    ])
  }

  const create = async () => {
    setCreateError('')
    const amt = parseAmount(amount)
    if (!name.trim()) return setCreateError('Digite um nome.')
    if (amt <= 0) return setCreateError('Digite um valor inicial positivo.')
    if (monthId == null) return setCreateError('Selecione um período.')
    setCreating(true)
    try {
      await createInvestment(name.trim(), category, monthId, amt, note.trim())
      setName('')
      setAmount('')
      setNote('')
      await invalidateAll()
    } catch (e) {
      setCreateError('Erro: ' + (e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const run = async (fn: () => Promise<void>) => {
    setError('')
    try {
      await fn()
      await invalidateAll()
    } catch (e) {
      setError('Erro: ' + (e as Error).message)
    } finally {
      setAction(null)
    }
  }

  const toggleHistory = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleInvestments = investments.filter((inv) => {
    if (monthFilter === 'todos') return true
    return movements.some((m) => m.investment_id === inv.id && m.month_id === monthFilter)
  })

  return (
    <div className="p-4 pb-8">
      <h1 className="mb-1 text-2xl font-bold">Investimentos</h1>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        Gerencie seus investimentos e movimentações
      </p>

      {/* Novo investimento */}
      <div className="mb-5 rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="mb-3 text-sm font-bold">Novo investimento</p>
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex: Tesouro Selic 2029)"
            className="rounded-lg border px-3 py-3 text-sm outline-none"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-3 text-sm outline-none"
              style={inputStyle}
            >
              {INVESTMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={monthId ?? ''}
              onChange={(e) => setMonthId(Number(e.target.value))}
              className="flex-1 rounded-lg border px-3 py-3 text-sm outline-none"
              style={inputStyle}
            >
              {months.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Valor inicial (R$)"
            className="rounded-lg border px-3 py-3 text-base outline-none"
            style={inputStyle}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            className="rounded-lg border px-3 py-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        {createError && (
          <p className="mt-2 text-sm" style={{ color: 'var(--red)' }}>
            {createError}
          </p>
        )}
        <button
          onClick={create}
          disabled={creating}
          className="mt-3 w-full rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {creating ? 'Criando…' : '+ Criar investimento'}
        </button>
      </div>

      {months.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={inputStyle}
          >
            <option value="todos">Todos os períodos</option>
            {months.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
            {monthFilter === 'todos'
              ? `${investments.length} investimento(s)`
              : `${visibleInvestments.length} de ${investments.length}`}
          </span>
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : visibleInvestments.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          {investments.length === 0 ? 'Nenhum investimento cadastrado.' : 'Nenhum investimento neste período.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleInvestments.map((inv) => {
            const invMovements = movements.filter((m) => m.investment_id === inv.id)
            const balance = calcInvestmentBalance(invMovements)
            const initial = invMovements.find((m) => m.movement_type === 'aporte_inicial')
            const initialMonth = initial ? months.find((m) => m.id === initial.month_id) : null
            const isOpen = expanded.has(inv.id)
            return (
              <div key={inv.id} className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="mb-2 h-1 w-8 rounded" style={{ background: 'var(--violet)' }} />
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{inv.name}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    · {inv.category}
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold" style={{ color: balance >= 0 ? 'var(--violet)' : 'var(--red)' }}>
                  {formatCurrency(balance)}
                </p>
                <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                  Criado em {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                  {initialMonth ? ` · ${initialMonth.name}` : ''} · {invMovements.length}{' '}
                  {invMovements.length === 1 ? 'movimentação' : 'movimentações'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setAction({ kind: 'movement', mode: 'aporte', inv })}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    + Aportar
                  </button>
                  <button
                    onClick={() => setAction({ kind: 'movement', mode: 'saque', inv })}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                    style={{ background: 'var(--red)' }}
                  >
                    − Sacar
                  </button>
                  <button
                    onClick={() => toggleHistory(inv.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                  >
                    ↕ Histórico
                  </button>
                  <button
                    onClick={() => setAction({ kind: 'editInv', inv })}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                  >
                    ✎ Editar
                  </button>
                  <button
                    onClick={() => setAction({ kind: 'archive', inv })}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                  >
                    Arquivar
                  </button>
                  <button
                    onClick={() => setAction({ kind: 'deleteInv', inv })}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--red)' }}
                  >
                    🗑
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                    {invMovements.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        Sem movimentações.
                      </p>
                    ) : (
                      invMovements.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg p-2.5"
                          style={{ background: 'var(--card2)' }}
                        >
                          <div className="min-w-0">
                            <p
                              className="text-xs font-semibold"
                              style={{
                                color:
                                  m.movement_type === 'saque'
                                    ? 'var(--red)'
                                    : m.movement_type === 'aporte_inicial'
                                      ? 'var(--violet)'
                                      : 'var(--primary)',
                              }}
                            >
                              {MOVEMENT_LABEL[m.movement_type]}
                            </p>
                            <p className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                              {new Date(m.created_at).toLocaleDateString('pt-BR')}
                              {m.note ? ` · ${m.note}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2.5">
                            <span
                              className="text-sm font-bold"
                              style={{ color: m.movement_type === 'saque' ? 'var(--red)' : 'var(--text)' }}
                            >
                              {m.movement_type === 'saque' ? '− ' : '+ '}
                              {formatCurrency(m.amount)}
                            </span>
                            <button onClick={() => setAction({ kind: 'editMov', mov: m })} style={{ color: 'var(--muted)' }}>
                              ✎
                            </button>
                            <button onClick={() => setAction({ kind: 'deleteMov', mov: m })} style={{ color: 'var(--red)' }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {action?.kind === 'movement' && (
        <MovementDialog
          mode={action.mode}
          investmentName={action.inv.name}
          months={months}
          onClose={() => setAction(null)}
          onConfirm={(mId, amt, nt) =>
            run(() => addInvestmentMovement(action.inv.id, mId, action.mode, amt, nt))
          }
        />
      )}
      {action?.kind === 'editInv' && (
        <EditInvestmentDialog
          name={action.inv.name}
          category={action.inv.category}
          onClose={() => setAction(null)}
          onConfirm={(n, c) => run(() => updateInvestment(action.inv.id, n, c))}
        />
      )}
      {action?.kind === 'editMov' && (
        <EditMovementDialog
          amount={action.mov.amount}
          note={action.mov.note ?? ''}
          onClose={() => setAction(null)}
          onConfirm={(amt, nt) => run(() => updateInvestmentMovement(action.mov.id, amt, nt))}
        />
      )}
      {action?.kind === 'archive' && (
        <ConfirmDialog
          title="Arquivar investimento?"
          message={`"${action.inv.name}" sumirá da lista. O saldo histórico continua sendo contabilizado nos totais.`}
          confirmText="Arquivar"
          danger={false}
          onClose={() => setAction(null)}
          onConfirm={() => run(() => archiveInvestment(action.inv.id))}
        />
      )}
      {action?.kind === 'deleteInv' && (
        <ConfirmDialog
          title="Excluir permanentemente?"
          message={`"${action.inv.name}" e todas as suas movimentações serão apagadas. Os valores somem dos totais do dashboard.`}
          confirmText="Excluir"
          onClose={() => setAction(null)}
          onConfirm={() => run(() => deleteInvestment(action.inv.id))}
        />
      )}
      {action?.kind === 'deleteMov' && (
        <ConfirmDialog
          title="Excluir movimentação?"
          message="Esta movimentação será removida permanentemente. O saldo será recalculado."
          confirmText="Excluir"
          onClose={() => setAction(null)}
          onConfirm={() => run(() => deleteInvestmentMovement(action.mov.id))}
        />
      )}
    </div>
  )
}
