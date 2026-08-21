import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createRecurringGoal } from '../lib/api'
import { MONTHS_PT, formatCurrency } from '../lib/format'
import type { GoalInstallmentInput } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

type PreviewRow = GoalInstallmentInput & { text: string }

const now = new Date()

type Props = { onClose: () => void }

export function RecurringGoalForm({ onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [monthly, setMonthly] = useState('')
  const [target, setTarget] = useState('')
  const [nMonths, setNMonths] = useState(12)
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const years = Array.from({ length: 21 }, (_, i) => 2020 + i)

  const genPreview = () => {
    const monthlyVal = parseAmount(monthly)
    if (monthlyVal <= 0) {
      setError('Informe o valor mensal antes de gerar as parcelas.')
      return
    }
    setError('')
    const rows: PreviewRow[] = []
    let y = year
    let m = month + 1 // 1-indexed
    for (let k = 0; k < nMonths; k++) {
      rows.push({
        number: k + 1,
        amount: monthlyVal,
        year: y,
        month: m,
        text: `${MONTHS_PT[m - 1]} ${y}`,
      })
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
    setPreview(rows)
  }

  const updateRow = (idx: number, raw: string) => {
    setPreview((rows) => {
      const next = [...rows]
      next[idx] = { ...next[idx], amount: parseAmount(raw) }
      return next
    })
  }

  const submit = async () => {
    if (!name.trim()) return setError('Preencha o nome da meta.')
    const monthlyVal = parseAmount(monthly)
    if (monthlyVal <= 0) return setError('Informe um valor mensal positivo.')
    let rows = preview
    if (rows.length === 0) {
      genPreview()
      return
    }
    const targetVal = target.trim() ? parseAmount(target) : null
    setBusy(true)
    setError('')
    try {
      await createRecurringGoal(
        name.trim(),
        targetVal && targetVal > 0 ? targetVal : null,
        monthlyVal,
        rows.map((r) => ({ number: r.number, amount: r.amount, year: r.year, month: r.month })),
      )
      await qc.invalidateQueries({ queryKey: ['goals'] })
      await qc.invalidateQueries({ queryKey: ['goalInstallments'] })
      onClose()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
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
        className="w-full max-w-md overflow-y-auto rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', maxHeight: '92vh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Meta recorrente</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da meta (ex: Viagem)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <div className="mb-3 flex gap-2">
          <input
            value={monthly}
            onChange={(e) => { setMonthly(e.target.value); setPreview([]) }}
            inputMode="decimal"
            placeholder="Valor mensal (R$)"
            className="flex-1 rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          />
          <select
            value={nMonths}
            onChange={(e) => { setNMonths(Number(e.target.value)); setPreview([]) }}
            className="w-28 rounded-lg border px-2 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          >
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'mês' : 'meses'}
              </option>
            ))}
          </select>
        </div>

        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          inputMode="decimal"
          placeholder="Valor alvo (R$) — opcional, deixe em branco pra sem fim"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
          PRIMEIRO MÊS
        </label>
        <div className="mb-3 flex gap-2">
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setPreview([]) }}
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          >
            {MONTHS_PT.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setPreview([]) }}
            className="w-28 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={genPreview}
          className="mb-3 w-full rounded-lg py-2.5 text-sm font-bold"
          style={{ background: 'var(--card2)', color: 'var(--primary)' }}
        >
          ↻ Gerar parcelas
        </button>

        {preview.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {preview.map((r, idx) => (
              <div key={r.number} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                  {r.number}/{nMonths} · {r.text}
                </span>
                <input
                  defaultValue={String(r.amount).replace('.', ',')}
                  onChange={(e) => updateRow(idx, e.target.value)}
                  inputMode="decimal"
                  className="flex-1 rounded-lg border px-2 py-1.5 text-right text-sm outline-none"
                  style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
                />
              </div>
            ))}
            <p className="text-right text-xs" style={{ color: 'var(--muted)' }}>
              Total: {formatCurrency(preview.reduce((a, r) => a + r.amount, 0))}
            </p>
          </div>
        )}

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
          {busy ? 'Salvando…' : 'Salvar meta'}
        </button>
      </div>
    </div>
  )
}
