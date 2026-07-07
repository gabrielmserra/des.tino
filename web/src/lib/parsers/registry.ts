import type { BankParser } from './types'
import { InterCsvExtratoParser } from './inter/csvExtrato'
import { InterOfxParser } from './inter/ofx'
import { InterPdfExtratoParser } from './inter/pdfExtrato'

export const PARSERS: BankParser[] = [
  new InterCsvExtratoParser(),
  new InterOfxParser(),
  new InterPdfExtratoParser(),
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
