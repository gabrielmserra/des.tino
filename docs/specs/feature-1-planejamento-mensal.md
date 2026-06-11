# Feature 1 — Planejamento Mensal

## Contexto do projeto

App desktop de finanças pessoais em **Python + Tkinter + Supabase**. Hoje funciona como dashboard passivo (exibe gastos, receitas e cartões). Esta feature transforma o app em uma ferramenta ativa de planejamento: ao receber o salário, o usuário já destina o dinheiro para cada finalidade.

**Antes de implementar:** explore o código e o schema atual do Supabase, me apresente um resumo e um plano de implementação. Só code após minha aprovação. Apresente os SQLs de migração antes de aplicar.

---

## Objetivo

Gerar, no início de cada mês (ou quando o usuário registrar o recebimento), um **plano de alocação por categoria** baseado no histórico de gastos, permitir ajustes manuais, e acompanhar plano vs. realizado durante o mês.

---

## Comportamento detalhado

### 1. Geração do plano

- Gatilho: botão "Gerar plano do mês" (e/ou sugestão automática ao abrir o app em um mês sem plano).
- O app calcula uma sugestão de valor por categoria de gasto com base no histórico. Método padrão sugerido: **média ponderada dos últimos 3 meses** (peso maior para o mês mais recente, ex: 0.5 / 0.3 / 0.2). Implemente isso de forma isolada (uma função/classe de estratégia) para facilitar trocar o método depois.
- Casos sem histórico suficiente:
  - 1-2 meses de histórico → usar média simples do que existir.
  - Nenhum histórico → plano em branco para preenchimento manual, com aviso amigável.
- Categorias com gasto esporádico (apareceram em só 1 dos últimos 3 meses) devem entrar na sugestão com valor reduzido ou marcadas como "eventuais" — escolha uma abordagem e justifique.
- O plano deve considerar a **renda do mês** (salário informado ou estimado pelo histórico de receitas). Exibir: renda total, total alocado, e **sobra não alocada** (que pode virar poupança).

### 2. Ajuste e confirmação

- Tela de revisão: lista de categorias com valor sugerido editável (Entry/Spinbox por linha).
- Permitir adicionar categoria nova ao plano e remover categoria sugerida.
- Totalizador dinâmico: conforme o usuário edita, atualizar "total alocado" e "sobra". Se o alocado ultrapassar a renda, destacar em vermelho (não bloquear — só avisar).
- Botão "Confirmar plano" persiste o plano no Supabase com status `ativo`.
- O plano pode ser **reeditado durante o mês** (manter histórico simples de última modificação; não precisa de versionamento completo).

### 3. Acompanhamento (plano vs. realizado)

- Para cada categoria do plano: **planejado / gasto até agora / restante**, com barra de progresso.
- Cores de alerta: verde (< 70% consumido), amarelo (70-99%), vermelho (≥ 100%).
- Notificação visual no dashboard quando alguma categoria estourar.
- Gastos registrados no app são automaticamente vinculados à categoria correspondente do plano (mesmo campo de categoria já existente). Gastos em categoria fora do plano aparecem em um bloco "Fora do plano".

### 4. Histórico

- Tela ou seletor para consultar planos de meses anteriores, com o fechamento: planejado vs. realizado final por categoria e o "saldo" do mês.

---

## Modelo de dados sugerido (adaptar ao schema existente)

```sql
-- Tabela de planos mensais
create table monthly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  month date not null,                -- usar dia 1 do mês como referência
  income numeric not null default 0,  -- renda considerada
  status text not null default 'ativo', -- ativo | fechado
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, month)
);

-- Itens do plano (alocação por categoria)
create table monthly_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references monthly_plans on delete cascade,
  category text not null,             -- ou FK para tabela de categorias, se existir
  suggested_amount numeric,           -- valor sugerido pelo algoritmo
  planned_amount numeric not null,    -- valor confirmado pelo usuário
  is_mandatory boolean default false, -- usado pela Feature 2 (dívidas)
  unique (plan_id, category)
);
```

> Se já existir tabela de categorias, usar FK em vez de texto. Verifique antes.

---

## UI/UX (Tkinter)

- Nova aba/tela "Planejamento" no menu principal.
- Tela 1 — Revisão do plano: tabela editável (Treeview + edição inline ou Entries em Frame com scroll), cabeçalho com renda/alocado/sobra, botões Gerar sugestão / Confirmar.
- Tela 2 — Acompanhamento: cards ou linhas por categoria com barra de progresso (`ttk.Progressbar` ou Canvas customizado para controlar cores).
- Manter consistência visual com o restante do app (reaproveitar estilos/cores existentes).

---

## Edge cases

- Mês virou e o plano anterior não foi fechado → fechar automaticamente o anterior (status `fechado`) ao gerar o novo.
- Usuário gera plano duas vezes no mesmo mês → editar o existente, nunca duplicar (constraint `unique (user_id, month)` garante no banco; tratar o erro na UI).
- Gasto retroativo registrado em mês com plano fechado → atualizar o realizado daquele plano.
- Renda zero ou não informada → permitir plano mesmo assim, sem cálculo de sobra.

---

## Critérios de aceite

1. Consigo gerar um plano sugerido com 1-2 cliques e os valores refletem meu histórico.
2. Consigo editar valores, adicionar/remover categorias e confirmar.
3. Vejo planejado / gasto / restante por categoria, com cores de alerta.
4. Gastos novos atualizam o realizado automaticamente.
5. Consigo consultar planos de meses anteriores.
6. Nada do que já existia quebrou.

## Como testar (gerar instruções ao final)

Ao concluir, me entregue um roteiro de teste manual passo a passo, incluindo: gerar plano com histórico, gerar sem histórico, estourar uma categoria, e virar o mês.
