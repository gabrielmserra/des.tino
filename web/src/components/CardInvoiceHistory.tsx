import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCardInvoices, fetchCardInvoiceTransactions } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import type { CardOverview, Transaction } from '../lib/types'

type Props = { card: CardOverview; onClose: () => void }

function InvoiceTransactions({ invoiceId }: { invoiceId: number }) {
  const q = useQuery({
    queryKey: ['cardInvoiceTransactions', invoiceId],
    queryFn: () => fetchCardInvoiceTransactions(invoiceId),
  })
  const txs: Transaction[] = q.data ?? []

  if (q.isLoading) {
    return (
      <p className="px-1 py-2 text-xs" style={{ color: 'var(--muted)' }}>
        Carregando…
      </p>
    )
  }
  if (txs.length === 0) {
    return (
      <p className="px-1 py-2 text-xs" style={{ color: 'var(--muted)' }}>
        Nenhum lançamento encontrado.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5 py-2">
      {txs.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate" style={{ color: 'var(--text)' }}>
            {t.description}
          </span>
          <span className="shrink-0" style={{ color: 'var(--muted)' }}>
            {t.payment_date ? formatDate(t.payment_date) : ''} · {formatCurrency(t.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function CardInvoiceHistory({ card, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const invoicesQ = useQuery({
    queryKey: ['cardInvoices', card.id],
    queryFn: () => fetchCardInvoices(card.id),
  })
  const invoices = invoicesQ.data ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-y-auto rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', maxHeight: '92vh', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Histórico de faturas · {card.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        {invoicesQ.isLoading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Carregando…
          </p>
        ) : invoices.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Nenhuma fatura paga ainda. Faturas fechadas e pagas (ou vencidas) aparecem aqui.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border p-3"
                style={{ borderColor: 'var(--border-l)' }}
              >
                <button
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {formatDate(inv.cycle_start)} — {formatDate(inv.due_date)}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {inv.auto_settled
                        ? `Vencida automaticamente em ${formatDate(inv.paid_at.slice(0, 10))}`
                        : `Paga em ${formatDate(inv.paid_at.slice(0, 10))}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold" style={{ color: 'var(--text)' }}>
                    {formatCurrency(inv.total)}
                  </span>
                </button>
                {expandedId === inv.id && (
                  <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--border)' }}>
                    <InvoiceTransactions invoiceId={inv.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
