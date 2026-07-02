export type Month = {
  id: number
  name: string
  year: number
  month: number
}

export type TxType =
  | 'entrada_fixa'
  | 'entrada_variavel'
  | 'saida_fixa'
  | 'saida_variavel'

export type Transaction = {
  id: number
  month_id: number
  type: TxType
  description: string
  amount: number
  category: string | null
  card_id: number | null
  benefit_id: number | null
  is_expectation: boolean
  created_at: string
}

export type MonthSummary = {
  entrada_fixa: number
  entrada_variavel: number
  saida_fixa: number
  saida_variavel: number
  total_entradas: number
  total_saidas: number
  total_investimentos: number
  saldo: number
  saldo_projetado: number
  n_expectations: number
  has_expectations: boolean
}

export type CategoryTotal = {
  category: string
  total: number
}

export type Card = {
  id: number
  name: string
  limit: number
  due_day: number
  closing_day: number
  color: string
}

export type CardOverview = {
  id: number
  name: string
  card_limit: number
  due_day: number
  closing_day: number
  color: string
  spent: number
  paid: number
  unpaid: number
  available: number | null
  days_until_closing: number
  days_until_due: number
  cycle_open: boolean
}
