// Parser da fatura de cartão de crédito do Banco Inter em CSV — único
// formato exportável pro cartão (diferente do extrato da conta corrente).
// Mesma lógica de parsers/inter/credit_card_csv.py (desktop) — ver ali
// para detalhes do formato observado.
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory } from '../base'
import { cleanDescription, decodeBytes, parseBrlAmount, stripAccents } from '../common'

function parseDateBr(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

// Parser CSV simples com suporte a campos entre aspas (o formato do Inter
// não tem vírgulas dentro de campos, mas isso lida com aspas corretamente
// mesmo assim, sem precisar de uma lib externa).
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export class InterCreditCardCsvParser implements BankParser {
  bankId = 'inter'
  formatId = 'credit_card_csv'

  sniff(bytes: ArrayBuffer, filename: string): boolean {
    if (!filename.toLowerCase().endsWith('.csv')) return false
    const text = decodeBytes(bytes.slice(0, 4096))
    const upper = stripAccents(text).toUpperCase()
    return upper.includes('LANCAMENTO') && upper.includes('CATEGORIA') && upper.includes('VALOR')
      && text.slice(0, 200).includes('","')
  }

  async parse(bytes: ArrayBuffer): Promise<NormalizedRow[]> {
    const text = decodeBytes(bytes)
    const lines = text.split(/\r?\n/).filter((ln) => ln.trim())
    if (lines.length === 0) return []

    const header = parseCsvLine(lines[0]).map((h) => stripAccents(h).trim().toUpperCase())
    const iDate = header.indexOf('DATA')
    const iDesc = header.indexOf('LANCAMENTO')
    const iVal = header.indexOf('VALOR')
    if (iDate === -1 || iDesc === -1 || iVal === -1) return []

    const rows: NormalizedRow[] = []
    for (const ln of lines.slice(1)) {
      const parts = parseCsvLine(ln)
      if (parts.length <= Math.max(iDate, iDesc, iVal)) continue

      const isoDate = parseDateBr(parts[iDate])
      if (!isoDate) continue

      const amount = parseBrlAmount(parts[iVal])
      if (amount < 0) {
        // Pagamento automático da fatura — não é uma compra, o app já tem
        // seu próprio fluxo de "Pagar Fatura" pra isso.
        continue
      }

      const desc = cleanDescription(parts[iDesc])
      rows.push({
        date: isoDate,
        description: desc,
        amount,
        direction: 'saida',
        suggestedCategory: guessCategory(desc),
        suggestedPaymentMethod: 'credito',
        isInvestmentLike: false,
        isCreditCardCharge: true,
        raw: ln,
      })
    }
    return rows
  }
}
