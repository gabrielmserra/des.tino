export const CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Vestuário',
  'Assinaturas',
  'Cuidados Pessoais',
  'Viagem',
  'Pets',
  'Investimentos',
  'Outros',
]

// Categorias do planejamento mensal — mesma lista (já inclui Investimentos)
export const PLAN_CATEGORIES = CATEGORIES

// Categorias de dívida: "Dívidas" (padrão) + as mesmas do app
export const DEBT_CATEGORIES = ['Dívidas', ...CATEGORIES]

export const INVESTMENT_CATEGORIES = [
  'Ações',
  'FIIs',
  'Criptomoedas',
  'CDB / LCI / LCA',
  'Tesouro Direto',
  'Previdência',
  'Poupança',
  'Outros',
]

export const TYPE_LABELS: Record<string, string> = {
  entrada_fixa: 'Entrada Fixa',
  entrada_variavel: 'Entrada Variável',
  saida_fixa: 'Saída Fixa',
  saida_variavel: 'Saída Variável',
}

export const PAYMENT_METHODS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  vr_va: 'VR/VA',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  outro: 'Outro',
}
