import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateDebt, deleteDebt } from '../lib/api'
import { DEBT_CATEGORIES } from '../lib/constants'
import { AskExpenseDialog, ConfirmDialog } from './DebtDialogs'
import type { Debt, DebtInstallment } from '../lib/types'

type Props = {
  debt: Debt
  installments: DebtInstallment[]
  onClose: () => void
}

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

export function EditDebtForm({ debt, installments, onClose }: Props) {
  const qc = useQueryClient()
  const [description, setDescription] = useState(debt.description)
  const [creditor, setCreditor] = useState(debt.creditor ?? '')
  const [category, setCategory] = useState(debt.category ?? 'Dívidas')
  const [notes, setNotes] = useState(debt.notes ?? '')
  const [rate, setRate] = useState(
    debt.interest_rate ? String(debt.interest_rate).replace('.', ',') : '',
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [askExpense, setAskExpense] = useState(false)

  const hasExpenses = installments.some((i) => i.expense_id)

  async function invalidate() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['debts'] }),
      qc.invalidateQueries({ queryKey: ['installments'] }),
      qc.invalidateQueries({ queryKey: ['debtOverview'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['summary'] }),
    ])
  }

  const submit = async () => {
    if (!description.trim()) return setError('Preencha a descrição.')
    setBusy(true)
    try {
      const parsedRate = parseAmount(rate)
      await updateDebt(debt.id, {
        description: description.trim(),
        creditor: creditor.trim(),
        category,
        notes: notes.trim(),
        interest_rate: parsedRate > 0 ? parsedRate : null,
      })
      await invalidate()
      onClose()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async (deleteExpenses: boolean) => {
    setBusy(true)
    try {
      await deleteDebt(debt.id, deleteExpenses)
      await invalidate()
      onClose()
    } catch (e) {
      setError('Erro ao excluir: ' + (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Editar dívida</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />
        <input
          value={creditor}
          onChange={(e) => setCreditor(e.target.value)}
          placeholder="Credor"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          {DEBT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          inputMode="decimal"
          placeholder="Taxa de juros mensal (%, opcional)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        {error && (
          <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg py-3 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {busy ? 'Salvando…' : 'Salvar'}
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className="mt-2 w-full rounded-lg border py-3 font-semibold disabled:opacity-60"
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          Excluir dívida
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Excluir dívida?"
          message={`"${debt.description}" e todas as suas parcelas serão excluídas. Esta ação é irreversível.`}
          confirmText="Excluir"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            if (hasExpenses) setAskExpense(true)
            else doDelete(false)
          }}
        />
      )}

      {askExpense && (
        <AskExpenseDialog
          onClose={() => setAskExpense(false)}
          onChoice={(deleteExpenses) => {
            setAskExpense(false)
            doDelete(deleteExpenses)
          }}
        />
      )}
    </div>
  )
}
