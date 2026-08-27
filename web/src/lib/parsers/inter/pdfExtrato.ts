// Parser do extrato da conta corrente do Banco Inter em PDF, no navegador
// (pdfjs-dist). Mesma lógica de parsers/inter/pdf_extrato.py (desktop) —
// ver ali para detalhes do formato observado (agrupado por dia, acentos
// removidos na extração, lançamentos que quebram em mais de uma linha).
import * as pdfjsLib from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { BankParser, NormalizedRow } from '../types'
import { guessCategory, looksLikeInvestment } from '../base'
import { cleanDescription, guessPaymentMethod, parseBrlAmount, stripAccents } from '../common'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const MONTHS_NO_ACCENT = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const DAY_RE = /^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\b/
const START_RE = /^([A-Za-zÀ-ÿ ]+?):\s*"(.*)$/
const AMOUNT_TAIL_RE = /(-?R\$\s?[\d.,]+)\s+-?R\$\s?[\d.,]+\s*$/
const NOISE_PREFIXES = ['Fale com a gente', 'SAC:', 'Solicitado em', 'Ouvidoria']

function parseDayHeader(m: RegExpMatchArray): string {
  const day = parseInt(m[1], 10)
  const monthName = stripAccents(m[2]).toLowerCase()
  const year = parseInt(m[3], 10)
  const month = MONTHS_NO_ACCENT.indexOf(monthName) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // Agrupa por linha usando a coordenada Y, na ordem em que os itens vêm
    // (pdf.js já entrega em ordem de leitura na maioria dos casos).
    let lastY: number | null = null
    let line = ''
    const lines: string[] = []
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line)
        line = ''
      }
      line += item.str
      lastY = y
    }
    if (line) lines.push(line)
    parts.push(lines.join('\n'))
  }
  return parts.join('\n')
}

export function parseText(text: string): NormalizedRow[] {
  const lines = text.split(/\r?\n/).map((ln) => ln.trim()).filter(Boolean)

  const rows: NormalizedRow[] = []
  let currentDate: string | null = null
  let buffer: string[] = []
  let tipo: string | null = null

  const flush = () => {
    if (!tipo || buffer.length === 0 || currentDate === null) {
      buffer = []
      tipo = null
      return
    }
    const full = buffer.join(' ')
    const m = full.match(AMOUNT_TAIL_RE)
    if (!m || m.index === undefined) {
      buffer = []
      tipo = null
      return
    }
    const valorStr = m[1]
    const detail = full.slice(0, m.index).trim().replace(/"$/, '').trim()
    let amount = parseBrlAmount(valorStr)
    const direction = amount < 0 ? 'saida' : 'entrada'
    amount = Math.abs(amount)
    const desc = cleanDescription(detail)
    const isInv = looksLikeInvestment(tipo)
    rows.push({
      date: currentDate,
      description: desc || tipo,
      amount,
      direction,
      suggestedCategory: isInv ? 'Investimentos' : guessCategory(desc),
      // Combina Tipo + detalhe: a palavra-chave da forma de pagamento pode
      // estar em qualquer um dos dois campos, dependendo do banco.
      suggestedPaymentMethod: guessPaymentMethod(`${tipo} ${desc}`),
      isInvestmentLike: isInv,
      isCreditCardCharge: false,
      raw: full,
    })
    buffer = []
    tipo = null
  }

  for (const ln of lines) {
    if (NOISE_PREFIXES.some((p) => ln.startsWith(p))) {
      buffer = []
      tipo = null
      continue
    }

    const dayM = ln.match(DAY_RE)
    if (dayM) {
      flush()
      currentDate = parseDayHeader(dayM)
      continue
    }

    const startM = ln.match(START_RE)
    if (startM) {
      flush()
      tipo = startM[1].trim()
      buffer = [startM[2]]
      if (AMOUNT_TAIL_RE.test(ln)) flush()
      continue
    }

    if (tipo !== null) {
      buffer.push(ln)
      if (AMOUNT_TAIL_RE.test(ln)) flush()
    }
  }
  flush()
  return rows
}

export class InterPdfExtratoParser implements BankParser {
  bankId = 'inter'
  formatId = 'pdf_extrato'

  sniff(_bytes: ArrayBuffer, filename: string): boolean {
    // A checagem real (texto contém "Banco Inter" + "Saldo do dia") só é
    // possível de forma assíncrona (extração de PDF) — aqui só filtra pela
    // extensão; parse() retorna [] se o conteúdo não bater com o esperado.
    return filename.toLowerCase().endsWith('.pdf')
  }

  async parse(bytes: ArrayBuffer): Promise<NormalizedRow[]> {
    const text = await extractPdfText(bytes)
    const upper = stripAccents(text).toUpperCase()
    if (!upper.includes('BANCO INTER') || !upper.includes('SALDO DO DIA')) return []
    return parseText(text)
  }
}
