import { useState } from 'react'
import { MONTHS_PT } from '../lib/format'
import { createMonth } from '../lib/api'
import type { Month } from '../lib/types'

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// Sugere o mês seguinte ao mais recente já cadastrado (ou o mês atual, se não houver nenhum)
function suggestNext(months: Month[]): { year: number; month: number } {
  if (months.length === 0) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const latest = months[0] // já vem ordenado desc por year, month
  return latest.month === 12
    ? { year: latest.year + 1, month: 1 }
    : { year: latest.year, month: latest.month + 1 }
}

type Props = {
  months: Month[]
  onClose: () => void
  onCreated: (monthId: number) => void
}

export function AddMonthDialog({ months, onClose, onCreated }: Props) {
  const suggested = suggestNext(months)
  const [month, setMonth] = useState(suggested.month - 1)
  const [year, setYear] = useState(suggested.year)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const years = Array.from({ length: 21 }, (_, i) => 2020 + i)

  const create = async () => {
    const name = `${MONTHS_PT[month]} ${year}`
    if (months.some((m) => m.name === name)) {
      setError(`${name} já existe.`)
      return
    }
    setError('')
    setBusy(true)
    try {
      const id = await createMonth(name, year, month + 1)
      onCreated(id)
    } catch (e) {
      setError('Erro ao criar período: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Novo período</h2>
      <div className="mb-1 flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
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
          onChange={(e) => setYear(Number(e.target.value))}
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
      {error && (
        <p className="mb-2 mt-2 text-center text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={create}
          disabled={busy}
          className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {busy ? 'Criando…' : 'Criar período'}
        </button>
      </div>
    </Sheet>
  )
}
