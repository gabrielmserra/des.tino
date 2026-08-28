import { useQuery } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import { fetchCardsOverview, fetchFutureCommitments } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { safetyMessage } from '../pages/Cards'

export function CardRiskBanner() {
  const { selectedId, months } = useMonths()

  const cardsQ = useQuery({
    queryKey: ['cardsOverview', selectedId],
    queryFn: () => fetchCardsOverview(selectedId!),
    enabled: selectedId != null,
  })
  const commitmentsQ = useQuery({
    queryKey: ['futureCommitments', 3],
    queryFn: () => fetchFutureCommitments(3),
  })

  const cards = cardsQ.data ?? []
  const redCards = cards
    .map((c) => ({ c, safety: safetyMessage(c) }))
    .filter(({ safety }) => safety.color === 'var(--red)')

  // "Mês atual" na visão do app (o mais recente cadastrado — pode estar à
  // frente do calendário por causa do dia de corte), não a data real de hoje.
  const current = months[0]
  const commitments = commitmentsQ.data ?? []
  const curRow = current
    ? commitments.find((c) => c.year === current.year && c.month === current.month)
    : undefined
  const openBillTotal = curRow?.card_total ?? 0
  const nextRow = current
    ? commitments.find((c) => c.year > current.year || (c.year === current.year && c.month > current.month))
    : undefined
  const nextMonthCardTotal = nextRow?.card_total ?? 0

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
