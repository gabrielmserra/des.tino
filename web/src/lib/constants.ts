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
  'Outros',
]

// Categorias do planejamento: as mesmas + "Investimentos" antes de "Outros"
export const PLAN_CATEGORIES = [...CATEGORIES.slice(0, -1), 'Investimentos', 'Outros']

export const TYPE_LABELS: Record<string, string> = {
  entrada_fixa: 'Entrada Fixa',
  entrada_variavel: 'Entrada Variável',
  saida_fixa: 'Saída Fixa',
  saida_variavel: 'Saída Variável',
}
