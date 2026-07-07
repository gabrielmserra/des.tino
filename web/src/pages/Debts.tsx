import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchDebts,
  fetchAllInstallments,
  fetchDebtOverview,
  payInstallment,
  undoInstallmentPayment,
  rescheduleInstallment,
  updateInstallmentAmount,
  deleteInstallment,
} from '../lib/api'
import { installmentStatus } from '../lib/debtStatus'
import { formatCurrency, MONTHS_PT } from '../lib/format'
import { DebtForm } from '../components/DebtForm'
import { EditDebtForm } from '../components/EditDebtForm'
import {
  PayDialog,
  RescheduleDialog,
  AmountDialog,
  AskExpenseDialog,
  ConfirmDialog,
} from '../components/DebtDialogs'
import type { Debt, DebtInstallment, InstallmentStatus } from '../lib/types'

const STATUS_COLOR: Record<InstallmentStatus, string> = {
  pendente: 'var(--accent)',
  atrasada: 'var(--red)',
  paga: 'var(--muted)',
}

function monthLabel(year: number, month: number): string {
  return `${MONTHS_PT[month - 1].slice(0, 3)}/${year}`
}

type StatusFilter = 'todas' | 'pendente' | 'atrasada' | 'paga'

type PendingAction =
  | { kind: 'pay'; inst: DebtInstallment; debt: Debt; nTotal: number }
  | { kind: 'undo'; inst: DebtInstallment }
  | { kind: 'reschedule'; inst: DebtInstallment }
  | { kind: 'amount'; inst: DebtInstallment }
  | { kind: 'deleteInst'; inst: DebtInstallment }
  | { kind: 'askExpenseInst'; inst: DebtInstallment }

export function Debts() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editDebt, setEditDebt] = useState<Debt | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todas')
  const [creditorFilter, setCreditorFilter] = useState('todos')
  const [action, setAction] = useState<PendingAction | null>(null)
  const [error, setError] = useState('')

  const debtsQ = useQuery({ queryKey: ['debts'], queryFn: fetchDebts })
  const instQ = useQuery({ queryKey: ['installments'], queryFn: fetchAllInstallments })
  const overviewQ = useQuery({ queryKey: ['debtOverview'], queryFn: fetchDebtOverview })

  const debts = debtsQ.data ?? []
  const installments = instQ.data ?? []
  const overview = overviewQ.data
  const loading = debtsQ.isLoading || instQ.isLoading || overviewQ.isLoading

  const creditors = Array.from(new Set(debts.map((d) => d.creditor).filter(Boolean))) as string[]

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['debts'] }),
      qc.invalidateQueries({ queryKey: ['installments'] }),
      qc.invalidateQueries({ queryKey: ['debtOverview'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['summary'] }),
    ])
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

  return (
    <div className="p-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dívidas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          + Nova dívida
        </button>
      </div>

      {overview && (
        <div
          className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border p-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
              TOTAL EM ABERTO
            </p>
            <p className="text-lg font-bold" style={{ color: 'var(--red)' }}>
              {formatCurrency(overview.total_aberto)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
              PARCELAS ATRASADAS
            </p>
            <p className="text-lg font-bold" style={{ color: overview.n_atrasadas ? 'var(--red)' : 'var(--primary)' }}>
              {overview.n_atrasadas}
            </p>
          </div>
          <div className="col-span-2">
            <p className="mb-1 text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
              PRÓXIMOS 6 MESES
            </p>
            {overview.future.some((f) => f.total > 0) ? (
              <div className="flex flex-wrap gap-1.5">
                {overview.future
                  .filter((f) => f.total > 0)
                  .map((f) => (
                    <span
                      key={`${f.year}-${f.month}`}
                      className="rounded px-2 py-1 text-[11px] font-semibold"
                      style={{ background: 'var(--card2)', color: 'var(--accent)' }}
                    >
                      {monthLabel(f.year, f.month)} {formatCurrency(f.total)}
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--primary)' }}>
                Nenhuma parcela nos próximos meses 🎉
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(['todas', 'pendente', 'atrasada', 'paga'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{
              background: statusFilter === f ? 'var(--primary)' : 'var(--card2)',
              color: statusFilter === f ? '#fff' : 'var(--muted)',
            }}
          >
            {f === 'todas' ? 'Todas' : f === 'pendente' ? 'Pendentes' : f === 'atrasada' ? 'Atrasadas' : 'Pagas'}
          </button>
        ))}
        {creditors.length > 0 && (
          <select
            value={creditorFilter}
            onChange={(e) => setCreditorFilter(e.target.value)}
            className="shrink-0 rounded-full border px-3 py-1.5 text-sm outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          >
            <option value="todos">Todos credores</option>
            {creditors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : (
        <DebtsList
          debts={debts}
          installments={installments}
          statusFilter={statusFilter}
          creditorFilter={creditorFilter}
          onEdit={setEditDebt}
          onAction={setAction}
        />
      )}

      {showForm && <DebtForm onClose={() => setShowForm(false)} />}
      {editDebt && (
        <EditDebtForm
          debt={editDebt}
          installments={installments.filter((i) => i.debt_id === editDebt.id)}
          onClose={() => setEditDebt(null)}
        />
      )}

      {action?.kind === 'pay' && (
        <PayDialog
          description={action.debt.description + (action.nTotal > 1 ? ` (parcela ${action.inst.installment_number}/${action.nTotal})` : '')}
          amount={action.inst.amount}
          monthLabel={monthLabel(action.inst.due_year, action.inst.due_month)}
          onClose={() => setAction(null)}
          onConfirm={(launch) => run(() => payInstallment(action.inst.id, launch))}
        />
      )}
      {action?.kind === 'undo' && (
        <ConfirmDialog
          title="Desfazer pagamento?"
          message={
            action.inst.expense_id
              ? 'O gasto lançado será removido junto. Confirmar?'
              : 'Confirmar?'
          }
          confirmText="Desfazer"
          onClose={() => setAction(null)}
          onConfirm={() => run(() => undoInstallmentPayment(action.inst.id))}
        />
      )}
      {action?.kind === 'reschedule' && (
        <RescheduleDialog
          currentYear={action.inst.due_year}
          currentMonth={action.inst.due_month}
          onClose={() => setAction(null)}
          onConfirm={(y, m) => run(() => rescheduleInstallment(action.inst.id, y, m))}
        />
      )}
      {action?.kind === 'amount' && (
        <AmountDialog
          current={action.inst.amount}
          onClose={() => setAction(null)}
          onConfirm={(amount) => run(() => updateInstallmentAmount(action.inst.id, amount))}
        />
      )}
      {action?.kind === 'deleteInst' && (
        <ConfirmDialog
          title="Excluir parcela?"
          message="Só esta parcela será excluída (o total da dívida será recalculado)."
          confirmText="Excluir parcela"
          onClose={() => setAction(null)}
          onConfirm={() => {
            if (action.inst.expense_id) {
              setAction({ kind: 'askExpenseInst', inst: action.inst })
            } else {
              run(() => deleteInstallment(action.inst.id, false))
            }
          }}
        />
      )}
      {action?.kind === 'askExpenseInst' && (
        <AskExpenseDialog
          onClose={() => setAction(null)}
          onChoice={(deleteExpense) => run(() => deleteInstallment(action.inst.id, deleteExpense))}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
function DebtsList({
  debts,
  installments,
  statusFilter,
  creditorFilter,
  onEdit,
  onAction,
}: {
  debts: Debt[]
  installments: DebtInstallment[]
  statusFilter: StatusFilter
  creditorFilter: string
  onEdit: (d: Debt) => void
  onAction: (a: PendingAction) => void
}) {
  const cards = debts
    .map((debt) => {
      if (creditorFilter !== 'todos' && debt.creditor !== creditorFilter) return null
      const all = installments.filter((i) => i.debt_id === debt.id)
      const visible = all.filter((i) => {
        if (statusFilter === 'todas') return true
        return installmentStatus(i) === statusFilter
      })
      if (visible.length === 0) return null
      return { debt, all, visible }
    })
    .filter((x): x is { debt: Debt; all: DebtInstallment[]; visible: DebtInstallment[] } => x !== null)

  if (cards.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
        {debts.length === 0 ? 'Nenhuma dívida cadastrada. Toque em "+ Nova dívida".' : 'Nenhuma dívida bate com os filtros.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map(({ debt, all, visible }) => {
        const nTotal = all.length
        const nPaid = all.filter((i) => i.paid_at).length
        return (
          <div
            key={debt.id}
            className="rounded-2xl border p-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold">{debt.description}</span>
                  {debt.creditor && (
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      · {debt.creditor}
                    </span>
                  )}
                </div>
                <span
                  className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: 'var(--card2)', color: 'var(--muted)' }}
                >
                  {debt.category ?? 'Dívidas'}
                </span>
              </div>
              <button onClick={() => onEdit(debt)} className="shrink-0 text-sm" style={{ color: 'var(--muted)' }}>
                Editar
              </button>
            </div>

            <p className="mb-3 text-sm font-bold" style={{ color: 'var(--primary)' }}>
              {formatCurrency(debt.total_amount)}
              {nTotal > 1 && (
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                  {nPaid}/{nTotal} pagas
                </span>
              )}
            </p>

            <div className="flex flex-col gap-2">
              {visible.map((inst) => {
                const status = installmentStatus(inst)
                const label = nTotal > 1 ? `${inst.installment_number}/${nTotal}` : 'à vista'
                return (
                  <div
                    key={inst.id}
                    className="rounded-xl p-2.5"
                    style={{ background: 'var(--card2)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                        {label}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: status === 'paga' ? 'var(--muted)' : 'var(--text)' }}>
                        {status === 'paga' && '✓ '}
                        {formatCurrency(inst.amount)} · {monthLabel(inst.due_year, inst.due_month)}
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: STATUS_COLOR[status] }}>
                        {status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {status === 'paga' ? (
                        <button
                          onClick={() => onAction({ kind: 'undo', inst })}
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                        >
                          Desfazer
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => onAction({ kind: 'pay', inst, debt, nTotal })}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold"
                            style={{ background: 'var(--primary)', color: '#fff' }}
                          >
                            Pagar
                          </button>
                          <button
                            onClick={() => onAction({ kind: 'reschedule', inst })}
                            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                          >
                            → Mês
                          </button>
                          <button
                            onClick={() => onAction({ kind: 'amount', inst })}
                            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                          >
                            ✎
                          </button>
                          {nTotal > 1 && (
                            <button
                              onClick={() => onAction({ kind: 'deleteInst', inst })}
                              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                              style={{ borderColor: 'var(--border-l)', color: 'var(--red)' }}
                            >
                              ✕
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
