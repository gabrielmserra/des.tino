import { useState } from 'react'
import { formatCurrency } from '../lib/format'
import type { PlanIncomeItemInput } from '../lib/types'

type Row = { amount: string; day: string }

type Props = {
  items?: PlanIncomeItemInput[]
  suggested?: number
  onCancel: () => void
  onConfirm: (items: PlanIncomeItemInput[]) => void
}

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

function toRows(items?: PlanIncomeItemInput[], suggested?: number): Row[] {
  if (items && items.length > 0) {
    return items.map((it) => ({
      amount: String(it.amount).replace('.', ','),
      day: String(it.expected_day),
    }))
  }
  if (suggested && suggested > 0) {
    return [{ amount: String(suggested).replace('.', ','), day: '' }]
  }
  return [{ amount: '', day: '' }]
}

export function IncomeDialog({ items, suggested = 0, onCancel, onConfirm }: Props) {
  const [rows, setRows] = useState<Row[]>(() => toRows(items, suggested))
  const [error, setError] = useState('')

  const total = rows.reduce((acc, r) => acc + parseAmount(r.amount), 0)

  const updateRow = (idx: number, field: keyof Row, value: string) => {
    setRows((rs) => {
      const next = [...rs]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const addRow = () => setRows((rs) => [...rs, { amount: '', day: '' }])
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx))

  const confirm = () => {
    const result: PlanIncomeItemInput[] = []
    for (const r of rows) {
      if (!r.amount.trim() && !r.day.trim()) continue // linha em branco, ignora
      const amount = parseAmount(r.amount)
      const day = parseInt(r.day, 10)
      if (amount <= 0 || !Number.isInteger(day) || day < 1 || day > 31) {
        setError('Preencha valor e dia (1-31) em todas as entradas.')
        return
      }
      result.push({ amount, expected_day: day })
    }
    onConfirm(result)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-center text-lg font-bold">Quanto deve entrar este mês?</h2>
        <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
          Uma linha por entrada esperada, com o dia em que costuma cair. O total vira o
          máximo distribuível entre as categorias.
        </p>

        <div className="mb-1 flex gap-2 px-1">
          <span className="flex-1 text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
            VALOR (R$)
          </span>
          <span className="w-16 text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
            DIA
          </span>
          <span className="w-7" />
        </div>
        <div className="mb-2 flex flex-col gap-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={r.amount}
                onChange={(e) => updateRow(idx, 'amount', e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="flex-1 rounded-lg border px-3 py-2 text-base outline-none"
                style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
              />
              <input
                value={r.day}
                onChange={(e) => updateRow(idx, 'day', e.target.value)}
                inputMode="numeric"
                placeholder="1-31"
                className="w-16 rounded-lg border px-2 py-2 text-center text-base outline-none"
                style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
              />
              <button
                onClick={() => removeRow(idx)}
                className="w-7 shrink-0 text-lg"
                style={{ color: 'var(--muted)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="mb-3 w-full rounded-lg py-2 text-sm font-bold"
          style={{ background: 'var(--card2)', color: 'var(--primary)' }}
        >
          + Adicionar entrada
        </button>

        <p className="mb-3 text-center text-sm font-bold" style={{ color: 'var(--accent)' }}>
          Total: {formatCurrency(total)}
        </p>

        {error && (
          <p className="mb-3 text-center text-xs" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <div className="mt-1 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border py-3 font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            className="flex-1 rounded-lg py-3 font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
