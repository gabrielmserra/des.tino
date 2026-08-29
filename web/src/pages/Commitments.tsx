import { useSearchParams } from 'react-router-dom'
import { Debts } from './Debts'
import { Goals } from './Goals'
import { FixedBills } from './FixedBills'

const TABS = [
  { id: 'dividas', label: 'Dívidas' },
  { id: 'metas', label: 'Metas' },
  { id: 'contas-fixas', label: 'Contas Fixas' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Commitments() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'dividas'

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
              background: tab === t.id ? 'var(--primary)' : 'var(--card2)',
              color: tab === t.id ? '#fff' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'dividas' && <Debts />}
      {tab === 'metas' && <Goals />}
      {tab === 'contas-fixas' && <FixedBills />}
    </div>
  )
}
