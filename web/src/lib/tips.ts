// Guru Financeiro — porte fiel de ui/dashboard.py:_build_tips/_month_label/_fv
// (desktop). Mantido em sincronia manual com o Python — mesmas regras, mesmos
// limiares, mesmo texto.
import { formatCurrency, MONTHS_PT } from './format'
import type { MonthSummary, CategoryTotal, Goal, Investment } from './types'

export type TipTone = 'red' | 'gold' | 'green' | 'blue'

export type Tip = {
  icon: string
  title: string
  body: string
  tone: TipTone
}

export function monthLabel(monthsFromNow: number): string {
  const today = new Date()
  const total = today.getMonth() + monthsFromNow
  const year = today.getFullYear() + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  return `${MONTHS_PT[month]} ${year}`
}

export function futureValue(pmt: number, annualRate: number, years: number): number {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1
  const n = years * 12
  return r > 0 ? (pmt * (Math.pow(1 + r, n) - 1)) / r : pmt * n
}

type BuildTipsOptions = {
  goals?: Goal[]
  categories?: CategoryTotal[]
  history?: MonthSummary[] // meses anteriores, mais recente primeiro
  investments?: Investment[]
  totalInv?: number
  unpaidCards?: number
}

export function buildTips(s: MonthSummary, opts: BuildTipsOptions = {}): Tip[] {
  const { goals, categories, history, investments, totalInv = 0, unpaidCards = 0 } = opts

  const entradas = s.total_entradas ?? 0
  if (entradas <= 0) return []

  const saidas = s.total_saidas ?? 0
  const saidaFixa = s.saida_fixa ?? 0
  const entradaVar = s.entrada_variavel ?? 0
  const investidos = s.total_investimentos ?? 0
  const saldo = s.saldo ?? 0
  const invPct = investidos / entradas
  const gastoPct = saidas / entradas
  const savingsPct = Math.max(0, saldo / entradas)

  const alerts: Tip[] = []
  const neutral: Tip[] = []
  const positive: Tip[] = []

  // 0. Fatura(s) de cartão em aberto — sempre no topo
  if (unpaidCards > 0) {
    alerts.unshift({
      icon: '💳',
      title: 'Fatura de cartão em aberto',
      body: `Você tem ${formatCurrency(unpaidCards)} em faturas não pagas. Acesse a aba de Cartões ou o painel abaixo para pagar antes do vencimento e evitar juros.`,
      tone: 'red',
    })
  }

  // Média de aportes (meses com investimento > 0)
  const histInv = (history ?? []).map((h) => h.total_investimentos ?? 0)
  const allInv = [investidos, ...histInv].filter((v) => v > 0)
  const avgInv = allInv.length ? allInv.reduce((a, b) => a + b, 0) / allInv.length : 0

  // ── ALERTAS ──────────────────────────────────────────────────────────

  // 1. Déficit
  if (saldo < 0) {
    alerts.push({
      icon: '!',
      title: 'Déficit este mês',
      body: `Você está gastando ${formatCurrency(Math.abs(saldo))} a mais do que ganha. Revise os gastos variáveis com urgência e corte o que não é essencial.`,
      tone: 'red',
    })
  } else if (gastoPct > 0.8) {
    // 2. Gastos elevados
    alerts.push({
      icon: '!',
      title: 'Gastos elevados',
      body: `Despesas consumindo ${Math.round(gastoPct * 100)}% da renda (${formatCurrency(saidas)}). Abaixo de 70% é o ideal para ter margem.`,
      tone: 'gold',
    })
  }

  // 3. Tendência de alta nos gastos (vs mês anterior)
  if (history && history.length > 0 && saidas > 0) {
    const prevSaidas = history[0].total_saidas ?? 0
    if (prevSaidas > 0) {
      const crescimento = (saidas - prevSaidas) / prevSaidas
      if (crescimento > 0.12) {
        alerts.push({
          icon: '!',
          title: 'Gastos em tendência de alta',
          body: `Seus gastos subiram ${Math.round(crescimento * 100)}% em relação ao mês anterior (${formatCurrency(prevSaidas)} → ${formatCurrency(saidas)}). Se a tendência continuar, seu saldo vai encolher.`,
          tone: 'gold',
        })
      }
    }
  }

  // 4. Comprometimento de gastos fixos
  if (saidaFixa > 0 && saidaFixa / entradas > 0.55 && saldo >= 0) {
    alerts.push({
      icon: '!',
      title: 'Compromissos fixos elevados',
      body: `Gastos fixos representam ${Math.round((saidaFixa / entradas) * 100)}% da renda (${formatCurrency(saidaFixa)}). Revise assinaturas, parcelas e aluguéis — quanto menos fixo, mais flexibilidade.`,
      tone: 'gold',
    })
  }

  // 5. Categorias pesadas
  if (categories && categories.length > 0 && saidas > 0) {
    const pesadas = categories.filter((c) => c.total / entradas > 0.2)
    if (pesadas.length >= 2) {
      const nomes = pesadas.slice(0, 2).map((c) => c.category).join(' e ')
      const totalPesadas = pesadas.slice(0, 2).reduce((a, c) => a + c.total, 0)
      alerts.push({
        icon: '!',
        title: 'Múltiplas categorias pesadas',
        body: `${nomes} juntas consomem ${Math.round((totalPesadas / entradas) * 100)}% da renda (${formatCurrency(totalPesadas)}). Focar o corte aqui gera mais impacto.`,
        tone: 'gold',
      })
    } else if (pesadas.length === 1) {
      const top = pesadas[0]
      alerts.push({
        icon: '!',
        title: `${top.category} em destaque`,
        body: `Gastos com ${top.category.toLowerCase()} consomem ${Math.round((top.total / entradas) * 100)}% da renda (${formatCurrency(top.total)}). Veja se há margem para redução.`,
        tone: 'gold',
      })
    }
  }

  // ── NEUTROS / EDUCATIVOS ─────────────────────────────────────────────

  // 6. Queda na taxa de poupança ao longo de 3 meses
  if (history && history.length >= 2) {
    const rates: number[] = []
    for (const h of history.slice(0, 3)) {
      const ent = h.total_entradas ?? 0
      if (ent > 0) rates.push((h.saldo ?? 0) / ent)
    }
    if (rates.length >= 2 && rates[0] > savingsPct + 0.07) {
      const trend = [...rates].reverse().map((r) => `${Math.round(r * 100)}%`).join(' → ') + ` → ${Math.round(savingsPct * 100)}%`
      neutral.push({
        icon: 'i',
        title: 'Taxa de poupança em queda',
        body: `Sua taxa de poupança caiu: ${trend}. Identifique o que mudou nos seus gastos antes que vire déficit.`,
        tone: 'gold',
      })
    }
  }

  // 7. Renda majoritariamente variável
  if (entradaVar / entradas > 0.55) {
    neutral.push({
      icon: 'i',
      title: 'Renda predominantemente variável',
      body: `${Math.round((entradaVar / entradas) * 100)}% das entradas vêm de fontes variáveis. Para rendas irregulares, a reserva de emergência ideal é de 9 a 12 meses de despesas — não apenas 6.`,
      tone: 'gold',
    })
  }

  // 8. Reserva de emergência em meses (patrimônio / despesa mensal)
  if (totalInv > 0 && saidas > 0) {
    const mesesCobertos = totalInv / saidas
    if (mesesCobertos < 3) {
      neutral.push({
        icon: 'i',
        title: `Reserva cobre só ${mesesCobertos.toFixed(1)} mês(es)`,
        body: `Seu patrimônio total (${formatCurrency(totalInv)}) cobre apenas ${mesesCobertos.toFixed(1)} meses de despesas. Para 6 meses, você precisa de ${formatCurrency(saidas * 6)}.`,
        tone: 'gold',
      })
    } else if (mesesCobertos < 6) {
      const faltaMeses = 6 - mesesCobertos
      neutral.push({
        icon: 'i',
        title: `Reserva em ${mesesCobertos.toFixed(1)} de 6 meses`,
        body: `Você está a caminho da reserva ideal. Faltam ${formatCurrency(saidas * faltaMeses)} para completar 6 meses de segurança.`,
        tone: 'gold',
      })
    }
  }

  // 9. Investimentos — dica com valor concreto
  const ideal10 = entradas * 0.1
  const ideal20 = entradas * 0.2
  if (investidos === 0) {
    const sugestao = saldo > 0 ? Math.min(saldo, ideal10) : ideal10
    neutral.push({
      icon: '$',
      title: 'Comece a investir',
      body: `Sem investimentos este mês. Aplicar ${formatCurrency(sugestao)} (10% da renda) em Tesouro Selic ou CDB liquidez diária já é um ótimo começo.`,
      tone: 'blue',
    })
  } else if (invPct < 0.1) {
    neutral.push({
      icon: '$',
      title: 'Aumente seus investimentos',
      body: `Investindo ${(invPct * 100).toFixed(1)}% da renda. Mais ${formatCurrency(ideal10 - investidos)} chegaria ao mínimo de 10%.`,
      tone: 'blue',
    })
  } else if (invPct < 0.2) {
    neutral.push({
      icon: '$',
      title: 'Você está no caminho certo',
      body: `Investindo ${(invPct * 100).toFixed(1)}% da renda. Mais ${formatCurrency(ideal20 - investidos)} atingiria os 20% da regra 50/30/20.`,
      tone: 'blue',
    })
  }

  // 10. Concentração do portfólio
  if (investments && investments.length >= 2) {
    const counts = new Map<string, number>()
    for (const inv of investments) {
      const cat = inv.category || 'Outros'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    let topCat = ''
    let topN = 0
    for (const [cat, n] of counts) {
      if (n > topN) {
        topCat = cat
        topN = n
      }
    }
    const conc = topN / investments.length
    if (conc >= 0.75) {
      neutral.push({
        icon: 'i',
        title: 'Portfólio concentrado',
        body: `${topN} de ${investments.length} investimentos estão em ${topCat} (${Math.round(conc * 100)}% do portfólio). Diversificar reduz risco e pode melhorar a rentabilidade.`,
        tone: 'gold',
      })
    }
  }

  // 11. Metas sem aporte
  if (goals && goals.length > 0) {
    const active = goals.filter((g) => (g.target_amount ?? 0) > 0)
    const paradas = active.filter((g) => (g.saved_amount ?? 0) === 0)
    if (paradas.length >= 2) {
      neutral.push({
        icon: 'i',
        title: `${paradas.length} metas sem nenhum aporte`,
        body: `"${paradas[0].name}" e "${paradas[1].name}" ainda não têm progresso. Aportes regulares, mesmo pequenos, fazem a diferença.`,
        tone: 'gold',
      })
    }
  }

  // ── POSITIVOS ────────────────────────────────────────────────────────

  // 12. Projeção de conclusão de meta com data
  if (goals && goals.length > 0 && avgInv > 0) {
    const active = goals.filter((g) => (g.target_amount ?? 0) > (g.saved_amount ?? 0) && (g.saved_amount ?? 0) > 0)
    if (active.length > 0) {
      const g = active[0]
      const restante = (g.target_amount ?? 0) - g.saved_amount
      const meses = Math.max(1, Math.round(restante / avgInv))
      const label = monthLabel(meses)
      positive.push({
        icon: '*',
        title: `Previsão: ${g.name}`,
        body: `No ritmo atual (${formatCurrency(avgInv)}/mês), você conclui "${g.name}" em ~${meses} ${meses > 1 ? 'meses' : 'mês'} (${label}).`,
        tone: 'green',
      })
    }
  }

  // 13. Projeção de juros compostos (5 e 10 anos)
  if (avgInv >= 50) {
    const fv5 = futureValue(avgInv, 0.12, 5)
    const fv10 = futureValue(avgInv, 0.12, 10)
    const depositos5 = avgInv * 60
    positive.push({
      icon: '$',
      title: 'Poder dos juros compostos',
      body: `Mantendo ${formatCurrency(avgInv)}/mês a 12% a.a. (≈CDI): em 5 anos → ${formatCurrency(fv5)} (depósitos: ${formatCurrency(depositos5)}). Em 10 anos → ${formatCurrency(fv10)}.`,
      tone: 'blue',
    })
  }

  // 14. Reserva de emergência completa
  if (totalInv > 0 && saidas > 0 && totalInv / saidas >= 6) {
    const mesesCobertos = totalInv / saidas
    positive.push({
      icon: '*',
      title: 'Reserva de emergência OK',
      body: `Seu patrimônio (${formatCurrency(totalInv)}) cobre ${mesesCobertos.toFixed(1)} meses de despesas — acima dos 6 meses recomendados. Excelente segurança financeira!`,
      tone: 'green',
    })
  }

  // 15. Todas as metas concluídas / quase concluída
  if (goals && goals.length > 0) {
    const active = goals.filter((g) => (g.target_amount ?? 0) > 0)
    const done = active.filter((g) => (g.saved_amount ?? 0) >= (g.target_amount || 1))
    if (active.length > 0 && done.length === active.length) {
      positive.push({
        icon: '*',
        title: 'Todas as metas concluídas!',
        body: `Parabéns! Todas as suas ${active.length} metas foram atingidas. Hora de definir novos desafios — ou elevar os aportes.`,
        tone: 'green',
      })
    } else {
      for (const g of active) {
        const tgt = g.target_amount || 1
        const svd = g.saved_amount ?? 0
        const pct = tgt > 0 ? svd / tgt : 0
        if (pct >= 0.8 && pct < 1.0) {
          positive.push({
            icon: '*',
            title: 'Meta quase concluída!',
            body: `"${g.name}" está em ${Math.round(pct * 100)}%! Falta apenas ${formatCurrency(tgt - svd)}.`,
            tone: 'green',
          })
          break
        }
      }
    }
  }

  // 16. Ótimo investidor
  if (invPct >= 0.2) {
    positive.push({
      icon: '*',
      title: 'Ótimo investidor!',
      body: `Parabéns! ${(invPct * 100).toFixed(1)}% da renda investida (${formatCurrency(investidos)}). Considere diversificar entre renda fixa (CDB, LCI/LCA, Tesouro IPCA+) e variável (ações, FIIs).`,
      tone: 'green',
    })
  }

  // 17. Taxa de poupança excelente / 18. Mês equilibrado (fallback)
  if (savingsPct >= 0.25 && invPct >= 0.15 && alerts.length === 0) {
    positive.push({
      icon: '*',
      title: 'Taxa de poupança excelente',
      body: `Guardando ${Math.round(savingsPct * 100)}% da renda e investindo ${Math.round(invPct * 100)}%. Os juros compostos trabalham por você — cada mês de consistência vale muito.`,
      tone: 'green',
    })
  } else if (saldo >= 0 && invPct >= 0.1 && gastoPct <= 0.7 && alerts.length === 0) {
    positive.push({
      icon: '*',
      title: 'Mês equilibrado',
      body: `Gastos em ${Math.round(gastoPct * 100)}%, ${Math.round(invPct * 100)}% investido e saldo positivo de ${formatCurrency(saldo)}. Continue assim.`,
      tone: 'green',
    })
  }

  // Prioridade: alertas → neutros → positivos, máximo 3
  return [...alerts, ...neutral, ...positive].slice(0, 3)
}
