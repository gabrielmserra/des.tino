// Palavras-chave → categoria, aplicadas sobre a descrição em maiúsculas sem
// acento. Best-effort — o usuário sempre pode ajustar na tela de revisão.
// Mantido em sincronia com parsers/base.py (desktop).
// Pix/TED pra pessoa física (só o nome, sem palavra-chave de estabelecimento)
// nunca vai ser categorizado automaticamente — não tem como saber o motivo
// só pela descrição, fica "Outros" mesmo e o usuário ajusta na revisão.
const CATEGORY_KEYWORDS: [string[], string][] = [
  [['IFOOD', 'RAPPI', 'UBER EATS', 'RESTAURANTE', 'LANCHONETE', 'LANCHON',
    'PADARIA', 'PANIFIC', 'CAFE', 'BAR ', 'CHURRASCARIA', 'PIZZARIA',
    'PIZZA', 'BURGER', 'BURGUER', 'ACOUGUE', 'MERCADO', 'SUPERMERCADO',
    'HORTIFRUTI', 'CULINARIA', 'GASTRONOMIA', 'DOCERIA', 'SORVETERIA',
    'CONVENIENCIA', 'EMPORIO', 'BISTRO', 'COZINHA', 'BOTECO', 'CERVEJARIA',
    'ADEGA', 'TODESCHINI', 'BLUMENAUENSE', 'CASA LUCE', 'GRSA VOLVO'], 'Alimentação'],
  [['UBER', '99APP', '99POP', 'POSTO', 'COMBUSTIVEL', 'GASOLINA', 'ETANOL',
    'AUTO POSTO', 'PETRO', 'ESTACIONAMENTO', 'PEDAGIO', 'METRO', 'ONIBUS',
    'PASSAGEM', 'LOCADORA', 'OFICINA', 'AUTOPECAS', 'BORRACHARIA',
    'MECANICA', 'TRANSPORTE'], 'Transporte'],
  [['FARMACIA', 'DROGARIA', 'HOSPITAL', 'CLINICA', 'LABORATORIO',
    'CONSULTA', 'PLANO DE SAUDE', 'UNIMED', 'AMIL', 'ODONTO', 'DENTISTA',
    'FISIOTERAPIA', 'PSICOLOG', 'ACADEMIA', 'SMARTFIT'], 'Saúde'],
  [['NETFLIX', 'SPOTIFY', 'AMAZON PRIME', 'DISNEY', 'HBO', 'YOUTUBE',
    'ASSINATURA', 'MENSALIDADE', 'ICLOUD', 'GOOGLE ONE', 'DEEZER'], 'Assinaturas'],
  [['CINEMA', 'INGRESSO', 'TEATRO', 'SHOW', 'BALADA', 'JOGO', 'GAMING',
    'APOSTA', 'BET', 'BOLICHE', 'PARQUE', 'CLUBE', 'FESTA', 'EVENTO'], 'Lazer'],
  [['ALUGUEL', 'CONDOMINIO', 'IPTU', 'LUZ', 'ENERGIA', 'COPEL', 'SABESP',
    'AGUA', 'INTERNET', 'TELEFONE', 'CLARO', 'VIVO', 'TIM ', 'OI ',
    'IMOBILIARIA', 'REFORMA', 'MATERIAL DE CONSTRUCAO'], 'Moradia'],
  [['FACULDADE', 'ESCOLA', 'CURSO', 'UDEMY', 'ALURA', 'COLEGIO',
    'UNIVERSIDADE', 'LIVRARIA'], 'Educação'],
  [['LOJA', 'MAGAZINE', 'SHOPPING', 'VESTUARIO', 'CALCADOS', 'BOUTIQUE',
    'MODA', 'CONFECCOES'], 'Vestuário'],
  [['PET ', 'VETERINAR', 'PETSHOP', 'PET SHOP'], 'Pets'],
  [['SALAO', 'BARBEARIA', 'ESTETICA', 'MANICURE', 'CABELEIREIRO',
    'COSMETICO', 'PERFUMARIA'], 'Cuidados Pessoais'],
  [['HOTEL', 'POUSADA', 'HOSTEL', 'AIRBNB', 'CVC', 'AGENCIA DE VIAGEM',
    'PASSAGEM AEREA', 'AZUL', 'GOL LINHAS', 'LATAM', 'DECOLAR'], 'Viagem'],
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
