# Feature 2 — Módulo de Dívidas

## Contexto do projeto

App desktop de finanças pessoais em **Python + Tkinter + Supabase**. A Feature 1 (Planejamento Mensal) já deve estar implementada — este módulo se integra a ela: dívidas alocadas em um mês entram automaticamente no plano daquele mês como reserva obrigatória.

**Antes de implementar:** explore o código atual (incluindo o que foi feito na Feature 1), me apresente um plano e os SQLs de migração. Só code após minha aprovação.

---

## Objetivo

Uma seção dedicada onde o usuário cadastra tudo que deve, escolhe **em qual mês vai pagar** cada dívida (ou parcela), e acompanha o comprometimento da renda dos próximos meses.

---

## Comportamento detalhado

### 1. Cadastro de dívida

Campos:
- **Descrição** (obrigatório)
- **Valor total** (obrigatório)
- **Credor** (opcional — pessoa, loja, banco)
- **Mês de pagamento** (obrigatório — seletor de mês/ano, ex: Combobox de mês + Spinbox de ano)
- **Parcelamento** (opcional): número de parcelas. Ao parcelar, o app divide o valor em N parcelas mensais consecutivas a partir do mês escolhido. Permitir ajuste manual do valor de cada parcela (ex: entrada maior), validando que a soma feche com o total.
- **Categoria** (opcional, default "Dívidas") — usada na integração com o plano.
- **Observações** (opcional)

### 2. Gestão e remanejamento

- Lista de dívidas com filtros: status (pendente / paga / atrasada), mês, credor.
- **Remanejar**: mover uma dívida ou parcela individual para outro mês (ação rápida, ex: botão ou menu de contexto na linha).
- **Marcar como paga**: registra data de pagamento. Opção de gerar automaticamente um gasto correspondente no app (perguntar ao usuário com um checkbox "lançar como gasto", marcado por padrão) — para não duplicar caso ele já registre manualmente.
- **Status automático**: parcela com mês anterior ao atual e não paga → `atrasada` (calculado, não precisa de job; resolver na leitura).
- Editar e excluir dívidas (excluir pede confirmação; se parcelada, perguntar se exclui só a parcela ou a dívida inteira).

### 3. Integração com o Planejamento Mensal (Feature 1)

- Ao gerar/abrir o plano de um mês, somar as parcelas pendentes daquele mês e inseri-las como item do plano com `is_mandatory = true` (categoria "Dívidas" ou a categoria da dívida).
- Itens obrigatórios aparecem destacados no plano (ex: ícone de cadeado) e **não recebem sugestão por histórico** — o valor é a soma das parcelas.
- Se o usuário remanejar uma dívida depois do plano confirmado, atualizar o item correspondente no plano e avisar visualmente.

### 4. Visão geral

Painel no topo da seção com:
- **Total em aberto** (soma de tudo pendente/atrasado)
- **Comprometimento dos próximos 6 meses**: gráfico de barras simples ou lista mês a mês com o total de parcelas, e — se houver renda estimada — o % da renda comprometido.
- Contagem de dívidas atrasadas com destaque vermelho.

---

## Modelo de dados sugerido (adaptar ao schema existente)

```sql
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  description text not null,
  creditor text,
  total_amount numeric not null,
  category text default 'Dívidas',
  notes text,
  created_at timestamptz default now()
);

create table debt_installments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid references debts on delete cascade,
  installment_number int not null default 1,
  amount numeric not null,
  due_month date not null,            -- dia 1 do mês escolhido
  paid_at timestamptz,                -- null = pendente
  expense_id uuid,                    -- FK para o gasto gerado, se houver
  unique (debt_id, installment_number)
);
```

> Dívida à vista = 1 installment. Status é derivado: `paid_at` preenchido → paga; `due_month` < mês atual e não paga → atrasada; senão pendente.

---

## UI/UX (Tkinter)

- Nova aba/tela "Dívidas".
- Topo: painel de visão geral (total em aberto, atrasadas, comprometimento futuro).
- Centro: Treeview com colunas Descrição | Credor | Parcela | Valor | Mês | Status, com cores por status (vermelho atrasada, cinza paga).
- Botões: Nova dívida, Marcar como paga, Remanejar, Editar, Excluir.
- Formulário de cadastro em janela modal (Toplevel), com preview das parcelas geradas antes de salvar.

---

## Edge cases

- Parcela paga não pode ser remanejada nem editada em valor (só desfazer o pagamento primeiro).
- Remanejar para um mês que já tem plano confirmado → atualizar o plano e sinalizar.
- Excluir dívida cujas parcelas geraram gastos → perguntar se remove também os gastos vinculados.
- Soma de parcelas editadas manualmente ≠ valor total → bloquear salvamento com mensagem clara.
- Dívida com mês de pagamento no passado já no cadastro → permitir (pode ser dívida antiga sendo registrada), já nasce como atrasada.

---

## Critérios de aceite

1. Consigo cadastrar uma dívida à vista e uma parcelada, escolhendo o(s) mês(es).
2. Consigo remanejar uma parcela para outro mês em poucos cliques.
3. O plano do mês reflete automaticamente as dívidas daquele mês como reserva obrigatória.
4. Marcar como paga funciona e (opcionalmente) lança o gasto.
5. Vejo total em aberto e comprometimento dos próximos meses.
6. Status atrasada aparece corretamente sem ação manual.

## Como testar (gerar instruções ao final)

Roteiro manual cobrindo: dívida à vista, dívida em 3x com entrada maior, remanejamento, pagamento com lançamento de gasto, e dívida atrasada.
