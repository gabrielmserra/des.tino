# Feature 4 — Dashboard Personalizável

## Contexto do projeto

App desktop de finanças pessoais em **Python + Tkinter + Supabase**. As Features 1 (Planejamento Mensal), 2 (Dívidas) e 3 (VR/VA) já devem estar implementadas — vários cards desta feature dependem dos dados delas.

**Antes de implementar:** explore como o dashboard atual está construído (layout, componentes, fonte dos dados) e me apresente um plano. A refatoração aqui pode ser a maior do projeto — se o dashboard atual for monolítico, proponha primeiro a extração dos blocos existentes para o sistema de cards, depois os cards novos.

---

## Objetivo

Transformar o dashboard principal em uma grade de **widgets/cards configurável**: o usuário escolhe quais cards aparecem, em que ordem, e a configuração persiste entre sessões.

---

## Arquitetura sugerida

### Sistema de cards

- Criar uma **classe base `DashboardCard`** (Frame do Tkinter) com interface comum: `card_id`, `title`, `size` (ex: pequeno 1x1, largo 2x1), método `refresh()` para recarregar dados, e renderização padronizada (borda, título, corpo).
- Cada tipo de card é uma subclasse registrada em um **registry** (dict `card_id → classe + metadados`), para que adicionar um card novo no futuro seja só criar a classe e registrar.
- O dashboard vira um **grid container** que lê a configuração do usuário e instancia os cards na ordem definida.

### Persistência da configuração

```sql
create table dashboard_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  layout jsonb not null,        -- [{"card_id": "plan_summary", "position": 0, "size": "wide"}, ...]
  updated_at timestamptz default now(),
  unique (user_id)
);
```

- Fallback local (arquivo JSON) caso esteja offline, sincronizando quando possível — **somente se** o app já tiver algum mecanismo offline; senão, Supabase direto é suficiente.
- Layout padrão (default) definido em código para usuários sem configuração salva.

### Modo de edição

- Botão "Editar dashboard" no topo. No modo de edição:
  - Cada card exibe um "X" para remover e setas/botões para mover (cima/baixo ou esquerda/direita na grade). Drag-and-drop em Tkinter é trabalhoso — **setas de reordenação são suficientes**; só implemente drag se for simples com o que já existe.
  - Botão "+ Adicionar card" abre uma galeria (Toplevel) com todos os cards disponíveis: nome, descrição curta e preview/ícone, com indicação dos já adicionados.
- "Salvar" persiste; "Cancelar" descarta. Feedback visual claro de que está em modo de edição (ex: borda tracejada nos cards).

---

## Biblioteca de cards (implementar todos)

| # | card_id | Nome | Descrição | Dependência |
|---|---------|------|-----------|-------------|
| 1 | `plan_summary` | Plano vs. Realizado | Resumo do plano do mês: total planejado, gasto, restante, com barras por categoria (top 5 + "ver tudo") | F1 |
| 2 | `category_pie` | Gastos por Categoria | Gráfico de pizza/rosca dos gastos do mês corrente | — |
| 3 | `monthly_trend` | Evolução Mensal | Barras dos últimos 6 meses: total de gastos (e receitas, se couber) | — |
| 4 | `top_expenses` | Maiores Gastos | Top 5 gastos do mês com descrição, categoria e valor | — |
| 5 | `debts_overview` | Dívidas | Total em aberto, próximas parcelas (até 3) e contagem de atrasadas | F2 |
| 6 | `benefits_balance` | Saldo VR/VA | Saldo de cada benefício e dias até a renovação | F3 |
| 7 | `savings_rate` | Taxa de Poupança | % do recebido que sobrou no mês (e comparação com mês anterior) | — |
| 8 | `month_comparison` | Este Mês vs. Média | Gasto atual vs. média dos últimos 3 meses, por total e top categorias | — |
| 9 | `recurring_expenses` | Gastos Recorrentes | Gastos com mesma descrição/valor aproximado em 3+ meses consecutivos (assinaturas etc.) | — |
| 10 | `month_projection` | Projeção de Fim de Mês | Projeta o total do mês pelo ritmo diário atual (gasto até hoje ÷ dias corridos × dias do mês), com alerta se exceder o plano/renda | F1 (opcional) |
| 11 | `credit_cards` | Cartões de Crédito | (Extração do que já existe) faturas e limites dos cartões | — |
| 12 | `cash_balance` | Saldo Geral | (Extração do que já existe) saldo consolidado de contas | — |

> Os cards 11 e 12 são a migração do conteúdo atual do dashboard para o novo sistema — nada do que existe hoje pode sumir, apenas virar card.

### Detalhes de implementação dos cards

- **Gráficos**: usar o que o projeto já usa (matplotlib embutido via `FigureCanvasTkAgg`, ou Canvas puro). Se nada existir, prefira Canvas puro para pizza/barras simples (menos dependência, mais leve); matplotlib só se já estiver instalado.
- Cada card com dependência de feature ausente de dados (ex: nenhum plano criado) mostra um **estado vazio amigável** com call-to-action ("Crie seu plano do mês →") em vez de erro ou card em branco.
- `refresh()` de todos os cards é chamado ao trocar de mês ou registrar gasto/receita (evento centralizado ou refresh ao focar a tela — escolha o que se encaixa na arquitetura atual).
- Card de recorrentes (#9): heurística simples — agrupar por descrição normalizada (lowercase, trim) com valores variando até ±10% em 3+ meses. Documente a heurística no código.

---

## Edge cases

- Configuração salva referencia um `card_id` que não existe mais → ignorar silenciosamente e logar.
- Usuário remove todos os cards → permitir, mas exibir estado vazio com botão "Adicionar card".
- Janela redimensionada → a grade deve reorganizar (2 colunas em janela larga, 1 em estreita), dentro do razoável para Tkinter.
- Dois cards do mesmo tipo → não permitir duplicatas (na galeria, card já adicionado fica desabilitado).
- Performance: cards fazem queries independentes — agrupar/batch onde possível e carregar de forma que a UI não congele (após o desenho inicial; se necessário, `after()` para carregamento progressivo).

---

## Critérios de aceite

1. Entro no modo de edição, adiciono/removo/reordeno cards, salvo, fecho o app, reabro: o layout persiste.
2. Os 12 cards estão disponíveis na galeria e renderizam com dados reais.
3. Cards sem dados exibem estado vazio amigável, nunca erro.
4. Tudo que o dashboard antigo mostrava continua disponível (como cards).
5. O dashboard abre sem travamento perceptível.
6. Layout padrão sensato para quem nunca configurou.

## Como testar (gerar instruções ao final)

Roteiro manual cobrindo: configurar e persistir layout, cada card com e sem dados, redimensionamento da janela, e cancelar edição sem salvar.
