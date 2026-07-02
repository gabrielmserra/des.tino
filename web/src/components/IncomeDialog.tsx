import { useState } from 'react'

type Props = {
  suggested: number
  onCancel: () => void
  onConfirm: (income: number) => void
}

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

export function IncomeDialog({ suggested, onCancel, onConfirm }: Props) {
  const [value, setValue] = useState(suggested > 0 ? String(suggested).replace('.', ',') : '')

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
          Ainda não há entradas registradas neste mês. Essa estimativa vira o máximo
          distribuível entre as categorias.
        </p>
        <label
          className="mb-1 block text-center text-xs font-bold"
          style={{ color: 'var(--muted)' }}
        >
          RENDA ESTIMADA (R$)
        </label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="mb-1 w-full rounded-lg border px-3 py-3 text-center text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />
        {suggested > 0 && (
          <p className="mb-4 text-center text-[10px]" style={{ color: 'var(--muted)' }}>
            pré-preenchido com a média das suas entradas recentes
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border py-3 font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            Sem renda
          </button>
          <button
            onClick={() => onConfirm(parseAmount(value))}
            className="flex-1 rounded-lg py-3 font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
