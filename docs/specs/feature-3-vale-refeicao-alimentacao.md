# Feature 3 — Vale Refeição / Vale Alimentação

## Contexto do projeto

App desktop de finanças pessoais em **Python + Tkinter + Supabase**. O app já permite cadastrar cartões de crédito. Esta feature adiciona um tipo análogo de "conta": benefícios (VR/VA) com saldo que **renova em um dia fixo do mês**.

**Antes de implementar:** explore como os cartões de crédito estão modelados hoje (tabela, telas, fluxo de gasto) e decida se VR/VA deve **estender a estrutura existente** (campo `type` na mesma tabela) ou ter tabela própria. Me apresente as duas opções com prós e contras antes de codar.

---

## Objetivo

Cadastrar VR e VA com dia de renovação e valor de recarga; vincular gastos a eles descontando do saldo do benefício; tratar esse dinheiro separadamente no planejamento (é dinheiro "carimbado" para alimentação).

---

## Comportamento detalhado

### 1. Cadastro do benefício

Campos:
- **Nome** (ex: "VR Caju", "VA Alelo")
- **Tipo**: VR ou VA (Combobox)
- **Saldo atual** (informado no cadastro)
- **Dia de renovação** (1-28; ver edge cases para 29-31)
- **Valor da recarga mensal**
- **Comportamento da recarga** (Combobox):
  - `acumula` → novo saldo = saldo anterior + recarga (padrão da maioria dos benefícios)
  - `zera` → novo saldo = recarga (alguns benefícios expiram o saldo)

### 2. Renovação automática

- Não há job em background (app desktop): a renovação roda **na abertura do app** (e/ou ao acessar a tela de benefícios).
- Lógica: guardar `last_renewal` (data da última renovação aplicada). Ao abrir, calcular quantas renovações ocorreram entre `last_renewal` e hoje (pode ser mais de uma, se o app ficou semanas fechado) e aplicar todas em sequência, registrando cada uma.
- Cada renovação gera um registro de histórico (auditoria simples: data, valor, saldo antes/depois).
- Exibir no card do benefício: saldo atual e **"renova em X dias"**.

### 3. Gastos com VR/VA

- No formulário de gasto existente, o seletor de origem/forma de pagamento passa a incluir os benefícios cadastrados.
- Gasto vinculado a VR/VA desconta do saldo do benefício.
- Validação suave: se o gasto exceder o saldo, avisar mas permitir (saldo pode ficar negativo? **Não** — na prática o cartão recusaria; bloquear e sugerir dividir o gasto entre VR e outra origem, se for simples de implementar; senão, apenas bloquear com mensagem).
- Edição/exclusão de gasto vinculado a benefício deve estornar o saldo corretamente.

### 4. Separação no planejamento e nas análises

- Gastos pagos com VR/VA **não consomem** os envelopes do Planejamento Mensal (Feature 1) — eles saem de um "bolso" separado.
- No plano e no dashboard, exibir alimentação em duas visões quando aplicável: gasto via benefício vs. gasto do próprio bolso.
- Nos totais gerais de gastos do mês, incluir os gastos de benefício mas com possibilidade de filtrar/segmentar (decisão de UI: um toggle "incluir benefícios" nos cards de análise).

---

## Modelo de dados sugerido (adaptar conforme decisão da etapa de exploração)

Opção A — estender a tabela de cartões existente com `account_type` ('credit' | 'vr' | 'va') e campos extras nullable. Opção B — tabela própria:

```sql
create table benefit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  benefit_type text not null check (benefit_type in ('VR','VA')),
  balance numeric not null default 0,
  renewal_day int not null check (renewal_day between 1 and 28),
  recharge_amount numeric not null default 0,
  recharge_mode text not null default 'acumula' check (recharge_mode in ('acumula','zera')),
  last_renewal date,
  created_at timestamptz default now()
);

create table benefit_renewals (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid references benefit_cards on delete cascade,
  renewed_at date not null,
  amount numeric not null,
  balance_before numeric not null,
  balance_after numeric not null
);
```

> Na tabela de gastos, adicionar referência à origem benefício (FK nullable `benefit_id` ou reaproveitar o campo de origem existente, conforme a opção escolhida).

---

## UI/UX (Tkinter)

- Na tela onde hoje se adiciona cartão de crédito, incluir a opção "Adicionar VR/VA" (mesmo padrão visual).
- Card do benefício no estilo dos cards de cartão: nome, tipo (badge VR/VA com cores diferentes), saldo, "renova em X dias", recarga mensal.
- Ao abrir o app e haver renovação aplicada, mostrar feedback discreto (ex: toast/label "VR renovado: +R$ 550,00").

---

## Edge cases

- **Dia 29-31**: limitar o cadastro a 1-28 para evitar ambiguidade em fevereiro, OU aceitar 1-31 e renovar no último dia do mês quando o dia não existir. Escolha uma abordagem e me informe (prefiro a segunda se não complicar).
- App fechado por 2+ meses → aplicar renovações múltiplas em ordem, respeitando o modo (`zera` aplica só a última na prática, mas registre todas no histórico).
- Mudança do valor de recarga ou do dia → vale a partir da próxima renovação, sem efeito retroativo.
- Exclusão de benefício com gastos vinculados → manter os gastos (com a referência marcada como removida/arquivada), não deletar em cascata.
- Saldo inicial informado no cadastro não gera registro de renovação.

---

## Critérios de aceite

1. Consigo cadastrar um VR com dia de renovação, valor e modo de recarga.
2. O saldo renova corretamente na data (inclusive após dias sem abrir o app).
3. Consigo registrar um gasto escolhendo o VR/VA como origem, e o saldo desconta.
4. Gastos de benefício não consomem os envelopes do plano mensal.
5. Vejo no card do benefício o saldo e quantos dias faltam para renovar.
6. Editar/excluir gasto vinculado estorna o saldo corretamente.

## Como testar (gerar instruções ao final)

Roteiro manual cobrindo: cadastro, gasto com saldo suficiente, gasto excedendo saldo, renovação simples, renovação múltipla (simular `last_renewal` antigo no banco), e os dois modos de recarga.
