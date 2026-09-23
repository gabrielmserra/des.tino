// Parser do extrato da conta corrente do Bradesco em CSV. Mesma lógica de
// parsers/bradesco/csv_extrato.py (desktop) — ver ali para detalhes do
// formato observado (crédito/débito em colunas separadas, ruído filtrado
// pela tentativa de parse de data, marcador "COD. LANC." ignorado).
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory, looksLikeInvestment } from '../base'
import { decodeBytes, parseBrlAmount, stripAccents } from '../common'
import { guessPaymentMethod } from './common'

function parseDateBr(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export class BradescoCsvExtratoParser implements BankParser {
  bankId = 'bradesco'
  formatId = 'csv_extrato'

  sniff(bytes: ArrayBuffer, filename: string): boolean {
    if (!filename.toLowerCase().endsWith('.csv')) return false
    const text = decodeBytes(bytes.slice(0, 4096))
    const upper = stripAccents(text).toUpperCase()
    return upper.includes('HISTORICO') && upper.includes('DOCTO')
      && (upper.includes('CREDITO') || upper.includes('DEBITO'))
  }

  async parse(bytes: ArrayBuffer): Promise<NormalizedRow[]> {
    const text = decodeBytes(bytes)
    const lines = text.split(/\r?\n/).filter((ln) => ln.trim())

    const rows: NormalizedRow[] = []
    for (const ln of lines) {
      const parts = ln.split(';')
      if (parts.length < 6) continue
      const dateStr = parts[0].trim()
      const historico = parts[1].trim()
      const d = parseDateBr(dateStr)
      if (!d) continue
      if (stripAccents(historico).toUpperCase().startsWith('COD. LANC.')) continue

      const credito = parts[3].trim()
      const debito = parts[4].trim()
      let amount: number
      let direction: 'entrada' | 'saida'
      if (credito && credito !== '0,00') {
        amount = parseBrlAmount(credito)
        direction = 'entrada'
      } else if (debito && debito !== '0,00') {
        amount = parseBrlAmount(debito)
        direction = 'saida'
      } else {
        continue
      }

      const desc = historico
      const isInv = looksLikeInvestment(historico)
      rows.push({
        date: d,
        description: desc,
        amount: Math.abs(amount),
        direction,
        suggestedCategory: isInv ? 'Investimentos' : guessCategory(desc),
        suggestedPaymentMethod: guessPaymentMethod(historico),
        isInvestmentLike: isInv,
        isCreditCardCharge: false,
        raw: ln,
      })
    }
    return rows
  }
}
