import { supabase } from './supabase'
import { DEFAULT_IMPORT_CUTOFF_DAY } from './format'
import type {
  Month,
  MonthSummary,
  CategoryTotal,
  Transaction,
  CardOverview,
  CardBasic,
  BenefitBasic,
  BenefitOverview,
  RenewalSummary,
  Plan,
  PlanItem,
  PlanItemInput,
  DebitCard,
  Debt,
  DebtInstallment,
  DebtInstallmentInput,
  DebtOverview,
  Investment,
  InvestmentMovement,
  MovementType,
  Goal,
  DashboardWidgetEntry,
} from './types'

export async function fetchMonths(): Promise<Month[]> {
  const { data, error } = await supabase
    .from('months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createMonth(name: string, year: number, month: number): Promise<number> {
  const { data, error } = await supabase.rpc('create_month', {
    p_name: name,
    p_year: year,
    p_month: month,
  })
  if (error) throw error
  return data as number
}

export async function renameMonth(id: number, name: string, year: number, month: number): Promise<void> {
  const { error } = await supabase.from('months').update({ name, year, month }).eq('id', id)
  if (error) throw error
}

export async function deleteMonth(id: number): Promise<void> {
  const { error } = await supabase.from('months').delete().eq('id', id)
  if (error) throw error
}

export async function setMonthOpeningBalance(id: number, value: number | null): Promise<void> {
  const { error } = await supabase.from('months').update({ opening_balance: value }).eq('id', id)
  if (error) throw error
}

export async function fetchTheme(): Promise<string> {
  const { data, error } = await supabase.from('user_settings').select('theme').maybeSingle()
  if (error) throw error
  return data?.theme ?? 'Esmeralda'
}

export async function saveTheme(theme: string): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({ theme }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function fetchDashboardConfig(): Promise<DashboardWidgetEntry[] | null> {
  const { data, error } = await supabase.from('user_settings').select('dashboard_widgets').maybeSingle()
  if (error) throw error
  return (data?.dashboard_widgets as DashboardWidgetEntry[] | null) ?? null
}

export async function saveDashboardConfig(config: DashboardWidgetEntry[]): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ dashboard_widgets: config }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function fetchImportCutoffDay(): Promise<number> {
  try {
    const { data, error } = await supabase.from('user_settings').select('import_cutoff_day').maybeSingle()
    if (error) throw error
    return data?.import_cutoff_day ?? DEFAULT_IMPORT_CUTOFF_DAY
  } catch {
    // Migration 018 (coluna import_cutoff_day) ainda não rodou no Supabase.
    return DEFAULT_IMPORT_CUTOFF_DAY
  }
}

export async function saveImportCutoffDay(day: number): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ import_cutoff_day: day }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function fetchMonthSummary(monthId: number): Promise<MonthSummary> {
  const { data, error } = await supabase.rpc('get_month_summary', {
    p_month_id: monthId,
  })
  if (error) throw error
  return data as MonthSummary
}

export async function fetchExpensesByCategory(
  monthId: number,
): Promise<CategoryTotal[]> {
  const { data, error } = await supabase.rpc('get_expenses_by_category', {
    p_month_id: monthId,
  })
  if (error) throw error
  return (data ?? []).map((r: { category: string; total: number | string }) => ({
    category: r.category,
    total: Number(r.total),
  }))
}

export async function fetchTransactions(monthId: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('month_id', monthId)
    .order('id', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchBenefitTotal(): Promise<number> {
  const { data, error } = await supabase.rpc('get_benefit_balance_total')
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchTotalInvestments(): Promise<number> {
  const { data, error } = await supabase.rpc('get_total_investments')
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchExpensesByPaymentMethod(monthId: number): Promise<CategoryTotal[]> {
  const { data, error } = await supabase.rpc('get_expenses_by_payment_method', {
    p_month_id: monthId,
  })
  if (error) throw error
  return (data ?? []).map((r: { payment_method: string; total: number | string }) => ({
    category: r.payment_method,
    total: Number(r.total),
  }))
}

export async function ensureMonth(name: string, year: number, month: number): Promise<number> {
  const { data, error } = await supabase.rpc('ensure_month', {
    p_name: name,
    p_year: year,
    p_month: month,
  })
  if (error) throw error
  return data as number
}

// ── Escrita (via RPC centralizada no Postgres) ───────────────────────
export type TxInput = {
  type: string
  description: string
  amount: number
  category: string
  is_expectation: boolean
  card_id?: number | null
  benefit_id?: number | null
  debit_card_id?: number | null
  payment_method?: string | null
  payment_date?: string | null
}

export async function addTransaction(monthId: number, tx: TxInput): Promise<void> {
  const { error } = await supabase.rpc('add_transaction', {
    p_month_id: monthId,
    p_type: tx.type,
    p_description: tx.description,
    p_amount: tx.amount,
    p_category: tx.category,
    p_is_expectation: tx.is_expectation,
    p_card_id: tx.card_id ?? null,
    p_benefit_id: tx.benefit_id ?? null,
    p_debit_card_id: tx.debit_card_id ?? null,
    p_payment_method: tx.payment_method ?? null,
    p_payment_date: tx.payment_date ?? null,
  })
  if (error) throw error
}

export async function updateTransaction(id: number, tx: TxInput): Promise<void> {
  const { error } = await supabase.rpc('update_transaction', {
    p_id: id,
    p_description: tx.description,
    p_amount: tx.amount,
    p_category: tx.category,
    p_is_expectation: tx.is_expectation,
    p_card_id: tx.card_id ?? null,
    p_benefit_id: tx.benefit_id ?? null,
    p_debit_card_id: tx.debit_card_id ?? null,
    p_payment_method: tx.payment_method ?? null,
    p_payment_date: tx.payment_date ?? null,
  })
  if (error) throw error
}

export async function deleteTransaction(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_transaction', { p_id: id })
  if (error) throw error
}

// ── Cartões de crédito ────────────────────────────────────────────────
// CRUD simples via tabela (sem regra de negócio → sem RPC). O overview
// (gasto/disponível/dias) e o pagamento de fatura são RPCs (têm cálculo
// e efeito colateral, precisam ser a mesma fonte de verdade do desktop).
export type CardInput = {
  name: string
  limit: number
  due_day: number
  closing_day: number
  color: string
}

export async function fetchCardsOverview(monthId: number): Promise<CardOverview[]> {
  const { data, error } = await supabase.rpc('get_cards_overview', {
    p_month_id: monthId,
  })
  if (error) throw error
  return (data ?? []) as CardOverview[]
}

export async function createCard(card: CardInput): Promise<void> {
  const { error } = await supabase.from('credit_cards').insert({
    name: card.name,
    limit: card.limit,
    due_day: card.due_day,
    closing_day: card.closing_day,
    color: card.color,
  })
  if (error) throw error
}

export async function updateCard(id: number, card: CardInput): Promise<void> {
  const { error } = await supabase
    .from('credit_cards')
    .update({
      name: card.name,
      limit: card.limit,
      due_day: card.due_day,
      closing_day: card.closing_day,
      color: card.color,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCard(id: number): Promise<void> {
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
}

// Lista leve p/ o seletor de origem no formulário de lançamento
export async function fetchCardsBasic(): Promise<CardBasic[]> {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('id, name, color')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function fetchBenefitsBasic(): Promise<BenefitBasic[]> {
  const { data, error } = await supabase
    .from('benefit_cards')
    .select('id, name, benefit_type, color, balance')
    .is('archived_at', null)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((b) => ({ ...b, balance: Number(b.balance) }))
}

export async function payCardBill(cardId: number, monthId: number): Promise<number> {
  const { data, error } = await supabase.rpc('pay_card_bill', {
    p_card_id: cardId,
    p_month_id: monthId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

// ── Benefícios VR/VA ──────────────────────────────────────────────────
// Criação e a lista com dias-até-renovar são RPC (têm cálculo de data).
// Editar/ajustar saldo/arquivar são updates simples direto na tabela.
export type BenefitInput = {
  name: string
  benefit_type: string
  renewal_day: number
  recharge_amount: number
  recharge_mode: string
  color: string
}

export async function fetchBenefitsOverview(): Promise<BenefitOverview[]> {
  const { data, error } = await supabase.rpc('get_benefits_overview')
  if (error) throw error
  return (data ?? []) as BenefitOverview[]
}

export async function createBenefit(
  input: BenefitInput & { balance: number },
): Promise<void> {
  const { error } = await supabase.rpc('create_benefit', {
    p_name: input.name,
    p_benefit_type: input.benefit_type,
    p_balance: input.balance,
    p_renewal_day: input.renewal_day,
    p_recharge_amount: input.recharge_amount,
    p_recharge_mode: input.recharge_mode,
    p_color: input.color,
  })
  if (error) throw error
}

export async function updateBenefit(id: number, input: BenefitInput): Promise<void> {
  const { error } = await supabase
    .from('benefit_cards')
    .update({
      name: input.name,
      benefit_type: input.benefit_type,
      renewal_day: input.renewal_day,
      recharge_amount: input.recharge_amount,
      recharge_mode: input.recharge_mode,
      color: input.color,
    })
    .eq('id', id)
  if (error) throw error
}

export async function setBenefitBalance(id: number, balance: number): Promise<void> {
  const { error } = await supabase.from('benefit_cards').update({ balance }).eq('id', id)
  if (error) throw error
}

export async function archiveBenefit(id: number): Promise<void> {
  const { error } = await supabase
    .from('benefit_cards')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function applyAllDueRenewals(): Promise<RenewalSummary[]> {
  const { data, error } = await supabase.rpc('apply_all_due_renewals')
  if (error) throw error
  return (data ?? []) as RenewalSummary[]
}

// ── Planejamento Mensal ───────────────────────────────────────────────
// Leituras diretas (sem regra de negócio); investimentos/renda usam RPCs
// leves (cálculo simples). save_plan é RPC (upsert + fecha planos antigos).
export async function fetchPlan(monthId: number): Promise<Plan | null> {
  const { data, error } = await supabase
    .from('monthly_plans')
    .select('*')
    .eq('month_id', monthId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchPlanItems(planId: number): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('monthly_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('planned_amount', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchMonthInvestmentNet(monthId: number): Promise<number> {
  const { data, error } = await supabase.rpc('get_month_investment_net', {
    p_month_id: monthId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchMonthIncome(
  monthId: number,
  includeExpectations = false,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_month_income', {
    p_month_id: monthId,
    p_include_expectations: includeExpectations,
  })
  if (error) throw error
  return Number(data ?? 0)
}

/** Realizado por categoria: gastos + aporte líquido (mesma regra do desktop). */
export async function fetchPlanRealized(monthId: number): Promise<Record<string, number>> {
  const [cats, invNet] = await Promise.all([
    fetchExpensesByCategory(monthId),
    fetchMonthInvestmentNet(monthId),
  ])
  const realized: Record<string, number> = {}
  for (const c of cats) realized[c.category] = c.total
  if (invNet > 0) realized['Investimentos'] = invNet
  return realized
}

/** Até 3 meses anteriores ao mês dado (mais recente primeiro), p/ sugestão. */
export function priorMonths(months: Month[], current: Month, n = 3): Month[] {
  const key = current.year * 100 + current.month
  return months.filter((m) => m.year * 100 + m.month < key).slice(0, n)
}

export type MonthSeriesPoint = { month: Month; summary: MonthSummary }

/** Série de até n meses terminando no mês atual (mais antigo → mais novo), p/ gráficos de evolução. */
export async function fetchMonthSeries(
  months: Month[],
  current: Month,
  n = 6,
): Promise<MonthSeriesPoint[]> {
  const prior = priorMonths(months, current, n - 1)
  const ordered = [...prior].reverse().concat(current)
  const summaries = await Promise.all(ordered.map((m) => fetchMonthSummary(m.id)))
  return ordered.map((m, i) => ({ month: m, summary: summaries[i] }))
}

/** Resumo dos até n meses anteriores ao mês dado (mais recente primeiro), p/ o Guru Financeiro. */
export async function fetchMonthSummaryHistory(
  months: Month[],
  current: Month,
  n = 3,
): Promise<MonthSummary[]> {
  const prior = priorMonths(months, current, n)
  return Promise.all(prior.map((m) => fetchMonthSummary(m.id)))
}

export async function fetchPlanHistory(
  months: Month[],
  current: Month,
): Promise<{ expensesHistory: Record<string, number>[]; incomeHistory: number[] }> {
  const prior = priorMonths(months, current, 3)
  const expensesHistory: Record<string, number>[] = []
  const incomeHistory: number[] = []
  for (const m of prior) {
    const [cats, invNet, income] = await Promise.all([
      fetchExpensesByCategory(m.id),
      fetchMonthInvestmentNet(m.id),
      fetchMonthIncome(m.id),
    ])
    const catTotals: Record<string, number> = {}
    for (const c of cats) catTotals[c.category] = c.total
    if (invNet > 0) catTotals['Investimentos'] = invNet
    expensesHistory.push(catTotals)
    incomeHistory.push(income)
  }
  return { expensesHistory, incomeHistory }
}

export async function savePlan(
  monthId: number,
  income: number,
  items: PlanItemInput[],
): Promise<void> {
  const { error } = await supabase.rpc('save_plan', {
    p_month_id: monthId,
    p_income: income,
    p_items: items,
  })
  if (error) throw error
}

// ── Cartões de débito (exclusivo web/mobile) ─────────────────────────
// Não há mais UI pra cadastrar/editar/excluir cartão de débito — só
// listar os que já existem, pro seletor de forma de pagamento.
export async function fetchDebitCardsBasic(): Promise<DebitCard[]> {
  const { data, error } = await supabase
    .from('debit_cards')
    .select('id, name, color')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

// ── Dívidas ───────────────────────────────────────────────────────────
// Leituras diretas nas tabelas (sem regra de negócio). Escrita com efeito
// colateral (recalcular total, gerar/apagar gasto, sincronizar plano) é
// RPC — mesma fonte de verdade do desktop.
export async function fetchDebts(): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchAllInstallments(): Promise<DebtInstallment[]> {
  const { data, error } = await supabase
    .from('debt_installments')
    .select('*')
    .order('due_year')
    .order('due_month')
    .order('installment_number')
  if (error) throw error
  return data ?? []
}

export async function fetchDebtOverview(): Promise<DebtOverview> {
  const { data, error } = await supabase.rpc('get_debt_overview')
  if (error) throw error
  return data as DebtOverview
}

export async function createDebt(
  description: string,
  creditor: string,
  category: string,
  notes: string,
  installments: DebtInstallmentInput[],
): Promise<void> {
  const total = installments.reduce((a, i) => a + i.amount, 0)
  const { error } = await supabase.rpc('create_debt', {
    p_description: description,
    p_creditor: creditor || null,
    p_total_amount: total,
    p_category: category || 'Dívidas',
    p_notes: notes || null,
    p_installments: installments,
  })
  if (error) throw error
}

export async function updateDebt(
  id: number,
  input: { description: string; creditor: string; category: string; notes: string },
): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({
      description: input.description,
      creditor: input.creditor || null,
      category: input.category || 'Dívidas',
      notes: input.notes || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function rescheduleInstallment(instId: number, year: number, month: number): Promise<void> {
  const { error } = await supabase
    .from('debt_installments')
    .update({ due_year: year, due_month: month })
    .eq('id', instId)
  if (error) throw error
}

export async function updateInstallmentAmount(instId: number, amount: number): Promise<void> {
  const { error } = await supabase.rpc('update_installment_amount', {
    p_inst_id: instId,
    p_amount: amount,
  })
  if (error) throw error
}

export async function payInstallment(instId: number, launchExpense: boolean): Promise<void> {
  const { error } = await supabase.rpc('pay_installment', {
    p_inst_id: instId,
    p_launch_expense: launchExpense,
  })
  if (error) throw error
}

export async function undoInstallmentPayment(instId: number): Promise<void> {
  const { error } = await supabase.rpc('undo_installment_payment', { p_inst_id: instId })
  if (error) throw error
}

export async function deleteInstallment(instId: number, deleteExpense: boolean): Promise<void> {
  const { error } = await supabase.rpc('delete_installment', {
    p_inst_id: instId,
    p_delete_expense: deleteExpense,
  })
  if (error) throw error
}

export async function deleteDebt(debtId: number, deleteExpenses: boolean): Promise<void> {
  const { error } = await supabase.rpc('delete_debt', {
    p_debt_id: debtId,
    p_delete_expenses: deleteExpenses,
  })
  if (error) throw error
}

export async function syncDebtsIntoPlan(monthId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('sync_debts_into_plan', { p_month_id: monthId })
  if (error) throw error
  return Boolean(data)
}

// ── Investimentos ─────────────────────────────────────────────────────
// Leituras e edições simples (nome/categoria/valor/nota) são diretas na
// tabela. Criar (2 inserts: investimento + aporte inicial) e excluir
// (apaga movimentações antes do investimento) são RPC, pra garantir que
// as duas escritas aconteçam juntas.
export async function fetchInvestments(includeArchived = false): Promise<Investment[]> {
  let query = supabase.from('investments').select('*').order('created_at', { ascending: true })
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchAllInvestmentMovements(): Promise<InvestmentMovement[]> {
  const { data, error } = await supabase
    .from('investment_movements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createInvestment(
  name: string,
  category: string,
  monthId: number,
  amount: number,
  note: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('create_investment', {
    p_name: name,
    p_category: category,
    p_month_id: monthId,
    p_amount: amount,
    p_note: note || null,
  })
  if (error) throw error
  return data as number
}

export async function addInvestmentMovement(
  investmentId: number,
  monthId: number,
  movementType: MovementType,
  amount: number,
  note: string,
): Promise<void> {
  const { error } = await supabase.from('investment_movements').insert({
    investment_id: investmentId,
    month_id: monthId,
    movement_type: movementType,
    amount,
    note: note || null,
  })
  if (error) throw error
}

export async function updateInvestment(id: number, name: string, category: string): Promise<void> {
  const { error } = await supabase.from('investments').update({ name, category }).eq('id', id)
  if (error) throw error
}

export async function updateInvestmentMovement(id: number, amount: number, note: string): Promise<void> {
  const { error } = await supabase
    .from('investment_movements')
    .update({ amount, note: note || null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteInvestmentMovement(id: number): Promise<void> {
  const { error } = await supabase.from('investment_movements').delete().eq('id', id)
  if (error) throw error
}

export async function archiveInvestment(id: number): Promise<void> {
  const { error } = await supabase
    .from('investments')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteInvestment(id: number): Promise<void> {
  const { error } = await supabase.rpc('delete_investment', { p_investment_id: id })
  if (error) throw error
}

// ── Metas de poupança ─────────────────────────────────────────────────
// Contribuir/sacar é RPC (soma atômica, nunca deixa saved_amount negativo).
export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createGoal(name: string, targetAmount: number): Promise<void> {
  const { error } = await supabase.from('goals').insert({
    name,
    target_amount: targetAmount,
    saved_amount: 0,
  })
  if (error) throw error
}

export async function addGoalContribution(goalId: number, amount: number): Promise<number> {
  const { data, error } = await supabase.rpc('add_goal_contribution', {
    p_goal_id: goalId,
    p_amount: amount,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function updateGoal(id: number, name: string, targetAmount: number): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ name, target_amount: targetAmount })
    .eq('id', id)
  if (error) throw error
}

export async function deleteGoal(id: number): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

// ── Importação de extrato/fatura ─────────────────────────────────────
export type ImportRow = {
  month_id: number
  type: string
  description: string
  amount: number
  category?: string | null
  payment_method?: string | null
  payment_date?: string | null
  card_id?: number | null
  benefit_id?: number | null
  debit_card_id?: number | null
}

export async function importTransactionsBulk(rows: ImportRow[]): Promise<number[]> {
  const { data, error } = await supabase.rpc('import_transactions_bulk', { p_rows: rows })
  if (error) throw error
  return (data ?? []) as number[]
}
