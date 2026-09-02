import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  CreditCard,
  HandCoins,
  TrendingUp,
  CalendarClock,
  Upload,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'

const ITEMS: { to: string; end?: boolean; icon: LucideIcon; label: string }[] = [
  { to: '/', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/lancamentos', icon: Receipt, label: 'Lançamentos' },
  { to: '/cartoes', icon: CreditCard, label: 'Cartões' },
  { to: '/planejamento', icon: ClipboardList, label: 'Planejamento' },
  { to: '/compromissos', icon: HandCoins, label: 'Compromissos' },
  { to: '/investimentos', icon: TrendingUp, label: 'Investimentos' },
  { to: '/compromissos-futuros', icon: CalendarClock, label: 'Compromissos Futuros' },
  { to: '/importar', icon: Upload, label: 'Importar Extrato' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

const STORAGE_KEY = 'sidebar_collapsed'

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar() {
  const { signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignora — só uma conveniência local
      }
      return next
    })
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r lg:flex ${collapsed ? 'w-[72px]' : 'w-56'}`}
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className={`flex items-center gap-2 px-4 pt-5 pb-4 ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
        {!collapsed && (
          <span className="text-lg font-bold">
            des<span style={{ color: 'var(--primary)' }}>.</span>tino
          </span>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}
            style={({ isActive }) => (isActive ? { background: 'var(--card2)' } : undefined)}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={2} color={isActive ? 'var(--primary)' : 'var(--muted)'} className="shrink-0" />
                {!collapsed && (
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: isActive ? 'var(--primary)' : 'var(--text)' }}
                  >
                    {label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5 pt-2">
        <button
          onClick={() => signOut()}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--muted)' }}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut size={20} strokeWidth={2} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
