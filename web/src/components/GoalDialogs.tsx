import { useState } from 'react'

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
type ContributionProps = {
  mode: 'aporte' | 'saque'
  goalName: string
  onClose: () => void
  onConfirm: (amount: number) => void
}

export function ContributionDialog({ mode, goalName, onClose, onConfirm }: ContributionProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    const amt = parseAmount(value)
    if (amt <= 0) return setError('Digite um valor positivo.')
    onConfirm(amt)
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">
        {mode === 'aporte' ? 'Aportar em' : 'Sacar de'}: {goalName}
      </h2>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        placeholder="Valor (R$)"
        className="w-full rounded-lg border px-3 py-3 text-center text-base outline-none"
        style={inputStyle}
      />
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

// ── Editar meta (nome/valor alvo) ────────────────────────────────────
type EditGoalProps = {
  name: string
  targetAmount: number | null
  onClose: () => void
  onConfirm: (name: string, targetAmount: number | null) => void
}

export function EditGoalDialog({ name, targetAmount, onClose, onConfirm }: EditGoalProps) {
  const [n, setN] = useState(name)
  const [value, setValue] = useState(targetAmount != null ? String(targetAmount).replace('.', ',') : '')
  const [error, setError] = useState('')

  const confirm = () => {
    if (!n.trim()) return setError('Digite um nome.')
    if (!value.trim()) return onConfirm(n.trim(), null)
    const amt = parseAmount(value)
    if (amt <= 0) return setError('Digite um valor alvo positivo, ou deixe em branco.')
    onConfirm(n.trim(), amt)
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Editar meta</h2>
      <div className="flex flex-col gap-2">
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="Nome da meta"
          className="rounded-lg border px-3 py-3 text-sm outline-none"
          style={inputStyle}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="Valor alvo (R$) — opcional"
          className="rounded-lg border px-3 py-3 text-base outline-none"
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

// ── Gerar mais meses numa meta recorrente ────────────────────────────
type GenerateMoreProps = {
  goalName: string
  onClose: () => void
  onConfirm: (nMonths: number) => void
}

export function GenerateMoreGoalDialog({ goalName, onClose, onConfirm }: GenerateMoreProps) {
  const [n, setN] = useState(12)

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Gerar mais meses</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        {goalName}
      </p>
      <select
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        className="w-full rounded-lg border px-3 py-3 text-center text-base outline-none"
        style={inputStyle}
      >
        {Array.from({ length: 24 }, (_, i) => i + 1).map((v) => (
          <option key={v} value={v}>
            {v} {v === 1 ? 'mês' : 'meses'}
          </option>
        ))}
      </select>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(n)}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          Gerar
        </button>
      </div>
    </Sheet>
  )
}

// ── Adicionar parcela avulsa (meta de cronograma personalizado) ──────
type AddCustomInstallmentProps = {
  goalName: string
  onClose: () => void
  onConfirm: (day: number, month: number, year: number, amount: number) => void
}

export function AddCustomInstallmentDialog({ goalName, onClose, onConfirm }: AddCustomInstallmentProps) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(todayIso)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    const amt = parseAmount(value)
    if (amt <= 0) return setError('Digite um valor positivo.')
    if (!date) return setError('Escolha uma data.')
    const [y, m, d] = date.split('-').map(Number)
    onConfirm(d, m, y, amt)
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Adicionar parcela</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        {goalName}
      </p>
      <div className="flex flex-col gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border px-3 py-3 text-base outline-none"
          style={inputStyle}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="Valor (R$)"
          className="rounded-lg border px-3 py-3 text-center text-base outline-none"
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
          Adicionar
        </button>
      </div>
    </Sheet>
  )
}

// ── Confirmação genérica (excluir) ───────────────────────────────────
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
