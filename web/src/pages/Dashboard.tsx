import { useAuth } from '../lib/auth'

// Placeholder da Fase 0 — a Fase 1 traz KPIs, gráfico e lista de lançamentos.
export function Dashboard() {
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''

  return (
    <div className="flex min-h-full flex-col p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          des<span style={{ color: 'var(--primary)' }}>.</span>tino
        </h1>
        <button
          onClick={() => signOut()}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Sair
        </button>
      </header>

      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Conectado como
        </p>
        <p className="text-lg font-semibold">{email}</p>
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
          ✅ Login funcionando e vinculado ao mesmo Supabase do app. O dashboard
          com saldo, KPIs e lançamentos chega na Fase 1.
        </p>
      </div>
    </div>
  )
}
