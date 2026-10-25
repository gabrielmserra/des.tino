// Baixa automática na importação (Fase 4 do calendário): acha a pendência
// do Calendário (conta fixa, dívida, meta, fatura) que uma linha de saída
// do extrato provavelmente está pagando. Só SUGERE — quem decide é o
// usuário, no checkbox da tela de revisão. Réplica exata de
// utils/pending_match.py.
import { billMatchRatio } from './textSimilarity'
import type { CalendarEvent } from './api'

const NAME_MIN_RATIO = 0.7
const AMOUNT_TOLERANCE = 0.2
const DATE_WINDOW_DAYS = 5

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Nome da pendência sem o sufixo que o Calendário acrescenta
// ("Nubank (fatura)" → "nubank").
function eventName(label: string): string {
  return normalize(label.replace(/\s*\((fatura|fatura em aberto)\)\s*$/i, ''))
}

function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.abs(da - db) / 86_400_000
}

export function isMatchable(e: CalendarEvent): boolean {
  return !e.is_income && e.ref_table !== 'plan_income_items' && e.source !== 'card_invoice_open'
}

export function eventMatchesLine(
  e: CalendarEvent, description: string, amount: number, date: string,
): boolean {
  if (!isMatchable(e)) return false
  const name = eventName(e.label)
  if (name.length < 3) return false
  if (billMatchRatio(name, normalize(description)) < NAME_MIN_RATIO) return false
  const expected = Number(e.amount)
  if (expected <= 0 || Math.abs(amount - expected) > expected * AMOUNT_TOLERANCE) return false
  // Pendência vencida aparece em "hoje" no Calendário (a data real se
  // perde), então aceita qualquer data do extrato; pendente exige a data
  // perto do vencimento.
  if (e.status === 'overdue') return true
  return daysBetween(date, e.event_date) <= DATE_WINDOW_DAYS
}

// Casa cada linha com no máximo uma pendência e cada pendência com no
// máximo uma linha (a primeira que bater, na ordem das linhas).
export function matchPendingToLines(
  events: CalendarEvent[],
  lines: { description: string; amount: number; date: string; isExpense: boolean }[],
): (CalendarEvent | null)[] {
  const used = new Set<string>()
  return lines.map((l) => {
    if (!l.isExpense) return null
    const hit = events.find(
      (e) => !used.has(`${e.ref_table}-${e.ref_id}`) && eventMatchesLine(e, l.description, l.amount, l.date),
    )
    if (!hit) return null
    used.add(`${hit.ref_table}-${hit.ref_id}`)
    return hit
  })
}
