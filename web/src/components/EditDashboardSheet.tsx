import { useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { widgetById, WIDGET_REGISTRY, type WidgetDef } from '../lib/dashboardWidgets'
import type { DashboardWidgetEntry } from '../lib/types'

type Props = {
  config: DashboardWidgetEntry[]
  onChange: (config: DashboardWidgetEntry[]) => void
  onClose: () => void
}

function SortableRow({ entry, onRemove }: { entry: DashboardWidgetEntry; onRemove: () => void }) {
  const widget = widgetById(entry.id)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })
  if (!widget) return null

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: 'var(--card2)',
        borderColor: 'var(--border-l)',
      }}
      className="flex items-center gap-2 rounded-xl border p-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
        style={{ color: 'var(--muted)' }}
        aria-label="Arrastar para reordenar"
      >
        <GripVertical size={18} />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{widget.label}</span>
      <button
        onClick={onRemove}
        className="shrink-0 rounded-lg p-1"
        style={{ color: 'var(--muted)' }}
        aria-label={`Remover ${widget.label}`}
      >
        <X size={16} />
      </button>
    </div>
  )
}

function AddWidgetPicker({
  available, onAdd, onClose,
}: {
  available: WidgetDef[]
  onAdd: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="mb-3 flex flex-col gap-1.5 rounded-xl border p-3"
      style={{ borderColor: 'var(--border-l)', background: 'var(--card2)' }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
          Adicionar widget
        </span>
        <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-lg leading-none">
          ×
        </button>
      </div>
      {available.length === 0 ? (
        <p className="py-2 text-xs" style={{ color: 'var(--muted)' }}>
          Todos os widgets já estão no dashboard.
        </p>
      ) : (
        available.map((w) => (
          <button
            key={w.id}
            onClick={() => onAdd(w.id)}
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold"
            style={{ background: 'var(--card)' }}
          >
            {w.label}
            <Plus size={16} style={{ color: 'var(--primary)' }} />
          </button>
        ))
      )}
    </div>
  )
}

export function EditDashboardSheet({ config, onChange, onClose }: Props) {
  const [showAdd, setShowAdd] = useState(false)

  const enabled = config.filter((e) => e.enabled && widgetById(e.id))
  const enabledIds = new Set(enabled.map((e) => e.id))
  const available = WIDGET_REGISTRY.filter((w) => !enabledIds.has(w.id))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = enabled.findIndex((e) => e.id === active.id)
    const newIndex = enabled.findIndex((e) => e.id === over.id)
    const reordered = arrayMove(enabled, oldIndex, newIndex)
    const rest = config.filter((e) => !e.enabled || !widgetById(e.id))
    onChange([...reordered, ...rest])
  }

  const addWidget = (id: string) => {
    const existing = config.find((e) => e.id === id)
    const newEntry: DashboardWidgetEntry = existing ? { ...existing, enabled: true } : { id, enabled: true }
    const rest = config.filter((e) => e.id !== id)
    onChange([...enabled, newEntry, ...rest.filter((e) => !e.enabled)])
    setShowAdd(false)
  }

  const removeWidget = (id: string) => {
    onChange(config.map((e) => (e.id === id ? { ...e, enabled: false } : e)))
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-t-2xl border-t"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border-l)',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-lg font-bold">Editar Dashboard</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center justify-center rounded-lg p-1.5"
              style={{ background: 'var(--primary)' }}
              aria-label="Adicionar widget"
            >
              <Plus size={18} color="#fff" />
            </button>
            <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
              ×
            </button>
          </div>
        </div>
        <p className="px-5 pb-3 text-xs" style={{ color: 'var(--muted)' }}>
          Arraste pra reordenar. Cards compactos aparecem lado a lado no dashboard.
          A escolha é salva automaticamente.
        </p>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {showAdd && (
            <AddWidgetPicker available={available} onAdd={addWidget} onClose={() => setShowAdd(false)} />
          )}

          {enabled.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Nenhum widget no dashboard. Toque em + pra adicionar.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={enabled.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
                  {enabled.map((entry) => (
                    <SortableRow key={entry.id} entry={entry} onRemove={() => removeWidget(entry.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )
}
