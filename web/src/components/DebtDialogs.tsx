import { useState } from 'react'
import { MONTHS_PT, formatCurrency } from '../lib/format'

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

// ── Pagar parcela ────────────────────────────────────────────────────
type PayProps = {
  description: string
  amount: number
  monthLabel: string
  onClose: () => void
  onConfirm: () => void
}

export function PayDialog({ description, amount, monthLabel, onClose, onConfirm }: PayProps) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold" style={{ color: 'var(--primary)' }}>
        Confirmar pagamento
      </h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        {description}
        <br />
        {formatCurrency(amount)} — {monthLabel}
      </p>
      <p className="mb-4 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
        Só marca a parcela como paga — não lança gasto nem mexe no saldo.
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
          style={{ background: 'var(--primary)' }}
        >
          Confirmar
        </button>
      </div>
    </Sheet>
  )
}

// ── Remanejar parcela ────────────────────────────────────────────────
type RescheduleProps = {
  currentYear: number
  currentMonth: number
  onClose: () => void
  onConfirm: (year: number, month: number) => void
}

export function RescheduleDialog({ currentYear, currentMonth, onClose, onConfirm }: RescheduleProps) {
  const [month, setMonth] = useState(currentMonth - 1)
  const [year, setYear] = useState(currentYear)
  const years = Array.from({ length: 21 }, (_, i) => 2020 + i)

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Mover parcela para…</h2>
      <div className="mb-4 flex gap-2">
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
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(year, month + 1)}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          Remanejar
        </button>
      </div>
    </Sheet>
  )
}

// ── Editar valor da parcela ──────────────────────────────────────────
type AmountProps = {
  current: number
  onClose: () => void
  onConfirm: (amount: number) => void
}

export function AmountDialog({ current, onClose, onConfirm }: AmountProps) {
  const [value, setValue] = useState(String(current).replace('.', ','))
  const [error, setError] = useState('')

  const confirm = () => {
    const v = parseAmount(value)
    if (v <= 0) return setError('Digite um valor positivo.')
    onConfirm(v)
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Novo valor da parcela</h2>
      <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        O total da dívida será recalculado.
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        className="mb-1 w-full rounded-lg border px-3 py-3 text-center text-base outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      />
      {error && (
        <p className="mb-2 text-center text-sm" style={{ color: 'var(--red)' }}>
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

// ── Perguntar se remove gastos vinculados ao excluir ─────────────────
type AskExpenseProps = {
  onClose: () => void
  onChoice: (deleteExpense: boolean) => void
}

export function AskExpenseDialog({ onClose, onChoice }: AskExpenseProps) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Há gastos lançados por estas parcelas</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        Deseja removê-los também dos lançamentos do mês?
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onChoice(false)}
          className="rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          Manter gastos
        </button>
        <button
          onClick={() => onChoice(true)}
          className="rounded-lg py-3 font-bold text-white"
          style={{ background: 'var(--red)' }}
        >
          Remover gastos
        </button>
      </div>
    </Sheet>
  )
}

// ── Confirmação genérica (excluir dívida/parcela) ────────────────────
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
