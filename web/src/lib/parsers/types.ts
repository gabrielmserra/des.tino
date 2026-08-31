export type Direction = 'entrada' | 'saida'

export type NormalizedRow = {
  date: string // "YYYY-MM-DD"
  time?: string | null // "HH:MM:SS" — só OFX pode trazer isso
  description: string
  amount: number // sempre positivo — direction carrega o sinal
  direction: Direction
  suggestedCategory: string
  suggestedPaymentMethod: string
  isInvestmentLike: boolean
  isCreditCardCharge: boolean
  raw: string
}

export interface BankParser {
  bankId: string
  formatId: string
  sniff(bytes: ArrayBuffer, filename: string): boolean
  parse(bytes: ArrayBuffer): Promise<NormalizedRow[]>
}
