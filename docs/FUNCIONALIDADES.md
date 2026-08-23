# Funcionalidades do des.tino

Documento de referência com todas as funcionalidades do app, cobrindo a
versão desktop (Windows, `destino.exe`) e a versão web/PWA (site e celular,
`web/`). As duas versões compartilham o mesmo banco (Supabase Postgres) com
RLS por usuário — qualquer lançamento feito em uma aparece instantaneamente
na outra.

Legenda: **[Ambas]** funciona igual nas duas versões · **[Desktop]** só no
exe · **[Web]** só no site/PWA.

---

## 1. Conta e acesso

- **[Ambas]** Login por e-mail/senha (Supabase Auth).
- **[Web]** "Esqueci minha senha" com fluxo de redefinição por e-mail
  (`/esqueci-senha`, `/reset-password`).
- **[Web]** Instalável como PWA no celular (ícone na tela inicial, abre em
  tela cheia sem barra do navegador).
- **[Ambas]** Logout.

## 2. Períodos (meses)

- **[Ambas]** Cada mês é um período independente com seus próprios
  lançamentos, planejamento e saldo.
- **[Ambas]** Criar novo período ("+ Novo Período" no desktop; criado
  automaticamente ao navegar pro mês seguinte no web).
- **[Ambas]** Navegar entre meses já criados.
- **[Ambas]** Dia de corte configurável (ver [Configurações](#12-configurações)) —
  define a partir de que dia do mês um lançamento importado do extrato conta
  pro mês seguinte, alinhado à data de recebimento do salário.

## 3. Lançamentos

Quatro tipos de lançamento, cada um em sua própria aba:

- **Entradas Fixas** — receitas recorrentes (salário, etc.)
- **Entradas Variáveis** — receitas pontuais
- **Saídas Fixas** — despesas recorrentes (aluguel, assinaturas)
- **Saídas Variáveis** — despesas pontuais do dia a dia

Para cada lançamento:

- **[Ambas]** Descrição, valor, categoria, forma de pagamento, data.
- **[Ambas]** 13 categorias: Alimentação, Moradia, Transporte, Saúde, Lazer,
  Educação, Vestuário, Assinaturas, Cuidados Pessoais, Viagem, Pets,
  Investimentos, Outros.
- **[Ambas]** 8 formas de pagamento: Dinheiro, Pix, Débito, Crédito, VR/VA,
  Boleto, Transferência, Outro.
- **[Ambas]** Forma de pagamento é **obrigatória** no lançamento.
- **[Ambas]** Editar e excluir lançamentos.
- **[Ambas]** Marcar despesa/receita como "prevista" (ainda não efetivada) —
  entra no planejamento sem contar no saldo real ainda.
- **[Web]** Filtro de ordenação na tela de Lançamentos: mais recentes ↔ mais
  antigos primeiro, **pela data real do pagamento** (não pela data em que
  foi importado/cadastrado).
- **[Ambas]** Percentual de cartão de crédito por lançamento (ver
  [Cartões](#4-cartões-débito-crédito-e-benefícios)).

## 4. Cartões (débito, crédito e benefícios)

- **[Ambas]** Cadastro de cartões de crédito e de débito.
- **[Ambas]** Ao lançar uma despesa no crédito, é possível informar o
  **percentual da fatura** que aquele gasto representa (parcelamento
  simplificado).
- **[Ambas]** "Situação dos cartões" — acompanhamento de fatura por cartão.
- **[Ambas]** Saldo de benefícios (VR/VA) com controle de uso separado do
  saldo em conta.
- **[Web]** Tela dedicada "Cartões" (`/cartoes`) reúne cartões de
  crédito/débito e benefícios num só lugar (a antiga rota `/beneficios`
  redireciona pra cá).

## 5. Planejamento mensal

- **[Ambas]** Definir um valor planejado por categoria para o mês.
- **[Ambas]** Comparação visual entre planejado x realizado por categoria.
- **[Ambas]** Mesmas 13 categorias dos lançamentos (`PLAN_CATEGORIES`).

## 6. Dívidas

- **[Ambas]** Cadastro de dívidas com parcelas (nome, valor total, número de
  parcelas, vencimentos).
- **[Ambas]** Marcar parcela como paga — **não gera lançamento nem mexe no
  saldo automaticamente** (é só um checklist de controle; o pagamento real,
  se quiser refletir no saldo, é lançado manualmente como uma Saída).
- **[Ambas]** Desfazer pagamento de parcela.
- **[Ambas]** Editar valor de uma parcela específica.

## 7. Investimentos

- **[Ambas]** Registro de aportes e resgates por categoria: Ações, FIIs,
  Criptomoedas, CDB/LCI/LCA, Tesouro Direto, Previdência, Poupança, Outros.
- **[Ambas]** Acompanhamento do total investido e evolução do patrimônio.
- **[Ambas]** Detecção automática de aporte/resgate na importação de extrato
  (palavras-chave: "Tesouro Direto", "Aplicação", "Resgate", "CDB", "LCI",
  "LCA", "Fundo de Investimento") — sugerido como investimento, fora do
  fluxo normal de despesa/receita, mas confirmado pelo usuário na revisão.

## 8. Metas de poupança

Dois tipos de meta, lado a lado:

- **Meta simples** — **[Ambas]** valor-alvo único, contribuições avulsas até
  bater a meta.
- **Meta recorrente (parcelada)** — **[Ambas]**
  - Valor mensal fixo, com ou sem valor-alvo total definido (aceita meta
    "sem fim", recorrente indefinidamente).
  - Gera um cronograma de parcelas mês a mês a partir de um mês inicial
    escolhido.
  - Cada parcela pode ser paga/desfeita individualmente, e seu valor pode
    ser editado parcela a parcela.
  - "Gerar mais parcelas" quando o cronograma atual se esgota.
  - Igual às dívidas: marcar parcela como contribuída **não lança
    despesa nem mexe no saldo automaticamente** — é controle de checklist.

## 9. Dashboard

- **[Ambas]** 17 widgets configuráveis, cada usuário escolhe quais quer ver
  e em que ordem:

  | Widget | Tipo |
  |---|---|
  | Saldo acumulado (destaque) | KPI grande |
  | Entradas | KPI |
  | Saídas | KPI |
  | Saldo VR/VA | KPI |
  | Investimentos do mês | KPI |
  | Investimentos totais | KPI |
  | Despesas por categoria | Gráfico pizza |
  | Gastos por forma de pagamento | Gráfico pizza |
  | Entradas vs Saídas vs Investimentos | Gráfico |
  | Taxa de poupança | Indicador |
  | Metas de poupança | Lista |
  | Situação dos cartões | Lista |
  | Guru Financeiro (dicas) | Dicas automáticas |
  | Evolução do saldo (6 meses) | Gráfico de linha |
  | Gastos por categoria ao longo do tempo | Gráfico de linha |
  | Maiores gastos do mês | Lista |
  | Evolução do patrimônio investido | Gráfico de linha |
  | Gastos dos últimos 7 dias | Gráfico de barras |

- **[Desktop]** Edição via diálogo "Editar Dashboard" (`EditDashboardDialog`)
  — liga/desliga widgets e reordena numa lista.
- **[Web]** Mesma ideia via sheet de edição arrastável (drag & drop,
  `@dnd-kit`).
- **[Ambas]** Gráficos de pizza (categoria, forma de pagamento): fatias
  abaixo de 4% não mostram o rótulo dentro da fatia (evita poluição visual),
  mas a legenda sempre mostra o percentual de cada categoria.
- **[Web]** Gráficos de linha mostram o valor de cada ponto direto no
  gráfico (não precisa passar o mouse em cima), com tooltip formatado em
  R$ ao passar o mouse.

## 10. Importação de extrato bancário

- **[Ambas]** Importação de extrato do Banco Inter em três formatos: OFX,
  CSV e PDF.
- **[Ambas]** Categorização automática por palavras-chave na descrição do
  lançamento (ex.: "IFOOD", "UBER", "NETFLIX" → categoria correspondente),
  mantida em sincronia entre desktop (`parsers/base.py`), web
  (`web/src/lib/parsers/base.ts`) e o atalho de voz (`quick-tx`).
- **[Ambas]** Reconhecimento automático de accents/acentos e caixa (ex.:
  "café", "CAFE", "Café" tratados igual).
- **[Ambas]** Detecção de possíveis duplicatas antes de confirmar a
  importação — compara descrição, valor **e data exata** (lançamentos
  recorrentes no mesmo lugar e valor mas em dias diferentes, como um café
  comprado todo dia, **não** são marcados como duplicata).
  A data do lançamento suspeito de duplicata é exibida no aviso.
  - **[Web]** Lista de lançamentos a importar pode ser ordenada por data
    real do pagamento.
- **[Ambas]** Dia de corte configurável: lançamentos a partir do dia
  configurado nas Configurações contam pro mês seguinte, alinhando a
  importação com a data em que o salário cai.
- **[Ambas]** Detecção automática de aporte/resgate de investimento durante
  a importação.

## 11. Exportação

- **[Ambas]** Exportação do mês em **.xlsx** (Excel) formatado: cabeçalho
  com fundo escuro e texto branco em negrito, valores em moeda (R$),
  entradas em verde e saídas em vermelho, datas no formato DD/MM/AAAA,
  linha de totais, larguras de coluna ajustadas, congelamento do cabeçalho
  e filtro automático.
  - **[Desktop]** gerado com `openpyxl`.
  - **[Web]** gerado com `exceljs`, carregado sob demanda só na hora do
    clique em "Exportar" (não pesa no carregamento inicial do site).

## 12. Configurações

- **[Ambas]** Dia de corte para importação de extrato (padrão: dia 1, ou
  seja, sem deslocamento de mês) — editável pelo usuário.
- **[Ambas]** Temas visuais (light/dark e variações), acessível pelo menu
  lateral (desktop) ou tela de Configurações (web).

## 13. Atalho de voz (quick-tx)

- **[Web/Automação]** Edge Function no Supabase (`quick-tx`) que recebe um
  texto (ex. de um atalho de voz do celular) e cria um lançamento
  automaticamente, aplicando a mesma lógica de categorização por
  palavra-chave usada na importação de extrato.
- Requer redeploy manual (via painel do Supabase) sempre que o código da
  function muda — não é publicado automaticamente pelo pipeline normal do
  app.

## 14. Infraestrutura e sincronização

- **[Ambas]** Um único banco Supabase Postgres com Row Level Security por
  usuário — qualquer lançamento feito no desktop aparece no site/celular e
  vice-versa, em tempo real.
- **[Desktop]** Distribuído como executável Windows (`destino.exe`),
  empacotado com PyInstaller, com atualizações via GitHub Releases
  (versionado, ex. `v3.9.2`).
- **[Web]** Hospedado na Vercel, deploy automático a cada push na branch
  principal; PWA instalável.
