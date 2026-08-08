import { GripVertical, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { WidgetDef } from '../lib/dashboardWidgets'

export function EditableWidgetCard({
  widget, onRemove,
}: {
  widget: WidgetDef
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={widget.size === 'full' ? 'relative col-span-2' : 'relative col-span-1'}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {/* Conteúdo real do widget, desarmado (links/botões internos não recebem clique
          enquanto em modo de edição) — evita ter que mexer em cada um dos widgets. */}
      <div
        style={{
          pointerEvents: 'none',
          opacity: 0.85,
          borderRadius: 16,
          outlineStyle: 'dashed',
          outlineWidth: 2,
          outlineOffset: 2,
          outlineColor: 'var(--border-l)',
        }}
      >
        <widget.Component />
      </div>

      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
        style={{ background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border-l)' }}
        aria-label={`Arrastar ${widget.label}`}
      >
        <GripVertical size={15} />
      </button>
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: 'var(--red)', color: '#fff' }}
        aria-label={`Remover ${widget.label}`}
      >
        <X size={15} />
      </button>
    </div>
  )
}
