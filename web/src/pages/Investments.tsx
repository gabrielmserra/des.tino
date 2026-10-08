import { useSearchParams } from 'react-router-dom'
import { InvestmentsList } from './InvestmentsList'
import { InvestorProfile } from './InvestorProfile'
import { AllocationComparison } from './AllocationComparison'
import { MockPortfolios } from './MockPortfolios'

const TABS = [
  { id: 'carteira', label: 'Carteira' },
  { id: 'perfil', label: 'Perfil de Investidor' },
  { id: 'alocacao', label: 'Alocação' },
  { id: 'ficticias', label: 'Carteiras Fictícias' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Investments() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'carteira'

  return (
    <div className="flex flex-col">
      <div
        className="sticky top-0 z-[5] flex gap-1 border-b p-2"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className="flex-1 rounded-lg py-2 text-sm font-semibold"
            style={{
              background: tab === t.id ? 'var(--violet)' : 'var(--card2)',
              color: tab === t.id ? '#fff' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'carteira' && <InvestmentsList />}
      {tab === 'perfil' && <InvestorProfile />}
      {tab === 'alocacao' && <AllocationComparison />}
      {tab === 'ficticias' && <MockPortfolios />}
    </div>
  )
}
