// Comprimento da maior subsequência comum (LCS) entre duas strings —
// mesmo espírito do difflib.SequenceMatcher usado no desktop.
function lcsLength(a: string, b: string): number {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return 0
  let prev = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(0)
    for (let j = 1; j <= m; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    prev = cur
  }
  return prev[m]
}

// Razão de similaridade SIMÉTRICA: penaliza diferença de tamanho entre os
// dois textos. Boa quando os dois vêm da mesma fonte e têm tamanho
// parecido (ex.: duas versões do mesmo texto de extrato) — usada na
// detecção de duplicata da importação (Import.tsx). 1 = idênticas, 0 =
// nada em comum.
export function descriptionSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase()
  const s2 = b.toLowerCase()
  if (s1.length === 0 || s2.length === 0) return s1.length === s2.length ? 1 : 0
  return (2 * lcsLength(s1, s2)) / (s1.length + s2.length)
}

// Tamanho do maior TRECHO CONTÍNUO em comum (substring, não subsequência)
// — mesmo espírito do difflib.SequenceMatcher.find_longest_match usado no
// desktop. Diferente de lcsLength: aqui as letras precisam estar juntas,
// não só na mesma ordem — "LUZ" "aparecer" espalhado (com outras letras
// no meio) em "MINIMERCADO NEGRELLI" não conta.
function longestCommonSubstring(a: string, b: string): number {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return 0
  let prev = new Array(m + 1).fill(0)
  let best = 0
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(0)
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1
        if (cur[j] > best) best = cur[j]
      }
    }
    prev = cur
  }
  return best
}

// Razão de CONTENÇÃO: quanto do texto mais curto está de fato dentro do
// mais longo (como um trecho contínuo), sem penalizar pelo tamanho do
// texto maior. Melhor pra "esse apelido curto aparece dentro dessa
// descrição verbosa" (ex.: conta fixa "Internet" vs. lançamento "OI FIBRA
// INTERNET RESIDENCIAL") — usada pelo Guru Financeiro pra cruzar contas
// fixas com o extrato importado. Usa trecho contínuo (não a soma de
// pedaços espalhados tipo LCS) porque nomes curtos davam falso positivo
// feio contra descrições longas só por coincidência de letras soltas
// (ex.: "Luz" "batendo" com "MINIMERCADO NEGRELLI" sem nenhum trecho de
// verdade em comum). 1 = texto curto inteiramente contido no longo, 0 =
// nada em comum.
export function billMatchRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0
  return longestCommonSubstring(a, b) / Math.min(a.length, b.length)
}
