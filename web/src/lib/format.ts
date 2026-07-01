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
