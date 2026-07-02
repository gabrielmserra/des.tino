import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import { fetchCardsOverview, payCardBill } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { CardForm } from '../components/CardForm'
import type { CardOverview } from '../lib/types'

function safetyMessage(c: CardOverview): { text: string; color: string } {
  const pctUsed = c.card_limit > 0 ? c.spent / c.card_limit : 0
  if (pctUsed >= 0.9) return { text: 'Limite quase esgotado', color: 'var(--red)' }
  if (c.days_until_due <= 3 && c.unpaid > 0)
    return { text: `Vence em ${c.days_until_due}d — atenção`, color: 'var(--red)' }
  if (pctUsed >= 0.7) return { text: `${Math.round(pctUsed * 100)}% do limite usado`, color: 'var(--accent)' }
  if (c.days_until_due <= 5 && c.unpaid > 0)
    return { text: `Vence em ${c.days_until_due}d`, color: 'var(--accent)' }
  if (c.unpaid === 0) return { text: 'Nenhuma fatura em aberto', color: 'var(--primary)' }
  return { text: 'Situação tranquila', color: 'var(--primary)' }
}

export function Cards() {
  const { selectedId } = useMonths()
  const qc = useQueryClient()
  const [formCard, setFormCard] = useState<CardOverview | 'new' | null>(null)
  const [payBusy, setPayBusy] = useState<number | null>(null)
  const [payError, setPayError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cardsOverview', selectedId],
    queryFn: () => fetchCardsOverview(selectedId!),
    enabled: selectedId != null,
  })

  const cards = data ?? []

  const pay = async (c: CardOverview) => {
    if (!selectedId) return
    if (!confirm(`Pagar a fatura de ${formatCurrency(c.unpaid)} do cartão ${c.name}?`)) return
    setPayBusy(c.id)
    setPayError('')
    try {
      await payCardBill(c.id, selectedId)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cardsOverview'] }),
        qc.invalidateQueries({ queryKey: ['summary'] }),
        qc.invalidateQueries({ queryKey: ['cats'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
      ])
    } catch (e) {
      setPayError('Erro ao pagar: ' + (e as Error).message)
    } finally {
      setPayBusy(null)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cartões</h1>
        <button
          onClick={() => setFormCard('new')}
          className="rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          + Cartão
        </button>
      </div>

      {payError && (
        <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
          {payError}
        </p>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : cards.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum cartão. Toque em "+ Cartão" para adicionar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((c) => {
            const safety = safetyMessage(c)
            const pctUsed = c.card_limit > 0 ? Math.min(1, c.spent / c.card_limit) : 0
            return (
              <div
                key={c.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="font-bold">{c.name}</span>
                  </div>
                  <button
                    onClick={() => setFormCard(c)}
                    className="text-sm"
                    style={{ color: 'var(--muted)' }}
                  >
                    Editar
                  </button>
                </div>

                <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
                  {c.cycle_open ? 'Fatura aberta' : 'Fatura fechada'} · Fecha em{' '}
                  {c.days_until_closing}d · Vence em {c.days_until_due}d
                </p>

                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Gasto no ciclo
                  </span>
                  <span className="font-bold" style={{ color: c.color }}>
                    {formatCurrency(c.spent)}
                  </span>
                </div>
                {c.available != null && (
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      Disponível
                    </span>
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>
                      {formatCurrency(c.available)}
                    </span>
                  </div>
                )}

                {c.card_limit > 0 && (
                  <div
                    className="mb-3 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--border)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pctUsed * 100}%`,
                        background: pctUsed > 0.85 ? 'var(--red)' : c.color,
                      }}
                    />
                  </div>
                )}

                <p className="mb-3 text-xs font-semibold" style={{ color: safety.color }}>
                  {safety.text}
                </p>

                {c.unpaid > 0 ? (
                  <button
                    onClick={() => pay(c)}
                    disabled={payBusy === c.id}
                    className="w-full rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
                    style={{ background: 'var(--primary)' }}
                  >
                    {payBusy === c.id
                      ? 'Pagando…'
                      : `Pagar fatura (${formatCurrency(c.unpaid)})`}
                  </button>
                ) : (
                  <p className="text-center text-xs" style={{ color: 'var(--primary)' }}>
                    ✓ Fatura em dia
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formCard !== null && (
        <CardForm
          card={formCard === 'new' ? null : formCard}
          onClose={() => setFormCard(null)}
        />
      )}
    </div>
  )
}
