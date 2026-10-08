/**
 * Réplica exata de utils/asset_classes.py — taxonomia de classes de
 * ativo para a alocação-alvo por perfil de investidor. Separada de
 * INVESTMENT_CATEGORIES (constants.ts) de propósito -- aquela lista
 * alimenta o dropdown de categoria do investimento e a heurística de
 * concentração do Guru Financeiro, que não mudam. assetClass é um
 * recorte diferente (mais próximo de "risco/liquidez" que de
 * "produto"), usado só pela tela de Alocação.
 */

export const ASSET_CLASSES = [
  'reserva_liquidez',
  'renda_fixa_pos',
  'renda_fixa_inflacao_pre',
  'acoes',
  'fiis',
  'internacional',
  'cripto',
] as const

export type AssetClass = (typeof ASSET_CLASSES)[number]

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  reserva_liquidez: 'Reserva / Liquidez',
  renda_fixa_pos: 'Renda Fixa Pós-fixada',
  renda_fixa_inflacao_pre: 'Renda Fixa Inflação/Prefixada',
  acoes: 'Ações',
  fiis: 'FIIs',
  internacional: 'Internacional',
  cripto: 'Criptomoedas',
}

// Mapeamento usado só como sugestão inicial no diálogo de editar
// investimento -- sempre sobrescrevível pelo usuário por investimento.
// Categorias não listadas aqui (ex. "Outros") ficam sem classe ("Não
// classificado" na tela).
export const CATEGORY_TO_ASSET_CLASS: Record<string, AssetClass> = {
  'Poupança': 'reserva_liquidez',
  'CDB / LCI / LCA': 'renda_fixa_pos',
  'Tesouro Direto': 'renda_fixa_pos',
  'Previdência': 'renda_fixa_pos',
  'Ações': 'acoes',
  'FIIs': 'fiis',
  'Criptomoedas': 'cripto',
}

export const NAO_CLASSIFICADO = 'nao_classificado'
