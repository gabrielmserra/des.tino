import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchGoals,
  fetchGoalInstallments,
  createGoal,
  addGoalContribution,
  updateGoal,
  deleteGoal,
  addGoalInstallments,
  contributeGoalInstallment,
  undoGoalInstallmentContribution,
  updateGoalInstallmentAmount,
  deleteGoalInstallment,
} from '../lib/api'
import { formatCurrency, MONTHS_PT } from '../lib/format'
import { Skeleton } from '../components/Skeleton'
import { ContributionDialog, EditGoalDialog, GenerateMoreGoalDialog, AddCustomInstallmentDialog, ConfirmDialog } from '../components/GoalDialogs'
import { PayDialog, AmountDialog } from '../components/DebtDialogs'
import { RecurringGoalForm } from '../components/RecurringGoalForm'
import type { Goal, GoalInstallment } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

function monthLabel(year: number, month: number): string {
  return `${MONTHS_PT[month - 1]} ${year}`
}

function installmentLabel(inst: GoalInstallment): string {
  if (inst.due_day) {
    return `${String(inst.due_day).padStart(2, '0')}/${String(inst.due_month).padStart(2, '0')}/${inst.due_year}`
  }
  return monthLabel(inst.due_year, inst.due_month)
}

function installmentSortKey(i: GoalInstallment): number {
  return ((i.due_year * 12 + i.due_month) * 31) + (i.due_day ?? 0)
}

function installmentStatus(inst: GoalInstallment): 'paga' | 'atrasada' | 'pendente' {
  if (inst.contributed_at) return 'paga'
  const today = new Date()
  if (inst.due_day) {
    const due = new Date(inst.due_year, inst.due_month - 1, inst.due_day)
    return due < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? 'atrasada' : 'pendente'
  }
  const cur = today.getFullYear() * 12 + today.getMonth() + 1
  const due = inst.due_year * 12 + inst.due_month
  return due < cur ? 'atrasada' : 'pendente'
}

const STATUS_COLOR: Record<string, string> = {
  paga: 'var(--muted)',
  atrasada: 'var(--red)',
  pendente: 'var(--accent)',
}

const inputStyle = { background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }

type PendingAction =
  | { kind: 'contribute'; mode: 'aporte' | 'saque'; goal: Goal }
  | { kind: 'edit'; goal: Goal }
  | { kind: 'delete'; goal: Goal }
  | { kind: 'generateMore'; goal: Goal }
  | { kind: 'addCustomInst'; goal: Goal }
  | { kind: 'payInst'; inst: GoalInstallment }
  | { kind: 'undoInst'; inst: GoalInstallment }
  | { kind: 'editInstAmount'; inst: GoalInstallment }
  | { kind: 'deleteInst'; inst: GoalInstallment }

export function Goals() {
  const qc = useQueryClient()
  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: fetchGoals })
  const instsQ = useQuery({ queryKey: ['goalInstallments'], queryFn: fetchGoalInstallments })
  const goals = goalsQ.data ?? []
  const allInsts = instsQ.data ?? []

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [error, setError] = useState('')

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['goals'] }),
      qc.invalidateQueries({ queryKey: ['goalInstallments'] }),
    ])

  const create = async () => {
    setCreateError('')
    const amt = parseAmount(target)
    if (!name.trim()) return setCreateError('Digite um nome.')
    if (amt <= 0) return setCreateError('Digite um valor alvo positivo.')
    setCreating(true)
    try {
      await createGoal(name.trim(), amt)
      setName('')
      setTarget('')
      await invalidate()
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
      await invalidate()
    } catch (e) {
      setError('Erro: ' + (e as Error).message)
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="p-4 pb-8">
      <h1 className="mb-4 text-2xl font-bold">Metas de poupança</h1>

      <div className="mb-5 rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="mb-3 text-sm font-bold">Nova meta de poupança</p>
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Reserva de emergência, Viagem…"
            className="rounded-lg border px-3 py-3 text-sm outline-none"
            style={inputStyle}
          />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="Valor alvo (R$)"
            className="rounded-lg border px-3 py-3 text-base outline-none"
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
          {creating ? 'Criando…' : '+ Criar meta'}
        </button>
        <button
          onClick={() => setShowRecurringForm(true)}
          className="mt-2 w-full rounded-lg border py-2 text-xs font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          ↻ Meta com cronograma (mensal ou personalizado)
        </button>
      </div>

      <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
        {goals.length} meta{goals.length === 1 ? '' : 's'}
      </p>

      {error && (
        <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}

      {goalsQ.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhuma meta criada. Adicione uma acima ↑
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((g) => {
            const hasTarget = g.target_amount != null
            const pct = hasTarget && g.target_amount! > 0 ? Math.min(1, g.saved_amount / g.target_amount!) : 0
            const done = hasTarget && g.saved_amount >= g.target_amount! && g.target_amount! > 0
            const isRecurring = g.monthly_amount != null
            const isCustom = g.schedule_type === 'custom'
            const goalInsts = allInsts
              .filter((i) => i.goal_id === g.id)
              .sort((a, b) => installmentSortKey(a) - installmentSortKey(b))
            const scheduledTotal = goalInsts.reduce((a, i) => a + i.amount, 0)

            return (
              <div key={g.id} className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-bold">{g.name}</span>
                  {hasTarget && (
                    <span className="shrink-0 text-sm font-bold" style={{ color: done ? 'var(--primary)' : 'var(--accent)' }}>
                      {done ? 'Concluída!' : `${(pct * 100).toFixed(1)}%`}
                    </span>
                  )}
                </div>
                <p className="mb-2 text-sm" style={{ color: 'var(--muted)' }}>
                  {hasTarget
                    ? `${formatCurrency(g.saved_amount)} de ${formatCurrency(g.target_amount!)}`
                    : `${formatCurrency(g.saved_amount)} guardados até agora`}
                </p>
                {hasTarget && (
                  <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, background: done ? 'var(--primary)' : 'var(--accent)' }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {!isRecurring && !isCustom && (
                    <>
                      <button
                        onClick={() => setAction({ kind: 'contribute', mode: 'aporte', goal: g })}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                        style={{ background: 'var(--primary)' }}
                      >
                        + Aportar
                      </button>
                      <button
                        onClick={() => setAction({ kind: 'contribute', mode: 'saque', goal: g })}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        style={{ borderColor: 'var(--border-l)', color: 'var(--red)' }}
                      >
                        − Sacar
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setAction({ kind: 'edit', goal: g })}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                  >
                    ✎ Editar
                  </button>
                  <button
                    onClick={() => setAction({ kind: 'delete', goal: g })}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--red)' }}
                  >
                    Excluir
                  </button>
                </div>

                {(isRecurring || isCustom) && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                    {isCustom && hasTarget && (
                      <p className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>
                        Cronograma: {formatCurrency(scheduledTotal)} de {formatCurrency(g.target_amount!)} planejados
                      </p>
                    )}
                    {goalInsts.map((inst) => {
                      const st = installmentStatus(inst)
                      return (
                        <div
                          key={inst.id}
                          className="flex items-center justify-between gap-2 rounded-lg p-2"
                          style={{ background: 'var(--card2)' }}
                        >
                          <span className="text-xs" style={{ color: st === 'paga' ? 'var(--muted)' : 'var(--text)' }}>
                            {st === 'paga' ? '✓ ' : ''}
                            {formatCurrency(inst.amount)} · {installmentLabel(inst)}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[10px] font-bold" style={{ color: STATUS_COLOR[st] }}>
                              {st}
                            </span>
                            {st === 'paga' ? (
                              <button
                                onClick={() => setAction({ kind: 'undoInst', inst })}
                                className="rounded px-2 py-1 text-[11px] font-semibold"
                                style={{ color: 'var(--muted)' }}
                              >
                                Desfazer
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setAction({ kind: 'payInst', inst })}
                                  className="rounded px-2 py-1 text-[11px] font-bold"
                                  style={{ background: 'var(--card)', color: 'var(--primary)' }}
                                >
                                  Guardado
                                </button>
                                <button
                                  onClick={() => setAction({ kind: 'editInstAmount', inst })}
                                  className="text-[11px]"
                                  style={{ color: 'var(--muted)' }}
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => setAction({ kind: 'deleteInst', inst })}
                                  className="text-[11px]"
                                  style={{ color: 'var(--red)' }}
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {isCustom ? (
                      <button
                        onClick={() => setAction({ kind: 'addCustomInst', goal: g })}
                        className="mt-1 rounded-lg border py-2 text-xs font-semibold"
                        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                      >
                        + Adicionar parcela
                      </button>
                    ) : (
                      <button
                        onClick={() => setAction({ kind: 'generateMore', goal: g })}
                        className="mt-1 rounded-lg border py-2 text-xs font-semibold"
                        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                      >
                        ↻ Gerar mais meses
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showRecurringForm && <RecurringGoalForm onClose={() => setShowRecurringForm(false)} />}

      {action?.kind === 'contribute' && (
        <ContributionDialog
          mode={action.mode}
          goalName={action.goal.name}
          onClose={() => setAction(null)}
          onConfirm={(amt) =>
            run(() => addGoalContribution(action.goal.id, action.mode === 'saque' ? -amt : amt).then(() => {}))
          }
        />
      )}
      {action?.kind === 'edit' && (
        <EditGoalDialog
          name={action.goal.name}
          targetAmount={action.goal.target_amount}
          onClose={() => setAction(null)}
          onConfirm={(n, t) => run(() => updateGoal(action.goal.id, n, t))}
        />
      )}
      {action?.kind === 'delete' && (
        <ConfirmDialog
          title="Excluir meta?"
          message="Esta ação é irreversível. Confirmar?"
          confirmText="Excluir"
          onClose={() => setAction(null)}
          onConfirm={() => run(() => deleteGoal(action.goal.id))}
        />
      )}
      {action?.kind === 'generateMore' && (
        <GenerateMoreGoalDialog
          goalName={action.goal.name}
          onClose={() => setAction(null)}
          onConfirm={(nMonths) =>
            run(async () => {
              const goal = action.goal
              const monthly = goal.monthly_amount ?? 0
              const goalInsts = allInsts.filter((i) => i.goal_id === goal.id)
              if (goalInsts.length === 0 || monthly <= 0) return
              const last = goalInsts.reduce((a, b) =>
                a.due_year * 12 + a.due_month > b.due_year * 12 + b.due_month ? a : b,
              )
              let y = last.due_year
              let m = last.due_month
              let num = Math.max(...goalInsts.map((i) => i.installment_number)) + 1
              const rows = []
              for (let k = 0; k < nMonths; k++) {
                m += 1
                if (m > 12) { m = 1; y += 1 }
                rows.push({ number: num++, amount: monthly, year: y, month: m })
              }
              await addGoalInstallments(goal.id, rows)
            })
          }
        />
      )}
      {action?.kind === 'addCustomInst' && (
        <AddCustomInstallmentDialog
          goalName={action.goal.name}
          onClose={() => setAction(null)}
          onConfirm={(day, month, year, amount) =>
            run(async () => {
              const goal = action.goal
              const goalInsts = allInsts.filter((i) => i.goal_id === goal.id)
              const nextNumber = Math.max(0, ...goalInsts.map((i) => i.installment_number)) + 1
              await addGoalInstallments(goal.id, [{ number: nextNumber, amount, year, month, day }])
            })
          }
        />
      )}
      {action?.kind === 'payInst' && (
        <PayDialog
          description="Marcar como guardado"
          amount={action.inst.amount}
          monthLabel={installmentLabel(action.inst)}
          onClose={() => setAction(null)}
          onConfirm={() => run(() => contributeGoalInstallment(action.inst.id))}
        />
      )}
      {action?.kind === 'undoInst' && (
        <ConfirmDialog
          title="Desfazer?"
          message="Confirmar?"
          confirmText="Desfazer"
          onClose={() => setAction(null)}
          onConfirm={() => run(() => undoGoalInstallmentContribution(action.inst.id))}
        />
      )}
      {action?.kind === 'editInstAmount' && (
        <AmountDialog
          current={action.inst.amount}
          onClose={() => setAction(null)}
          onConfirm={(amt) => run(() => updateGoalInstallmentAmount(action.inst.id, amt))}
        />
      )}
      {action?.kind === 'deleteInst' && (
        <ConfirmDialog
          title="Excluir mês?"
          message="Só este mês do cronograma será excluído."
          confirmText="Excluir"
          onClose={() => setAction(null)}
          onConfirm={() => run(() => deleteGoalInstallment(action.inst.id))}
        />
      )}
    </div>
  )
}
