// Helpers compartilhados entre TODOS os parsers (Inter e Bradesco) — só
// guessPaymentMethod/METHOD_KEYWORDS aqui embaixo são específicos do Inter
// (a redação de cada banco é diferente, ver parsers/bradesco/common.ts).
// Mantido em sincronia com parsers/base.py + parsers/inter/common.py (desktop).

export function decodeBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(bytes)
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    }
  }
}

export function stripAccents(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

export function parseBrlAmount(raw: string): number {
  let s = raw.trim().replace('R$', '').trim()
  const negative = s.startsWith('-')
  s = s.replace(/^[+-]/, '').trim()
  s = s.replace(/\./g, '').replace(',', '.')
  const val = parseFloat(s)
  const n = isNaN(val) ? 0 : val
  return negative ? -n : n
}

// table: lista de [keywords, method] — primeira tupla cuja palavra-chave
// aparecer em `text` (maiúsculo, sem acento) vence. Cada banco tem sua
// própria tabela (a redação varia: "Compra no débito" do Inter x "Compra
// Elo Débito Vista" do Bradesco não têm substring em comum).
export function guessFromKeywordTable(text: string, table: [string[], string][]): string {
  const upper = stripAccents(text).toUpperCase()
  for (const [keywords, method] of table) {
    if (keywords.some((k) => upper.includes(k))) return method
  }
  return 'outro'
}

// "Histórico" do Inter (sem acento, maiúsculo) → forma de pagamento sugerida.
const METHOD_KEYWORDS: [string[], string][] = [
  [['PIX ENVIADO', 'PIX RECEBIDO'], 'pix'],
  [['COMPRA NO DEBITO'], 'debito'],
  [['PAGAMENTO DE BOLETO', 'BOLETO'], 'boleto'],
  [['PAGAMENTO EFETUADO', 'TED', 'DOC', 'TRANSFERENCIA'], 'transferencia'],
]

export function guessPaymentMethod(historico: string): string {
  return guessFromKeywordTable(historico, METHOD_KEYWORDS)
}

export function cleanDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
