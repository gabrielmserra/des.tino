import type { DebtInstallment, InstallmentStatus } from './types'

/** Status derivado — réplica de database.py:installment_status. */
export function installmentStatus(inst: DebtInstallment): InstallmentStatus {
  if (inst.paid_at) return 'paga'
  const today = new Date()
  const key = today.getFullYear() * 100 + (today.getMonth() + 1)
  const dueKey = inst.due_year * 100 + inst.due_month
  return dueKey < key ? 'atrasada' : 'pendente'
}
