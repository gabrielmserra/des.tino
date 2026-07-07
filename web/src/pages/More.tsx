import { Link } from 'react-router-dom'
import { TrendingUp, Target, Upload, ChevronRight } from 'lucide-react'

const ITEMS = [
  { to: '/investimentos', icon: TrendingUp, label: 'Investimentos', desc: 'Aportes, saques e histórico' },
  { to: '/metas', icon: Target, label: 'Metas de poupança', desc: 'Crie e acompanhe suas metas' },
  { to: '/importar', icon: Upload, label: 'Importar extrato', desc: 'Banco Inter — OFX, CSV ou PDF' },
]

export function More() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Mais</h1>
      <div className="flex flex-col gap-2">
        {ITEMS.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-2xl border p-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--card2)' }}
            >
              <Icon size={20} strokeWidth={2} color="var(--primary)" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{label}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {desc}
              </p>
            </div>
            <ChevronRight size={18} color="var(--muted)" />
          </Link>
        ))}
      </div>
    </div>
  )
}
