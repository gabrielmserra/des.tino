import { useState, type ComponentType } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip, Legend, LabelList,
} from 'recharts'
import { useMonths } from './month'
import {
  fetchMonthSummary,
  fetchMonthSummaryHistory,
  fetchExpensesByCategory,
  fetchExpensesByPaymentMethod,
  fetchBenefitTotal,
  fetchTotalInvestments,
  fetchGoals,
  fetchInvestments,
  fetchCardsOverview,
  payCardBill,
} from './api'
import { formatCurrency } from './format'
import { PAYMENT_METHODS } from './constants'
import { buildTips } from './tips'
import { safetyMessage } from '../pages/Cards'

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
  const saldoColor = (s?.saldo ?? 0) >= 0 ? 'var(--primary)' : 'var(--red)'
  const val = (n: number | undefined) => (s ? formatCurrency(n ?? 0) : '…')
  return (
    <div className="rounded-2xl border p-5" style={CARD_STYLE}>
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
  const done = goals.filter((g) => g.target_amount > 0 && g.saved_amount >= g.target_amount).length

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

// ── Gráfico de pizza genérico (categoria / forma de pagamento) ────────
function PieWidget({ title, empty, data }: { title: string; empty: string; data: { name: string; value: number }[] }) {
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
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} strokeWidth={2} stroke="var(--card)">
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
              formatter={(v: string) => <span style={{ color: 'var(--muted)' }}>{v}</span>}
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
              formatter={(v) => formatCurrency(Number(v))}
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

// ── Registro ─────────────────────────────────────────────────────────
export type WidgetSize = 'compact' | 'full'

export type WidgetDef = {
  id: string
  label: string
  size: WidgetSize
  Component: ComponentType
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: 'saldo_mes', label: 'Saldo do mês (destaque)', size: 'full', Component: SaldoMesWidget },
  { id: 'kpi_entradas', label: 'Entradas', size: 'compact', Component: KpiEntradasWidget },
  { id: 'kpi_saidas', label: 'Saídas', size: 'compact', Component: KpiSaidasWidget },
  { id: 'kpi_saldo_vrva', label: 'Saldo VR/VA', size: 'compact', Component: KpiSaldoVrVaWidget },
  { id: 'kpi_investimentos_mes', label: 'Investimentos do mês', size: 'compact', Component: KpiInvestimentosMesWidget },
  { id: 'kpi_investimentos_total', label: 'Investimentos totais', size: 'compact', Component: KpiInvestimentosTotalWidget },
  { id: 'chart_categoria', label: 'Despesas por categoria', size: 'full', Component: ChartCategoriaWidget },
  { id: 'chart_forma_pagamento', label: 'Gastos por forma de pagamento', size: 'full', Component: ChartFormaPagamentoWidget },
  { id: 'chart_entradas_saidas_investimentos', label: 'Entradas vs Saídas vs Investimentos', size: 'full', Component: ChartEntradasSaidasInvestimentosWidget },
  { id: 'taxa_poupanca', label: 'Taxa de poupança', size: 'full', Component: TaxaPoupancaWidget },
  { id: 'metas', label: 'Metas de poupança', size: 'full', Component: MetasWidget },
  { id: 'cartoes_situacao', label: 'Situação dos cartões', size: 'full', Component: CartoesSituacaoWidget },
  { id: 'guru_financeiro', label: 'Guru Financeiro (dicas)', size: 'full', Component: GuruFinanceiroWidget },
]

export const DEFAULT_WIDGET_ORDER: string[] = WIDGET_REGISTRY.map((w) => w.id)

export function widgetById(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id)
}
