// Parser do extrato da conta corrente do Banco Inter em CSV.
// Mesma lógica de parsers/inter/csv_extrato.py (desktop) — ver ali para
// detalhes do formato observado.
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory, looksLikeInvestment } from '../base'
import { cleanDescription, decodeBytes, guessPaymentMethod, parseBrlAmount, stripAccents } from '../common'

function parseDateBr(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export class InterCsvExtratoParser implements BankParser {
  bankId = 'inter'
  formatId = 'csv_extrato'

  sniff(bytes: ArrayBuffer, filename: string): boolean {
    if (!filename.toLowerCase().endsWith('.csv')) return false
    const text = decodeBytes(bytes.slice(0, 4096))
    const upper = stripAccents(text).toUpperCase()
    return upper.includes('EXTRATO CONTA CORRENTE') ||
      (upper.includes('DATA LANCAMENTO') && upper.includes('HISTORICO'))
  }

  async parse(bytes: ArrayBuffer): Promise<NormalizedRow[]> {
    const text = decodeBytes(bytes)
    const lines = text.split(/\r?\n/).filter((ln) => ln.trim())

    let headerIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const upper = stripAccents(lines[i]).toUpperCase()
      if (upper.includes('DATA LANCAMENTO') && upper.includes('HISTORICO')) {
        headerIdx = i
        break
      }
    }
    if (headerIdx === -1) return []

    const rows: NormalizedRow[] = []
    for (const ln of lines.slice(headerIdx + 1)) {
      const parts = ln.split(';')
      if (parts.length < 4) continue
      const dateStr   = parts[0].trim()
      const historico = parts[1].trim()
      const descricao = parts[2].trim()
      const valorStr  = parts[3].trim()

      const isoDate = parseDateBr(dateStr)
      if (!isoDate) continue

      let amount = parseBrlAmount(valorStr)
      const direction = amount < 0 ? 'saida' : 'entrada'
      amount = Math.abs(amount)

      const desc = cleanDescription(descricao) || cleanDescription(historico)
      const isInv = looksLikeInvestment(historico)
      rows.push({
        date: isoDate,
        description: desc,
        amount,
        direction,
        suggestedCategory: isInv ? 'Investimentos' : guessCategory(desc),
        suggestedPaymentMethod: guessPaymentMethod(historico),
        isInvestmentLike: isInv,
        raw: ln,
      })
    }
    return rows
  }
}
