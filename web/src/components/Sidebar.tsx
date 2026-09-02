import { NavLink } from 'react-router-dom'
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
  { to: '/compromissos-futuros', icon: CalendarClock, label: 'Resumo dos\nCompromissos' },
  { to: '/importar', icon: Upload, label: 'Importar Extrato' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export const SIDEBAR_STORAGE_KEY = 'sidebar_collapsed'

export function getInitialSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Rótulo com fade + encolhimento suave (em vez de sumir na hora) ao recolher.
// whitespace-nowrap é FIXO (nunca alterna com o estado collapsed): a
// quebra em 2 linhas de "Resumo dos Compromissos" é manual (ver LabelText),
// não por wrap automático. Alternar whitespace normal/nowrap durante a
// transição de largura causava um "pulo": white-space muda instantaneamente
// no início da animação (é uma propriedade discreta, não interpolável),
// então por uma fração de segundo o texto ficava com whitespace:normal e
// max-width ainda quase 0 — quebrando em 3 linhas até a largura crescer o
// suficiente pra caber em 2, empurrando os itens de baixo temporariamente.
function FadeLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap text-sm font-semibold leading-tight transition-all duration-200 ease-in-out ${
        collapsed ? 'max-w-0 opacity-0' : 'max-w-[170px] opacity-100'
      }`}
    >
      {children}
    </span>
  )
}

// Quebra manual de linha via "\n" no label (ver "Resumo dos\nCompromissos"
// em ITEMS) — cada linha vira um bloco próprio, independente de wrap
// automático por largura (ver comentário em FadeLabel).
function LabelText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { signOut } = useAuth()

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-in-out lg:flex ${
        collapsed ? 'w-[72px]' : 'w-56'
      }`}
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className={`flex items-center gap-2 px-4 pt-5 pb-4 ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
        <span
          className={`overflow-hidden whitespace-nowrap text-lg font-bold transition-all duration-200 ease-in-out ${
            collapsed ? 'max-w-0 opacity-0' : 'max-w-[140px] opacity-100'
          }`}
        >
          des<span style={{ color: 'var(--primary)' }}>.</span>tino
        </span>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3">
        {ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={`flex items-center rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center gap-0' : 'gap-3'}`}
            style={({ isActive }) => (isActive ? { background: 'var(--card2)' } : undefined)}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={2} color={isActive ? 'var(--primary)' : 'var(--muted)'} className="shrink-0" />
                <FadeLabel collapsed={collapsed}>
                  <span style={{ color: isActive ? 'var(--primary)' : 'var(--text)' }}>
                    <LabelText text={label} />
                  </span>
                </FadeLabel>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5 pt-2">
        <button
          onClick={() => signOut()}
          className={`flex w-full items-center rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center gap-0' : 'gap-3'}`}
          style={{ color: 'var(--muted)' }}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut size={20} strokeWidth={2} className="shrink-0" />
          <FadeLabel collapsed={collapsed}>Sair</FadeLabel>
        </button>
      </div>
    </aside>
  )
}
