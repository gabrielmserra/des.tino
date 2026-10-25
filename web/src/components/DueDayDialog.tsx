import { useState } from 'react'

// Dia de vencimento opcional de uma dívida ou meta recorrente (migração
// 052) — vale pra todas as parcelas; só muda em que dia elas aparecem no
// Calendário e no "Livre para gastar". Réplica de ui/debts.py:DueDayDialog.
export function DueDayDialog({
  name,
  current,
  onClose,
  onConfirm,
}: {
  name: string
  current: number | null
  onClose: () => void
  onConfirm: (day: number | null) => void
}) {
  const [value, setValue] = useState(current ? String(current) : '')

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
        <h2 className="text-center text-lg font-bold">Dia do vencimento</h2>
        <p className="mb-1 text-center text-sm" style={{ color: 'var(--muted)' }}>{name}</p>
        <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
          Vale pra todas as parcelas. Só muda o dia em que elas aparecem no Calendário — nada mais.
        </p>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          <option value="">Sem dia certo (dia 1)</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              Dia {i + 1}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-3 font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(value ? Number(value) : null)}
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
