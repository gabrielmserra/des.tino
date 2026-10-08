/**
 * Réplica exata de utils/allocation_strategy.py — comparação entre a
 * carteira de investimentos (real ou fictícia) e a alocação-alvo por
 * classe de ativo, com diagnóstico em texto no mesmo estilo/tom do
 * Guru Financeiro (lib/tips.ts). Função pura, sem I/O. Nunca escreve
 * em transactions nem em investment_movements -- só lê e calcula.
 */
import { ASSET_CLASSES, ASSET_CLASS_LABELS, NAO_CLASSIFICADO, type AssetClass } from './assetClasses'
import { formatCurrency } from './format'
import type { Investment, InvestmentMovement } from './types'

// Acima desse percentual do total da carteira num único investimento,
// entra o alerta de concentração.
export const CONCENTRATION_THRESHOLD_PCT = 0.25

// Mesmo "6 meses" de referência do resto do app, aplicado
// especificamente à classe reserva_liquidez (mais preciso que a
// heurística do Dashboard, que usa o patrimônio investido total como
// proxy).
export const EMERGENCY_FUND_MONTHS_TARGET = 6
export const EMERGENCY_FUND_MONTHS_MIN = 3

export type TargetInfo = { target_pct: number; tolerance_pct: number }
export type ComparisonRow = {
  asset_class: string
  actual_value: number
  actual_pct: number
  target_pct: number
  tolerance_pct: number
  deviation_pct: number
  status: 'dentro' | 'acima' | 'abaixo'
  suggested_move_value: number
}
export type DiagnosisTone = 'red' | 'gold' | 'green' | 'blue'
export type DiagnosisTip = { icon: string; title: string; body: string; tone: DiagnosisTone }
export type MockItemLike = { asset_class: string; value: number }

// {investmentId: saldo} -- aporte_inicial+aporte-saque, mesma lógica
// de investmentBalance.ts:calcInvestmentBalance, reimplementada aqui
// pra não acoplar lib/ à camada de UI.
function investmentBalances(investments: Investment[], movements: InvestmentMovement[]): Map<number, number> {
  const byId = new Map<number, number>(investments.map((inv) => [inv.id, 0]))
  for (const m of movements) {
    if (!byId.has(m.investment_id)) continue
    const delta = m.movement_type === 'saque' ? -m.amount : m.amount
    byId.set(m.investment_id, (byId.get(m.investment_id) ?? 0) + delta)
  }
  return byId
}

export function aggregateByClass(
  investments: Investment[],
  movements: InvestmentMovement[],
): Record<string, number> {
  const balances = investmentBalances(investments, movements)
  const result: Record<string, number> = {}
  for (const inv of investments) {
    const balance = balances.get(inv.id) ?? 0
    if (balance <= 0) continue
    const cls = inv.asset_class || NAO_CLASSIFICADO
    result[cls] = (result[cls] ?? 0) + balance
  }
  return result
}

export function aggregateMockByClass(items: MockItemLike[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const it of items) {
    if (it.value <= 0) continue
    const cls = it.asset_class || NAO_CLASSIFICADO
    result[cls] = (result[cls] ?? 0) + it.value
  }
  return result
}

/** targetByClass: {assetClass: {target_pct, tolerance_pct}}.
 *
 * Retorna uma linha por classe (ordem de ASSET_CLASSES, com
 * "nao_classificado" no fim se houver saldo): valor atual, % atual, %
 * alvo, tolerância, desvio, status e suggestedMoveValue -- **só
 * informativo**, nunca executa nada. Convenção de sinal: positivo =
 * sugestão de mover dinheiro PRA essa classe; negativo = mover DESSA
 * classe pras outras. */
export function compareAllocation(
  actualByClass: Record<string, number>,
  targetByClass: Partial<Record<string, TargetInfo>>,
): ComparisonRow[] {
  const total = Object.values(actualByClass).reduce((a, b) => a + b, 0)

  const classesSeen = new Set([...Object.keys(actualByClass), ...Object.keys(targetByClass)])
  const ordered: string[] = ASSET_CLASSES.filter((c) => classesSeen.has(c))
  if (classesSeen.has(NAO_CLASSIFICADO)) ordered.push(NAO_CLASSIFICADO)

  return ordered.map((cls) => {
    const actualValue = actualByClass[cls] ?? 0
    const actualPct = total > 0 ? actualValue / total : 0
    const t = targetByClass[cls] ?? { target_pct: 0, tolerance_pct: 0 }
    const targetPct = t.target_pct
    const tolerancePct = t.tolerance_pct
    const deviationPct = actualPct - targetPct

    let status: ComparisonRow['status']
    if (deviationPct > tolerancePct) status = 'acima'
    else if (deviationPct < -tolerancePct) status = 'abaixo'
    else status = 'dentro'

    return {
      asset_class: cls,
      actual_value: round2(actualValue),
      actual_pct: round4(actualPct),
      target_pct: round4(targetPct),
      tolerance_pct: round4(tolerancePct),
      deviation_pct: round4(deviationPct),
      status,
      suggested_move_value: total > 0 ? round2(-deviationPct * total) : 0,
    }
  })
}

/** Gera dicas {icon, title, body, tone} no mesmo estilo/tom do Guru
 * Financeiro -- prioridade: alertas → neutros → positivos, no máximo
 * 5 (tela dedicada, não o top-3 do Dashboard). */
export function diagnose(
  comparisons: ComparisonRow[],
  investments: Investment[],
  movements: InvestmentMovement[],
  monthlyExpenses = 0,
): DiagnosisTip[] {
  const alerts: DiagnosisTip[] = []
  const neutral: DiagnosisTip[] = []
  const positive: DiagnosisTip[] = []

  const total = comparisons.reduce((a, c) => a + c.actual_value, 0)

  // 1. Desvios fora da faixa de tolerância, por classe
  for (const c of comparisons) {
    if (c.status === 'dentro') continue
    const label = ASSET_CLASS_LABELS[c.asset_class as AssetClass] ?? 'Não classificado'
    const pctAtual = c.actual_pct * 100
    const pctAlvo = c.target_pct * 100
    const pctDesv = Math.abs(c.deviation_pct) * 100
    const valorMover = formatCurrency(Math.abs(c.suggested_move_value))
    if (c.status === 'acima') {
      alerts.push({
        icon: '⚠️',
        title: `${label} acima da meta`,
        body: `${label} está em ${pctAtual.toFixed(0)}% da carteira, ${pctDesv.toFixed(0)} pontos acima da meta de ${pctAlvo.toFixed(0)}%. Considere mover cerca de ${valorMover} para outras classes.`,
        tone: 'gold',
      })
    } else {
      neutral.push({
        icon: '💡',
        title: `${label} abaixo da meta`,
        body: `${label} está em ${pctAtual.toFixed(0)}% da carteira, ${pctDesv.toFixed(0)} pontos abaixo da meta de ${pctAlvo.toFixed(0)}%. Considere direcionar cerca de ${valorMover} pra essa classe nos próximos aportes.`,
        tone: 'blue',
      })
    }
  }

  // 2. Concentração: um único investimento com peso excessivo
  if (total > 0) {
    const balances = investmentBalances(investments, movements)
    for (const inv of investments) {
      const bal = balances.get(inv.id) ?? 0
      if (bal <= 0) continue
      const share = bal / total
      if (share > CONCENTRATION_THRESHOLD_PCT) {
        alerts.push({
          icon: '⚠️',
          title: 'Concentração em um único ativo',
          body: `"${inv.name}" representa ${(share * 100).toFixed(0)}% da sua carteira. Concentração alta num único ativo aumenta o risco -- considere diversificar.`,
          tone: 'red',
        })
      }
    }
  }

  // 3. Reserva de emergência (classe reserva_liquidez vs meses de gasto)
  if (monthlyExpenses > 0) {
    const reserva = comparisons.find((c) => c.asset_class === 'reserva_liquidez')?.actual_value ?? 0
    const monthsCovered = reserva / monthlyExpenses
    if (monthsCovered < EMERGENCY_FUND_MONTHS_MIN) {
      alerts.push({
        icon: '⚠️',
        title: 'Reserva de emergência baixa',
        body: `Sua reserva de liquidez cobre ${monthsCovered.toFixed(1)} meses de gastos. O ideal é ter de ${EMERGENCY_FUND_MONTHS_MIN} a ${EMERGENCY_FUND_MONTHS_TARGET} meses guardados antes de priorizar outras classes.`,
        tone: 'red',
      })
    } else if (monthsCovered < EMERGENCY_FUND_MONTHS_TARGET) {
      const falta = Math.max(0, (EMERGENCY_FUND_MONTHS_TARGET - monthsCovered) * monthlyExpenses)
      neutral.push({
        icon: '💡',
        title: 'Reserva de emergência incompleta',
        body: `Você já tem ${monthsCovered.toFixed(1)} meses de gastos reservados. Faltam cerca de ${formatCurrency(falta)} para completar ${EMERGENCY_FUND_MONTHS_TARGET} meses de segurança.`,
        tone: 'blue',
      })
    }
  }

  if (alerts.length === 0 && neutral.length === 0) {
    positive.push({
      icon: '✅',
      title: 'Carteira alinhada ao seu perfil',
      body: 'Todas as classes de ativo estão dentro da faixa-alvo do seu perfil. Continue assim.',
      tone: 'green',
    })
  }

  return [...alerts, ...neutral, ...positive].slice(0, 5)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
