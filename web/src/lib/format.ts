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
