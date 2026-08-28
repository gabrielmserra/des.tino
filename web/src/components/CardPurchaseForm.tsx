import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createCardPurchase } from '../lib/api'
import { CATEGORIES } from '../lib/constants'
import { MONTHS_PT, formatCurrency } from '../lib/format'
import type { CardOverview, CardPurchaseInstallmentInput } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

type PreviewRow = CardPurchaseInstallmentInput & { number: number; text: string }

const now = new Date()

type Props = { card: CardOverview; onClose: () => void }

export function CardPurchaseForm({ card, onClose }: Props) {
  const qc = useQueryClient()
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Outros')
  const [total, setTotal] = useState('')
  const [nParcelas, setNParcelas] = useState(1)
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const years = Array.from({ length: 21 }, (_, i) => 2020 + i)

  const genPreview = () => {
    const totalVal = parseAmount(total)
    if (totalVal <= 0) {
      setError('Informe o valor total antes de gerar as parcelas.')
      return
    }
    setError('')
    const base = Math.round((totalVal / nParcelas) * 100) / 100
    const amounts = Array(nParcelas).fill(base)
    amounts[nParcelas - 1] = Math.round((totalVal - base * (nParcelas - 1)) * 100) / 100

    const rows: PreviewRow[] = []
    let y = year
    let m = month + 1 // 1-indexed
    for (let k = 0; k < nParcelas; k++) {
      rows.push({
        number: k + 1,
        amount: amounts[k],
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
    if (!description.trim()) return setError('Preencha a descrição.')
    const totalVal = parseAmount(total)
    if (totalVal <= 0) return setError('Informe um valor total positivo.')
    let rows = preview
    if (rows.length === 0) {
      genPreview()
      return
    }
    const soma = rows.reduce((a, r) => a + r.amount, 0)
    if (Math.abs(soma - totalVal) > 0.01) {
      return setError(
        `Soma das parcelas (${formatCurrency(soma)}) difere do total (${formatCurrency(totalVal)}).`,
      )
    }
    setBusy(true)
    setError('')
    try {
      await createCardPurchase(
        card.id,
        description.trim(),
        category,
        rows.map((r) => ({ amount: r.amount, year: r.year, month: r.month })),
      )
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cardsOverview'] }),
        qc.invalidateQueries({ queryKey: ['summary'] }),
        qc.invalidateQueries({ queryKey: ['cats'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['futureCommitments'] }),
      ])
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
          <h2 className="text-lg font-bold">Compra parcelada · {card.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (ex: Notebook, viagem…)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <div className="mb-3 flex gap-2">
          <input
            value={total}
            onChange={(e) => { setTotal(e.target.value); setPreview([]) }}
            inputMode="decimal"
            placeholder="Valor total (R$)"
            className="flex-1 rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          />
          <select
            value={nParcelas}
            onChange={(e) => { setNParcelas(Number(e.target.value)); setPreview([]) }}
            className="w-24 rounded-lg border px-2 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          >
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </select>
        </div>

        <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
          PRIMEIRA PARCELA
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

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          onClick={genPreview}
          className="mb-3 w-full rounded-lg py-2.5 text-sm font-bold"
          style={{ background: 'var(--card2)', color: 'var(--primary)' }}
        >
          ↻ Gerar parcelas
        </button>

        {preview.length > 0 && (
          <>
            <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
              A parcela do mês atual entra como gasto real; as futuras entram
              como previstas até você confirmá-las.
            </p>
            <div className="mb-3 flex flex-col gap-2">
              {preview.map((r, idx) => (
                <div key={r.number} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                    {r.number}/{nParcelas} · {r.text}
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
            </div>
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
          {busy ? 'Salvando…' : 'Salvar compra parcelada'}
        </button>
      </div>
    </div>
  )
}
