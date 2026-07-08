export type Month = {
  id: number
  name: string
  year: number
  month: number
}

export type DashboardWidgetEntry = {
  id: string
  enabled: boolean
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
  debit_card_id: number | null
  payment_method: string | null
  payment_date: string | null
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

export type CardBasic = {
  id: number
  name: string
  color: string
}

export type BenefitBasic = {
  id: number
  name: string
  benefit_type: string
  color: string
  balance: number
}

export type DebitCard = {
  id: number
  name: string
  color: string
}

export type Plan = {
  id: number
  month_id: number
  income: number
  status: 'ativo' | 'fechado'
  updated_at: string
}

export type PlanItem = {
  id: number
  plan_id: number
  category: string
  suggested_amount: number | null
  planned_amount: number
  is_eventual: boolean
  is_mandatory: boolean
}

export type PlanItemInput = {
  category: string
  planned_amount: number
  suggested_amount: number | null
  is_eventual: boolean
  is_mandatory: boolean
}

export type BenefitOverview = {
  id: number
  name: string
  benefit_type: string
  balance: number
  renewal_day: number
  recharge_amount: number
  recharge_mode: string
  color: string
  days_until_renewal: number
}

export type RenewalSummary = {
  name: string
  benefit_type: string
  total: number
  count: number
  balance_after: number
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

export type Debt = {
  id: number
  description: string
  creditor: string | null
  total_amount: number
  category: string | null
  notes: string | null
  created_at: string
}

export type DebtInstallment = {
  id: number
  debt_id: number
  installment_number: number
  amount: number
  due_year: number
  due_month: number
  paid_at: string | null
  expense_id: number | null
}

export type InstallmentStatus = 'paga' | 'atrasada' | 'pendente'

export type DebtInstallmentInput = {
  number: number
  amount: number
  year: number
  month: number
}

export type DebtFuture = {
  year: number
  month: number
  total: number
}

export type DebtOverview = {
  total_aberto: number
  n_atrasadas: number
  future: DebtFuture[]
}

export type Investment = {
  id: number
  name: string
  category: string
  archived_at: string | null
  created_at: string
}

export type MovementType = 'aporte_inicial' | 'aporte' | 'saque'

export type InvestmentMovement = {
  id: number
  investment_id: number
  month_id: number
  movement_type: MovementType
  amount: number
  note: string | null
  created_at: string
}

export type Goal = {
  id: number
  name: string
  target_amount: number
  saved_amount: number
  created_at: string
}
