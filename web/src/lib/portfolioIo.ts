/**
 * Réplica exata de utils/portfolio_io.py — exportar/importar carteira
 * (real ou fictícia) em JSON versionado. Função pura, sem I/O (quem
 * chama cuida de ler o arquivo e escrever no banco).
 *
 * Validação estrita: qualquer problema estrutural rejeita o arquivo
 * inteiro -- diferente do import de extrato bancário (lib/parsers/),
 * que tolera linha malformada. Aqui o arquivo é pequeno, inteiramente
 * autoral do usuário, e uma importação parcial seria enganosa. Campos
 * desconhecidos são ignorados, não rejeitam. Nunca contém identificador
 * pessoal (sem user_id, e-mail, nome).
 */
import { ASSET_CLASSES } from './assetClasses'

export const SCHEMA_VERSION = 1
const SUPPORTED_SCHEMA_VERSIONS = new Set([1])
const KIND = 'des.tino_portfolio'

export const MAX_IMPORT_FILE_BYTES = 1_000_000
export const MAX_IMPORT_ITEMS = 200
const PCT_SUM_TOLERANCE = 0.01

export type PortfolioMode = 'absolute' | 'percentage'
export type PortfolioItemLike = { asset_class: string; label?: string | null; value: number }

export function buildExportPayload(name: string, items: PortfolioItemLike[], mode: PortfolioMode) {
  const key = mode === 'absolute' ? 'value' : 'pct'
  return {
    schema_version: SCHEMA_VERSION,
    kind: KIND,
    mode,
    portfolio_name: name,
    items: items.map((it) => ({ asset_class: it.asset_class, label: it.label ?? null, [key]: it.value })),
  }
}

/** Baixa o payload de export como arquivo .json -- única função deste
 * módulo que faz I/O (as acima são puras); replica o padrão de
 * lib/exportXlsx.ts (Blob + <a download> temporário). */
export function downloadPortfolioJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export type ImportedPortfolio = { name: string; mode: PortfolioMode; items: PortfolioItemLike[] }
export type ValidateResult = { ok: true; data: ImportedPortfolio } | { ok: false; error: string }

export function validateImportPayload(rawText: string): ValidateResult {
  if (new TextEncoder().encode(rawText).length > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, error: 'Arquivo muito grande (máximo 1 MB).' }
  }

  let data: unknown
  try {
    data = JSON.parse(rawText)
  } catch {
    return { ok: false, error: 'Arquivo inválido: não é um JSON válido.' }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'Arquivo inválido: formato inesperado.' }
  }
  const obj = data as Record<string, unknown>

  if (obj.kind !== KIND) {
    return { ok: false, error: 'Este arquivo não é uma carteira do des.tino.' }
  }
  if (typeof obj.schema_version !== 'number' || !SUPPORTED_SCHEMA_VERSIONS.has(obj.schema_version)) {
    return { ok: false, error: 'Versão do arquivo não suportada.' }
  }

  const mode = obj.mode
  if (mode !== 'absolute' && mode !== 'percentage') {
    return { ok: false, error: 'Arquivo inválido: modo desconhecido.' }
  }

  const itemsRaw = obj.items
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return { ok: false, error: 'Arquivo inválido: nenhum item encontrado.' }
  }
  if (itemsRaw.length > MAX_IMPORT_ITEMS) {
    return { ok: false, error: `Arquivo inválido: muitos itens (máximo ${MAX_IMPORT_ITEMS}).` }
  }

  const key = mode === 'absolute' ? 'value' : 'pct'
  const items: PortfolioItemLike[] = []
  let totalPct = 0

  for (const rawItem of itemsRaw) {
    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) {
      return { ok: false, error: 'Arquivo inválido: item malformado.' }
    }
    const item = rawItem as Record<string, unknown>

    const assetClass = item.asset_class
    if (typeof assetClass !== 'string' || !(ASSET_CLASSES as readonly string[]).includes(assetClass)) {
      return { ok: false, error: `Arquivo inválido: classe de ativo desconhecida ("${String(assetClass)}").` }
    }

    const rawValue = item[key]
    if (typeof rawValue !== 'number' || !isFinite(rawValue) || rawValue < 0) {
      return { ok: false, error: 'Arquivo inválido: valor inválido ou negativo.' }
    }

    const rawLabel = item.label
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel : null

    items.push({ asset_class: assetClass, label, value: rawValue })
    if (mode === 'percentage') totalPct += rawValue
  }

  if (mode === 'percentage' && Math.abs(totalPct - 1.0) > PCT_SUM_TOLERANCE) {
    return {
      ok: false,
      error: `Arquivo inválido: a soma dos percentuais é ${(totalPct * 100).toFixed(0)}%, deveria ser 100%.`,
    }
  }

  const rawName = obj.portfolio_name
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Carteira importada'

  return { ok: true, data: { name, mode, items } }
}
