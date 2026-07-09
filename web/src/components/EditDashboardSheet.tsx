import { widgetById } from '../lib/dashboardWidgets'
import type { DashboardWidgetEntry } from '../lib/types'

type Props = {
  config: DashboardWidgetEntry[]
  onChange: (config: DashboardWidgetEntry[]) => void
  onClose: () => void
}

// Linhas de prévia: espelha o agrupamento real do Dashboard (compactos
// habilitados e consecutivos ficam juntos numa grade de 2 colunas;
// desabilitados não entram na conta, mas continuam com sua própria linha
// pra dar pra reordenar/religar).
type PreviewRow = { kind: 'single'; index: number } | { kind: 'block'; indices: number[] }

function buildPreviewRows(config: DashboardWidgetEntry[]): PreviewRow[] {
  const rows: PreviewRow[] = []
  let pending: number[] = []
  const flush = () => {
    if (pending.length) rows.push({ kind: 'block', indices: pending })
    pending = []
  }
  config.forEach((entry, i) => {
    const widget = widgetById(entry.id)
    if (!widget) return
    if (!entry.enabled) {
      // Desabilitado não quebra o bloco de compactos ao redor — o
      // Dashboard real também filtra os desabilitados antes de agrupar,
      // então dois compactos "vizinhos" apesar de um desabilitado no
      // meio continuam se juntando entre si.
      rows.push({ kind: 'single', index: i })
      return
    }
    if (widget.size === 'compact') {
      pending.push(i)
    } else {
      flush()
      rows.push({ kind: 'single', index: i })
    }
  })
  flush()
  return rows
}

function EntryCard({
  entry, canUp, canDown, onMoveUp, onMoveDown, onToggle,
}: {
  entry: DashboardWidgetEntry
  canUp: boolean
  canDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggle: () => void
}) {
  const widget = widgetById(entry.id)
  if (!widget) return null
  return (
    <div
      className="flex items-center gap-2 rounded-xl border p-2.5"
      style={{ background: 'var(--card2)', borderColor: 'var(--border-l)' }}
    >
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={!canUp}
          className="disabled:opacity-25"
          style={{ color: 'var(--muted)' }}
          aria-label="Mover para cima"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canDown}
          className="disabled:opacity-25"
          style={{ color: 'var(--muted)' }}
          aria-label="Mover para baixo"
        >
          ▼
        </button>
      </div>
      <span
        className="min-w-0 flex-1 truncate text-sm font-semibold"
        style={{ color: entry.enabled ? 'var(--text)' : 'var(--muted)' }}
      >
        {widget.label}
      </span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={entry.enabled}
        className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
        style={{ background: entry.enabled ? 'var(--primary)' : 'var(--border-l)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: entry.enabled ? '18px' : '2px' }}
        />
      </button>
    </div>
  )
}

export function EditDashboardSheet({ config, onChange, onClose }: Props) {
  const toggle = (index: number) => {
    const next = config.map((e, i) => (i === index ? { ...e, enabled: !e.enabled } : e))
    onChange(next)
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= config.length) return
    const next = [...config]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const rows = buildPreviewRows(config)

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
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>
        <p className="px-5 pb-3 text-xs" style={{ color: 'var(--muted)' }}>
          Escolha quais cards aparecem e em que ordem. Cards lado a lado aparecem
          juntos no dashboard. A escolha é salva automaticamente.
        </p>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="flex flex-col gap-2">
            {rows.map((row, ri) =>
              row.kind === 'single' ? (
                <EntryCard
                  key={config[row.index].id}
                  entry={config[row.index]}
                  canUp={row.index > 0}
                  canDown={row.index < config.length - 1}
                  onMoveUp={() => move(row.index, -1)}
                  onMoveDown={() => move(row.index, 1)}
                  onToggle={() => toggle(row.index)}
                />
              ) : (
                <div key={ri} className="grid grid-cols-2 gap-2">
                  {row.indices.map((idx) => (
                    <EntryCard
                      key={config[idx].id}
                      entry={config[idx]}
                      canUp={idx > 0}
                      canDown={idx < config.length - 1}
                      onMoveUp={() => move(idx, -1)}
                      onMoveDown={() => move(idx, 1)}
                      onToggle={() => toggle(idx)}
                    />
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
