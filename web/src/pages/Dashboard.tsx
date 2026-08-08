import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal, Check, Plus } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useMonths } from '../lib/month'
import { fetchDashboardConfig, saveDashboardConfig } from '../lib/api'
import { todayLabel } from '../lib/format'
import { DashboardSkeleton } from '../components/Skeleton'
import { EditableWidgetCard } from '../components/EditableWidgetCard'
import { AddWidgetPicker } from '../components/AddWidgetPicker'
import { DEFAULT_WIDGET_ORDER, WIDGET_REGISTRY, widgetById, type WidgetDef } from '../lib/dashboardWidgets'
import type { DashboardWidgetEntry } from '../lib/types'

function resolveConfig(saved: DashboardWidgetEntry[] | null): DashboardWidgetEntry[] {
  const valid = (saved ?? []).filter((e) => widgetById(e.id))
  const known = new Set(valid.map((e) => e.id))
  const missing = DEFAULT_WIDGET_ORDER.filter((id) => !known.has(id)).map((id) => ({ id, enabled: true }))
  return [...valid, ...missing]
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
  const [editMode, setEditMode] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [config, setConfig] = useState<DashboardWidgetEntry[] | null>(null)

  const configQ = useQuery({ queryKey: ['dashboardConfig'], queryFn: fetchDashboardConfig })

  useEffect(() => {
    if (configQ.data !== undefined) setConfig(resolveConfig(configQ.data))
  }, [configQ.data])

  const applyChange = (next: DashboardWidgetEntry[]) => {
    setConfig(next)
    saveDashboardConfig(next).then(() => qc.invalidateQueries({ queryKey: ['dashboardConfig'] }))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  if (loading || config === null) return <DashboardSkeleton />
  if (!selected) return <Centered>Nenhum período encontrado. Crie um no app desktop.</Centered>

  const enabledEntries = config.filter((e) => e.enabled && widgetById(e.id))
  const activeDefs = enabledEntries.map((e) => widgetById(e.id) as WidgetDef)
  const enabledIds = new Set(enabledEntries.map((e) => e.id))
  const available = WIDGET_REGISTRY.filter((w) => !enabledIds.has(w.id))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = enabledEntries.findIndex((e) => e.id === active.id)
    const newIndex = enabledEntries.findIndex((e) => e.id === over.id)
    const reordered = arrayMove(enabledEntries, oldIndex, newIndex)
    const rest = config.filter((e) => !e.enabled || !widgetById(e.id))
    applyChange([...reordered, ...rest])
  }

  const removeWidget = (id: string) => {
    applyChange(config.map((e) => (e.id === id ? { ...e, enabled: false } : e)))
  }

  const addWidget = (id: string) => {
    const existing = config.find((e) => e.id === id)
    const newEntry: DashboardWidgetEntry = existing ? { ...existing, enabled: true } : { id, enabled: true }
    const rest = config.filter((e) => e.id !== id)
    applyChange([...enabledEntries, newEntry, ...rest.filter((e) => !e.enabled)])
    setShowAdd(false)
  }

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
          onClick={() => {
            setEditMode((v) => !v)
            setShowAdd(false)
          }}
          aria-label={editMode ? 'Concluir edição' : 'Editar Dashboard'}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2"
          style={
            editMode
              ? { borderColor: 'var(--primary)', color: 'var(--primary)', background: 'var(--card2)' }
              : { borderColor: 'var(--border-l)', color: 'var(--muted)' }
          }
        >
          {editMode ? <Check size={16} strokeWidth={2.5} /> : <SlidersHorizontal size={16} strokeWidth={2} />}
          {editMode && <span className="text-sm font-bold">Concluir</span>}
        </button>
      </div>

      {activeDefs.length === 0 && !editMode ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum card habilitado. Toque no ícone de editar para escolher o que mostrar.
        </p>
      ) : editMode ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={enabledEntries.map((e) => e.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3">
              {activeDefs.map((w) => (
                <EditableWidgetCard key={w.id} widget={w} onRemove={() => removeWidget(w.id)} />
              ))}
              <div className="col-span-2">
                {showAdd ? (
                  <AddWidgetPicker available={available} onAdd={addWidget} onClose={() => setShowAdd(false)} />
                ) : (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-sm font-bold"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                  >
                    <Plus size={18} /> Adicionar widget
                  </button>
                )}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {activeDefs.map((w) => (
            <div key={w.id} className={w.size === 'full' ? 'col-span-2' : 'col-span-1'}>
              <w.Component />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
