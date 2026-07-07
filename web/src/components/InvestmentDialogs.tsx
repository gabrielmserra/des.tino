import { useState } from 'react'
import { INVESTMENT_CATEGORIES } from '../lib/constants'
import type { Month } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

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

const inputStyle = { background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }

// ── Aportar / Sacar ───────────────────────────────────────────────────
type MovementProps = {
  mode: 'aporte' | 'saque'
  investmentName: string
  months: Month[]
  onClose: () => void
  onConfirm: (monthId: number, amount: number, note: string) => void
}

export function MovementDialog({ mode, investmentName, months, onClose, onConfirm }: MovementProps) {
  const [monthId, setMonthId] = useState<number | null>(months[0]?.id ?? null)
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    const amt = parseAmount(value)
    if (amt <= 0) return setError('Digite um valor positivo.')
    if (monthId == null) return setError('Selecione um período.')
    onConfirm(monthId, amt, note.trim())
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">
        {mode === 'aporte' ? 'Aportar em' : 'Sacar de'}: {investmentName}
      </h2>
      <div className="flex flex-col gap-2">
        <select
          value={monthId ?? ''}
          onChange={(e) => setMonthId(Number(e.target.value))}
          className="rounded-lg border px-3 py-3 text-sm outline-none"
          style={inputStyle}
        >
          {months.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="Valor (R$)"
          className="rounded-lg border px-3 py-3 text-base outline-none"
          style={inputStyle}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="rounded-lg border px-3 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </div>
      {error && (
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--red)' }}>
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
          onClick={confirm}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: mode === 'aporte' ? 'var(--primary)' : 'var(--red)' }}
        >
          {mode === 'aporte' ? 'Aportar' : 'Sacar'}
        </button>
      </div>
    </Sheet>
  )
}

// ── Editar investimento (nome/categoria) ─────────────────────────────
type EditInvestmentProps = {
  name: string
  category: string
  onClose: () => void
  onConfirm: (name: string, category: string) => void
}

export function EditInvestmentDialog({ name, category, onClose, onConfirm }: EditInvestmentProps) {
  const [n, setN] = useState(name)
  const [c, setC] = useState(category)
  const [error, setError] = useState('')

  const confirm = () => {
    if (!n.trim()) return setError('Digite um nome.')
    onConfirm(n.trim(), c)
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Editar investimento</h2>
      <div className="flex flex-col gap-2">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="Nome"
          className="rounded-lg border px-3 py-3 text-sm outline-none"
          style={inputStyle}
        />
        <select
          value={c}
          onChange={(e) => setC(e.target.value)}
          className="rounded-lg border px-3 py-3 text-sm outline-none"
          style={inputStyle}
        >
          {INVESTMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--red)' }}>
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
          onClick={confirm}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          Salvar
        </button>
      </div>
    </Sheet>
  )
}

// ── Editar movimentação (valor/nota) ─────────────────────────────────
type EditMovementProps = {
  amount: number
  note: string
  onClose: () => void
  onConfirm: (amount: number, note: string) => void
}

export function EditMovementDialog({ amount, note, onClose, onConfirm }: EditMovementProps) {
  const [value, setValue] = useState(String(amount).replace('.', ','))
  const [n, setN] = useState(note)
  const [error, setError] = useState('')

  const confirm = () => {
    const amt = parseAmount(value)
    if (amt <= 0) return setError('Digite um valor positivo.')
    onConfirm(amt, n.trim())
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Editar movimentação</h2>
      <div className="flex flex-col gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="Valor (R$)"
          className="rounded-lg border px-3 py-3 text-base outline-none"
          style={inputStyle}
        />
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="Nota (opcional)"
          className="rounded-lg border px-3 py-3 text-sm outline-none"
          style={inputStyle}
        />
      </div>
      {error && (
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--red)' }}>
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
          onClick={confirm}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          Salvar
        </button>
      </div>
    </Sheet>
  )
}

// ── Confirmação genérica (arquivar/excluir) ──────────────────────────
type ConfirmProps = {
  title: string
  message: string
  confirmText: string
  danger?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ title, message, confirmText, danger = true, onClose, onConfirm }: ConfirmProps) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">{title}</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        {message}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: danger ? 'var(--red)' : 'var(--primary)' }}
        >
          {confirmText}
        </button>
      </div>
    </Sheet>
  )
}
