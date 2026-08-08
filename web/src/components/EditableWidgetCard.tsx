import { GripVertical, X } from 'lucide-react'
import { useSortable, defaultAnimateLayoutChanges, type AnimateLayoutChanges } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { WidgetDef } from '../lib/dashboardWidgets'

// Anima o reflow mesmo quando a mudança não veio de um arrasto ativo (ex:
// remover/adicionar um widget também desliza os vizinhos suavemente).
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true })

export function EditableWidgetCard({
  widget, onRemove, removing, entering,
}: {
  widget: WidgetDef
  onRemove: () => void
  removing?: boolean
  entering?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    animateLayoutChanges,
  })

  return (
    <div
      ref={setNodeRef}
      className={
        (widget.size === 'full' ? 'relative col-span-2' : 'relative col-span-1') +
        (entering ? ' widget-enter' : '') +
        (removing ? ' widget-exit' : '')
      }
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? 'transform 250ms cubic-bezier(0.2, 0, 0, 1)',
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      {/* Conteúdo real do widget, desarmado (links/botões internos não recebem clique
          enquanto em modo de edição) — evita ter que mexer em cada um dos widgets. */}
      <div
        style={{
          pointerEvents: 'none',
          opacity: isDragging ? 0.3 : 0.85,
          borderRadius: 16,
          outlineStyle: 'dashed',
          outlineWidth: 2,
          outlineOffset: 2,
          outlineColor: isDragging ? 'var(--primary)' : 'var(--border-l)',
          transition: 'opacity 150ms ease, outline-color 150ms ease',
        }}
      >
        <widget.Component />
      </div>

      {/* O grip continua no DOM e com os listeners mesmo durante o arrasto (o
          PointerSensor mantém a captura do ponteiro nele) — só fica invisível
          pra não duplicar visualmente com o clone flutuante do DragOverlay. */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 flex h-7 w-7 touch-none cursor-grab items-center justify-center rounded-full transition-[transform,opacity] active:scale-110 active:cursor-grabbing"
        style={{
          background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border-l)',
          opacity: isDragging ? 0 : 1,
        }}
        aria-label={`Arrastar ${widget.label}`}
      >
        <GripVertical size={15} />
      </button>
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-[transform,opacity] active:scale-90"
        style={{
          background: 'var(--red)', color: '#fff',
          opacity: isDragging ? 0 : 1,
          pointerEvents: isDragging ? 'none' : undefined,
        }}
        aria-label={`Remover ${widget.label}`}
      >
        <X size={15} />
      </button>
    </div>
  )
}
