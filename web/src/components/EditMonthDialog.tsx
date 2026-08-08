import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { MONTHS_PT } from '../lib/format'
import { renameMonth, deleteMonth } from '../lib/api'
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

type Props = {
  current: Month
  months: Month[]
  onClose: () => void
  onRenamed: () => void
  onDeleted: () => void
}

export function EditMonthDialog({ current, months, onClose, onRenamed, onDeleted }: Props) {
  const [monthIdx, setMonthIdx] = useState(current.month - 1)
  const [year, setYear] = useState(current.year)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const years = Array.from({ length: 21 }, (_, i) => 2020 + i)

  const save = async () => {
    const name = `${MONTHS_PT[monthIdx]} ${year}`
    const dup = months.some((m) => m.name === name && m.id !== current.id)
    if (dup) {
      setError(`${name} já existe.`)
      return
    }
    setError('')
    setBusy(true)
    try {
      await renameMonth(current.id, name, year, monthIdx + 1)
      onRenamed()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Excluir "${current.name}"? Todos os lançamentos deste período serão permanentemente excluídos.`)) {
      return
    }
    setError('')
    setBusy(true)
    try {
      await deleteMonth(current.id)
      onDeleted()
    } catch (e) {
      setError('Erro ao excluir: ' + (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Editar período</h2>
      <div className="mb-1 flex gap-2">
        <select
          value={monthIdx}
          onChange={(e) => setMonthIdx(Number(e.target.value))}
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
          disabled={busy}
          className="flex-1 rounded-lg border py-3 font-semibold disabled:opacity-60"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-3 font-semibold disabled:opacity-60"
        style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
      >
        <Trash2 size={16} strokeWidth={2} />
        Excluir período
      </button>
    </Sheet>
  )
}
