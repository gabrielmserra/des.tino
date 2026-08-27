import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createRecurringGoal, createCustomGoal } from '../lib/api'
import { MONTHS_PT, formatCurrency } from '../lib/format'
import type { GoalInstallmentInput } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

type PreviewRow = GoalInstallmentInput & { text: string }
type CustomRow = { number: number; date: string; amount: string }

const now = new Date()
const todayIso = now.toISOString().slice(0, 10)

type Props = { onClose: () => void }

export function RecurringGoalForm({ onClose }: Props) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'monthly' | 'custom'>('monthly')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Modo Mensal (inalterado)
  const [monthly, setMonthly] = useState('')
  const [nMonths, setNMonths] = useState(12)
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [preview, setPreview] = useState<PreviewRow[]>([])

  // Modo Personalizado (novo)
  const [customRows, setCustomRows] = useState<CustomRow[]>([{ number: 1, date: todayIso, amount: '' }])

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

  const addCustomRow = () => {
    setCustomRows((rows) => [
      ...rows,
      { number: (rows[rows.length - 1]?.number ?? 0) + 1, date: todayIso, amount: '' },
    ])
  }

  const removeCustomRow = (idx: number) => {
    setCustomRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)))
  }

  const updateCustomRow = (idx: number, patch: Partial<CustomRow>) => {
    setCustomRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const submit = async () => {
    if (!name.trim()) return setError('Preencha o nome da meta.')
    const targetVal = target.trim() ? parseAmount(target) : null
    const finalTarget = targetVal && targetVal > 0 ? targetVal : null

    if (mode === 'monthly') {
      const monthlyVal = parseAmount(monthly)
      if (monthlyVal <= 0) return setError('Informe um valor mensal positivo.')
      if (preview.length === 0) {
        genPreview()
        return
      }
      setBusy(true)
      setError('')
      try {
        await createRecurringGoal(
          name.trim(),
          finalTarget,
          monthlyVal,
          preview.map((r) => ({ number: r.number, amount: r.amount, year: r.year, month: r.month })),
        )
        await qc.invalidateQueries({ queryKey: ['goals'] })
        await qc.invalidateQueries({ queryKey: ['goalInstallments'] })
        onClose()
      } catch (e) {
        setError('Erro ao salvar: ' + (e as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }

    // Modo Personalizado
    const installments: GoalInstallmentInput[] = []
    for (const r of customRows) {
      const amt = parseAmount(r.amount)
      if (amt <= 0) return setError('Todas as parcelas precisam de um valor positivo.')
      if (!r.date) return setError('Todas as parcelas precisam de uma data.')
      const [y, m, d] = r.date.split('-').map(Number)
      installments.push({ number: r.number, amount: amt, year: y, month: m, day: d })
    }
    if (installments.length === 0) return setError('Adicione ao menos uma parcela.')

    setBusy(true)
    setError('')
    try {
      await createCustomGoal(name.trim(), finalTarget, installments)
      await qc.invalidateQueries({ queryKey: ['goals'] })
      await qc.invalidateQueries({ queryKey: ['goalInstallments'] })
      onClose()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = { background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }

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
          <h2 className="text-lg font-bold">Nova meta</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setMode('monthly')}
            className="flex-1 rounded-lg py-2.5 text-sm font-bold"
            style={mode === 'monthly'
              ? { background: 'var(--primary)', color: '#fff' }
              : { background: 'var(--card2)', color: 'var(--muted)' }}
          >
            Mensal
          </button>
          <button
            onClick={() => setMode('custom')}
            className="flex-1 rounded-lg py-2.5 text-sm font-bold"
            style={mode === 'custom'
              ? { background: 'var(--primary)', color: '#fff' }
              : { background: 'var(--card2)', color: 'var(--muted)' }}
          >
            Personalizado
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da meta (ex: Viagem)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={inputStyle}
        />

        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          inputMode="decimal"
          placeholder="Valor alvo (R$) — opcional, deixe em branco pra sem fim"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={inputStyle}
        />

        {mode === 'monthly' ? (
          <>
            <div className="mb-3 flex gap-2">
              <input
                value={monthly}
                onChange={(e) => { setMonthly(e.target.value); setPreview([]) }}
                inputMode="decimal"
                placeholder="Valor mensal (R$)"
                className="flex-1 rounded-lg border px-3 py-3 text-base outline-none"
                style={inputStyle}
              />
              <select
                value={nMonths}
                onChange={(e) => { setNMonths(Number(e.target.value)); setPreview([]) }}
                className="w-28 rounded-lg border px-2 py-3 text-base outline-none"
                style={inputStyle}
              >
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'mês' : 'meses'}
                  </option>
                ))}
              </select>
            </div>

            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              PRIMEIRO MÊS
            </label>
            <div className="mb-3 flex gap-2">
              <select
                value={month}
                onChange={(e) => { setMonth(Number(e.target.value)); setPreview([]) }}
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                style={inputStyle}
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
                style={inputStyle}
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
                      style={inputStyle}
                    />
                  </div>
                ))}
                <p className="text-right text-xs" style={{ color: 'var(--muted)' }}>
                  Total: {formatCurrency(preview.reduce((a, r) => a + r.amount, 0))}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              PARCELAS (QUALQUER DIA, QUALQUER VALOR)
            </label>
            <div className="mb-3 flex flex-col gap-2">
              {customRows.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={r.date}
                    onChange={(e) => updateCustomRow(idx, { date: e.target.value })}
                    className="flex-1 rounded-lg border px-2 py-2 text-sm outline-none"
                    style={inputStyle}
                  />
                  <input
                    value={r.amount}
                    onChange={(e) => updateCustomRow(idx, { amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-24 rounded-lg border px-2 py-2 text-right text-sm outline-none"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeCustomRow(idx)}
                    disabled={customRows.length <= 1}
                    className="shrink-0 rounded-lg px-2 py-2 text-sm disabled:opacity-30"
                    style={{ color: 'var(--muted)' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addCustomRow}
              className="mb-3 w-full rounded-lg py-2.5 text-sm font-bold"
              style={{ background: 'var(--card2)', color: 'var(--primary)' }}
            >
              + Adicionar parcela
            </button>
          </>
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
