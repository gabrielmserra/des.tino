import { useQuery } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import { fetchCardsOverview, fetchFutureCommitments } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { safetyMessage } from '../pages/Cards'

export function CardRiskBanner() {
  const { selectedId } = useMonths()

  const cardsQ = useQuery({
    queryKey: ['cardsOverview', selectedId],
    queryFn: () => fetchCardsOverview(selectedId!),
    enabled: selectedId != null,
  })
  const commitmentsQ = useQuery({
    queryKey: ['futureCommitments', 2],
    queryFn: () => fetchFutureCommitments(2),
  })

  const cards = cardsQ.data ?? []
  const redCards = cards
    .map((c) => ({ c, safety: safetyMessage(c) }))
    .filter(({ safety }) => safety.color === 'var(--red)')

  // commitments[0] é sempre o mês corrente de verdade (data real), e
  // commitments[1] o mês seguinte — get_future_commitments rotula a
  // fatura em aberto de cada cartão pelo mês em que o ciclo dele começou.
  const commitments = commitmentsQ.data ?? []
  const openBillTotal = commitments[0]?.card_total ?? 0
  const nextMonthCardTotal = commitments[1]?.card_total ?? 0

  const parts: string[] = []
  if (redCards.length === 1) {
    parts.push(`⚠ ${redCards[0].c.name}: ${redCards[0].safety.text}`)
  } else if (redCards.length > 1) {
    const names = redCards.slice(0, 3).map(({ c }) => c.name).join(', ') + (redCards.length > 3 ? '…' : '')
    parts.push(`⚠ Atenção com: ${names}`)
  }
  if (openBillTotal > 300) {
    parts.push(`fatura em aberto: ${formatCurrency(openBillTotal)}`)
  }
  if (nextMonthCardTotal > 300) {
    parts.push(`mês que vem já tem ${formatCurrency(nextMonthCardTotal)} comprometido em parcelas`)
  }

  if (parts.length === 0) return null

  return (
    <div
      className="mb-3 rounded-xl border px-4 py-3 text-sm font-bold"
      style={{ background: 'rgba(255,80,80,0.12)', borderColor: 'var(--red)', color: 'var(--red)' }}
    >
      {parts.join('  •  ')}
    </div>
  )
}
