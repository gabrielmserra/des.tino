import { supabase } from './supabase'
import type {
  Month,
  MonthSummary,
  CategoryTotal,
  Transaction,
  CardOverview,
  CardBasic,
  BenefitBasic,
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

// ── Escrita (via RPC centralizada no Postgres) ───────────────────────
export type TxInput = {
  type: string
  description: string
  amount: number
  category: string
  is_expectation: boolean
  card_id?: number | null
  benefit_id?: number | null
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
