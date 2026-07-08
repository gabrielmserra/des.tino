import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import {
  fetchCardsOverview,
  payCardBill,
  fetchBenefitsOverview,
} from '../lib/api'
import { formatCurrency } from '../lib/format'
import { Skeleton } from '../components/Skeleton'
import { CardForm } from '../components/CardForm'
import { BenefitForm } from '../components/BenefitForm'
import type { CardOverview, BenefitOverview } from '../lib/types'

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

type AddChoice = 'credito' | 'vrva' | null

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
      {children}
    </h2>
  )
}

export function Cards() {
  const { selectedId } = useMonths()
  const qc = useQueryClient()

  const [addChoice, setAddChoice] = useState(false)
  const [creditForm, setCreditForm] = useState<CardOverview | 'new' | null>(null)
  const [benefitForm, setBenefitForm] = useState<BenefitOverview | 'new' | null>(null)

  const [payBusy, setPayBusy] = useState<number | null>(null)
  const [payError, setPayError] = useState('')

  const creditQ = useQuery({
    queryKey: ['cardsOverview', selectedId],
    queryFn: () => fetchCardsOverview(selectedId!),
    enabled: selectedId != null,
  })
  const benefitQ = useQuery({ queryKey: ['benefitsOverview'], queryFn: fetchBenefitsOverview })

  const creditCards = creditQ.data ?? []
  const benefits = benefitQ.data ?? []
  const loading = creditQ.isLoading || benefitQ.isLoading

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

  const pickType = (choice: AddChoice) => {
    setAddChoice(false)
    if (choice === 'credito') setCreditForm('new')
    else if (choice === 'vrva') setBenefitForm('new')
  }

  return (
    <div className="p-4 pb-8">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cartões</h1>
        <button
          onClick={() => setAddChoice(true)}
          className="rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          + Adicionar
        </button>
      </div>

      {payError && (
        <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
          {payError}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <SectionTitle>💳 Crédito</SectionTitle>
          {creditCards.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Nenhum cartão de crédito.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {creditCards.map((c) => {
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
                      <button onClick={() => setCreditForm(c)} className="text-sm" style={{ color: 'var(--muted)' }}>
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
                          style={{ width: `${pctUsed * 100}%`, background: pctUsed > 0.85 ? 'var(--red)' : c.color }}
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
                        {payBusy === c.id ? 'Pagando…' : `Pagar fatura (${formatCurrency(c.unpaid)})`}
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

          <SectionTitle>🍽️ Vale Refeição / Alimentação</SectionTitle>
          {benefits.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Nenhum benefício.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {benefits.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{b.name}</span>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: b.color }}
                      >
                        {b.benefit_type}
                      </span>
                    </div>
                    <button onClick={() => setBenefitForm(b)} className="text-sm" style={{ color: 'var(--muted)' }}>
                      Editar
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Saldo disponível
                  </p>
                  <p className="mb-2 text-2xl font-bold" style={{ color: b.color }}>
                    {formatCurrency(b.balance)}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: b.days_until_renewal <= 3 ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    Renova em {b.days_until_renewal}d
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    Recarga: {formatCurrency(b.recharge_amount)} (
                    {b.recharge_mode === 'acumula' ? 'acumula' : 'zera'})
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {addChoice && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setAddChoice(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border-t p-5"
            style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center text-lg font-bold">O que você quer adicionar?</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => pickType('credito')}
                className="rounded-lg border py-3 text-left font-semibold"
                style={{ borderColor: 'var(--border-l)', color: 'var(--text)' }}
              >
                <span className="pl-3">💳 Cartão de crédito</span>
              </button>
              <button
                onClick={() => pickType('vrva')}
                className="rounded-lg border py-3 text-left font-semibold"
                style={{ borderColor: 'var(--border-l)', color: 'var(--text)' }}
              >
                <span className="pl-3">🍽️ Vale Refeição / Alimentação</span>
              </button>
            </div>
            <button
              onClick={() => setAddChoice(false)}
              className="mt-4 w-full rounded-lg py-3 text-sm font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {creditForm !== null && (
        <CardForm card={creditForm === 'new' ? null : creditForm} onClose={() => setCreditForm(null)} />
      )}
      {benefitForm !== null && (
        <BenefitForm benefit={benefitForm === 'new' ? null : benefitForm} onClose={() => setBenefitForm(null)} />
      )}
    </div>
  )
}
