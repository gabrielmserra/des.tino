import { widgetById } from '../lib/dashboardWidgets'
import type { DashboardWidgetEntry } from '../lib/types'

type Props = {
  config: DashboardWidgetEntry[]
  onChange: (config: DashboardWidgetEntry[]) => void
  onClose: () => void
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
          Escolha quais cards aparecem e em que ordem. A escolha é salva automaticamente.
        </p>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="flex flex-col gap-2">
            {config.map((entry, i) => {
              const widget = widgetById(entry.id)
              if (!widget) return null
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-xl border p-2.5"
                  style={{ background: 'var(--card2)', borderColor: 'var(--border-l)' }}
                >
                  <div className="flex flex-col">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="disabled:opacity-25"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Mover para cima"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === config.length - 1}
                      className="disabled:opacity-25"
                      style={{ color: 'var(--muted)' }}
                      aria-label="Mover para baixo"
                    >
                      ▼
                    </button>
                  </div>
                  <span
                    className="flex-1 text-sm font-semibold"
                    style={{ color: entry.enabled ? 'var(--text)' : 'var(--muted)' }}
                  >
                    {widget.label}
                  </span>
                  <button
                    onClick={() => toggle(i)}
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
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
