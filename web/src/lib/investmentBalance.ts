import type { InvestmentMovement } from './types'

export function calcInvestmentBalance(movements: InvestmentMovement[]): number {
  return movements.reduce((sum, m) => sum + (m.movement_type === 'saque' ? -m.amount : m.amount), 0)
}
