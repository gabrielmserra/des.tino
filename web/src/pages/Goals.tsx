import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGoals, createGoal, addGoalContribution, updateGoal, deleteGoal } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { Skeleton } from '../components/Skeleton'
import { ContributionDialog, EditGoalDialog, ConfirmDialog } from '../components/GoalDialogs'
import type { Goal } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

const inputStyle = { background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }

type PendingAction =
  | { kind: 'contribute'; mode: 'aporte' | 'saque'; goal: Goal }
  | { kind: 'edit'; goal: Goal }
  | { kind: 'delete'; goal: Goal }

export function Goals() {
  const qc = useQueryClient()
  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: fetchGoals })
  const goals = goalsQ.data ?? []

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState<PendingAction | null>(null)
  const [error, setError] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['goals'] })

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
            const pct = g.target_amount > 0 ? Math.min(1, g.saved_amount / g.target_amount) : 0
            const done = g.saved_amount >= g.target_amount && g.target_amount > 0
            return (
              <div key={g.id} className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-bold">{g.name}</span>
                  <span className="shrink-0 text-sm font-bold" style={{ color: done ? 'var(--primary)' : 'var(--accent)' }}>
                    {done ? 'Concluída!' : `${(pct * 100).toFixed(1)}%`}
                  </span>
                </div>
                <p className="mb-2 text-sm" style={{ color: 'var(--muted)' }}>
                  {formatCurrency(g.saved_amount)} de {formatCurrency(g.target_amount)}
                </p>
                <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct * 100}%`, background: done ? 'var(--primary)' : 'var(--accent)' }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
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
              </div>
            )
          })}
        </div>
      )}

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
    </div>
  )
}
