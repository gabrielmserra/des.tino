// Helpers compartilhados entre os parsers do Banco Inter (todos os formatos).
// Mantido em sincronia com parsers/inter/common.py (desktop).

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

// "Histórico" do Inter (sem acento, maiúsculo) → forma de pagamento sugerida.
const METHOD_KEYWORDS: [string[], string][] = [
  [['PIX ENVIADO', 'PIX RECEBIDO'], 'pix'],
  [['COMPRA NO DEBITO'], 'debito'],
  [['PAGAMENTO DE BOLETO', 'BOLETO'], 'boleto'],
  [['PAGAMENTO EFETUADO', 'TED', 'DOC', 'TRANSFERENCIA'], 'transferencia'],
]

export function guessPaymentMethod(historico: string): string {
  const upper = stripAccents(historico).toUpperCase()
  for (const [keywords, method] of METHOD_KEYWORDS) {
    if (keywords.some((k) => upper.includes(k))) return method
  }
  return 'outro'
}

export function cleanDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
