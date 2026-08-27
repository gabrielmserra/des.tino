export type Direction = 'entrada' | 'saida'

export type NormalizedRow = {
  date: string // "YYYY-MM-DD"
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
