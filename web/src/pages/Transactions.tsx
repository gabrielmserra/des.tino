import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import { fetchTransactions } from '../lib/api'
import { formatCurrency } from '../lib/format'
import type { Transaction, TxType } from '../lib/types'

const IS_INCOME: Record<TxType, boolean> = {
  entrada_fixa: true,
  entrada_variavel: true,
  saida_fixa: false,
  saida_variavel: false,
}

type Filter = 'todos' | 'entradas' | 'saidas'

function origemTag(t: Transaction): string | null {
  if (t.benefit_id) return 'VR/VA'
  if (t.card_id) return 'Cartão'
  return null
}

export function Transactions() {
  const { selectedId, selected } = useMonths()
  const [filter, setFilter] = useState<Filter>('todos')

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', selectedId],
    queryFn: () => fetchTransactions(selectedId!),
    enabled: selectedId != null,
  })

  const all = data ?? []
  const txs = all.filter((t) => {
    if (filter === 'entradas') return IS_INCOME[t.type]
    if (filter === 'saidas') return !IS_INCOME[t.type]
    return true
  })

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className="rounded-full px-4 py-1.5 text-sm font-semibold"
      style={{
        background: filter === f ? 'var(--primary)' : 'var(--card2)',
        color: filter === f ? '#fff' : 'var(--muted)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="p-4">
      <h1 className="mb-1 text-2xl font-bold">Lançamentos</h1>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        {selected?.name}
      </p>

      <div className="mb-4 flex gap-2">
        {chip('todos', 'Todos')}
        {chip('entradas', 'Entradas')}
        {chip('saidas', 'Saídas')}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : txs.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum lançamento neste filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {txs.map((t) => {
            const income = IS_INCOME[t.type]
            const color = income ? 'var(--primary)' : 'var(--red)'
            const tag = origemTag(t)
            return (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl border p-3"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-semibold"
                    style={{ color: t.is_expectation ? 'var(--muted)' : 'var(--text)' }}
                  >
                    {t.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {t.category || 'Outros'}
                    </span>
                    {t.is_expectation && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--card2)', color: 'var(--accent)' }}
                      >
                        previsto
                      </span>
                    )}
                    {tag && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--card2)', color: 'var(--muted)' }}
                      >
                        {tag}
                      </span>
                    )}
                  </div>
                </div>
                <span className="ml-3 shrink-0 font-bold" style={{ color }}>
                  {income ? '' : '- '}
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
