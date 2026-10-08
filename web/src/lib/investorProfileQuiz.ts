/**
 * Réplica exata de utils/investor_profile_quiz.py — perguntas, pesos,
 * faixas de pontuação e explicações do questionário de perfil de
 * investidor (função pura, sem I/O).
 */

export type QuizOption = { value: string; label: string; score: number }
export type QuizQuestion = { id: string; text: string; weight: number; options: QuizOption[] }

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 'horizonte',
    text: 'Em quanto tempo você provavelmente vai precisar resgatar a maior parte desse dinheiro?',
    weight: 1.5,
    options: [
      { value: 'curto', label: 'Menos de 1 ano', score: 0 },
      { value: 'medio', label: 'De 1 a 3 anos', score: 1 },
      { value: 'longo', label: 'De 3 a 10 anos', score: 2 },
      { value: 'muito_longo', label: 'Mais de 10 anos', score: 3 },
    ],
  },
  {
    id: 'queda_20',
    text: 'Se seus investimentos caíssem 20% em um mês, o que você faria?',
    weight: 1.5,
    options: [
      { value: 'vende_tudo', label: 'Resgataria tudo para evitar mais perdas', score: 0 },
      { value: 'vende_parte', label: 'Resgataria parte, por segurança', score: 1 },
      { value: 'mantem', label: 'Manteria, é esperado no longo prazo', score: 2 },
      { value: 'aporta_mais', label: 'Aproveitaria para investir mais', score: 3 },
    ],
  },
  {
    id: 'objetivo',
    text: 'Qual desses objetivos melhor descreve por que você está investindo?',
    weight: 1.0,
    options: [
      { value: 'preservar', label: 'Preservar o que já tenho, sem correr riscos', score: 0 },
      { value: 'complementar', label: 'Complementar a renda com algo estável', score: 1 },
      { value: 'crescer', label: 'Fazer o patrimônio crescer no médio prazo', score: 2 },
      { value: 'maximizar', label: 'Maximizar o retorno no longo prazo, aceitando oscilações', score: 3 },
    ],
  },
  {
    id: 'experiencia',
    text: 'Qual sua experiência com investimentos até hoje?',
    weight: 1.0,
    options: [
      { value: 'nenhuma', label: 'Nunca investi além da poupança', score: 0 },
      { value: 'basica', label: 'Já tenho CDB/Tesouro Direto', score: 1 },
      { value: 'intermediaria', label: 'Já invisto em ações/fundos imobiliários', score: 2 },
      { value: 'avancada', label: 'Já invisto em renda variável, cripto ou mercado internacional', score: 3 },
    ],
  },
  {
    id: 'estabilidade_renda',
    text: 'Como você descreveria a estabilidade da sua renda mensal?',
    weight: 1.0,
    options: [
      { value: 'instavel', label: 'Bem instável, varia bastante mês a mês', score: 0 },
      { value: 'alguma_variacao', label: 'Tem alguma variação, mas previsível', score: 1 },
      { value: 'estavel', label: 'Estável (CLT, funcionário público, etc.)', score: 2 },
      { value: 'estavel_alta', label: 'Estável e com boa margem de sobra', score: 3 },
    ],
  },
  {
    id: 'reserva_emergencia',
    text: 'Quanto você tem guardado em reserva de emergência (dinheiro de fácil acesso)?',
    weight: 1.0,
    options: [
      { value: 'nenhuma', label: 'Nada guardado', score: 0 },
      { value: 'parcial', label: 'Menos de 3 meses de gastos', score: 1 },
      { value: 'adequada', label: 'De 3 a 6 meses de gastos', score: 2 },
      { value: 'acima', label: 'Mais de 6 meses de gastos', score: 3 },
    ],
  },
  {
    id: 'pct_patrimonio',
    text: 'Que percentual do seu patrimônio total você pretende manter investido (fora a reserva de emergência)?',
    weight: 1.0,
    options: [
      { value: 'baixo', label: 'Até 20%', score: 0 },
      { value: 'medio', label: 'De 20% a 50%', score: 1 },
      { value: 'alto', label: 'De 50% a 80%', score: 2 },
      { value: 'muito_alto', label: 'Mais de 80%', score: 3 },
    ],
  },
  {
    id: 'reacao_alta',
    text: 'Se um investimento seu valorizasse 30% rápido, o que você faria?',
    weight: 1.0,
    options: [
      { value: 'vende_tudo', label: 'Venderia tudo para garantir o lucro', score: 0 },
      { value: 'vende_parte', label: 'Venderia parte e deixaria o resto', score: 1 },
      { value: 'mantem', label: 'Manteria, confiando na estratégia', score: 2 },
      { value: 'aporta_mais', label: 'Aportaria mais, aproveitando o momento', score: 3 },
    ],
  },
  {
    id: 'conhecimento',
    text: 'Você se sente confortável entendendo como funcionam ações, fundos imobiliários ou criptomoedas?',
    weight: 1.0,
    options: [
      { value: 'nada', label: 'Não entendo nada disso', score: 0 },
      { value: 'pouco', label: 'Entendo o básico', score: 1 },
      { value: 'razoavel', label: 'Entendo razoavelmente bem', score: 2 },
      { value: 'muito', label: 'Entendo bem e acompanho o mercado', score: 3 },
    ],
  },
  {
    id: 'diversificacao',
    text: 'Hoje, como está dividido o que você já investe?',
    weight: 1.0,
    options: [
      { value: 'so_renda_fixa', label: 'Só renda fixa (poupança, CDB, Tesouro)', score: 0 },
      { value: 'maioria_renda_fixa', label: 'Majoritariamente renda fixa, um pouco de variável', score: 1 },
      { value: 'equilibrado', label: 'Equilibrado entre renda fixa e variável', score: 2 },
      { value: 'maioria_variavel', label: 'Majoritariamente renda variável', score: 3 },
    ],
  },
]

const MAX_RAW_SCORE = QUESTIONS.reduce((acc, q) => acc + q.weight * 3, 0)

export const SCORE_CUTOFFS = [
  { maxScore: 33.0, profile: 'Conservador' },
  { maxScore: 66.0, profile: 'Moderado' },
  { maxScore: Infinity, profile: 'Arrojado' },
]

export const PROFILE_EXPLANATIONS: Record<string, string> = {
  Conservador:
    'Você prioriza segurança e previsibilidade. Prefere evitar oscilações, mesmo que isso signifique abrir mão de um retorno maior — faz sentido concentrar a carteira em reserva de liquidez e renda fixa de baixo risco.',
  Moderado:
    'Você aceita alguma oscilação na carteira em troca de um retorno melhor no médio/longo prazo, mas sem exagerar — um equilíbrio entre renda fixa e uma parcela de renda variável costuma fazer sentido pro seu perfil.',
  Arrojado:
    'Você tolera bem a volatilidade e tem um horizonte mais longo, priorizando potencial de retorno. Uma parcela maior em renda variável tende a fazer sentido, sempre com uma reserva de segurança por trás.',
}

/** answers: {questionId: optionValue}. Perguntas sem resposta contam
 * score 0 -- a UI já exige todas respondidas antes de liberar o botão
 * de ver resultado. Retorna {score: 0-100, profile}. */
export function scoreAnswers(answers: Record<string, string>): { score: number; profile: string } {
  let raw = 0
  for (const q of QUESTIONS) {
    const chosen = answers[q.id]
    if (chosen == null) continue
    const option = q.options.find((o) => o.value === chosen)
    if (!option) continue
    raw += q.weight * option.score
  }

  const score = MAX_RAW_SCORE ? Math.round((raw / MAX_RAW_SCORE) * 1000) / 10 : 0

  let profile = SCORE_CUTOFFS[SCORE_CUTOFFS.length - 1].profile
  for (const cutoff of SCORE_CUTOFFS) {
    if (score <= cutoff.maxScore) {
      profile = cutoff.profile
      break
    }
  }

  return { score, profile }
}
