import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useMonths } from '../lib/month'
import { fetchDashboardConfig, saveDashboardConfig } from '../lib/api'
import { todayLabel } from '../lib/format'
import { DashboardSkeleton } from '../components/Skeleton'
import { EditDashboardSheet } from '../components/EditDashboardSheet'
import { DEFAULT_WIDGET_ORDER, widgetById, type WidgetDef } from '../lib/dashboardWidgets'
import type { DashboardWidgetEntry } from '../lib/types'

function resolveConfig(saved: DashboardWidgetEntry[] | null): DashboardWidgetEntry[] {
  const valid = (saved ?? []).filter((e) => widgetById(e.id))
  const known = new Set(valid.map((e) => e.id))
  const missing = DEFAULT_WIDGET_ORDER.filter((id) => !known.has(id)).map((id) => ({ id, enabled: true }))
  return [...valid, ...missing]
}

function groupWidgets(defs: WidgetDef[]): (WidgetDef[] | WidgetDef)[] {
  const groups: (WidgetDef[] | WidgetDef)[] = []
  let compact: WidgetDef[] = []
  for (const w of defs) {
    if (w.size === 'compact') {
      compact.push(w)
    } else {
      if (compact.length) {
        groups.push(compact)
        compact = []
      }
      groups.push(w)
    }
  }
  if (compact.length) groups.push(compact)
  return groups
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p style={{ color: 'var(--muted)' }}>{children}</p>
    </div>
  )
}

export function Dashboard() {
  const { selected, loading } = useMonths()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [config, setConfig] = useState<DashboardWidgetEntry[] | null>(null)

  const configQ = useQuery({ queryKey: ['dashboardConfig'], queryFn: fetchDashboardConfig })

  useEffect(() => {
    if (configQ.data !== undefined) setConfig(resolveConfig(configQ.data))
  }, [configQ.data])

  const applyChange = (next: DashboardWidgetEntry[]) => {
    setConfig(next)
    saveDashboardConfig(next).then(() => qc.invalidateQueries({ queryKey: ['dashboardConfig'] }))
  }

  if (loading || config === null) return <DashboardSkeleton />
  if (!selected) return <Centered>Nenhum período encontrado. Crie um no app desktop.</Centered>

  const activeDefs = config
    .filter((e) => e.enabled)
    .map((e) => widgetById(e.id))
    .filter((w): w is WidgetDef => !!w)
  const groups = groupWidgets(activeDefs)

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{selected.name}</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {todayLabel()}
          </p>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          aria-label="Editar Dashboard"
          className="flex items-center justify-center rounded-lg border p-2"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          <SlidersHorizontal size={16} strokeWidth={2} />
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum card habilitado. Toque no ícone de editar para escolher o que mostrar.
        </p>
      ) : (
        groups.map((g, i) =>
          Array.isArray(g) ? (
            <div key={i} className="mb-3 grid grid-cols-2 gap-3">
              {g.map((w) => (
                <w.Component key={w.id} />
              ))}
            </div>
          ) : (
            <div key={g.id} className="mb-3">
              <g.Component />
            </div>
          ),
        )
      )}

      {showEdit && (
        <EditDashboardSheet config={config} onChange={applyChange} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
