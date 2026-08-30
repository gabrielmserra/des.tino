import { useEffect, useState } from 'react'
import { useMonths } from '../lib/month'
import {
  fetchPlan,
  fetchPlanItems,
  fetchPlanIncomeItems,
  fetchPlanRealized,
  fetchPlanHistory,
  fetchMonthIncome,
  savePlan,
  syncDebtsIntoPlan,
} from '../lib/api'
import { suggestAllocations, estimateIncome, INVESTMENT_CAP_PCT } from '../lib/planStrategy'
import { PLAN_CATEGORIES } from '../lib/constants'
import { formatCurrency } from '../lib/format'
import { IncomeDialog } from '../components/IncomeDialog'
import type { Plan, PlanItem, PlanItemInput, PlanIncomeItem, PlanIncomeItemInput } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

function toInput(n: number): string {
  return n > 0 ? String(n).replace('.', ',') : ''
}

type ReviewRow = {
  category: string
  planned: string
  suggested: number | null
  eventual: boolean
  mandatory: boolean
  capped: boolean
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'review'; incomeItems: PlanIncomeItemInput[]; rows: ReviewRow[]; nHist: number }
  | {
      kind: 'tracking'
      plan: Plan
      items: PlanItem[]
      incomeItems: PlanIncomeItem[]
      realized: Record<string, number>
      synced: boolean
    }

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <p style={{ color: 'var(--muted)' }}>{children}</p>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

export function Planning() {
  const { months, selectedId, selected, loading: monthsLoading } = useMonths()
  const [view, setView] = useState<ViewState>({ kind: 'loading' })
  const [showIncomeDialog, setShowIncomeDialog] = useState<{ suggested: number } | null>(null)
  const [editingIncome, setEditingIncome] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (selectedId != null) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  async function load() {
    if (selectedId == null) return
    setView({ kind: 'loading' })
    setError('')
    let synced = false
    try {
      synced = await syncDebtsIntoPlan(selectedId)
    } catch {
      // segue mesmo se a sincronização falhar (ex: sem dívidas cadastradas)
    }
    try {
      const plan = await fetchPlan(selectedId)
      if (!plan) {
        setView({ kind: 'empty' })
        return
      }
      const [items, incomeItems, realized] = await Promise.all([
        fetchPlanItems(plan.id),
        fetchPlanIncomeItems(plan.id),
        fetchPlanRealized(selectedId),
      ])
      setView({ kind: 'tracking', plan, items, incomeItems, realized, synced })
    } catch (e) {
      setError('Erro ao carregar: ' + (e as Error).message)
      setView({ kind: 'empty' })
    }
  }

  async function startGenerate() {
    if (selectedId == null || !selected) return
    setError('')
    try {
      const income = await fetchMonthIncome(selectedId, true)
      if (income <= 0) {
        const { incomeHistory } = await fetchPlanHistory(months, selected)
        setShowIncomeDialog({ suggested: estimateIncome(incomeHistory) })
        return
      }
      // Já tem entrada real na ledger — usa o total direto, sem perguntar,
      // guardado como item sintético pra manter o estado sempre "é uma lista".
      await generateWithIncomeItems([{ amount: income, expected_day: 1 }])
    } catch (e) {
      setError('Erro ao gerar sugestão: ' + (e as Error).message)
    }
  }

  async function generateWithIncomeItems(incomeItems: PlanIncomeItemInput[]) {
    if (selectedId == null || !selected) return
    setShowIncomeDialog(null)
    setView({ kind: 'loading' })
    const income = incomeItems.reduce((a, i) => a + i.amount, 0)
    try {
      const { expensesHistory, incomeHistory } = await fetchPlanHistory(months, selected)
      const suggestions = suggestAllocations(expensesHistory, incomeHistory, income)
      const rows: ReviewRow[] = Object.entries(suggestions)
        .map(([category, s]) => ({
          category,
          planned: toInput(s.amount),
          suggested: s.amount,
          eventual: s.eventual,
          mandatory: false,
          capped: s.capped,
        }))
        .sort((a, b) => parseAmount(b.planned) - parseAmount(a.planned))
      setView({ kind: 'review', incomeItems, rows, nHist: expensesHistory.length })
    } catch (e) {
      setError('Erro ao gerar sugestão: ' + (e as Error).message)
      setView({ kind: 'empty' })
    }
  }

  function editExisting() {
    setView((v) => {
      if (v.kind !== 'tracking') return v
      const rows: ReviewRow[] = v.items.map((it) => ({
        category: it.category,
        planned: toInput(it.planned_amount),
        suggested: it.suggested_amount,
        eventual: it.is_eventual,
        mandatory: it.is_mandatory,
        capped: false,
      }))
      const incomeItems: PlanIncomeItemInput[] = v.incomeItems.map((it) => ({
        amount: it.amount,
        expected_day: it.expected_day,
      }))
      return { kind: 'review', incomeItems, rows, nHist: -1 }
    })
  }

  if (monthsLoading || view.kind === 'loading') return <Centered>Carregando…</Centered>
  if (selectedId == null) return <Centered>Nenhum período encontrado.</Centered>

  // ── Estado 1: sem plano ────────────────────────────────────────────
  if (view.kind === 'empty') {
    return (
      <div className="p-4">
        <h1 className="mb-1 text-2xl font-bold">Planejamento</h1>
        <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
          {selected?.name}
        </p>
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="mb-2 text-4xl">📋</p>
          <p className="mb-1 font-bold">Este mês ainda não tem um plano</p>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
            Gere uma sugestão de alocação por categoria com base no seu histórico de gastos.
          </p>
          <button
            onClick={startGenerate}
            className="rounded-lg px-4 py-3 font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            ⚡ Gerar plano do mês
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}
        {showIncomeDialog && (
          <IncomeDialog
            suggested={showIncomeDialog.suggested}
            onCancel={() => generateWithIncomeItems([])}
            onConfirm={(incomeItems) => generateWithIncomeItems(incomeItems)}
          />
        )}
      </div>
    )
  }

  // ── Estado 2: revisão / edição ───────────────────────────────────────
  if (view.kind === 'review') {
    const income = view.incomeItems.reduce((a, i) => a + i.amount, 0)
    const total = view.rows.reduce((acc, r) => acc + parseAmount(r.planned), 0)
    const spare = income - total
    const investRow = view.rows.find((r) => r.category === 'Investimentos')
    const investVal = investRow ? parseAmount(investRow.planned) : 0
    const overCap = income > 0 && spare >= 0 && investVal > income * INVESTMENT_CAP_PCT

    const usedCats = new Set(view.rows.map((r) => r.category))
    const availableCats = PLAN_CATEGORIES.filter((c) => !usedCats.has(c))

    const updateRow = (idx: number, planned: string) =>
      setView((v) => {
        if (v.kind !== 'review') return v
        const rows = [...v.rows]
        rows[idx] = { ...rows[idx], planned }
        return { ...v, rows }
      })

    const removeRow = (idx: number) =>
      setView((v) => (v.kind !== 'review' ? v : { ...v, rows: v.rows.filter((_, i) => i !== idx) }))

    const addCategory = (cat: string) => {
      if (!cat) return
      setView((v) =>
        v.kind !== 'review'
          ? v
          : {
              ...v,
              rows: [
                ...v.rows,
                { category: cat, planned: '', suggested: null, eventual: false, mandatory: false, capped: false },
              ],
            },
      )
    }

    const confirm = async () => {
      if (selectedId == null) return
      setBusy(true)
      setError('')
      try {
        const items: PlanItemInput[] = view.rows.map((r) => ({
          category: r.category,
          planned_amount: parseAmount(r.planned),
          suggested_amount: r.suggested,
          is_eventual: r.eventual,
          is_mandatory: r.mandatory,
        }))
        await savePlan(selectedId, income, items, view.incomeItems)
        await load()
      } catch (e) {
        setError('Erro ao salvar: ' + (e as Error).message)
      } finally {
        setBusy(false)
      }
    }

    const updateIncomeItems = (incomeItems: PlanIncomeItemInput[]) =>
      setView((v) => (v.kind !== 'review' ? v : { ...v, incomeItems }))

    return (
      <div className="p-4 pb-8">
        <h1 className="mb-1 text-2xl font-bold">Revisão do plano</h1>
        <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
          {selected?.name}
        </p>

        <div
          className="mb-4 rounded-2xl border p-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                RENDA DO MÊS (R$)
              </p>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                {formatCurrency(income)}
              </p>
            </div>
            <button
              onClick={() => setEditingIncome(true)}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: 'var(--border-l)', color: 'var(--primary)' }}
            >
              ✎ Editar entradas
            </button>
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                TOTAL ALOCADO
              </p>
              <p className="font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(total)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>
                SOBRA
              </p>
              <p className="font-bold" style={{ color: spare < 0 ? 'var(--red)' : 'var(--primary)' }}>
                {income > 0 ? formatCurrency(spare) : '—'}
              </p>
            </div>
          </div>
          {spare < 0 && (
            <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--red)' }}>
              ⚠ O total alocado ultrapassa a renda do mês.
            </p>
          )}
          {overCap && (
            <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              ⚠ Investimentos acima do teto recomendado de {INVESTMENT_CAP_PCT * 100}% da renda
              (máx. sugerido: {formatCurrency(income * INVESTMENT_CAP_PCT)}).
            </p>
          )}
        </div>

        {view.nHist === 0 && (
          <p className="mb-3 text-xs" style={{ color: 'var(--accent)' }}>
            💡 Ainda não há histórico de gastos — monte seu plano manualmente abaixo.
          </p>
        )}
        {view.nHist >= 1 && view.nHist <= 2 && (
          <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
            Sugestão por média simples ({view.nHist} {view.nHist === 1 ? 'mês' : 'meses'} de histórico).
          </p>
        )}
        {view.nHist >= 3 && (
          <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
            Sugestão proporcional à renda (últimos 3 meses, pesos 50/30/20), com teto de 50%
            p/ Investimentos.
          </p>
        )}

        <select
          onChange={(e) => {
            addCategory(e.target.value)
            e.target.value = ''
          }}
          defaultValue=""
          className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          <option value="" disabled>
            + Adicionar categoria…
          </option>
          {availableCats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-2">
          {view.rows.map((r, idx) => (
            <div
              key={r.category}
              className="rounded-xl border p-3"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.category}</span>
                  {r.mandatory && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--card2)', color: 'var(--red)' }}
                    >
                      🔒 dívidas
                    </span>
                  )}
                  {r.eventual && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--card2)', color: 'var(--accent)' }}
                    >
                      eventual
                    </span>
                  )}
                  {r.capped && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--card2)', color: 'var(--violet)' }}
                    >
                      teto 50%
                    </span>
                  )}
                </div>
                {!r.mandatory && (
                  <button
                    onClick={() => removeRow(idx)}
                    style={{ color: 'var(--muted)' }}
                    className="text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                {r.suggested != null && r.suggested > 0 && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    sugerido: {formatCurrency(r.suggested)}
                  </span>
                )}
                <input
                  value={r.planned}
                  disabled={r.mandatory}
                  onChange={(e) => updateRow(idx, e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="ml-auto w-28 rounded-lg border px-2 py-1.5 text-right text-sm outline-none disabled:opacity-70"
                  style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={load}
            className="flex-1 rounded-lg border py-3 font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {busy ? 'Salvando…' : '✓ Confirmar plano'}
          </button>
        </div>

        {editingIncome && (
          <IncomeDialog
            items={view.incomeItems}
            onCancel={() => setEditingIncome(false)}
            onConfirm={(incomeItems) => {
              updateIncomeItems(incomeItems)
              setEditingIncome(false)
            }}
          />
        )}
      </div>
    )
  }

  // ── Estado 3: acompanhamento (plano vs. realizado) ───────────────────
  const { plan, items, realized, synced } = view
  const closed = plan.status === 'fechado'
  const income = plan.income
  const plannedTotal = items.reduce((a, i) => a + i.planned_amount, 0)
  const usedCategories = new Set(items.map((i) => i.category))
  const outOfPlan = Object.entries(realized).filter(([cat, v]) => v > 0 && !usedCategories.has(cat))
  const spentInPlan = items.reduce((a, i) => a + (realized[i.category] ?? 0), 0)
  const outOfPlanTotal = outOfPlan.reduce((a, [, v]) => a + v, 0)
  const spentTotal = spentInPlan + outOfPlanTotal

  return (
    <div className="p-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planejamento</h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {selected?.name}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: closed ? 'var(--card2)' : 'var(--primary)', color: closed ? 'var(--muted)' : '#fff' }}
        >
          {closed ? 'fechado' : 'ativo'}
        </span>
      </div>

      {synced && (
        <div
          className="mb-4 rounded-xl border p-3 text-xs font-semibold"
          style={{ background: 'var(--card2)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          🔄 O plano foi atualizado automaticamente com as dívidas deste mês.
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Kpi label="RENDA" value={formatCurrency(income)} color="var(--primary)" />
        <Kpi label="ALOCADO" value={formatCurrency(plannedTotal)} color="var(--accent)" />
        <Kpi
          label={closed ? 'GASTO FINAL' : 'GASTO ATÉ AGORA'}
          value={formatCurrency(spentTotal)}
          color="var(--red)"
        />
      </div>

      {income > 0 ? (
        <p
          className="mb-4 text-xs"
          style={{ color: income - spentTotal < 0 ? 'var(--red)' : 'var(--muted)' }}
        >
          Sobra não alocada: {formatCurrency(income - plannedTotal)} ·{' '}
          {closed ? 'Saldo final' : 'Saldo atual'}: {formatCurrency(income - spentTotal)}
        </p>
      ) : (
        <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
          Renda não informada — sobra e saldo não calculados.
        </p>
      )}

      {!closed && (
        <button
          onClick={editExisting}
          className="mb-4 w-full rounded-lg border py-2 text-sm font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          ✎ Editar plano
        </button>
      )}

      {items.length === 0 && (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Plano sem categorias. Use "Editar plano" para adicioná-las.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const spent = realized[it.category] ?? 0
          const planned = it.planned_amount
          const isInvestment = it.category === 'Investimentos'
          const pct = planned > 0 ? spent / planned : spent > 0 ? 1 : 0
          let color = 'var(--primary)'
          if (isInvestment) color = pct >= 1 ? 'var(--primary)' : 'var(--violet)'
          else if (pct >= 1) color = 'var(--red)'
          else if (pct >= 0.7) color = 'var(--accent)'
          const remaining = planned - spent

          return (
            <div
              key={it.id}
              className="rounded-xl border p-3"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{it.category}</span>
                  {it.is_mandatory && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--card2)', color: 'var(--red)' }}
                    >
                      🔒 dívidas
                    </span>
                  )}
                  {it.is_eventual && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: 'var(--card2)', color: 'var(--accent)' }}
                    >
                      eventual
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold" style={{ color }}>
                  {planned > 0 ? `${(isInvestment && pct >= 1 ? '✓ ' : pct >= 1 && !isInvestment ? '⚠ ' : '') + Math.round(pct * 100)}%` : 'sem teto'}
                </span>
              </div>
              <p className="mb-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                planejado {formatCurrency(planned)} · {isInvestment ? 'aportado' : 'gasto'}{' '}
                {formatCurrency(spent)} ·{' '}
                {remaining < 0
                  ? `${isInvestment ? 'acima do plano em' : 'excedido em'} ${formatCurrency(Math.abs(remaining))}`
                  : `${isInvestment ? 'falta aportar' : 'restante'} ${formatCurrency(remaining)}`}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(pct, 1) * 100}%`, background: color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {outOfPlan.length > 0 && (
        <div
          className="mt-4 rounded-xl border p-3"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="mb-2 text-sm font-bold" style={{ color: 'var(--violet)' }}>
            Fora do plano — {formatCurrency(outOfPlanTotal)}
          </p>
          {outOfPlan
            .sort((a, b) => b[1] - a[1])
            .map(([cat, val]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span>{cat}</span>
                <span className="font-semibold" style={{ color: 'var(--violet)' }}>
                  {formatCurrency(val)}
                </span>
              </div>
            ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
