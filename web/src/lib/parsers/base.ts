// Palavras-chave → categoria, aplicadas sobre a descrição em maiúsculas sem
// acento. Best-effort — o usuário sempre pode ajustar na tela de revisão.
// Mantido em sincronia com parsers/base.py (desktop).
const CATEGORY_KEYWORDS: [string[], string][] = [
  [['IFOOD', 'RAPPI', 'UBER EATS', 'RESTAURANTE', 'LANCHONETE', 'PADARIA',
    'PANIFICADORA', 'CAFE', 'BAR ', 'CHURRASCARIA', 'PIZZARIA', 'BURGER',
    'ACOUGUE', 'MERCADO', 'SUPERMERCADO', 'HORTIFRUTI'], 'Alimentação'],
  [['UBER', '99APP', 'POSTO', 'COMBUSTIVEL', 'ESTACIONAMENTO', 'PEDAGIO',
    'METRO', 'ONIBUS', 'PASSAGEM'], 'Transporte'],
  [['FARMACIA', 'DROGARIA', 'HOSPITAL', 'CLINICA', 'LABORATORIO',
    'CONSULTA', 'PLANO DE SAUDE', 'UNIMED', 'AMIL'], 'Saúde'],
  [['NETFLIX', 'SPOTIFY', 'AMAZON PRIME', 'DISNEY', 'HBO', 'YOUTUBE',
    'ASSINATURA', 'MENSALIDADE'], 'Assinaturas'],
  [['CINEMA', 'INGRESSO', 'TEATRO', 'SHOW', 'BALADA', 'JOGO'], 'Lazer'],
  [['ALUGUEL', 'CONDOMINIO', 'IPTU', 'LUZ', 'ENERGIA', 'COPEL', 'SABESP',
    'AGUA', 'INTERNET', 'TELEFONE', 'CLARO', 'VIVO', 'TIM', 'OI '], 'Moradia'],
  [['FACULDADE', 'ESCOLA', 'CURSO', 'UDEMY', 'ALURA'], 'Educação'],
  [['LOJA', 'MAGAZINE', 'SHOPPING', 'VESTUARIO', 'CALCADOS'], 'Vestuário'],
  [['PET ', 'VETERINAR', 'PETSHOP'], 'Pets'],
]

const INVESTMENT_KEYWORDS = [
  'TESOURO DIRETO', 'APLICACAO', 'APLICAÇÃO', 'RESGATE',
  'CDB', 'LCI', 'LCA', 'FUNDO DE INVESTIMENTO',
]

export function guessCategory(description: string): string {
  const upper = description.toUpperCase()
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => upper.includes(k))) return category
  }
  return 'Outros'
}

export function looksLikeInvestment(historico: string): boolean {
  const upper = historico.toUpperCase()
  return INVESTMENT_KEYWORDS.some((k) => upper.includes(k))
}
