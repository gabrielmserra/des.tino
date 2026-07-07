import { THEME_NAMES, type ThemeName } from '../lib/theme'
import { THEMES } from '../lib/themes'

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

type Props = {
  current: ThemeName
  onClose: () => void
  onSelect: (name: ThemeName) => void
}

export function ThemeDialog({ current, onClose, onSelect }: Props) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Escolher tema</h2>
      <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        A escolha é salva automaticamente e vale pro desktop também.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {THEME_NAMES.map((name) => {
          const t = THEMES[name]
          const active = name === current
          return (
            <button
              key={name}
              onClick={() => {
                onSelect(name)
                onClose()
              }}
              className="flex flex-col items-center gap-2 rounded-xl border p-3"
              style={{
                background: active ? 'var(--card2)' : 'transparent',
                borderColor: active ? t.primary : 'var(--border-l)',
                borderWidth: active ? 2 : 1,
              }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full border-2"
                style={{ background: t.bg, borderColor: t.primary }}
              >
                <span className="h-[18px] w-[18px] rounded-full" style={{ background: t.primary }} />
              </span>
              <span className="text-xs font-semibold" style={{ color: active ? t.primary : 'var(--muted)' }}>
                {name}
              </span>
            </button>
          )
        })}
      </div>
      <button
        onClick={onClose}
        className="mt-4 w-full rounded-lg py-3 text-sm font-semibold"
        style={{ color: 'var(--muted)' }}
      >
        Fechar
      </button>
    </Sheet>
  )
}
