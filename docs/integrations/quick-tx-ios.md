# Lançar transações por voz no iPhone (Atalho + Edge Function)

Permite registrar uma transação falando no iPhone (ex: *"35 mercado almoço"*),
sem abrir o app. O fluxo é:

```
Você fala  →  iPhone transcreve (Siri/ditado)  →  Atalho envia o texto
          →  Edge Function "quick-tx" interpreta e grava no Supabase
          →  aparece no app na próxima abertura
```

A função entende: valor em dígitos ou por extenso ("trinta e cinco"), o tipo
(entrada/saída, fixa/variável, "previsto"), e **categoriza sozinha** por
palavra-chave. Cria o mês automaticamente se ainda não existir.

---

## Parte 1 — Publicar a função no Supabase (uma vez)

A função está em [`supabase/functions/quick-tx/index.ts`](../../supabase/functions/quick-tx/index.ts).

### 1.1 — Descubra seu USER_ID
Painel do Supabase → **Authentication** → **Users** → clique no seu usuário →
copie o **User UID** (algo como `a1b2c3d4-...`).

### 1.2 — Crie um segredo aleatório
Invente uma senha longa só para autorizar o atalho, ex:
`qtx_8f3k9d2m7p1q5z` (qualquer string difícil de adivinhar). Guarde — você vai
colá-la no atalho também.

### 1.3 — Faça o deploy

**Opção A — Supabase CLI (recomendada)**

```bash
# instalar a CLI (Windows, via Scoop):  scoop install supabase
supabase login
supabase link --project-ref wbnefvskqudjnmafpqnn

# definir os segredos
supabase secrets set QUICK_TX_SECRET="qtx_8f3k9d2m7p1q5z" QUICK_TX_USER_ID="SEU_USER_UID"

# publicar (sem exigir JWT do Supabase — a proteção é o nosso segredo)
supabase functions deploy quick-tx --no-verify-jwt
```

**Opção B — Painel do Supabase (sem CLI)**
1. Menu **Edge Functions** → **Create a new function** → nome `quick-tx`.
2. Cole o conteúdo de `index.ts` no editor e **Deploy**.
3. Em **Edge Functions → quick-tx → Settings**, desligue **Verify JWT**.
4. Em **Project Settings → Edge Functions → Secrets** (ou a aba *Secrets* das
   funções), adicione:
   - `QUICK_TX_SECRET` = `qtx_8f3k9d2m7p1q5z`
   - `QUICK_TX_USER_ID` = `SEU_USER_UID`

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente no
> runtime — não precisa configurá-los.

### 1.4 — URL da função
```
https://wbnefvskqudjnmafpqnn.supabase.co/functions/v1/quick-tx
```

### 1.5 — Teste rápido (opcional, do PC)
```bash
curl -X POST "https://wbnefvskqudjnmafpqnn.supabase.co/functions/v1/quick-tx" \
  -H "Content-Type: application/json" \
  -d '{"secret":"qtx_8f3k9d2m7p1q5z","text":"35 mercado almoço"}'
```
Resposta esperada: `{"ok":true,"message":"✅ Saída: R$ 35,00 — Mercado almoço [Alimentação] em ..."}`

---

## Parte 2 — Montar o Atalho no iPhone

Abra o app **Atalhos** → **+** (novo atalho) → **Adicionar ação**:

1. **Ditar Texto** (Dictate Text)
   - Idioma: Português (Brasil). É aqui que você fala.

2. **Obter conteúdo de URL** (Get Contents of URL)
   - URL: `https://wbnefvskqudjnmafpqnn.supabase.co/functions/v1/quick-tx`
   - Toque em **Mostrar mais**:
     - **Método**: `POST`
     - **Cabeçalhos**: adicione `Content-Type` = `application/json`
     - **Corpo da solicitação**: `JSON`, com dois campos:
       - `secret` (Texto) = `qtx_8f3k9d2m7p1q5z`
       - `text` (Texto) = variável **Texto Ditado** (toque para inserir)

3. **Obter valor do dicionário** (Get Dictionary Value)
   - Chave: `message`
   - Entrada: **Conteúdo da URL**

4. **Mostrar notificação** (Show Notification)
   - Texto: o **Valor do dicionário** do passo 3

Renomeie o atalho para algo curto como **"Novo Gasto"** e:
- **Adicionar à Tela de Início** (vira um ícone de 1 toque), e/ou
- Dispare por voz: *"Ei Siri, Novo Gasto"* → a Siri abre o atalho, você fala o
  lançamento e pronto.

---

## Como falar (exemplos)

| Você fala | Resultado |
|---|---|
| "35 mercado" | Saída variável R$ 35,00 · Alimentação |
| "trinta e cinco no mercado" | Saída variável R$ 35,00 · Alimentação |
| "120 e 90 centavos farmácia" | Saída variável R$ 120,90 · Saúde |
| "uber 28" | Saída variável R$ 28,00 · Transporte |
| "salário 5000" | Entrada fixa R$ 5.000,00 |
| "recebi 800 freela" | Entrada variável R$ 800,00 |
| "aluguel 1500" | Saída fixa R$ 1.500,00 · Moradia |
| "previsto 200 luz" | Saída fixa **prevista** R$ 200,00 · Moradia |

Regra simples: **diga o valor + uma descrição**. O resto (tipo e categoria) o
app deduz; se não reconhecer a categoria, cai em "Outros" e você ajusta no app.

---

## Segurança
- O atalho carrega apenas o **segredo** (`QUICK_TX_SECRET`), não a sua senha do
  app. Se vazar, é só trocar o segredo (refazer 1.2 + atualizar o atalho).
- A função só insere transações para o **seu** `QUICK_TX_USER_ID` — não acessa
  mais nada.
- A `service_role key` fica **só no servidor** (no runtime da função), nunca no
  telefone.

## Problemas comuns
- **401 "Não autorizado"**: o `secret` do atalho ≠ `QUICK_TX_SECRET` da função.
- **"Não entendi o valor"**: fale o número de forma clara ("35" ou "trinta e cinco").
- **Caiu em "Outros"**: a descrição não bateu com nenhuma palavra-chave — normal,
  ajuste a categoria no app ou inclua uma palavra conhecida (mercado, uber…).
- **Mês errado virou o mês**: a função usa o fuso de São Paulo; perto da virada
  do mês confira a data do aparelho.
