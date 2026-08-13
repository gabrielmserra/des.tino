export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function formatCurrency(value: number): string {
  const v = Number(value) || 0
  const s = Math.abs(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return v < 0 ? `- R$ ${s}` : `R$ ${s}`
}

/** Lançamentos a partir do dia 24 contam pro mês seguinte na importação de
 * extrato — alinhado com a data em que o usuário recebe o salário. */
export function billingMonth(year: number, month: number, day: number): { year: number; month: number } {
  if (day >= 24) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return { year, month }
}

export function todayLabel(): string {
  const d = new Date()
  return `Hoje, ${d.getDate()} de ${MONTHS_PT[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`
}

/** Formata uma data "YYYY-MM-DD" (coluna `date` do Postgres) como dd/mm/aaaa.
 * Faz split manual em vez de `new Date(str)` pra não sofrer o shift de fuso
 * horário (UTC-3 faria "2026-07-06" virar 05/07 se passasse por Date). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}
