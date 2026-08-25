// =====================================================================
// Edge Function: quick-tx
// Recebe um texto curto (ditado por voz no iOS, ex: "35 mercado almoço")
// e cria uma transação no app des.tino, criando o mês se necessário.
//
// Deploy:  supabase functions deploy quick-tx --no-verify-jwt
// Secrets: QUICK_TX_SECRET (segredo aleatório), QUICK_TX_USER_ID (seu uid)
//          SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo runtime.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Categoria por palavra-chave (ordem importa: mais específico primeiro)
const CATEGORY_KEYWORDS: [string, string[]][] = [
  ["Assinaturas", ["netflix", "spotify", "disney", "hbo", "prime video", "amazon prime", "youtube premium", "assinatura", "icloud", "chatgpt", "streaming", "globoplay", "paramount", "apple music", "apple tv", "game pass", "playstation plus", "steam", "kindle unlimited", "adobe", "canva", "openai", "notion", "dropbox", "onedrive"]],
  ["Viagem", ["viagem", "hotel", "airbnb", "pousada", "hospedagem", "passagem aérea", "passagem aerea", "resort", "milhas", "cvc", "agencia de viagem", "hostel", "123 milhas", "maxmilhas", "booking", "trivago", "expedia", "seguro viagem"]],
  ["Alimentação", ["food", "mercado", "supermercado", "comida", "almoço", "almoco", "janta", "jantar", "lanche", "restaurante", "ifood", "padaria", "açougue", "acougue", "feira", "café", "cafe", "caffe", "panqueca", "pizza", "hambúrguer", "hamburguer", "burguer", "sorvete", "doce", "rappi", "todeschini", "blumenauense", "casa luce", "grsa volvo", "massas", "espetinhos", "espaco soccer", "esfiha", "esfirra", "temaki", "sushi", "yakisoba", "churrasco", "grelhados", "quitanda", "food truck", "foodtruck", "açaí", "acai", "acaiteria", "cantina", "trattoria", "tratoria", "cuisine", "cuisina", "cucina", "wok to you", "pizza hut", "dominos", "mc donald", "mcdonald", "burger king", "bob's", "bobs", "habib's", "habibs", "subway", "giraffas", "spoleto", "china in box", "outback", "madero", "coco bambu", "kfc", "popeyes", "starbucks", "cacau show", "kopenhagen", "gelateria", "tapiocaria", "creperia", "hamburgueria", "pastelaria", "pastel", "coxinha", "carrefour", "atacadão", "atacadao", "assaí", "assai", "extra", "pão de açúcar", "pao de acucar", "angeloni", "condor", "zaffari", "muffato", "aish baladi", "lonatto"]],
  ["Transporte", ["uber", "99", "gasolina", "combustível", "combustivel", "álcool", "alcool", "ônibus", "onibus", "metrô", "metro", "estacionamento", "pedágio", "pedagio", "passagem", "parking", "mecânico", "mecanico", "oficina", "brt", "bilhete", "etanol", "cabify", "indriver", "localiza", "movida", "unidas", "ipva", "despachante", "pneu", "lava jato", "lavajato", "funilaria"]],
  ["Saúde", ["farmácia", "farmacia", "remédio", "remedio", "médico", "medico", "dentista", "consulta", "exame", "hospital", "academia", "fisioterapia", "psicólogo", "psicologo", "terapia", "vacina", "pronto socorro", "upa", "raio x", "tomografia", "ultrassom", "hemograma", "dasa", "fleury", "hapvida", "notredame", "sulamerica", "psiquiatra", "nutricionista", "oftalmo", "otorrino", "pediatra", "ginecolog", "drogasil", "pague menos", "raia", "panvel", "crossfit", "pilates", "yoga", "fisio"]],
  ["Moradia", ["aluguel", "condomínio", "condominio", "luz", "energia", "água", "agua", "gás", "gas", "iptu", "internet", "faxina", "diarista", "reforma", "eletrodoméstico", "eletrodomestico", "encanador", "eletricista", "chaveiro", "dedetização", "dedetizacao", "cemig", "enel", "celesc", "casan", "cpfl"]],
  ["Lazer", ["cinema", "show", "jogo", "game", "passeio", "parque", "festa", "balada", "bar", "beer", "cerveja", "bebida", "ingresso", "hobby", "boliche", "ruina", "shopping", "boa praca", "cardosogarden", "kartódromo", "kartodromo", "escape room", "zoológico", "zoologico", "museu", "exposição", "exposicao", "festival", "karaoke", "sinuca", "bilhar", "fliperama", "sympla", "eventim"]],
  ["Educação", ["curso", "livro", "faculdade", "escola", "mensalidade", "udemy", "alura", "apostila", "material escolar", "saraiva", "kumon", "wizard", "ccaa", "cna", "fisk", "coursera", "hotmart"]],
  ["Vestuário", ["roupa", "sapato", "tênis", "tenis", "camisa", "calça", "calca", "vestido", "blusa", "jaqueta", "meia", "renner", "riachuelo", "zara", "hering", "marisa", "centauro", "nike", "adidas", "decathlon", "melissa", "arezzo", "track field", "sapataria"]],
  ["Cuidados Pessoais", ["cabeleireiro", "salão", "salao", "barbeiro", "barbearia", "manicure", "cosmético", "cosmetico", "skincare", "perfume", "maquiagem", "depilação", "depilacao", "spa", "bronzeamento", "podologia", "tatuagem", "piercing", "boticário", "boticario", "natura", "eudora", "avon", "massagem"]],
  ["Pets", ["pet", "ração", "racao", "veterinário", "veterinario", "petshop", "cachorro", "gato", "tosa", "banho e tosa", "adestramento", "cobasi", "petz", "petlove"]],
  ["Investimentos", ["investimento", "aporte", "cdb", "lci", "lca", "tesouro", "tesouro direto", "selic", "ação", "acao", "ações", "acoes", "fii", "fiis", "cripto", "criptomoeda", "bitcoin", "previdência", "previdencia"]],
];

const UNIDADES: Record<string, number> = {
  "zero": 0, "um": 1, "uma": 1, "dois": 2, "duas": 2, "três": 3, "tres": 3,
  "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9,
  "dez": 10, "onze": 11, "doze": 12, "treze": 13, "quatorze": 14, "catorze": 14,
  "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19,
};
const DEZENAS: Record<string, number> = {
  "vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50,
  "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90,
};
const CENTENAS: Record<string, number> = {
  "cem": 100, "cento": 100, "duzentos": 200, "trezentos": 300, "quatrocentos": 400,
  "quinhentos": 500, "seiscentos": 600, "setecentos": 700, "oitocentos": 800, "novecentos": 900,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function strip(s: string): string {
  // remove acentos (faixa de marcas diacríticas combinantes U+0300–U+036F)
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ── Tipo do lançamento ────────────────────────────────────────────────
function detectType(text: string): { type: string; text: string; expectation: boolean } {
  let t = text;
  let expectation = false;
  if (/\bprevist[oa]\b|\bprevis[ãa]o\b/i.test(strip(t))) {
    expectation = true;
    t = t.replace(/\bprevist[oa]\b|\bprevis[ãa]o\b/gi, " ");
  }
  const s = strip(t);
  const test = (re: RegExp) => re.test(s);

  let type = "saida_variavel";
  if (test(/entrada fixa/)) { type = "entrada_fixa"; t = t.replace(/entrada fixa/gi, " "); }
  else if (test(/entrada variavel/)) { type = "entrada_variavel"; t = t.replace(/entrada vari[áa]vel/gi, " "); }
  else if (test(/saida fixa/)) { type = "saida_fixa"; t = t.replace(/sa[íi]da fixa/gi, " "); }
  else if (test(/saida variavel/)) { type = "saida_variavel"; t = t.replace(/sa[íi]da vari[áa]vel/gi, " "); }
  else if (test(/\bsalario\b/)) { type = "entrada_fixa"; }                       // mantém "salário" na descrição
  else if (test(/\b(recebi|receita|ganhei|entrada)\b/)) {
    type = "entrada_variavel";
    t = t.replace(/\b(recebi|receita|ganhei|entrada)\b/gi, " ");
  }
  else if (test(/\b(aluguel|financiamento|prestacao|parcela|mensalidade|assinatura|internet|condominio|luz|energia|agua|gas|telefone)\b/)) {
    type = "saida_fixa";                                                          // pistas de despesa fixa
  }
  return { type, text: t, expectation };
}

// ── Valor em dígitos ──────────────────────────────────────────────────
function extractDigitAmount(text: string): { value: number; match: string } | null {
  const t = text.replace(/r\$/gi, " ");
  let m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:reais|real)?\s*e\s*(\d{1,2})\s*centavos/i);
  if (m) return { value: parseInt(m[1].replace(/\./g, "")) + parseInt(m[2]) / 100, match: m[0] };
  m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})/);
  if (m) return { value: parseFloat(m[1].replace(/\./g, "") + "." + m[2]), match: m[0] };
  m = t.match(/(\d+)\.(\d{1,2})(?!\d)/);
  if (m) return { value: parseFloat(m[1] + "." + m[2]), match: m[0] };
  m = t.match(/(\d{1,3}(?:\.\d{3})+)(?!\d)/);
  if (m) return { value: parseInt(m[1].replace(/\./g, "")), match: m[0] };
  m = t.match(/(\d+)/);
  if (m) return { value: parseInt(m[1]), match: m[0] };
  return null;
}

// ── Valor por extenso (best-effort, inteiros) ─────────────────────────
function isNumWord(w: string): boolean {
  return w === "mil" || w in UNIDADES || w in DEZENAS || w in CENTENAS;
}
function extractSpelledAmount(text: string): { value: number; match: string } | null {
  const tokens = strip(text).split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length && !isNumWord(tokens[i])) i++;
  if (i >= tokens.length) return null;
  const start = i;
  let total = 0, current = 0, end = i;
  for (; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk === "e" && i > start) { end = i + 1; continue; }
    if (tk === "mil") { current = current === 0 ? 1 : current; total += current * 1000; current = 0; end = i + 1; continue; }
    if (tk in CENTENAS) { current += CENTENAS[tk]; end = i + 1; continue; }
    if (tk in DEZENAS) { current += DEZENAS[tk]; end = i + 1; continue; }
    if (tk in UNIDADES) { current += UNIDADES[tk]; end = i + 1; continue; }
    break;
  }
  const value = total + current;
  if (value <= 0) return null;
  return { value, match: tokens.slice(start, end).join(" ") };
}

// ── Categoria ─────────────────────────────────────────────────────────
function detectCategory(text: string): string {
  const s = strip(text);
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    for (const w of words) {
      if (s.includes(strip(w))) return cat;
    }
  }
  return "Outros";
}

// ── Descrição limpa ───────────────────────────────────────────────────
function cleanDescription(text: string, amountMatch: string): string {
  let d = text;
  if (amountMatch) d = d.replace(amountMatch, " ");
  d = d
    .replace(/r\$/gi, " ")
    .replace(/\b(reais|real|centavos)\b/gi, " ")
    .replace(/\b(de|do|da|no|na|com|gastei|paguei|comprei|gasto|despesa|um|uma)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!d) return "";
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function formatBRL(v: number): string {
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nowInSaoPaulo(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const year = parseInt(parts.find((p) => p.type === "year")!.value);
  const month = parseInt(parts.find((p) => p.type === "month")!.value);
  return { year, month };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const secret = String(body.secret ?? "");
  if (!secret || secret !== Deno.env.get("QUICK_TX_SECRET")) {
    return json({ error: "Não autorizado." }, 401);
  }
  const userId = Deno.env.get("QUICK_TX_USER_ID");
  if (!userId) return json({ error: "QUICK_TX_USER_ID não configurado." }, 500);

  const rawText = String(body.text ?? "").trim();
  if (!rawText) return json({ error: "Texto vazio." }, 400);

  // 1. Tipo (+ previsão)
  const { type, text: afterType, expectation } = detectType(rawText);

  // 2. Valor (dígitos → por extenso)
  const amt = extractDigitAmount(afterType) ?? extractSpelledAmount(afterType);
  if (!amt || amt.value <= 0) {
    return json({ error: "Não entendi o valor. Tente algo como \"35 mercado\"." }, 400);
  }

  // 3. Descrição e categoria
  const isIncome = type.startsWith("entrada");
  const desc = cleanDescription(afterType, amt.match) || (isIncome ? "Receita" : "Lançamento");
  const category = isIncome ? "Receita" : detectCategory(afterType);

  // 4. Mês atual (fuso de São Paulo) — cria se não existir
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { year, month } = nowInSaoPaulo();
  const monthName = `${MONTHS_PT[month - 1]} ${year}`;

  let monthId: number | null = null;
  const { data: existing } = await supabase
    .from("months").select("id").eq("user_id", userId).eq("name", monthName).maybeSingle();
  if (existing) {
    monthId = existing.id;
  } else {
    const { data: created, error: mErr } = await supabase
      .from("months").insert({ user_id: userId, name: monthName, year, month })
      .select("id").single();
    if (mErr) return json({ error: "Falha ao criar o mês: " + mErr.message }, 500);
    monthId = created.id;
  }

  // 5. Insere a transação
  const { error: tErr } = await supabase.from("transactions").insert({
    month_id: monthId,
    user_id: userId,
    type,
    description: desc,
    amount: amt.value,
    category,
    is_expectation: expectation,
  });
  if (tErr) return json({ error: "Falha ao lançar: " + tErr.message }, 500);

  const label = isIncome ? "Entrada" : "Saída";
  const prev = expectation ? " (previsto)" : "";
  return json({
    ok: true,
    message: `✅ ${label}${prev}: ${formatBRL(amt.value)} — ${desc} [${category}] em ${monthName}`,
    type, amount: amt.value, description: desc, category, month: monthName,
    is_expectation: expectation,
  });
});
