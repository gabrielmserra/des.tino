import { useQuery } from '@tanstack/react-query'
import { fetchFutureCommitments } from '../lib/api'
import { formatCurrency, MONTHS_PT } from '../lib/format'
import type { FutureCommitment } from '../lib/types'

function Stat({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="flex-1">
      <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
        {emoji} {label}
      </p>
      <p className="text-sm font-bold" style={{ color: value > 0 ? 'var(--text)' : 'var(--muted)' }}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function MonthCard({ r }: { r: FutureCommitment }) {
  return (
    <div className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-bold">{MONTHS_PT[r.month - 1]} {r.year}</span>
        <span className="font-bold" style={{ color: r.grand_total > 0 ? 'var(--accent)' : 'var(--muted)' }}>
          {formatCurrency(r.grand_total)}
        </span>
      </div>
      <div className="flex gap-3">
        <Stat emoji="💳" label="Cartão" value={r.card_total} />
        <Stat emoji="💸" label="Dívidas" value={r.debt_total} />
        <Stat emoji="🧾" label="Contas Fixas" value={r.bills_total} />
      </div>
      {r.grand_total === 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          Nada comprometido ainda pra este mês.
        </p>
      )}
    </div>
  )
}

export function FutureCommitments() {
  const { data, isLoading } = useQuery({
    queryKey: ['futureCommitments', 6],
    queryFn: () => fetchFutureCommitments(6),
  })

  const rows = data ?? []

  return (
    <div className="p-4 pb-8">
      <h1 className="text-2xl font-bold">Compromissos Futuros</h1>
      <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
        Tudo que já está comprometido pra frente: parcelas de cartão, dívidas em aberto e contas fixas pendentes.
      </p>

      {isLoading ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Não foi possível carregar os compromissos futuros.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <MonthCard key={`${r.year}-${r.month}`} r={r} />
          ))}
        </div>
      )}
    </div>
  )
}
