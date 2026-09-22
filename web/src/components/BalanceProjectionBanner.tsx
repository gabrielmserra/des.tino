import { useQuery } from '@tanstack/react-query'
import { useMonths } from '../lib/month'
import { fetchBalanceProjection } from '../lib/api'
import { formatCurrency } from '../lib/format'

export function BalanceProjectionBanner() {
  const { selectedId } = useMonths()

  const projectionQ = useQuery({
    queryKey: ['balanceProjection', selectedId],
    queryFn: () => fetchBalanceProjection(selectedId!),
    enabled: selectedId != null,
  })

  const projection = projectionQ.data
  if (!projection) return null

  const text =
    `⚠ Saldo projetado fica negativo no dia ${projection.day} (${formatCurrency(projection.balance)})` +
    (projection.next_income_day
      ? `, antes da sua próxima entrada esperada no dia ${projection.next_income_day}.`
      : '.')

  return (
    <div
      className="mb-3 rounded-xl border px-4 py-3 text-sm font-bold"
      style={{ background: 'rgba(255,80,80,0.12)', borderColor: 'var(--red)', color: 'var(--red)' }}
    >
      {text}
    </div>
  )
}
