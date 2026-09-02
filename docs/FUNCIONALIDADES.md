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
- **[Web]** "Lembrar de mim" no login controla onde a sessão fica salva:
  marcado, guarda no `localStorage` e mantém o login entre fechamentos do
  navegador; desmarcado, guarda só no `sessionStorage` e expira ao fechar a
  aba/navegador.
- **[Ambas]** Criar conta nova por e-mail/senha (`/cadastro` no web) — se o
  projeto tiver confirmação de e-mail ativada, mostra aviso pra confirmar
  antes de entrar; senão, entra direto.
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
- **[Ambas]** Dia de corte configurável (ver [Configurações](#13-configurações)) —
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
- **[Ambas]** Forma de pagamento e **data do pagamento** são obrigatórias
  no lançamento — o campo de data já vem pré-preenchido com hoje (editável
  antes de salvar).
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
- **[Ambas]** **Compra parcelada real** — em vez de dividir o valor de
  cabeça e lançar já fracionado, o botão "🧾 Compra parcelada" (por cartão)
  abre um formulário (descrição, categoria, valor total, número de
  parcelas, primeira parcela) que gera e lança uma transação por mês, uma
  por parcela. A parcela do mês corrente entra como gasto real de uma vez;
  as parcelas de meses futuros entram como **previstas** (reaproveita o
  mesmo mecanismo de "previsto"/confirmação usado no resto do app) — os
  meses futuros necessários são criados automaticamente. Na lista de
  lançamentos, uma parcela aparece como "🧾 descrição (N/M)". Pagar a
  fatura do mês continua funcionando normalmente: só consolida a parcela
  daquele mês específico, as futuras ficam intactas.
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
- **[Ambas]** A renda do mês é montada como **uma ou mais entradas
  esperadas**, cada uma com valor e o dia do mês em que costuma cair (ex.:
  "R$5000 no dia 5" + "R$2860 no dia 24"), em vez de um número único —
  botão "✎ Editar entradas" abre a lista pra adicionar/remover/ajustar.
  Continua sendo só uma estimativa/meta do Planejamento — **nunca lança
  nenhuma transação real**, igual Dívidas/Metas/Contas Fixas.

## 6. Compromissos (Dívidas, Metas e Contas Fixas)

- **[Ambas]** As três funcionalidades abaixo vivem numa única tela
  "Compromissos", com uma aba pra cada uma — todas compartilham a mesma
  ideia: uma lista de itens com um cronograma de parcelas/instâncias com
  status pago/pendente/atrasado, e marcar como pago **nunca lança
  despesa nem mexe no saldo automaticamente** (é só um checklist de
  controle).
- **[Desktop]** Tela acessada pela barra lateral ("📋 Compromissos"), com
  as 3 abas dentro.
- **[Web]** Aba "Compromissos" (`/compromissos`) — na barra inferior no
  celular, ou direto na barra lateral no desktop —, com seletor de sub-aba
  (`?tab=dividas|metas|contas-fixas`). As rotas antigas (`/dividas`,
  `/metas`, `/contas-fixas`) redirecionam pra cá.

### 6.1 Dívidas

- **[Ambas]** Cadastro de dívidas com parcelas (nome, valor total, número de
  parcelas, vencimentos).
- **[Ambas]** Taxa de juros mensal opcional (financiamento de carro, imóvel,
  etc.) — com a taxa preenchida, "Gerar parcelas" calcula o valor de cada
  parcela pela Tabela Price (`PMT = valor_total × i / (1 - (1+i)⁻ⁿ)`) em vez
  de dividir o total igualmente; sem taxa, continua o split simples de
  sempre. A taxa é exibida ao lado do valor total no card da dívida.
- **[Ambas]** Marcar parcela como paga — **não gera lançamento nem mexe no
  saldo automaticamente** (é só um checklist de controle; o pagamento real,
  se quiser refletir no saldo, é lançado manualmente como uma Saída).
- **[Ambas]** Desfazer pagamento de parcela.
- **[Ambas]** Editar valor de uma parcela específica (as parcelas geradas
  pela Tabela Price continuam editáveis manualmente depois, pra ajustar
  arredondamento do banco ou trocar pra sistema SAC).

### 6.2 Metas de poupança

Três tipos de meta, lado a lado:

- **Meta simples** — **[Ambas]** valor-alvo único, contribuições avulsas até
  bater a meta.
- **Meta recorrente (mensal)** — **[Ambas]**
  - Valor mensal fixo, com ou sem valor-alvo total definido (aceita meta
    "sem fim", recorrente indefinidamente).
  - Gera um cronograma de parcelas mês a mês a partir de um mês inicial
    escolhido.
  - Cada parcela pode ser paga/desfeita individualmente, e seu valor pode
    ser editado parcela a parcela.
  - "Gerar mais parcelas" quando o cronograma atual se esgota.
  - Alvo definido é sempre recalculado como a soma das parcelas do
    cronograma (o alvo *é* o cronograma).
- **Meta de cronograma personalizado** — **[Ambas]**
  - Em vez de valor mensal fixo, o usuário monta o cronograma manualmente:
    cada parcela com **qualquer dia e qualquer valor** — ideal pra juntar um
    valor usando datas variadas dentro do mês (ex: dia 20 e dia 24, datas de
    salário) em vez de uma cadência mensal única.
  - Botão **"+ Adicionar parcela"** (em vez de "Gerar mais parcelas") abre
    o mesmo formulário de data + valor a qualquer momento.
  - Pagar/desfazer/editar valor de uma parcela funcionam exatamente igual
    às demais metas — nunca lança despesa nem mexe no saldo.
  - Com valor-alvo definido, mostra a **soma das parcelas cadastradas vs. o
    alvo** ("Cronograma: R$ X de R$ Y planejados") — aqui o alvo é
    independente e **não** é recalculado automaticamente pela soma (ao
    contrário da meta mensal), então dá pra ver o progresso de montar o
    cronograma até completar o valor desejado.

### 6.3 Contas Fixas

- **[Ambas]** Cadastro de contas recorrentes mensais — internet, luz, água,
  aluguel, condomínio etc. — cada uma com nome, valor esperado, dia de
  vencimento, categoria e forma de pagamento padrão.
- **[Ambas]** Instância do mês **corrente real** (calendário, não o mês de
  cobrança deslocado pelo dia de corte da importação) é criada
  automaticamente ao abrir a tela ou o Dashboard.
- **[Ambas]** Marcar como "paga"/"pendente" é um checklist puro — igual
  Dívidas e Metas, **não lança despesa nem mexe no saldo automaticamente**.
  Valor de cada instância do mês é editável antes de marcar como paga
  (ex.: luz/água variam mês a mês).
- **[Ambas]** Novo widget no Dashboard: **"Saldo após contas em aberto"** =
  saldo atual menos as contas do mês real ainda não pagas — mostra também
  um aviso compacto quando alguma conta pendente já passou do vencimento
  (ex.: "Internet venceu dia 20"), sem aumentar o tamanho do card.

## 7. Investimentos

- **[Ambas]** Registro de aportes e resgates por categoria: Ações, FIIs,
  Criptomoedas, CDB/LCI/LCA, Tesouro Direto, Previdência, Poupança, Outros.
- **[Ambas]** Acompanhamento do total investido e evolução do patrimônio.
- **[Ambas]** Detecção automática de aporte/resgate na importação de extrato
  (palavras-chave: "Tesouro Direto", "Aplicação", "Resgate", "CDB", "LCI",
  "LCA", "Fundo de Investimento") — sugerido como investimento, fora do
  fluxo normal de despesa/receita, mas confirmado pelo usuário na revisão.

## 8. Resumo dos Compromissos (Compromissos Futuros)

- **[Ambas]** Tela dedicada que soma, mês a mês (próximos 6 meses a partir
  do mês corrente), **tudo** que já está comprometido pra frente: parcelas
  de compras no cartão ainda previstas, dívidas em aberto e contas fixas
  pendentes — três subtotais por mês mais o total geral.
- **[Ambas]** O subtotal de cartão também inclui a **fatura em aberto**
  (gasto real do ciclo atual ainda não pago) de cada cartão, não só as
  parcelas futuras previstas. A fatura é rotulada pelo **mês em que o
  ciclo do cartão começou** (dia de fechamento configurado em cada
  cartão) — ex.: cartão que fecha dia 4 e vence dia 12: a fatura que
  fecha 04/09 é "a fatura de Agosto" (ciclo começou 04/08); a que abre a
  partir de 04/09 é "a de Setembro". Isso é independente do dia de corte
  global da importação de extrato (Configurações), que só decide em qual
  mês um lançamento importado cai — os dois não têm relação entre si.
- **[Ambas]** Rotulada "Resumo dos Compromissos" em toda a interface
  (barra lateral e título da tela) — mesmo nome nas duas versões.
- **[Desktop]** Tela acessada pela barra lateral do app ("💳 Resumo dos
  Compromissos").
- **[Web]** Tela acessada direto pela barra lateral no desktop, ou pela
  página "Mais" no celular (`/compromissos-futuros`).

## 9. Aviso proativo de risco de cartão

- **[Ambas]** Banner de alerta visível direto no Dashboard (sem precisar
  abrir a tela de Cartões) quando algum cartão está em nível de risco
  vermelho — limite quase estourado (≥90% usado) ou fatura vencendo em até
  3 dias com saldo negativo — reaproveita a mesma lógica de segurança já
  usada na tela de Cartões, não duplica critérios novos.
- **[Ambas]** Aviso adicional quando o **mês seguinte** já tem mais de
  R$300 em parcelas de cartão previstas.

## 10. Dashboard

- **[Ambas]** 18 widgets configuráveis, cada usuário escolhe quais quer ver
  e em que ordem:

  | Widget | Tipo |
  |---|---|
  | Saldo acumulado (destaque) | KPI grande |
  | Entradas | KPI |
  | Saídas | KPI |
  | Saldo VR/VA | KPI |
  | Saldo após contas em aberto | KPI (com aviso de vencimento) |
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
- **[Ambas]** No widget "Gastos por categoria ao longo do tempo", as
  categorias menos usadas no mês são agrupadas num grupo à parte,
  rotulado "Demais categorias" pra não confundir com a categoria
  "Outros" de verdade (que continua aparecendo do seu próprio jeito
  quando usada) — evita poluir o gráfico com muitas linhas/barras.

## 11. Importação de extrato bancário

- **[Ambas]** Importação de extrato da conta corrente do Banco Inter em três
  formatos: OFX, CSV e PDF.
- **[Ambas]** Importação da **fatura do cartão de crédito** do Banco Inter
  (só exportável em .csv) — pede qual cartão cadastrado é o dono da fatura
  (um seletor único pra todo o arquivo) e já lança tudo com forma de
  pagamento "Crédito" e vinculado a esse cartão. A linha do pagamento
  automático da fatura (valor negativo) é descartada automaticamente — o
  app já tem seu próprio fluxo de "Pagar Fatura" pra isso, importar
  duplicaria o pagamento.
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

## 12. Exportação

- **[Ambas]** Exportação do mês em **.xlsx** (Excel) formatado: cabeçalho
  com fundo escuro e texto branco em negrito, valores em moeda (R$),
  entradas em verde e saídas em vermelho, datas no formato DD/MM/AAAA,
  linha de totais, larguras de coluna ajustadas, congelamento do cabeçalho
  e filtro automático.
  - **[Desktop]** gerado com `openpyxl`.
  - **[Web]** gerado com `exceljs`, carregado sob demanda só na hora do
    clique em "Exportar" (não pesa no carregamento inicial do site).
- **[Ambas]** **Relatório Financeiro Completo em PDF**, com período
  escolhido pelo usuário (De/Até, por mês): resumo (entradas, saídas,
  saldo, taxa de poupança), evolução do saldo, gastos por categoria e por
  forma de pagamento, gastos ao longo do período, maiores gastos e a lista
  completa de lançamentos.
  - Botão "Baixar Relatório Completo" nas Configurações.
  - **[Desktop]** gerado com `matplotlib` (gráficos) + `reportlab` (PDF).
  - **[Web]** gerado com `canvas` nativo (gráficos) + `jsPDF`/`jspdf-autotable`
    (PDF), carregado sob demanda.

## 13. Configurações

- **[Ambas]** Dia de corte para importação de extrato (padrão: dia 1, ou
  seja, sem deslocamento de mês) — editável pelo usuário.
- **[Ambas]** Temas visuais (light/dark e variações), acessível pelo menu
  lateral (desktop) ou tela de Configurações (web).
- **[Ambas]** Botão "Baixar Relatório Completo" (ver [Exportação](#12-exportação)).

## 14. Atalho de voz (quick-tx)

- **[Web/Automação]** Edge Function no Supabase (`quick-tx`) que recebe um
  texto (ex. de um atalho de voz do celular) e cria um lançamento
  automaticamente, aplicando a mesma lógica de categorização por
  palavra-chave usada na importação de extrato.
- Requer redeploy manual (via painel do Supabase) sempre que o código da
  function muda — não é publicado automaticamente pelo pipeline normal do
  app.

## 15. Infraestrutura e sincronização

- **[Ambas]** Um único banco Supabase Postgres com Row Level Security por
  usuário — qualquer lançamento feito no desktop aparece no site/celular e
  vice-versa, em tempo real.
- **[Desktop]** Distribuído como executável Windows (`destino.exe`),
  empacotado com PyInstaller, com atualizações via GitHub Releases
  (versionado, ex. `v3.9.2`).
- **[Web]** Hospedado na Vercel, deploy automático a cada push na branch
  principal; PWA instalável.

## 16. Navegação do site

- **[Web]** A partir de 1024px de largura de tela (telas de computador),
  a navegação vira uma **barra lateral fixa** à esquerda, com os 9
  destinos direto na barra (Dashboard, Lançamentos, Cartões,
  Planejamento, Compromissos, Investimentos, Resumo dos Compromissos,
  Importar Extrato, Configurações) — não precisa mais passar pela página
  "Mais".
- **[Web]** Barra lateral **retrátil/expansível**: um botão no topo
  recolhe pra só ícones (útil pra ganhar espaço de conteúdo) ou expande
  de volta mostrando os rótulos; o estado escolhido fica salvo no
  navegador entre sessões.
- **[Web]** Abaixo de 1024px (celular e tablets estreitos), a navegação
  continua sendo a barra inferior fixa com "Mais" reunindo os destinos
  extras — sem nenhuma mudança nessas larguras.
