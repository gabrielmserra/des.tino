import { Plus } from 'lucide-react'
import type { WidgetDef } from '../lib/dashboardWidgets'

export function AddWidgetPicker({
  available, onAdd, onClose,
}: {
  available: WidgetDef[]
  onAdd: (id: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-3"
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
