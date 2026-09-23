// Helpers compartilhados entre os parsers do Bradesco (CSV e PDF).
// decodeBytes/stripAccents/parseBrlAmount/cleanDescription vêm de '../common'
// (genéricos, compartilhados com o Inter) — aqui só a tabela de forma de
// pagamento, que é específica da redação do Bradesco ("Compra Elo Débito
// Vista" não bate com o "Compra no débito" do Inter).
// Mantido em sincronia com parsers/bradesco/common.py (desktop).
import { guessFromKeywordTable } from '../common'

const METHOD_KEYWORDS: [string[], string][] = [
  [['PIX ENVIADO', 'PIX RECEBIDO', 'PIX QR CODE'], 'pix'],
  [['COMPRA ELO DEBITO', 'COMPRA DEBITO'], 'debito'],
  [['PAGTO ELETRON', 'COBRANCA', 'BOLETO'], 'boleto'],
  [['TED', 'DOC', 'TRANSFERENCIA'], 'transferencia'],
]

export function guessPaymentMethod(historico: string): string {
  return guessFromKeywordTable(historico, METHOD_KEYWORDS)
}
