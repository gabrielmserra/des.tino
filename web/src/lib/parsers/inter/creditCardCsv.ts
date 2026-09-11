// Parser da fatura de cartão de crédito do Banco Inter em CSV — único
// formato exportável pro cartão (diferente do extrato da conta corrente).
// Mesma lógica de parsers/inter/credit_card_csv.py (desktop) — ver ali
// para detalhes do formato observado.
//
// A coluna "Tipo" indica "Compra à vista" ou "Parcela N/M" — cada parcela
// de uma compra parcelada chega como sua própria linha, uma por fatura/mês
// (o Inter não manda as parcelas futuras de uma vez, nem um ID que ligue as
// parcelas de uma mesma compra entre faturas de meses diferentes). Por isso
// não dá pra reconstruir a compra parcelada "de verdade" (como o fluxo
// manual "🧾 Compra parcelada" faz, com card_purchase_id agrupando tudo) —
// o que dá pra fazer com segurança é só marcar "N/M" na descrição de cada
// parcela importada, pra ficar visível qual parcela é e de quantas.
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory } from '../base'
import { cleanDescription, decodeBytes, parseBrlAmount, stripAccents } from '../common'

const INSTALLMENT_RE = /^parcela\s+(\d+)\s*\/\s*(\d+)$/i

function parseInstallment(tipo: string): [number, number] | null {
  const m = INSTALLMENT_RE.exec(tipo.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2])]
}

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
    const iTipo = header.indexOf('TIPO')
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

      let desc = cleanDescription(parts[iDesc])
      if (iTipo !== -1 && iTipo < parts.length) {
        const installment = parseInstallment(parts[iTipo])
        if (installment) {
          const [n, total] = installment
          desc = `${desc} (parcela ${n}/${total})`
        }
      }
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
