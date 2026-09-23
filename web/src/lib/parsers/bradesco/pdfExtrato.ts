// Parser do extrato da conta corrente do Bradesco em PDF, no navegador
// (pdfjs-dist, via ../pdfText). Mesma lógica de
// parsers/bradesco/pdf_extrato.py (desktop) — ver ali para detalhes do
// formato observado (bloco de 3 linhas por lançamento, direção inferida do
// prefixo REM:/DES: ou das palavras do rótulo do tipo).
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory, looksLikeInvestment } from '../base'
import { cleanDescription, parseBrlAmount, stripAccents } from '../common'
import { extractPdfText } from '../pdfText'
import { guessPaymentMethod } from './common'

const NOISE_PREFIXES = ['Bradesco Celular', 'Data:', 'Nome:', 'Extrato de:']
const TOTAL_RE = /^Total\s+[\d.,]+/
const COD_LANC_RE = /^(?:(\d{2}\/\d{2}\/\d{4})\s+)?COD\.?\s*LANC\.?/i
const AMOUNT_LINE_RE = /^(?:(\d{2}\/\d{2}\/\d{4})\s+)?(\S+)\s+([\d.,]+)\s+([\d.,]+)\s*$/
const KNOWN_TYPE_LABELS = [
  'PIX RECEBIDO', 'PIX ENVIADO', 'PIX QR CODE',
  'COMPRA ELO DEBITO', 'PAGTO ELETRON', 'TED', 'DOC', 'TRANSFERENCIA',
]

function isNoise(ln: string): boolean {
  const upper = stripAccents(ln).toUpperCase()
  if (NOISE_PREFIXES.some((p) => ln.startsWith(p))) return true
  if (upper.startsWith('DATA HISTORICO')) return true
  if (TOTAL_RE.test(ln)) return true
  return false
}

function isKnownTypeLabel(ln: string): boolean {
  const upper = stripAccents(ln).toUpperCase()
  return KNOWN_TYPE_LABELS.some((t) => upper.startsWith(t))
}

function parseDateBr(s: string): string {
  const [dd, mm, yyyy] = s.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function inferDirection(tipo: string, detail: string): 'entrada' | 'saida' {
  const detailUpper = stripAccents(detail).toUpperCase()
  if (detailUpper.startsWith('REM:')) return 'entrada'
  if (detailUpper.startsWith('DES:')) return 'saida'
  const tipoUpper = stripAccents(tipo).toUpperCase()
  return tipoUpper.includes('RECEBIDO') ? 'entrada' : 'saida'
}

export function parseText(text: string): NormalizedRow[] {
  const rawLines = text.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean)
  const lines = rawLines.filter((ln) => !isNoise(ln))

  const rows: NormalizedRow[] = []
  let currentDate: string | null = null
  let tipoBuffer: string[] = []

  let i = 0
  const n = lines.length
  while (i < n) {
    const ln = lines[i]

    const codM = COD_LANC_RE.exec(ln)
    if (codM) {
      if (codM[1]) currentDate = parseDateBr(codM[1])
      tipoBuffer = []
      i += 1
      continue
    }

    const amtM = AMOUNT_LINE_RE.exec(ln)
    if (amtM) {
      if (amtM[1]) currentDate = parseDateBr(amtM[1])
      const tipo = cleanDescription(tipoBuffer.join(' '))
      tipoBuffer = []
      i += 1

      let detail = ''
      if (i < n) {
        const nxt = lines[i]
        if (!AMOUNT_LINE_RE.test(nxt) && !COD_LANC_RE.test(nxt) && !isKnownTypeLabel(nxt)) {
          detail = nxt
          i += 1
        }
      }

      if (tipo && currentDate !== null) {
        const amount = parseBrlAmount(amtM[3])
        const direction = inferDirection(tipo, detail)
        const desc = cleanDescription(detail) || tipo
        const isInv = looksLikeInvestment(`${tipo} ${detail}`)
        rows.push({
          date: currentDate,
          description: desc,
          amount: Math.abs(amount),
          direction,
          suggestedCategory: isInv ? 'Investimentos' : guessCategory(desc),
          suggestedPaymentMethod: guessPaymentMethod(`${tipo} ${detail}`),
          isInvestmentLike: isInv,
          isCreditCardCharge: false,
          raw: `${tipo} | ${ln} | ${detail}`.trim(),
        })
      }
      continue
    }

    tipoBuffer.push(ln)
    i += 1
  }

  return rows
}

export class BradescoPdfExtratoParser implements BankParser {
  bankId = 'bradesco'
  formatId = 'pdf_extrato'

  sniff(_bytes: ArrayBuffer, filename: string): boolean {
    // A checagem real (texto contém "Bradesco") só é possível de forma
    // assíncrona (extração de PDF) — aqui só filtra pela extensão;
    // registry.ts's detectAndParse() descarta o match se parse() vier vazio.
    return filename.toLowerCase().endsWith('.pdf')
  }

  async parse(bytes: ArrayBuffer): Promise<NormalizedRow[]> {
    const text = await extractPdfText(bytes)
    const upper = stripAccents(text).toUpperCase()
    if (!upper.includes('BRADESCO')) return []
    return parseText(text)
  }
}
