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

export const DEFAULT_IMPORT_CUTOFF_DAY = 1

/** Lançamentos a partir do dia de corte (configurável pelo usuário nas
 * Configurações) contam pro mês seguinte na importação de extrato —
 * alinhado com a data em que o usuário recebe o salário. Dia de corte 1
 * (padrão) significa "sem deslocamento": o mês calendário já é o próprio
 * mês de cobrança. Se o dia de corte for maior que o número de dias do
 * mês (ex: 31 num mês de 30 dias), usa o último dia do mês. */
export function billingMonth(
  year: number,
  month: number,
  day: number,
  cutoffDay: number = DEFAULT_IMPORT_CUTOFF_DAY,
): { year: number; month: number } {
  if (cutoffDay <= 1) return { year, month }
  const daysInMonth = new Date(year, month, 0).getDate()
  const effectiveCutoff = Math.min(cutoffDay, daysInMonth)
  if (day >= effectiveCutoff) {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return { year, month }
}

/** Data real (DD/MM) a partir de "daqui a N dias" — usado pra mostrar a
 * data de fechamento/vencimento de fatura em vez de só "em Nd". */
export function dateFromDaysUntil(daysUntil: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysUntil)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
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
