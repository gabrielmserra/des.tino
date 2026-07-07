import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useMonths } from '../lib/month'
import {
  fetchMonthSummary,
  fetchExpensesByCategory,
  fetchExpensesByPaymentMethod,
  fetchBenefitTotal,
  fetchTotalInvestments,
  fetchGoals,
} from '../lib/api'
import { formatCurrency, todayLabel } from '../lib/format'
import { PAYMENT_METHODS } from '../lib/constants'
import { DashboardSkeleton } from '../components/Skeleton'

const PIE_COLORS = [
  '#E05252', '#F5A623', '#9B72F5', '#2EAF7D',
  '#22d3ee', '#4A9EFF', '#fb923c', '#e879f9',
]

function Kpi({ label, value, color, to }: { label: string; value: string; color: string; to?: string }) {
  const content = (
    <>
      <div className="h-1 w-8 rounded" style={{ background: color }} />
      <p className="mt-2 text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-lg font-bold" style={{ color }}>
        {value}
      </p>
    </>
  )
  const className = 'block rounded-2xl border p-4'
  const style = { background: 'var(--card)', borderColor: 'var(--border)' }
  return to ? (
    <Link to={to} className={className} style={style}>
      {content}
    </Link>
  ) : (
    <div className={className} style={style}>
      {content}
    </div>
  )
}

function GoalsCard() {
  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: fetchGoals })
  const goals = goalsQ.data ?? []
  const done = goals.filter((g) => g.target_amount > 0 && g.saved_amount >= g.target_amount).length

  return (
    <Link
      to="/metas"
      className="mb-3 block rounded-2xl border p-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold">🎯 Metas de Poupança</p>
        {goals.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {done}/{goals.length} concluída(s)
          </span>
        )}
      </div>
      {goals.length === 0 ? (
        <p className="py-2 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhuma meta criada. Toque para começar.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(1, g.saved_amount / g.target_amount) : 0
            const goalDone = pct >= 1 && g.target_amount > 0
            return (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{g.name}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: 'var(--muted)' }}>
                    {formatCurrency(g.saved_amount)} / {formatCurrency(g.target_amount)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct * 100}%`, background: goalDone ? 'var(--primary)' : 'var(--accent)' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Link>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p style={{ color: 'var(--muted)' }}>{children}</p>
    </div>
  )
}

export function Dashboard() {
  const { selectedId, selected, loading } = useMonths()

  const summary = useQuery({
    queryKey: ['summary', selectedId],
    queryFn: () => fetchMonthSummary(selectedId!),
    enabled: selectedId != null,
  })
  const cats = useQuery({
    queryKey: ['cats', selectedId],
    queryFn: () => fetchExpensesByCategory(selectedId!),
    enabled: selectedId != null,
  })
  const benefit = useQuery({ queryKey: ['benefitTotal'], queryFn: fetchBenefitTotal })
  const totalInv = useQuery({ queryKey: ['totalInv'], queryFn: fetchTotalInvestments })
  const byMethod = useQuery({
    queryKey: ['expensesByMethod', selectedId],
    queryFn: () => fetchExpensesByPaymentMethod(selectedId!),
    enabled: selectedId != null,
  })

  if (loading) return <DashboardSkeleton />
  if (selectedId == null)
    return <Centered>Nenhum período encontrado. Crie um no app desktop.</Centered>

  const s = summary.data
  const saldoColor = (s?.saldo ?? 0) >= 0 ? 'var(--primary)' : 'var(--red)'
  const val = (n: number | undefined) => (s ? formatCurrency(n ?? 0) : '…')

  const pieData = (cats.data ?? []).map((c) => ({ name: c.category, value: c.total }))
  const methodData = (byMethod.data ?? []).map((c) => ({
    name: PAYMENT_METHODS[c.category] ?? c.category,
    value: c.total,
  }))

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{selected?.name}</h1>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {todayLabel()}
        </p>
      </div>

      {/* Saldo em destaque */}
      <div
        className="mb-3 rounded-2xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
          SALDO DO MÊS
        </p>
        <p className="mt-1 text-3xl font-bold" style={{ color: saldoColor }}>
          {val(s?.saldo)}
        </p>
        {s?.has_expectations && (
          <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
            📋 Projetado com previstos: {formatCurrency(s.saldo_projetado)}
          </p>
        )}
      </div>

      {/* Grade de KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Kpi label="ENTRADAS" value={val(s?.total_entradas)} color="var(--primary)" />
        <Kpi label="SAÍDAS" value={val(s?.total_saidas)} color="var(--red)" />
        <Kpi
          label="SALDO VR/VA"
          value={benefit.data != null ? formatCurrency(benefit.data) : '…'}
          color="var(--accent)"
        />
        <Kpi label="INVESTIMENTOS MÊS" value={val(s?.total_investimentos)} color="var(--violet)" to="/investimentos" />
        <Kpi
          label="INVESTIMENTOS TOTAIS"
          value={totalInv.data != null ? formatCurrency(totalInv.data) : '…'}
          color="var(--violet)"
          to="/investimentos"
        />
      </div>

      <GoalsCard />

      {/* Gráfico de categorias */}
      <div
        className="rounded-2xl border p-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="mb-2 text-sm font-bold">Despesas por categoria</p>
        {pieData.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Nenhuma despesa registrada.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                strokeWidth={2}
                stroke="var(--card)"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{
                  background: 'var(--card2)',
                  border: '1px solid var(--border-l)',
                  borderRadius: 8,
                  color: 'var(--text)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
                formatter={(v: string) => <span style={{ color: 'var(--muted)' }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de forma de pagamento */}
      <div
        className="mt-3 rounded-2xl border p-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="mb-2 text-sm font-bold">Gastos por forma de pagamento</p>
        {methodData.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Nenhuma despesa registrada.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={methodData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                strokeWidth={2}
                stroke="var(--card)"
              >
                {methodData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{
                  background: 'var(--card2)',
                  border: '1px solid var(--border-l)',
                  borderRadius: 8,
                  color: 'var(--text)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
                formatter={(v: string) => <span style={{ color: 'var(--muted)' }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
