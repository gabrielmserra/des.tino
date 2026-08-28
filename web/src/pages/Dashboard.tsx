import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal, Check, Plus, GripVertical } from 'lucide-react'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  defaultDropAnimationSideEffects,
  type DragStartEvent, type DragEndEvent, type DropAnimation,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useMonths } from '../lib/month'
import { fetchDashboardConfig, saveDashboardConfig } from '../lib/api'
import { todayLabel } from '../lib/format'
import { DashboardSkeleton } from '../components/Skeleton'
import { EditableWidgetCard } from '../components/EditableWidgetCard'
import { AddWidgetPicker } from '../components/AddWidgetPicker'
import { AddMonthDialog } from '../components/AddMonthDialog'
import { CardRiskBanner } from '../components/CardRiskBanner'
import { DEFAULT_WIDGET_ORDER, WIDGET_REGISTRY, widgetById, type WidgetDef } from '../lib/dashboardWidgets'
import type { DashboardWidgetEntry } from '../lib/types'

const REMOVE_ANIM_MS = 200
const ENTER_ANIM_MS = 320

const dropAnimationConfig: DropAnimation = {
  duration: 250,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
}

function resolveConfig(saved: DashboardWidgetEntry[] | null): DashboardWidgetEntry[] {
  const valid = (saved ?? []).filter((e) => widgetById(e.id))
  const known = new Set(valid.map((e) => e.id))
  const missing = DEFAULT_WIDGET_ORDER.filter((id) => !known.has(id)).map((id) => ({ id, enabled: true }))
  return [...valid, ...missing]
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      {children}
    </div>
  )
}

export function Dashboard() {
  const { months, selected, setSelectedId, loading } = useMonths()
  const qc = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddMonth, setShowAddMonth] = useState(false)
  const [config, setConfig] = useState<DashboardWidgetEntry[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSize, setActiveSize] = useState<{ width: number; height: number } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [enteringId, setEnteringId] = useState<string | null>(null)

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
  if (!selected)
    return (
      <>
        <Centered>
          <p style={{ color: 'var(--muted)' }}>Nenhum período encontrado.</p>
          <button
            onClick={() => setShowAddMonth(true)}
            className="rounded-lg px-5 py-3 text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            + Criar período
          </button>
        </Centered>
        {showAddMonth && (
          <AddMonthDialog
            months={months}
            onClose={() => setShowAddMonth(false)}
            onCreated={async (id) => {
              await qc.invalidateQueries({ queryKey: ['months'] })
              setSelectedId(id)
              setShowAddMonth(false)
            }}
          />
        )}
      </>
    )

  const enabledEntries = config.filter((e) => e.enabled && widgetById(e.id))
  const activeDefs = enabledEntries.map((e) => widgetById(e.id) as WidgetDef)
  const enabledIds = new Set(enabledEntries.map((e) => e.id))
  const available = WIDGET_REGISTRY.filter((w) => !enabledIds.has(w.id))
  const activeWidget = activeId ? (activeDefs.find((w) => w.id === activeId) ?? null) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    const rect = event.active.rect.current.initial
    if (rect) setActiveSize({ width: rect.width, height: rect.height })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    setActiveSize(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = enabledEntries.findIndex((e) => e.id === active.id)
    const newIndex = enabledEntries.findIndex((e) => e.id === over.id)
    const reordered = arrayMove(enabledEntries, oldIndex, newIndex)
    const rest = config.filter((e) => !e.enabled || !widgetById(e.id))
    applyChange([...reordered, ...rest])
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setActiveSize(null)
  }

  const removeWidget = (id: string) => {
    setRemovingId(id)
    setTimeout(() => {
      applyChange(config.map((e) => (e.id === id ? { ...e, enabled: false } : e)))
      setRemovingId(null)
    }, REMOVE_ANIM_MS)
  }

  const addWidget = (id: string) => {
    const existing = config.find((e) => e.id === id)
    const newEntry: DashboardWidgetEntry = existing ? { ...existing, enabled: true } : { id, enabled: true }
    const rest = config.filter((e) => e.id !== id)
    applyChange([...enabledEntries, newEntry, ...rest.filter((e) => !e.enabled)])
    setShowAdd(false)
    setEnteringId(id)
    setTimeout(() => setEnteringId((cur) => (cur === id ? null : cur)), ENTER_ANIM_MS)
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
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors"
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

      {!editMode && <CardRiskBanner />}

      {activeDefs.length === 0 && !editMode ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum card habilitado. Toque no ícone de editar para escolher o que mostrar.
        </p>
      ) : editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={enabledEntries.map((e) => e.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3">
              {activeDefs.map((w) => (
                <EditableWidgetCard
                  key={w.id}
                  widget={w}
                  onRemove={() => removeWidget(w.id)}
                  removing={removingId === w.id}
                  entering={enteringId === w.id}
                />
              ))}
              <div className="col-span-2">
                {showAdd ? (
                  <AddWidgetPicker available={available} onAdd={addWidget} onClose={() => setShowAdd(false)} />
                ) : (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-sm font-bold transition-colors active:bg-[var(--card2)]"
                    style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                  >
                    <Plus size={18} /> Adicionar widget
                  </button>
                )}
              </div>
            </div>
          </SortableContext>

          {/* Clone flutuante do card sendo arrastado — segue o dedo/cursor livremente,
              sem ficar preso à distorção da grade (fica muito mais fluido que animar
              o próprio item da grade). */}
          <DragOverlay dropAnimation={dropAnimationConfig}>
            {activeWidget && activeSize ? (
              <div
                style={{
                  position: 'relative',
                  width: activeSize.width,
                  height: activeSize.height,
                  borderRadius: 16,
                  boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
                  transform: 'scale(1.03) rotate(1.5deg)',
                  cursor: 'grabbing',
                  pointerEvents: 'none',
                }}
              >
                <activeWidget.Component />
                <div
                  className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border-l)' }}
                >
                  <GripVertical size={15} />
                </div>
              </div>
            ) : null}
          </DragOverlay>
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
