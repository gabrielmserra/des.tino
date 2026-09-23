import type { BankParser, NormalizedRow } from './types'
import { InterCsvExtratoParser } from './inter/csvExtrato'
import { InterCreditCardCsvParser } from './inter/creditCardCsv'
import { InterOfxParser } from './inter/ofx'
import { InterPdfExtratoParser } from './inter/pdfExtrato'
import { BradescoCsvExtratoParser } from './bradesco/csvExtrato'
import { BradescoPdfExtratoParser } from './bradesco/pdfExtrato'

export const PARSERS: BankParser[] = [
  new InterCreditCardCsvParser(),
  new InterCsvExtratoParser(),
  new InterOfxParser(),
  new InterPdfExtratoParser(),
  new BradescoCsvExtratoParser(),
  new BradescoPdfExtratoParser(),
]

export function detectParser(bytes: ArrayBuffer, filename: string): BankParser | null {
  for (const parser of PARSERS) {
    try {
      if (parser.sniff(bytes, filename)) return parser
    } catch {
      continue
    }
  }
  return null
}

export type DetectAndParseResult =
  | { parser: BankParser; rows: NormalizedRow[] }
  | { parser: null; rows: []; sniffMatched: boolean }

// Alguns parsers de PDF só conseguem confirmar o formato de forma
// assíncrona (extração de PDF) — o sniff() síncrono deles só filtra pela
// extensão, então dois bancos com PDF sempre "empatam" no sniff. Em vez de
// aceitar o primeiro sniff-match cego (o que faria um PDF do banco errado
// cair no parser errado e devolver "nenhum lançamento encontrado"), tenta
// parse() de cada candidato em ordem e só aceita se vier alguma linha.
export async function detectAndParse(bytes: ArrayBuffer, filename: string): Promise<DetectAndParseResult> {
  let sniffMatched = false
  for (const parser of PARSERS) {
    let ok = false
    try {
      ok = parser.sniff(bytes, filename)
    } catch {
      ok = false
    }
    if (!ok) continue
    sniffMatched = true
    try {
      const rows = await parser.parse(bytes)
      if (rows.length > 0) return { parser, rows }
    } catch {
      // tenta o próximo candidato
    }
  }
  return { parser: null, rows: [], sniffMatched }
}
