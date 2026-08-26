import { useState, type ComponentType } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  ResponsiveContainer, Tooltip, Legend, LabelList, ReferenceLine,
} from 'recharts'
import { useMonths } from './month'
import {
  fetchMonthSummary,
  fetchMonthSummaryHistory,
  fetchMonthSeries,
  fetchExpensesByCategory,
  fetchExpensesByPaymentMethod,
  fetchBenefitTotal,
  fetchPendingFixedBillsTotal,
  ensureFixedBillInstances,
  fetchFixedBills,
  fetchFixedBillInstances,
  fetchTotalInvestments,
  fetchGoals,
  fetchInvestments,
  fetchCardsOverview,
  fetchTransactions,
  fetchDailySpending,
  payCardBill,
  type MonthSeriesPoint,
} from './api'
import { formatCurrency, MONTHS_PT } from './format'
import { PAYMENT_METHODS } from './constants'
import { buildTips } from './tips'
import { safetyMessage } from '../pages/Cards'
import type { Month } from './types'

function monthShortLabel(m: Month): string {
  return `${MONTHS_PT[m.month - 1].slice(0, 3)}/${String(m.year).slice(2)}`
}

function useMonthSeries(n = 6) {
  const { months, selected, selectedId } = useMonths()
  return useQuery({
    queryKey: ['monthSeries', selectedId, n],
    queryFn: () => fetchMonthSeries(months, selected!, n),
    enabled: selectedId != null && !!selected,
  })
}

export const PIE_COLORS = [
  '#E05252', '#F5A623', '#9B72F5', '#2EAF7D',
  '#22d3ee', '#4A9EFF', '#fb923c', '#e879f9',
]

const CARD_STYLE = { background: 'var(--card)', borderColor: 'var(--border)' }

function useSummary() {
  const { selectedId } = useMonths()
  return useQuery({
    queryKey: ['summary', selectedId],
    queryFn: () => fetchMonthSummary(selectedId!),
    enabled: selectedId != null,
  })
}

export function Kpi({ label, value, color, to }: { label: string; value: string; color: string; to?: string }) {
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
  return to ? (
    <Link to={to} className={className} style={CARD_STYLE}>
      {content}
    </Link>
  ) : (
    <div className={className} style={CARD_STYLE}>
      {content}
    </div>
  )
}

// ── Saldo do mês (destaque) ───────────────────────────────────────────
function SaldoMesWidget() {
  const summary = useSummary()
  const s = summary.data
  const saldoColor = (s?.saldo_acumulado ?? 0) >= 0 ? 'var(--primary)' : 'var(--red)'
  const deltaColor = (s?.saldo ?? 0) >= 0 ? 'var(--primary)' : 'var(--red)'
  const val = (n: number | undefined) => (s ? formatCurrency(n ?? 0) : '…')
  return (
    <div className="rounded-2xl border p-5" style={CARD_STYLE}>
      <p className="text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
        SALDO ACUMULADO
      </p>
      <p className="mt-1 text-3xl font-bold" style={{ color: saldoColor }}>
        {val(s?.saldo_acumulado)}
      </p>
      {s && (
        <p className="mt-1 text-xs font-semibold" style={{ color: deltaColor }}>
          {s.saldo >= 0 ? '+' : ''}
          {formatCurrency(s.saldo)} esse mês
        </p>
      )}
      {s?.has_expectations && (
        <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
          📋 Projetado com previstos: {formatCurrency(s.saldo_projetado)}
        </p>
      )}
    </div>
  )
}

// ── KPIs individuais ──────────────────────────────────────────────────
function KpiEntradasWidget() {
  const summary = useSummary()
  const s = summary.data
  return <Kpi label="ENTRADAS" value={s ? formatCurrency(s.total_entradas) : '…'} color="var(--primary)" />
}

function KpiSaidasWidget() {
  const summary = useSummary()
  const s = summary.data
  return <Kpi label="SAÍDAS" value={s ? formatCurrency(s.total_saidas) : '…'} color="var(--red)" />
}

function KpiSaldoVrVaWidget() {
  const benefit = useQuery({ queryKey: ['benefitTotal'], queryFn: fetchBenefitTotal })
  return (
    <Kpi
      label="SALDO VR/VA"
      value={benefit.data != null ? formatCurrency(benefit.data) : '…'}
      color="var(--accent)"
    />
  )
}

function KpiSaldoAposContasWidget() {
  // Contas Fixas usa o calendário REAL (hoje), não o mês de cobrança que o
  // dia de corte da importação desloca — vencimento é uma data real.
  const summary = useSummary()
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  const ensureQ = useQuery({
    queryKey: ['ensureFixedBillInstances', year, month],
    queryFn: () => ensureFixedBillInstances(year, month),
  })
  const pending = useQuery({
    queryKey: ['pendingFixedBills', year, month],
    queryFn: () => fetchPendingFixedBillsTotal(year, month),
    enabled: ensureQ.isSuccess,
  })
  const billsQ = useQuery({ queryKey: ['fixedBills'], queryFn: fetchFixedBills, enabled: ensureQ.isSuccess })
  const instQ = useQuery({ queryKey: ['fixedBillInstances'], queryFn: fetchFixedBillInstances, enabled: ensureQ.isSuccess })

  const ready = summary.data != null && pending.data != null
  const value = ready ? summary.data!.saldo_acumulado - (pending.data ?? 0) : null
  const color = value != null && value < 0 ? 'var(--red)' : 'var(--accent)'

  let warning = ''
  if (billsQ.data && instQ.data) {
    const billsById = new Map(billsQ.data.map((b) => [b.id, b]))
    const overdue = instQ.data
      .filter((i) => i.due_year === year && i.due_month === month && !i.paid_at)
      .map((i) => billsById.get(i.bill_id))
      .filter((b): b is NonNullable<typeof b> => b != null && b.due_day < today.getDate())
    if (overdue.length === 1) warning = `⚠ ${overdue[0].name} venceu dia ${overdue[0].due_day}`
    else if (overdue.length > 1) warning = `⚠ ${overdue.length} contas venceram`
  }

  // Layout próprio (não o <Kpi> compartilhado, usado por todos os outros
  // KPIs compactos) — reserva uma linha pequena e sempre presente pro
  // aviso, sem crescer o card quando não há vencimento.
  return (
    <div className="rounded-2xl border p-4" style={{ ...CARD_STYLE, paddingBottom: 8 }}>
      <div className="h-1 w-8 rounded" style={{ background: color }} />
      <p className="mt-2 text-[10px] font-bold" style={{ color: 'var(--muted)' }}>SALDO APÓS CONTAS</p>
      <p className="mt-1 text-lg font-bold" style={{ color }}>
        {value != null ? formatCurrency(value) : '…'}
      </p>
      <p className="truncate text-[9px] font-bold" style={{ color: 'var(--red)', lineHeight: '11px', height: '11px' }}>
        {warning}
      </p>
    </div>
  )
}

function KpiInvestimentosMesWidget() {
  const summary = useSummary()
  const s = summary.data
  return (
    <Kpi
      label="INVESTIMENTOS MÊS"
      value={s ? formatCurrency(s.total_investimentos) : '…'}
      color="var(--violet)"
      to="/investimentos"
    />
  )
}

function KpiInvestimentosTotalWidget() {
  const totalInv = useQuery({ queryKey: ['totalInv'], queryFn: fetchTotalInvestments })
  return (
    <Kpi
      label="INVESTIMENTOS TOTAIS"
      value={totalInv.data != null ? formatCurrency(totalInv.data) : '…'}
      color="var(--violet)"
      to="/investimentos"
    />
  )
}

// ── Metas de poupança ──────────────────────────────────────────────────
function MetasWidget() {
  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: fetchGoals })
  const goals = goalsQ.data ?? []
  const done = goals.filter((g) => (g.target_amount ?? 0) > 0 && g.saved_amount >= g.target_amount!).length

  return (
    <Link to="/metas" className="block rounded-2xl border p-4" style={CARD_STYLE}>
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
            const hasTarget = g.target_amount != null && g.target_amount > 0
            const pct = hasTarget ? Math.min(1, g.saved_amount / g.target_amount!) : 0
            const goalDone = hasTarget && pct >= 1
            return (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{g.name}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: 'var(--muted)' }}>
                    {hasTarget
                      ? `${formatCurrency(g.saved_amount)} / ${formatCurrency(g.target_amount!)}`
                      : formatCurrency(g.saved_amount)}
                  </span>
                </div>
                {hasTarget && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, background: goalDone ? 'var(--primary)' : 'var(--accent)' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Link>
  )
}

// ── Gráfico de pizza genérico (categoria / forma de pagamento) ────────
function PieWidget({ title, empty, data }: { title: string; empty: string; data: { name: string; value: number }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  // Fatias pequenas (<4%) não mostram o rótulo dentro do gráfico pra não
  // sobrepor — a % de cada uma continua na legenda, igual no desktop.
  const renderLabel = (p: { percent?: number }) =>
    (p.percent ?? 0) >= 0.04 ? `${((p.percent ?? 0) * 100).toFixed(1)}%` : ''
  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">{title}</p>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          {empty}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
              strokeWidth={2} stroke="var(--card)"
              label={renderLabel}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => formatCurrency(Number(v))}
              contentStyle={{ background: 'var(--card2)', border: '1px solid var(--border-l)', borderRadius: 8, color: 'var(--text)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
              formatter={(v: string, entry) => {
                const val = Number((entry?.payload as { value?: number } | undefined)?.value ?? 0)
                return (
                  <span style={{ color: 'var(--muted)' }}>
                    {v} · {((val / total) * 100).toFixed(1)}%
                  </span>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function ChartCategoriaWidget() {
  const { selectedId } = useMonths()
  const cats = useQuery({
    queryKey: ['cats', selectedId],
    queryFn: () => fetchExpensesByCategory(selectedId!),
    enabled: selectedId != null,
  })
  const data = (cats.data ?? []).map((c) => ({ name: c.category, value: c.total }))
  return <PieWidget title="Despesas por categoria" empty="Nenhuma despesa registrada." data={data} />
}

function ChartFormaPagamentoWidget() {
  const { selectedId } = useMonths()
  const byMethod = useQuery({
    queryKey: ['expensesByMethod', selectedId],
    queryFn: () => fetchExpensesByPaymentMethod(selectedId!),
    enabled: selectedId != null,
  })
  const data = (byMethod.data ?? []).map((c) => ({ name: PAYMENT_METHODS[c.category] ?? c.category, value: c.total }))
  return <PieWidget title="Gastos por forma de pagamento" empty="Nenhuma despesa registrada." data={data} />
}

// ── Entradas vs Saídas vs Investimentos ────────────────────────────────
function ChartEntradasSaidasInvestimentosWidget() {
  const summary = useSummary()
  const s = summary.data
  const data = [
    { name: 'Entradas', value: s?.total_entradas ?? 0, color: 'var(--primary)' },
    { name: 'Saídas', value: s?.total_saidas ?? 0, color: 'var(--red)' },
    { name: 'Investimentos', value: s?.total_investimentos ?? 0, color: 'var(--violet)' },
  ]
  const hasData = data.some((d) => d.value > 0)
  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">Entradas vs Saídas vs Investimentos</p>
      {!hasData ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum lançamento neste mês.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v, _n, p) => [formatCurrency(Number(v)), p?.payload?.name ?? '']}
              contentStyle={{ background: 'var(--card2)', border: '1px solid var(--border-l)', borderRadius: 8, color: 'var(--text)' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="value" position="top" formatter={(v: unknown) => formatCurrency(Number(v))} fill="var(--text)" fontSize={11} fontWeight="bold" />
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Taxa de poupança ────────────────────────────────────────────────────
function TaxaPoupancaWidget() {
  const summary = useSummary()
  const s = summary.data
  const entradas = s?.total_entradas ?? 0
  const saldo = s?.saldo ?? 0
  const pct = entradas > 0 ? Math.max(0, Math.min(1, saldo / entradas)) : 0
  const pctTxt = entradas > 0 ? `${(pct * 100).toFixed(1)}%` : '—'
  // pct já é clampado >= 0 acima, então (igual ao desktop) a cor só alterna
  // entre primary/accent — nunca red.
  const color = pct >= 0.1 ? 'var(--primary)' : 'var(--accent)'

  return (
    <div className="flex items-center gap-3 rounded-2xl border p-4" style={CARD_STYLE}>
      <span className="shrink-0 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
        Taxa de poupança:
      </span>
      <span className="shrink-0 text-sm font-bold" style={{ color }}>
        {pctTxt}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <span className="shrink-0 text-[11px]" style={{ color: 'var(--muted)' }}>
        {formatCurrency(saldo)} de {formatCurrency(entradas)}
      </span>
    </div>
  )
}

// ── Situação dos cartões (versão compacta, reaproveita Cards.tsx) ─────
function CartoesSituacaoWidget() {
  const { selectedId } = useMonths()
  const qc = useQueryClient()
  const [payBusy, setPayBusy] = useState<number | null>(null)
  const cardsQ = useQuery({
    queryKey: ['cardsOverview', selectedId],
    queryFn: () => fetchCardsOverview(selectedId!),
    enabled: selectedId != null,
  })
  const cards = cardsQ.data ?? []

  const pay = async (cardId: number, unpaid: number, name: string) => {
    if (!selectedId) return
    if (!confirm(`Pagar a fatura de ${formatCurrency(unpaid)} do cartão ${name}?`)) return
    setPayBusy(cardId)
    try {
      await payCardBill(cardId, selectedId)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cardsOverview'] }),
        qc.invalidateQueries({ queryKey: ['summary'] }),
        qc.invalidateQueries({ queryKey: ['cats'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
      ])
    } finally {
      setPayBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">💳 Situação dos Cartões</p>
      {cards.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum cartão de crédito cadastrado.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cards.map((c) => {
            const safety = safetyMessage(c)
            return (
              <div key={c.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-l)' }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-sm font-bold">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: safety.color }}>
                    {safety.text}
                  </span>
                </div>
                {c.unpaid > 0 ? (
                  <button
                    onClick={() => pay(c.id, c.unpaid, c.name)}
                    disabled={payBusy === c.id}
                    className="mt-1 w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-60"
                    style={{ background: 'var(--primary)' }}
                  >
                    {payBusy === c.id ? 'Pagando…' : `Pagar fatura (${formatCurrency(c.unpaid)})`}
                  </button>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    ✓ Fatura em dia
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Guru Financeiro (dicas) ────────────────────────────────────────────
function GuruFinanceiroWidget() {
  const { months, selected, selectedId } = useMonths()
  const summary = useSummary()
  const goalsQ = useQuery({ queryKey: ['goals'], queryFn: fetchGoals })
  const catsQ = useQuery({
    queryKey: ['cats', selectedId],
    queryFn: () => fetchExpensesByCategory(selectedId!),
    enabled: selectedId != null,
  })
  const historyQ = useQuery({
    queryKey: ['summaryHistory', selectedId],
    queryFn: () => fetchMonthSummaryHistory(months, selected!),
    enabled: selectedId != null && !!selected,
  })
  const investmentsQ = useQuery({ queryKey: ['investments'], queryFn: () => fetchInvestments() })
  const totalInvQ = useQuery({ queryKey: ['totalInv'], queryFn: fetchTotalInvestments })
  const cardsQ = useQuery({
    queryKey: ['cardsOverview', selectedId],
    queryFn: () => fetchCardsOverview(selectedId!),
    enabled: selectedId != null,
  })

  const ready = summary.data && goalsQ.data && catsQ.data && historyQ.data && investmentsQ.data && totalInvQ.data != null && cardsQ.data

  const TONE_COLOR: Record<string, string> = {
    red: 'var(--red)',
    gold: 'var(--accent)',
    green: 'var(--primary)',
    blue: 'var(--violet)',
  }

  const tips = ready
    ? buildTips(summary.data!, {
        goals: goalsQ.data,
        categories: catsQ.data,
        history: historyQ.data,
        investments: investmentsQ.data,
        totalInv: totalInvQ.data ?? 0,
        unpaidCards: (cardsQ.data ?? []).reduce((a, c) => a + c.unpaid, 0),
      })
    : []

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">🧭 Guru Financeiro</p>
      {!ready ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : tips.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Sem dicas por enquanto — volte quando houver lançamentos neste mês.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tips.map((tip, i) => (
            <div
              key={i}
              className="rounded-xl border-l-4 p-3"
              style={{ background: 'var(--card2)', borderColor: TONE_COLOR[tip.tone] }}
            >
              <p className="text-xs font-bold" style={{ color: TONE_COLOR[tip.tone] }}>
                {tip.icon} {tip.title}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                {tip.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Evolução do saldo (últimos 6 meses) ────────────────────────────────
function SaldoEvolucaoWidget() {
  const seriesQ = useMonthSeries(6)
  const points = (seriesQ.data ?? []).map((p: MonthSeriesPoint) => ({
    name: monthShortLabel(p.month),
    value: p.summary.saldo,
  }))
  const hasData = points.length > 1 && points.some((p) => p.value !== 0)

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">Evolução do saldo</p>
      {!hasData ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Sem meses suficientes ainda para mostrar a evolução.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 30, right: 40, left: 40, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v)), 'Saldo']}
              contentStyle={{ background: 'var(--card2)', border: '1px solid var(--border-l)', borderRadius: 8, color: 'var(--text)' }}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }}
                  label={{ position: 'top', offset: 12, formatter: (v: unknown) => formatCurrency(Number(v)), fill: 'var(--text)', fontSize: 10 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Gastos dos últimos 7 dias ───────────────────────────────────────────
function GastosUltimos7DiasWidget() {
  const dailyQ = useQuery({ queryKey: ['dailySpending', 7], queryFn: () => fetchDailySpending(7) })
  const points = (dailyQ.data ?? []).map((p) => {
    const [, m, d] = p.date.split('-')
    return { name: `${d}/${m}`, value: p.total }
  })
  const hasData = points.some((p) => p.value !== 0)

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">Gastos dos últimos 7 dias</p>
      {!hasData ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum gasto nos últimos 7 dias.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 30, right: 40, left: 40, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v)), 'Gasto']}
              contentStyle={{ background: 'var(--card2)', border: '1px solid var(--border-l)', borderRadius: 8, color: 'var(--text)' }}
            />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Line type="monotone" dataKey="value" stroke="var(--red)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--red)' }} activeDot={{ r: 6 }}
                  label={{ position: 'top', offset: 12, formatter: (v: unknown) => formatCurrency(Number(v)), fill: 'var(--text)', fontSize: 10 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Gastos por categoria ao longo do tempo (últimos 6 meses) ───────────
function useCategorySeries(n = 6) {
  const { months, selected, selectedId } = useMonths()
  return useQuery({
    queryKey: ['categorySeries', selectedId, n],
    queryFn: async () => {
      const series = await fetchMonthSeries(months, selected!, n)
      const perMonth = await Promise.all(series.map((s) => fetchExpensesByCategory(s.month.id)))
      return series.map((s, i) => ({ month: s.month, categories: perMonth[i] }))
    },
    enabled: selectedId != null && !!selected,
  })
}

function ChartGastosCategoriaEvolucaoWidget() {
  const seriesQ = useCategorySeries(6)
  const rows = seriesQ.data ?? []

  const totalByCat = new Map<string, number>()
  for (const r of rows) for (const c of r.categories) totalByCat.set(c.category, (totalByCat.get(c.category) ?? 0) + c.total)
  const topCats = [...totalByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c)
  const hasOutras = rows.some((r) => r.categories.some((c) => !topCats.includes(c.category)))
  const keys = hasOutras ? [...topCats, 'Outras'] : topCats

  const data = rows.map((r) => {
    const entry: Record<string, string | number> = { name: monthShortLabel(r.month) }
    let outras = 0
    for (const c of r.categories) {
      if (topCats.includes(c.category)) entry[c.category] = (Number(entry[c.category]) || 0) + c.total
      else outras += c.total
    }
    if (hasOutras) entry['Outras'] = outras
    return entry
  })
  const hasData = data.some((d) => keys.some((k) => Number(d[k] ?? 0) > 0))

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">Gastos por categoria ao longo do tempo</p>
      {!hasData ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhuma despesa registrada nos últimos meses.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v))}
              contentStyle={{ background: 'var(--card2)', border: '1px solid var(--border-l)', borderRadius: 8, color: 'var(--text)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }}
                    formatter={(v: string) => <span style={{ color: 'var(--muted)' }}>{v}</span>} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="a" fill={PIE_COLORS[i % PIE_COLORS.length]}
                   radius={i === keys.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Maiores gastos do mês ───────────────────────────────────────────────
function MaioresGastosWidget() {
  const { selectedId } = useMonths()
  const txQ = useQuery({
    queryKey: ['transactions', selectedId],
    queryFn: () => fetchTransactions(selectedId!),
    enabled: selectedId != null,
  })
  const top = (txQ.data ?? [])
    .filter((t) => (t.type === 'saida_fixa' || t.type === 'saida_variavel') && !t.is_expectation)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">Maiores gastos do mês</p>
      {top.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum gasto registrado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {top.map((t, i) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                 style={{ background: 'var(--card2)' }}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--muted)' }}>{i + 1}º</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.description}</p>
                  <p className="truncate text-[11px]" style={{ color: 'var(--muted)' }}>{t.category ?? 'Outros'}</p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold" style={{ color: 'var(--red)' }}>
                {formatCurrency(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Evolução do patrimônio investido (últimos 6 meses) ──────────────────
function PatrimonioEvolucaoWidget() {
  const seriesQ = useMonthSeries(6)
  const totalInvQ = useQuery({ queryKey: ['totalInv'], queryFn: fetchTotalInvestments })

  const series = seriesQ.data ?? []
  const ready = series.length > 0 && totalInvQ.data != null

  // patrimônio(mês k) = total atual − soma dos aportes líquidos dos meses
  // posteriores a k (reconstrução retroativa a partir do total de hoje).
  let running = totalInvQ.data ?? 0
  const points: { name: string; value: number }[] = []
  for (let i = series.length - 1; i >= 0; i--) {
    const { month, summary } = series[i]
    points.unshift({ name: monthShortLabel(month), value: running })
    running -= summary.total_investimentos
  }
  const hasData = ready && points.length > 1

  return (
    <div className="rounded-2xl border p-4" style={CARD_STYLE}>
      <p className="mb-2 text-sm font-bold">Evolução do patrimônio investido</p>
      {!hasData ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Sem meses suficientes ainda para mostrar a evolução.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 30, right: 40, left: 40, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v)), 'Patrimônio']}
              contentStyle={{ background: 'var(--card2)', border: '1px solid var(--border-l)', borderRadius: 8, color: 'var(--text)' }}
            />
            <Line type="monotone" dataKey="value" stroke="var(--violet)" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--violet)' }} activeDot={{ r: 6 }}
                  label={{ position: 'top', offset: 12, formatter: (v: unknown) => formatCurrency(Number(v)), fill: 'var(--text)', fontSize: 10 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Registro ─────────────────────────────────────────────────────────
export type WidgetSize = 'compact' | 'full'

export type WidgetDef = {
  id: string
  label: string
  size: WidgetSize
  Component: ComponentType
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: 'saldo_mes', label: 'Saldo acumulado (destaque)', size: 'full', Component: SaldoMesWidget },
  { id: 'kpi_entradas', label: 'Entradas', size: 'compact', Component: KpiEntradasWidget },
  { id: 'kpi_saidas', label: 'Saídas', size: 'compact', Component: KpiSaidasWidget },
  { id: 'kpi_saldo_vrva', label: 'Saldo VR/VA', size: 'compact', Component: KpiSaldoVrVaWidget },
  { id: 'kpi_saldo_apos_contas', label: 'Saldo após contas em aberto', size: 'compact', Component: KpiSaldoAposContasWidget },
  { id: 'kpi_investimentos_mes', label: 'Investimentos do mês', size: 'compact', Component: KpiInvestimentosMesWidget },
  { id: 'kpi_investimentos_total', label: 'Investimentos totais', size: 'compact', Component: KpiInvestimentosTotalWidget },
  { id: 'chart_categoria', label: 'Despesas por categoria', size: 'full', Component: ChartCategoriaWidget },
  { id: 'chart_forma_pagamento', label: 'Gastos por forma de pagamento', size: 'full', Component: ChartFormaPagamentoWidget },
  { id: 'chart_entradas_saidas_investimentos', label: 'Entradas vs Saídas vs Investimentos', size: 'full', Component: ChartEntradasSaidasInvestimentosWidget },
  { id: 'taxa_poupanca', label: 'Taxa de poupança', size: 'full', Component: TaxaPoupancaWidget },
  { id: 'metas', label: 'Metas de poupança', size: 'full', Component: MetasWidget },
  { id: 'cartoes_situacao', label: 'Situação dos cartões', size: 'full', Component: CartoesSituacaoWidget },
  { id: 'guru_financeiro', label: 'Guru Financeiro (dicas)', size: 'full', Component: GuruFinanceiroWidget },
  { id: 'saldo_evolucao', label: 'Evolução do saldo (6 meses)', size: 'full', Component: SaldoEvolucaoWidget },
  { id: 'gastos_categoria_evolucao', label: 'Gastos por categoria ao longo do tempo', size: 'full', Component: ChartGastosCategoriaEvolucaoWidget },
  { id: 'maiores_gastos', label: 'Maiores gastos do mês', size: 'full', Component: MaioresGastosWidget },
  { id: 'patrimonio_evolucao', label: 'Evolução do patrimônio investido', size: 'full', Component: PatrimonioEvolucaoWidget },
  { id: 'gastos_7_dias', label: 'Gastos dos últimos 7 dias', size: 'full', Component: GastosUltimos7DiasWidget },
]

export const DEFAULT_WIDGET_ORDER: string[] = WIDGET_REGISTRY.map((w) => w.id)

export function widgetById(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id)
}
