import { supabase } from './supabase'
import type { Month, MonthSummary, CategoryTotal, Transaction } from './types'

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
