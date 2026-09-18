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
- **[Ambas]** Filtro por forma de pagamento — quando "Crédito" é escolhido,
  aparece um subfiltro pra restringir a um cartão específico ("Todos" ou
  o nome de cada cartão cadastrado).
- **[Ambas]** Percentual de cartão de crédito por lançamento (ver
  [Cartões](#4-cartões-débito-crédito-e-benefícios)).
- **[Web]** Trocar o **tipo** do lançamento (ex.: Entrada Variável → Entrada
  Fixa, ou Saída Fixa → Saída Variável) direto no formulário de edição, via
  seletor Fixa/Variável — muda o lançamento de aba sem precisar excluir e
  recriar. O desktop não tem esse seletor na edição (o tipo é definido pela
  aba em que o lançamento foi criado e não muda depois).

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
  lançamentos, uma parcela aparece como "🧾 descrição (N/M)".
- **[Ambas]** "Situação dos cartões" — acompanhamento de fatura por cartão:
  gasto no ciclo aberto (ainda acumulando), fatura fechada aguardando
  pagamento (mostra o valor real até ser resolvida — não zera sozinha só
  porque um novo ciclo começou) e disponível (limite menos tudo que ainda
  não foi pago, ciclo aberto + fatura fechada).
- **[Ambas]** "Pagar Fatura" **marca** a fatura fechada como paga (fica
  registrada no histórico com todos os lançamentos originais intactos —
  eles continuam existindo e aparecendo normalmente em Lançamentos) em
  vez de apagar e consolidar tudo numa única linha. Se a fatura não for
  paga manualmente até a data de vencimento, é quitada sozinha
  automaticamente (assume paga, ex. débito automático) — verificado uma
  vez a cada abertura do app/site.
- **[Ambas]** Compra no cartão **nunca** entra no saldo/saídas/entradas
  (saldo atual, saldo acumulado, saldo após contas em aberto) — nem em
  aberto, nem depois de paga. É só controle/acompanhamento da fatura
  (Lançamentos + aba Cartões). O dinheiro saindo de verdade só é contado
  quando o pagamento da fatura aparece no **extrato da conta corrente**
  importado (ou lançado manualmente) — evita contar o mesmo gasto duas
  vezes.
- **[Ambas]** Histórico de faturas por cartão — lista as faturas já
  fechadas e resolvidas (pagas ou vencidas automaticamente), com período,
  total e data; cada fatura pode ser expandida pra ver os lançamentos que
  a compõem.
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
- **[Ambas]** Cada parcela tem status **paga**, **pendente** ou **atrasada**
  (vencimento já passou e não foi marcada como paga), com filtro por status
  e um resumo no topo mostrando total em aberto e quantas parcelas estão
  atrasadas.

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

### 10.1 Guru Financeiro

Widget de dicas automáticas — analisa o mês corrente (saldo, gastos por
categoria, histórico dos últimos meses, investimentos, metas, cartões e
dívidas) e mostra até 3 cartões, sempre nesta ordem de prioridade:

1. **Alertas** (vermelho/dourado) — o que precisa de atenção agora:
   fatura de cartão em aberto, parcela de dívida atrasada, déficit no mês,
   gastos consumindo mais de 80% da renda, alta de mais de 12% nos gastos
   vs. o mês anterior, gastos fixos acima de 55% da renda, e categorias que
   sozinhas (ou juntas, as duas maiores) consomem mais de 20% da renda.
2. **Neutros/educativos** (dourado/azul) — sinais mais sutis: gastos deste
   mês acima da **própria média histórica** do usuário (limiar adaptativo,
   não um corte fixo igual pra todo mundo — só aparece quando não há
   nenhum alerta mais forte já cobrindo o mesmo problema), taxa de
   poupança em queda ao longo de 3 meses, renda predominantemente
   variável, reserva de emergência abaixo de 6 meses de despesas,
   portfólio de investimentos concentrado, metas sem nenhum aporte, e
   sugestões de quanto investir pra chegar a 10%/20% da renda.
3. **Positivos** (verde) — reconhecimento quando algo vai bem: projeção de
   data de conclusão de meta no ritmo atual de aportes, projeção de juros
   compostos em 5 e 10 anos, reserva de emergência completa, metas
   concluídas ou quase lá, boa taxa de investimento e mês equilibrado.
- **[Ambas]** Cada cartão tem um ícone (não emoji de rosto — ⚠️ alerta,
  💡 dica, 💰 investimento, ✅ positivo, 💳 fatura, ⏰ dívida atrasada),
  cor de acordo com a severidade e um texto com números concretos (R$ e
  %), nunca genérico.
- **[Ambas]** Lógica centralizada e mantida idêntica entre desktop
  (`ui/dashboard.py:_build_tips`) e web (`web/src/lib/tips.ts`) —
  mesmas regras, mesmos limiares, mesmo texto nas duas versões.

## 11. Importação de extrato bancário

- **[Ambas]** Importação de extrato da conta corrente do Banco Inter em três
  formatos: OFX, CSV e PDF.
  - **[Web]** No Safari/iOS, o seletor de arquivo aceita o .ofx mesmo sem
    esse formato ter um tipo de arquivo reconhecido pelo sistema (UTI) —
    sem isso, o app Arquivos do iPhone escondia/bloqueava os .ofx,
    deixando só .csv/.pdf selecionáveis.
- **[Ambas]** Importação da **fatura do cartão de crédito** do Banco Inter
  (só exportável em .csv) — pede qual cartão cadastrado é o dono da fatura
  (um seletor único pra todo o arquivo) e já lança tudo com forma de
  pagamento "Crédito" e vinculado a esse cartão. A linha do pagamento
  automático da fatura (valor negativo) é descartada automaticamente — o
  app já tem seu próprio fluxo de "Pagar Fatura" pra isso, importar
  duplicaria o pagamento.
  - **[Ambas]** Compra parcelada identificada pela coluna "Tipo" do CSV
    (ex.: "Parcela 1/10") — a descrição do lançamento importado ganha
    "(parcela N/M)" pra deixar claro qual parcela é e de quantas. Como o
    Inter manda cada parcela como uma linha própria em faturas de meses
    diferentes (sem nenhum identificador ligando as parcelas de uma mesma
    compra entre si), a importação não agrupa isso como uma "Compra
    parcelada" de verdade (ver [Cartões](#4-cartões-débito-crédito-e-benefícios))
    — só marca a informação na descrição de cada parcela importada.
- **[Ambas]** Categorização automática por palavras-chave na descrição do
  lançamento (ex.: "IFOOD", "UBER", "NETFLIX" → categoria correspondente),
  mantida em sincronia entre desktop (`parsers/base.py`), web
  (`web/src/lib/parsers/base.ts`) e o atalho de voz (`quick-tx`). Siglas
  curtas de risco (ex.: "IFD", abreviação comum de iFood em lançamentos de
  cartão) só contam quando aparecem como palavra isolada, não coladas em
  outra palavra — evita categorizar errado por coincidência de letras.
- **[Ambas]** Reconhecimento automático de accents/acentos e caixa (ex.:
  "café", "CAFE", "Café" tratados igual).
- **[Ambas]** Detecção de possíveis duplicatas antes de confirmar a
  importação — precisa ter valor igual, **data exata** igual e descrição
  **parecida** pra ser sinalizado (lançamentos recorrentes no mesmo lugar e
  valor mas em dias diferentes, como um café comprado todo dia, **não** são
  marcados como duplicata; dois Pix de mesmo valor/dia mas pra pessoas
  diferentes também não, já que a descrição não bate).
  A data do lançamento suspeito de duplicata é exibida no aviso.
  - **[Web]** Lista de lançamentos a importar pode ser ordenada por data
    real do pagamento.
  - **[Ambas]** A comparação de descrição usa o texto **original** lido do
    extrato/fatura no momento da importação (congelado, nunca muda), não a
    descrição atual do lançamento — renomear um lançamento depois de
    importado (ex.: trocar "SL MARECHAL CURITIBA BRA" por "Padaria da
    esquina") não atrapalha a detecção de duplicata numa reimportação
    futura do mesmo extrato/fatura.
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
  (versionado, ex. `v4.4.5`).
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

## 17. Banco de dados (Supabase Postgres)

Um único banco Postgres (Supabase) é a fonte de verdade das duas versões.
Toda tabela tem Row Level Security (RLS) ligada com a mesma política em
todo o projeto — `for all using (auth.uid() = user_id) with check
(auth.uid() = user_id)` — então cada usuário só enxerga suas próprias
linhas, sem nenhum filtro extra no código do app. A maior parte da lógica
de negócio (cálculos, regras de quando debitar saldo, etc.) mora em
**funções SQL (RPC)** chamadas pelo app — não em código Python/TS —
justamente pra desktop e web nunca divergirem: os dois chamam a mesma
função e recebem o mesmo resultado. Funções simples de leitura (sem
efeito colateral) rodam `stable`; funções que escrevem não têm essa
marcação. Todas são `SECURITY INVOKER` (padrão do Postgres) — a RLS do
usuário que chamou continua valendo dentro da função.

O schema é versionado como uma sequência de migrações SQL em
`docs/migrations/001_*.sql` a `040_*.sql` (uma por mudança, nunca
editadas depois de escritas), cada uma rodada manualmente pelo usuário no
SQL Editor do Supabase. Convenção importante: `create or replace
function` só troca a implementação se a lista de tipos de parâmetro for
idêntica à já existente — mudar a assinatura (adicionar/remover
parâmetro) sem um `drop function if exists (<assinatura antiga>)` antes
cria uma segunda função com o mesmo nome em vez de substituir, deixando
duas versões coexistindo. Toda migração deste projeto que muda uma
assinatura já dropa a versão antiga primeiro (ver 009, 021, 023, 025,
031, 040 como exemplos).

As tabelas `months`, `transactions`, `credit_cards`, `investments`,
`investment_movements` e `goals` são anteriores à pasta `docs/migrations`
(criadas direto no painel do Supabase antes desse versionamento existir)
— por isso não têm um arquivo `create table` correspondente no repositório,
só os `alter table` incrementais que vieram depois.

### 17.1 Tabelas

**`months`** — um período (mês) do app.
`id, user_id, name, year, month, created_at, opening_balance` (opening_balance:
"âncora" opcional do saldo acumulado, migração 019).

**`transactions`** — todo lançamento (entrada/saída), de qualquer origem
(manual, importado, gerado por outra feature como parcela de dívida ou
conta fixa).
`id, month_id, user_id, type, description, amount, category, created_at,
card_id, is_expectation, benefit_id, debit_card_id, payment_method,
payment_date, card_purchase_id, installment_number, installment_total,
imported, payment_time, invoice_id, import_raw`.
`type` é um de `entrada_fixa/entrada_variavel/saida_fixa/saida_variavel`.
Colunas adicionadas ao longo do tempo (por migração): `benefit_id` (003),
`debit_card_id`+`payment_method` (009), `payment_date` (014),
`card_purchase_id`+`installment_number`+`installment_total` (027),
`imported` (032), `payment_time` (033), `invoice_id` (035), `import_raw`
(038, descrição original do parser no momento da importação, imutável —
usada na detecção de duplicata pra sobreviver a renomeações).

**`credit_cards`** — `id, user_id, name, limit, due_day, closing_day,
color, created_at`.

**`card_invoices`** (migração 035) — fatura fechada e resolvida (paga ou
vencida automaticamente) de um cartão. `id, user_id, card_id, cycle_start,
due_date, total, paid_at, auto_settled, created_at`. Uma vez criada, as
`transactions` daquele ciclo ganham `invoice_id` apontando pra cá — elas
não são apagadas nem movidas, só ganham esse vínculo extra.

**`card_purchases`** (migração 027) — cabeçalho de uma compra parcelada
real no cartão. `id, user_id, card_id, description, category,
total_amount, installment_count, created_at`. Cada parcela é uma linha
normal em `transactions` com `card_purchase_id` apontando pra cá.

**`debit_cards`** (migração 009, exclusivo web) — `id, user_id, name,
color, created_at`. Tabela separada de `credit_cards` de propósito: cartão
de débito não tem fatura/vencimento/limite, e isolar evita qualquer risco
de quebrar o desktop (que nunca lê essa tabela nem a coluna
`transactions.debit_card_id`).

**`benefit_cards`** (migração 003) — saldo de VR/VA. `id, user_id, name,
benefit_type ('VR'|'VA'), balance, renewal_day, recharge_amount,
recharge_mode ('acumula'|'zera'), last_renewal, color, archived_at,
created_at`. Exclusão é "arquivar" (`archived_at`), nunca deleta de
verdade — mantém os gastos já vinculados intactos.

**`benefit_renewals`** (migração 003) — auditoria de cada recarga
automática aplicada. `id, benefit_id, user_id, renewed_at, amount,
balance_before, balance_after, created_at`.

**`investments`** — `id, user_id, name, category, archived_at,
created_at`.

**`investment_movements`** — cada aporte/saque. `id, investment_id,
user_id, month_id, movement_type ('aporte_inicial'|'aporte'|'saque'),
amount, note, created_at`.

**`goals`** — `id, user_id, name, target_amount, saved_amount,
created_at, monthly_amount, schedule_type`. `target_amount` é opcional
(meta recorrente "sem fim"); `monthly_amount` (022) marca meta recorrente
mensal; `schedule_type='custom'` (026) marca meta de cronograma
personalizado — sem nenhum dos dois, é uma meta simples (aporte avulso).

**`goal_installments`** (migração 022, `due_day` na 026) — parcela de uma
meta recorrente/personalizada. `id, goal_id, user_id, installment_number,
amount, due_year, due_month, contributed_at, created_at, due_day`.
`due_day` só é preenchido em metas de cronograma personalizado.

**`monthly_plans`** — um plano de orçamento por mês (`unique(month_id)`).
`id, user_id, month_id, income, status ('ativo'|'fechado'), created_at,
updated_at`.

**`monthly_plan_items`** — alocação planejada por categoria dentro de um
plano. `id, plan_id, user_id, category, suggested_amount, planned_amount,
is_eventual, is_mandatory`. `is_mandatory=true` são itens sincronizados
automaticamente a partir de dívidas em aberto (`sync_debts_into_plan`) —
o usuário não edita o valor livremente enquanto a dívida existir.

**`plan_income_items`** (migração 031) — cada entrada de renda esperada
do plano (várias por plano, com dia do mês). `id, plan_id, user_id,
amount, expected_day, created_at`. `monthly_plans.income` continua
existindo como o total (soma destes itens).

**`debts`** — `id, user_id, description, creditor, total_amount,
category, notes, created_at, interest_rate` (interest_rate na migração
023, opcional, só armazenada pra exibição — quem calcula a Tabela Price é
o client antes de chamar `create_debt`).

**`debt_installments`** — `id, debt_id, user_id, installment_number,
amount, due_year, due_month, paid_at, expense_id`. Sem coluna de status:
`paga` = `paid_at` preenchido; `atrasada` = `(due_year,due_month)` no
passado e não paga; senão `pendente` — sempre derivado na leitura.

**`fixed_bills`** (migração 024) — template de conta recorrente. `id,
user_id, name, expected_amount, due_day, category, payment_method,
active, created_at`.

**`fixed_bill_instances`** (migração 024, `due_year`/`due_month` na 025)
— uma instância por mês de uma conta fixa ativa. `id, bill_id, user_id,
amount, paid_at, expense_id, created_at, due_year, due_month`. Usa
calendário real (`due_year`/`due_month`), não `month_id` do app (que é
deslocado pelo dia de corte da importação) — mesmo modelo de
`debt_installments`/`goal_installments`. `expense_id` ficou órfão depois
da migração 025 (pagar deixou de gerar lançamento); a coluna continua
existindo mas sempre null em instâncias novas.

**`user_settings`** — uma linha por usuário (`user_id` é a PK).
`user_id, theme, updated_at, dashboard_widgets, import_cutoff_day`.
`dashboard_widgets` é um array json `[{id, enabled}]` na ordem de
exibição; `import_cutoff_day` (padrão 1) desloca lançamentos importados
pro mês seguinte a partir desse dia.

**`card_transactions`** e **`credit_card_payments`** — tabelas legadas,
anteriores a `docs/migrations`, de uma versão antiga do controle de
cartão (antes de `card_purchases`/`invoice_id` existirem). Não são mais
escritas por nenhum fluxo atual do app; `credit_card_payments` só
continua sendo lida (sempre retorna 0) num `LEFT JOIN` de compatibilidade
em `get_cards_overview`. Não devem ser usadas em código novo.

### 17.2 Funções (RPC)

Catálogo por domínio — nome, parâmetros principais e o que faz. Onde a
mesma função foi redefinida em várias migrações, só a versão final (mais
recente) é listada.

**Lançamentos (transactions)**
| Função | Parâmetros | O que faz |
|---|---|---|
| `add_transaction` | month_id, type, description, amount, category, card_id?, benefit_id?, is_expectation?, debit_card_id?, payment_method?, payment_date?, payment_time? | Insere um lançamento; debita saldo de VR/VA na hora se `benefit_id` + gasto real. |
| `update_transaction` | id, description, amount, category, card_id?, benefit_id?, is_expectation?, debit_card_id?, payment_method?, payment_date?, payment_time?, type? | Atualiza um lançamento (estorna e reaplica débito de VR/VA se mudou); `type` (040) permite trocar fixa↔variável. |
| `delete_transaction` | id | Remove um lançamento (estorna saldo de VR/VA se aplicável). |
| `import_transactions_bulk` | rows (jsonb[]) | Confirma uma importação de extrato/fatura: chama `add_transaction` por linha, marca `imported=true` e grava `import_raw`. |
| `get_month_summary` | month_id | Resumo do mês em JSON: entradas/saídas reais e previstas, saldo, saldo projetado, saldo acumulado, nº de previsões. Ignora compras no cartão e gastos com VR/VA no cálculo do saldo. |
| `get_month_real_flow` | month_id | Helper interno de `get_saldo_acumulado`: entradas/saídas reais do mês, mesma regra do resumo. |
| `get_saldo_acumulado` | month_id | Saldo acumulado até o mês, a partir da âncora (`opening_balance`) mais recente em ou antes do mês, somando o fluxo real mês a mês. |
| `get_expenses_by_category` | month_id | Gastos reais (exclui previstos e VR/VA) somados por categoria. |
| `get_expenses_by_payment_method` | month_id | Gastos reais somados por forma de pagamento. |
| `get_month_investment_net` | month_id | Aportes menos saques do mês. |
| `get_total_investments` | — | Patrimônio total investido (todos os meses). |
| `get_benefit_balance_total` | — | Soma o saldo de todos os benefícios VR/VA ativos. |
| `get_daily_spending` | — | Gasto real somado por dia, últimos N dias (usado no widget "Gastos dos últimos 7 dias"). |
| `billing_month` | date, cutoff_day | Calcula (ano, mês) de cobrança de uma data sob um dia de corte — réplica de `utils/helpers.py:billing_month`. |
| `recompute_cutoff_months` | cutoff_day | Remove lançamentos importados pro mês certo quando o usuário muda o dia de corte. |
| `create_month` / `ensure_month` | nome/ano/mês | Cria um período se não existir; `create_month` também copia pro novo mês as compras no cartão feitas após o fechamento do ciclo anterior. |

**Cartões de crédito**
| Função | Parâmetros | O que faz |
|---|---|---|
| `get_cards_overview` | month_id | Por cartão: gasto no ciclo aberto ou fatura fechada pendente (o que existir), pago, em aberto, disponível, dias até fechar/vencer, `cycle_open`. `cycle_open` é `true` quando não há fatura fechada pendente (não usa mais conta de calendário — migração 039). |
| `pay_card_bill` | card_id, month_id | Cria uma linha em `card_invoices` com o total da fatura fechada e marca (`invoice_id`) as transações correspondentes — nunca apaga lançamentos. |
| `settle_due_card_invoices` | — | Quita automaticamente (auto_settled=true) qualquer fatura fechada cujo vencimento já passou sem pagamento manual; chamada uma vez por sessão. |
| `get_card_invoices` | card_id | Histórico de faturas do cartão (mais recente primeiro). |
| `create_card_purchase` | card_id, description, category, installments (jsonb) | Cria `card_purchases` + uma transação por parcela (parcela do mês corrente é gasto real; futuras entram como previstas). |
| `delete_remaining_card_purchase_installments` | purchase_id | Apaga só as parcelas ainda previstas (futuras) de uma compra parcelada. |
| `get_debit_cards_overview` | month_id | Gasto do mês por cartão de débito (exclusivo web). |
| `_cycle_start` / `_cycle_due_date` / `_days_until` | closing_day / due_day | Helpers internos de data: início do ciclo atual, data de vencimento absoluta do ciclo mais recentemente fechado, dias até um dia-alvo do mês (com clamp pra meses curtos). |

**Benefícios (VR/VA)**
| Função | Parâmetros | O que faz |
|---|---|---|
| `get_benefits_overview` | — | Lista benefícios ativos com dias até a próxima renovação. |
| `create_benefit` | name, benefit_type, balance, renewal_day, recharge_amount, recharge_mode, color | Cria o benefício. |
| `apply_all_due_renewals` | — | Aplica todas as renovações pendentes de todos os benefícios (uma por mês perdido, se o app ficou muito tempo fechado), retorna um resumo pra toast; chamada uma vez por sessão. |
| `_renewal_date` / `_last_occurrence` / `_days_until_renewal` | — | Helpers internos de data de renovação (com clamp pra meses curtos). |

**Planejamento**
| Função | Parâmetros | O que faz |
|---|---|---|
| `save_plan` | month_id, income, items (jsonb), income_items (jsonb) | Cria/atualiza o plano do mês e substitui seus itens; fecha planos `ativo` de meses anteriores. |
| `get_month_income` | month_id, include_expectations? | Soma de entradas do mês (usada no histórico de sugestão). |

**Dívidas**
| Função | Parâmetros | O que faz |
|---|---|---|
| `create_debt` | description, creditor, total_amount, category, notes, installments (jsonb), interest_rate? | Cria a dívida + suas parcelas. |
| `update_installment_amount` | inst_id, amount | Edita o valor de uma parcela e recalcula `total_amount` da dívida. |
| `pay_installment` | inst_id | Marca a parcela como paga — checklist puro, não lança gasto nem mexe no saldo. |
| `undo_installment_payment` | inst_id | Desfaz o pagamento. |
| `delete_installment` / `delete_debt` | inst_id / debt_id | Exclui parcela (recalcula total; some a dívida se ficou sem parcelas) ou a dívida inteira. |
| `get_month_debt_totals` | month_id | Parcelas não pagas com vencimento no mês, somadas por categoria. |
| `sync_debts_into_plan` | month_id | Sincroniza itens obrigatórios (`is_mandatory`) do plano ativo com as parcelas pendentes. |
| `get_debt_overview` | — | Resumo: total em aberto, nº de parcelas atrasadas, comprometimento dos próximos 6 meses. |

**Contas Fixas**
| Função | Parâmetros | O que faz |
|---|---|---|
| `create_fixed_bill` / `update_fixed_bill` / `delete_fixed_bill` | — | CRUD do template da conta recorrente. |
| `ensure_fixed_bill_instances` | year, month | Garante uma instância pendente no mês real pra cada conta ativa que ainda não tem uma (idempotente). |
| `update_fixed_bill_instance_amount` | instance_id, amount | Edita o valor de uma instância (ex.: luz/água variam mês a mês). |
| `pay_fixed_bill_instance` / `undo_fixed_bill_payment` | instance_id | Marca paga/pendente — checklist puro (desde a migração 025). |
| `get_pending_fixed_bills_total` | year, month | Soma das instâncias pendentes do mês real. |

**Metas**
| Função | Parâmetros | O que faz |
|---|---|---|
| `create_recurring_goal` | name, target_amount?, monthly_amount, installments (jsonb) | Cria meta recorrente mensal + cronograma inicial. |
| `create_custom_goal` | name, target_amount, installments (jsonb, com dia) | Cria meta de cronograma personalizado (`schedule_type='custom'`). |
| `add_goal_installments` | goal_id, installments (jsonb) | Adiciona mais parcelas a uma meta já existente ("Gerar mais parcelas"/"+ Adicionar parcela"). |
| `contribute_goal_installment` / `undo_goal_installment_contribution` | inst_id | Marca/desmarca uma parcela como guardada; ajusta `saved_amount`. |
| `update_goal_installment_amount` / `delete_goal_installment` | inst_id, amount? | Edita/exclui uma parcela; recalcula `target_amount` como soma das parcelas **só** em metas recorrentes (não em `custom`, onde o alvo é independente). |
| `add_goal_contribution` | goal_id, amount | Aporte/saque avulso numa meta simples (valor negativo = saque); nunca deixa `saved_amount` negativo. |

**Investimentos**
| Função | Parâmetros | O que faz |
|---|---|---|
| `create_investment` | name, category, month_id, amount, note? | Cria o investimento + registra o aporte inicial. |
| `delete_investment` | investment_id | Exclui o investimento e todas as suas movimentações. |

**Compromissos futuros**
| Função | Parâmetros | O que faz |
|---|---|---|
| `get_future_commitments` | months (default 6) | Soma, mês a mês, parcelas de cartão previstas + fatura em aberto (rotulada pelo mês em que o ciclo começou) + dívidas em aberto + contas fixas pendentes. |

Grants: toda função é `grant execute ... to authenticated` — nunca
exposta a `anon`.

## 18. Arquitetura do código

### 18.1 Desktop (Python + CustomTkinter)

**Ponto de entrada — `main.py`**: `MainWindow(ctk.CTk)` é a única janela raiz
(nunca é destruída — as telas trocam como frames filhos). Cuida do
bootstrap visual (tema escuro, tamanho mínimo 1050x640, janela 1340x800
centralizada, ícone), de um patch pra um bug conhecido do CustomTkinter
5.2.2 + PyInstaller (`CTkButton.destroy()` levanta `AttributeError` em
certas condições), e do fluxo de login: se existe sessão salva
(`config.has_saved_session()`), mostra `ui.splash.SplashFrame` e tenta
restaurar em background; sem sessão salva, vai direto pro formulário
(`ui.login.LoginFrame`). `_prewarm_imports()` pré-importa `database`
(que já carrega o client do Supabase) e `matplotlib` em background
enquanto a tela de login está visível, pra esconder a latência desses
imports pesados.

**`config.py`**: credenciais do Supabase (URL + anon key) hardcoded no
módulo (`config.example.py` é o template sem valor real, pro
repositório). `get_client()` memoiza um único `supabase.Client` global.
`save_session`/`restore_session`/`has_saved_session`/`clear_session`
gerenciam o token salvo em `%APPDATA%/FinancasApp/.session`.

**`database.py`** (~1950 linhas) — camada de acesso a dados. Não há
SQLite local: tudo passa pelo `supabase-py`, com bastante lógica de
negócio em Python por cima (agregações, valores derivados). Padrão de
cache: dicionários no nível do módulo, indexados por `month_id` (ou
chaves compostas), um por domínio (`_tx_cache`, `_plan_cache`,
`_debts_cache`, `_benefits_cache`, etc.), cada um com sua própria função
`_invalidate*()` chamada depois de toda escrita; `clear_cache()` limpa
tudo de uma vez (logout, ou depois de mudar o dia de corte). A maior
parte do CRUD (meses, lançamentos, metas, cartões, investimentos,
dívidas, benefícios) é feita direto via `.table(...).select/insert/
update/delete()`, com a regra de negócio em Python — só uma parte vira
chamada de RPC (delegando pra mesma função SQL que o web usa, quando a
lógica precisa ficar idêntica nos dois): `get_cards_overview`,
`pay_card_bill`, `settle_due_card_invoices`, `get_card_invoices`,
`create_card_purchase`, `delete_remaining_card_purchase_installments`,
`get_future_commitments`, e **todas** as escritas de Contas Fixas
(`ensure_fixed_bill_instances`, `create/update/delete_fixed_bill`,
`update_fixed_bill_instance_amount`, `pay_fixed_bill_instance`,
`undo_fixed_bill_payment`, `get_pending_fixed_bills_total`) e
`save_import_cutoff_day` (que chama a RPC `recompute_cutoff_months`).
Funções agrupadas por domínio: meses, lançamentos (inclui
`get_month_summary`/`get_saldo_acumulado`, a lógica mais pesada do
arquivo), metas, cartões de crédito, cartões de débito, investimentos,
planejamento mensal, dívidas, contas fixas, benefícios VR/VA,
exportação (`export_month_xlsx`), config do dashboard e dia de corte.

**`ui/` (22 arquivos, ~10.800 linhas)** — uma tela/feature por arquivo:

| Arquivo | Classe(s) principal(is) | Tela/feature |
|---|---|---|
| `app.py` | `FinanceApp` | Shell do app pós-login: monta sidebar + `MainContent`, seleção/criação/exclusão de mês, roda as checagens de renovação de benefício e quitação automática de fatura ao abrir. |
| `login.py` | `LoginFrame` | Tela de login/cadastro/recuperação de senha (dois painéis). |
| `splash.py` | `SplashFrame` | Tela de transição durante a restauração automática de sessão. |
| `main_content.py` | `MainContent` | Área de conteúdo: cabeçalho + abas (Dashboard/Lançamentos/Planejamento). |
| `sidebar.py` | `Sidebar` | Navegação lateral: lista/seleção de mês, botões de navegação. |
| `dashboard.py` | `Dashboard`, `EditDashboardDialog` | KPIs + gráficos (matplotlib) + Guru Financeiro; widgets configuráveis pelo usuário. |
| `transactions.py` | `TransactionsTab` | Aba de Lançamentos: adicionar/editar/excluir, filtros, confirmação de previsão. |
| `credit_cards.py` | `CardPresetsBar`, `_PayBillDialog`, `_CardInvoiceHistoryDialog`, `_CardDialog`, `_NewCardPurchaseDialog` | Gestão de cartão de crédito: CRUD, pagar fatura, histórico de faturas, compra parcelada. |
| `debts.py` | `DebtsTab` + diálogos | Dívidas: cadastro com parcelas, pagar/desfazer, reagendar. |
| `goals.py` | `GoalsTab` + diálogos | Metas: simples, recorrente e cronograma personalizado. |
| `investments.py` | `InvestmentsTab` + diálogos | Investimentos: criar, aportar/sacar, editar/excluir movimentação. |
| `planning.py` | `PlanningTab`, `_IncomeItemsDialog` | Planejamento mensal: sugestão de alocação por categoria, entradas de renda. |
| `import_statement.py` | `_Candidate`, `ImportTab` | Importação de extrato/fatura: seleção de arquivo, revisão/dedupe, confirmação. |
| `fixed_bills.py` | `FixedBillsTab` + diálogos | Contas fixas: checklist de vencimento, nunca lança gasto. |
| `benefits.py` | `BenefitsBar`, `_BenefitDialog` | Barra de benefícios VR/VA (dentro de Saídas Variáveis) + CRUD. |
| `commitments.py` | `CommitmentsTab` | Tela unificada Dívidas/Metas/Contas Fixas (abas). |
| `future_commitments.py` | `FutureCommitmentsTab` | Resumo dos Compromissos (somente leitura). |
| `dialogs.py` | `_ErrorDialog`, `_InfoDialog`, `ConfirmDialog` | Diálogos modais reutilizáveis (erro/info/confirmação). |
| `report_dialog.py` | `ReportDialog` | Modal de geração do Relatório PDF por período. |
| `settings_dialog.py` | `SettingsDialog` | Configurações: dia de corte, atalho pro relatório PDF. |
| `theme.py` | (funções de módulo) | Tokens de design, fontes, aplicar/salvar/sincronizar tema com a nuvem (compartilhado com o web). |
| `theme_picker.py` | `ThemePickerDialog` | Modal de escolha de tema. |

**`utils/`**: `helpers.py` (constantes — `APP_VERSION`, categorias,
formas de pagamento, `format_currency`, `billing_month` — réplica da
função SQL homônima) e `plan_strategy.py` (`suggest_allocations`/
`estimate_income`: algoritmo de sugestão de orçamento por média
ponderada dos últimos 3 meses, com teto de 50% da renda pra
Investimentos, usado tanto pelo desktop quanto pelo web via porte
próprio).

**`parsers/`** (extrato bancário, exclusivo desktop): `base.py`
(`NormalizedRow`, `BankParser`, `guess_category`,
`looks_like_investment`), `registry.py` (`detect_parser`, tenta cada
parser em ordem), e `inter/` com um parser por formato do Banco Inter
(`csv_extrato.py`, `ofx.py`, `pdf_extrato.py`, `credit_card_csv.py`) —
único banco suportado hoje.

**Outros arquivos**: `FinancasApp.spec` (build PyInstaller),
`requirements.txt`, `report.py` (gera o PDF do Relatório Financeiro
Completo com reportlab + matplotlib), `file_version_info.txt`
(metadados de versão do .exe), `assets/` (ícones), `supabase/functions/`
(Edge Functions, compartilhadas com o web).

### 18.2 Web (React + TypeScript + Vite)

**Entrada e rotas — `src/main.tsx`/`src/App.tsx`**: `QueryClientProvider`
(TanStack Query) + `AuthProvider` no topo; roteamento com
`react-router-dom`. Rotas públicas (`/login`, `/cadastro`,
`/esqueci-senha`, `/reset-password`) redirecionam pra `/` se já
autenticado; todo o resto vive sob `ThemeProvider` → `MonthProvider` →
`TxFormProvider` → `Layout`, com redirect pra `/login` se não
autenticado. `/importar` é **lazy-loaded** (evita carregar o `pdfjs-dist`,
~440kB, pra quem nunca importa extrato) com um `ChunkErrorBoundary` que
recarrega a página sozinho se um chunk falhar (deploy novo no ar
enquanto a aba estava aberta). Rotas antigas (`/beneficios`, `/dividas`,
`/metas`, `/contas-fixas`) redirecionam pras rotas atuais.

| Rota | Página |
|---|---|
| `/` | `Dashboard` |
| `/lancamentos` | `Transactions` |
| `/cartoes` | `Cards` |
| `/planejamento` | `Planning` |
| `/compromissos` (`?tab=dividas\|metas\|contas-fixas`) | `Commitments` |
| `/investimentos` | `Investments` |
| `/compromissos-futuros` | `FutureCommitments` |
| `/importar` | `Import` (lazy) |
| `/mais` | `More` |
| `/configuracoes` | `Settings` |

**`src/pages/`**: um componente por tela (`Dashboard.tsx`,
`Transactions.tsx`, `Cards.tsx`, `Commitments.tsx` com `Debts.tsx`/
`Goals.tsx`/`FixedBills.tsx` como abas, `Planning.tsx`,
`Investments.tsx`, `FutureCommitments.tsx`, `Import.tsx`, `More.tsx`,
`Settings.tsx`, mais as telas de autenticação `Login.tsx`/`SignUp.tsx`/
`ForgotPassword.tsx`/`ResetPassword.tsx`).

**`src/components/`** — principais: `Layout.tsx` (shell: sidebar/nav
inferior, seletor de mês, tema, botão flutuante de novo lançamento,
roda `useRenewalCheck()`/`useCardInvoicesSettle()` uma vez por sessão),
`TxForm.tsx` (modal de add/editar lançamento), `CardForm.tsx`/
`CardPurchaseForm.tsx`/`CardInvoiceHistory.tsx`/`CardRiskBanner.tsx`
(cartões), `BenefitForm.tsx`, `DebtForm.tsx`/`EditDebtForm.tsx`/
`DebtDialogs.tsx`, `GoalDialogs.tsx`/`RecurringGoalForm.tsx`,
`InvestmentDialogs.tsx`, `IncomeDialog.tsx`, `AddMonthDialog.tsx`/
`EditMonthDialog.tsx`, `ThemeDialog.tsx`, `AddWidgetPicker.tsx`/
`EditableWidgetCard.tsx` (dashboard arrastável, `@dnd-kit`),
`Skeleton.tsx`, `ChunkErrorBoundary.tsx`, `Sidebar.tsx`.

**`src/lib/`** (camada compartilhada):
- `api.ts` (~1030 linhas, ~90 funções) — toda a comunicação com o
  Supabase (RPC + tabelas), organizada pelos mesmos domínios do banco
  (seção 17).
- `types.ts` (~310 linhas) — tipos TypeScript espelhando o schema.
- `tips.ts` — motor do Guru Financeiro (porte fiel de
  `ui/dashboard.py:_build_tips`, ver seção 10.1).
- `dashboardWidgets.tsx` (~870 linhas) — registro + implementação dos
  ~19 widgets do Dashboard (gráficos via `recharts`).
- `format.ts`, `constants.ts` — formatação (moeda, datas) e listas
  estáticas (categorias, formas de pagamento).
- `month.tsx`, `auth.tsx`, `theme.tsx`, `txform.tsx` — contexts React
  pro mês selecionado, sessão, tema e o modal global de lançamento.
- `themes.ts` — paletas de cor (réplica de `ui/theme.py`).
- `supabase.ts` — client singleton, com adapter de storage
  customizado pra "Lembrar de mim" (localStorage vs sessionStorage).
- `debtStatus.ts`, `investmentBalance.ts`, `planStrategy.ts` — portes
  puros de lógica do desktop (status de parcela, saldo de investimento,
  sugestão de orçamento).
- `exportXlsx.ts`, `reportCharts.ts`, `reportPdf.ts` — exportação
  .xlsx e geração do Relatório PDF (ver seção 12), carregados sob
  demanda.

**`src/lib/parsers/`** (extrato bancário, web): mesmo desenho do
desktop — `types.ts`/`base.ts`/`common.ts`/`registry.ts` +
`inter/creditCardCsv.ts`, `inter/csvExtrato.ts`, `inter/ofx.ts`,
`inter/pdfExtrato.ts` (este último usa `pdfjs-dist` direto no
navegador). Só Banco Inter, igual ao desktop.

**PWA/config**: `vite.config.ts` (plugin React + Tailwind v4 +
`vite-plugin-pwa`, manifest com nome/ícones/cor do des.tino),
`vercel.json` (rewrite de SPA), `index.html` (meta tags PWA/iOS).

### 18.3 Convenção de sincronia entre plataformas

Onde uma regra de negócio precisa se comportar identicamente nas duas
versões (cálculo de saldo, ciclo de fatura, dicas do Guru Financeiro,
sugestão de orçamento, categorização automática na importação), o
projeto usa uma de duas estratégias: **centralizar em SQL** (a função
RPC é a única implementação, ambas as plataformas só chamam) sempre que
possível, ou **manter dois portes fiéis comentados um pro outro**
quando a lógica precisa rodar no cliente (ex.: `ui/dashboard.py:
_build_tips` ↔ `web/src/lib/tips.ts`; `utils/plan_strategy.py` ↔
`web/src/lib/planStrategy.ts`; `parsers/base.py` ↔
`web/src/lib/parsers/base.ts`). Mudar uma dessas regras exige lembrar
de replicar no par — não há teste automatizado que garanta a
sincronia, é convenção mantida manualmente.
