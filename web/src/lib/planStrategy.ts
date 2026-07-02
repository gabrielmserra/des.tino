/**
 * Réplica exata de utils/plan_strategy.py — mesma fonte de cálculo do
 * desktop para a sugestão de planejamento (função pura, sem I/O).
 */

// Pesos da média ponderada — índice 0 é o mês mais recente
const WEIGHTS = [0.5, 0.3, 0.2]

// Teto recomendado de aporte em investimentos: 50% da renda do mês
export const INVESTMENT_CAP_PCT = 0.5

export type Suggestion = { amount: number; eventual: boolean; capped: boolean }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * history:        gastos por categoria de cada mês anterior, do mais
 *                 recente ao mais antigo (usa no máximo 3 meses).
 * incomeHistory:  renda de cada um desses mesmos meses, na mesma ordem.
 * targetIncome:   renda (real ou estimada) do mês sendo planejado.
 */
export function suggestAllocations(
  history: Record<string, number>[],
  incomeHistory: number[],
  targetIncome: number,
): Record<string, Suggestion> {
  const hist = history.slice(0, WEIGHTS.length)
  const incHist = incomeHistory.slice(0, WEIGHTS.length)
  const n = hist.length
  if (n === 0) return {}

  const useShare = targetIncome > 0 && incHist.some((v) => v > 0)

  const cats = new Set<string>()
  hist.forEach((m) => Object.keys(m).forEach((c) => cats.add(c)))

  const result: Record<string, Suggestion> = {}
  for (const cat of Array.from(cats).sort()) {
    const values = hist.map((m) => m[cat] ?? 0)
    const present = values.filter((v) => v > 0).length

    let amount: number
    if (useShare) {
      const pairs: [number, number][] = []
      values.forEach((v, i) => {
        const inc = incHist[i]
        if (inc && inc > 0) pairs.push([v, inc])
      })
      if (pairs.length > 0) {
        const shares = pairs.map(([v, inc]) => v / inc)
        const m = shares.length
        const share =
          m >= 3
            ? shares.reduce((acc, s, i) => acc + WEIGHTS[i] * s, 0)
            : shares.reduce((a, b) => a + b, 0) / m
        amount = share * targetIncome
      } else {
        amount = values.reduce((a, b) => a + b, 0) / n
      }
    } else {
      amount =
        n >= 3
          ? values.reduce((acc, v, i) => acc + WEIGHTS[i] * v, 0)
          : values.reduce((a, b) => a + b, 0) / n
    }

    if (amount <= 0) continue
    result[cat] = {
      amount: round2(amount),
      eventual: n >= 2 && present === 1,
      capped: false,
    }
  }

  if (targetIncome > 0 && Object.keys(result).length > 0) {
    const inv = result['Investimentos']
    const cap = round2(INVESTMENT_CAP_PCT * targetIncome)
    if (inv && inv.amount > cap) {
      inv.amount = cap
      inv.capped = true
    }
    const total = Object.values(result).reduce((a, r) => a + r.amount, 0)
    if (total > targetIncome) {
      const factor = targetIncome / total
      for (const r of Object.values(result)) {
        r.amount = round2(r.amount * factor)
      }
    }
  }

  return result
}

export function estimateIncome(incomeHistory: number[]): number {
  const hist = incomeHistory.slice(0, WEIGHTS.length)
  const n = hist.length
  if (n === 0) return 0
  if (n >= 3) return round2(hist.reduce((acc, v, i) => acc + WEIGHTS[i] * v, 0))
  return round2(hist.reduce((a, b) => a + b, 0) / n)
}
