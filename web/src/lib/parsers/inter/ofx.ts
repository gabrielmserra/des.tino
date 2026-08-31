// Parser de extrato bancário em OFX (padrão SGML/XML usado por bancos
// brasileiros). Ainda não validado contra uma amostra real do Inter — segue
// o padrão OFX 1.x (tags <STMTTRN>/<TRNTYPE>/<DTPOSTED>/<TRNAMT>/<MEMO>).
// Mesma lógica de parsers/inter/ofx.py (desktop).
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory, looksLikeInvestment } from '../base'
import { cleanDescription, decodeBytes, guessPaymentMethod } from '../common'

const TRN_RE = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
const TAG_RE = /<(\w+)>([^<\r\n]*)/g

function parseOfxDate(raw: string): string | null {
  const digits = raw.trim().slice(0, 8)
  const m = digits.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function parseOfxTime(raw: string): string | null {
  const digits = raw.trim().slice(8, 14)
  const m = digits.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (!m) return null
  const [, hh, mm, ss] = m
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null
  return `${hh}:${mm}:${ss}`
}

export class InterOfxParser implements BankParser {
  bankId = 'inter'
  formatId = 'ofx'

  sniff(bytes: ArrayBuffer, filename: string): boolean {
    if (filename.toLowerCase().endsWith('.ofx')) return true
    const head = decodeBytes(bytes.slice(0, 512)).toUpperCase()
    return head.includes('OFXHEADER') || head.includes('<OFX>')
  }

  async parse(bytes: ArrayBuffer): Promise<NormalizedRow[]> {
    const text = decodeBytes(bytes)
    const rows: NormalizedRow[] = []

    let trnMatch: RegExpExecArray | null
    while ((trnMatch = TRN_RE.exec(text))) {
      const block = trnMatch[1]
      const fields: Record<string, string> = {}
      let tagMatch: RegExpExecArray | null
      TAG_RE.lastIndex = 0
      while ((tagMatch = TAG_RE.exec(block))) {
        fields[tagMatch[1].toUpperCase()] = tagMatch[2].trim()
      }

      const dtposted = fields['DTPOSTED']
      const trnamt   = fields['TRNAMT']
      if (!dtposted || !trnamt) continue
      const isoDate = parseOfxDate(dtposted)
      if (!isoDate) continue

      // TRNAMT do OFX já vem em formato numérico padrão (ponto decimal,
      // ex: "-48.33") — NÃO é formato BR ("48,33"), então não passa por
      // parseBrlAmount (que assume ponto = separador de milhar e apagaria
      // o decimal de verdade, virando 48.33 em 4833).
      let amount = parseFloat(trnamt.replace(',', '.')) || 0
      const direction = amount < 0 ? 'saida' : 'entrada'
      amount = Math.abs(amount)

      const memo = fields['MEMO'] || fields['NAME'] || fields['TRNTYPE'] || ''
      const desc = cleanDescription(memo)
      const isInv = looksLikeInvestment(memo)
      rows.push({
        date: isoDate,
        time: parseOfxTime(dtposted),
        description: desc || 'Lançamento importado',
        amount,
        direction,
        suggestedCategory: isInv ? 'Investimentos' : guessCategory(desc),
        suggestedPaymentMethod: guessPaymentMethod(memo),
        isInvestmentLike: isInv,
        isCreditCardCharge: false,
        raw: block.trim(),
      })
    }
    return rows
  }
}
