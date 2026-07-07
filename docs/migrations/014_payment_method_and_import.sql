-- =====================================================================
-- Feature 6 — Forma de pagamento obrigatória, data de pagamento,
-- card de % por forma de pagamento e infraestrutura de importação de
-- extrato bancário (Banco Inter, fase 1).
-- Aditivo: não altera o comportamento de nenhuma chamada existente
-- (parâmetros novos sempre com default null/false).
-- Rodar no SQL Editor do Supabase (após 001-013).
-- =====================================================================

-- Data de pagamento — separada de created_at, sempre opcional.
alter table transactions add column if not exists payment_date date;

-- payment_method continua text sem CHECK (mesma coluna de antes, agora
-- com vocabulário mais amplo: dinheiro|pix|debito|credito|vr_va|boleto|
-- transferencia|outro — validado só na aplicação, não no banco).

-- Criação "leve" de mês (sem copiar lançamentos pós-fechamento do mês
-- anterior) — réplica de database.py:_ensure_month. Usada pela
-- importação de extrato, que pode precisar criar vários meses de uma
-- vez sem o efeito colateral do create_month (pensado só pro fluxo
-- manual de "novo período").
create or replace function ensure_month(p_name text, p_year int, p_month int)
returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  select id into v_id from months where name = p_name;
  if v_id is not null then
    return v_id;
  end if;
  insert into months (user_id, name, year, month)
  values (auth.uid(), p_name, p_year, p_month)
  returning id into v_id;
  return v_id;
end;
$$;

-- Gastos por forma de pagamento (para o card do Dashboard) — mesma
-- forma de get_expenses_by_category, mas NÃO exclui benefit_id (VR/VA
-- é uma fatia própria aqui, ao contrário do card de categorias).
create or replace function get_expenses_by_payment_method(p_month_id bigint)
returns table (payment_method text, total numeric)
language sql
stable
as $$
  select coalesce(t.payment_method, 'outro') as payment_method, sum(t.amount) as total
  from transactions t
  where t.month_id = p_month_id
    and t.type in ('saida_fixa', 'saida_variavel')
    and coalesce(t.is_expectation, false) = false
  group by coalesce(t.payment_method, 'outro')
  order by sum(t.amount) desc;
$$;

-- add_transaction / update_transaction ganham p_payment_date. Muda a
-- assinatura (nº de parâmetros) → precisa DROP + CREATE.
drop function if exists add_transaction(bigint, text, text, numeric, text, bigint, bigint, boolean, bigint, text);
drop function if exists update_transaction(bigint, text, numeric, text, bigint, bigint, boolean, bigint, text);

create or replace function add_transaction(
  p_month_id       bigint,
  p_type           text,
  p_description    text,
  p_amount         numeric,
  p_category       text default 'Outros',
  p_card_id        bigint default null,
  p_benefit_id     bigint default null,
  p_is_expectation boolean default false,
  p_debit_card_id  bigint default null,
  p_payment_method text default null,
  p_payment_date   date default null
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into transactions (
    month_id, user_id, type, description, amount, category,
    card_id, benefit_id, is_expectation, debit_card_id, payment_method,
    payment_date
  ) values (
    p_month_id, auth.uid(), p_type, p_description, p_amount,
    coalesce(p_category, 'Outros'), p_card_id, p_benefit_id,
    coalesce(p_is_expectation, false), p_debit_card_id, p_payment_method,
    p_payment_date
  )
  returning id into v_id;

  if p_benefit_id is not null and not coalesce(p_is_expectation, false) then
    update benefit_cards set balance = balance - p_amount where id = p_benefit_id;
  end if;

  return v_id;
end;
$$;

create or replace function update_transaction(
  p_id             bigint,
  p_description    text,
  p_amount         numeric,
  p_category       text,
  p_card_id        bigint default null,
  p_benefit_id     bigint default null,
  p_is_expectation boolean default false,
  p_debit_card_id  bigint default null,
  p_payment_method text default null,
  p_payment_date   date default null
) returns void
language plpgsql
as $$
declare
  v_old transactions;
begin
  select * into v_old from transactions where id = p_id;
  if not found then return; end if;

  if v_old.benefit_id is not null and not coalesce(v_old.is_expectation, false) then
    update benefit_cards set balance = balance + v_old.amount where id = v_old.benefit_id;
  end if;

  update transactions set
    description    = p_description,
    amount         = p_amount,
    category       = coalesce(p_category, 'Outros'),
    card_id        = p_card_id,
    benefit_id     = p_benefit_id,
    is_expectation = coalesce(p_is_expectation, false),
    debit_card_id  = p_debit_card_id,
    payment_method = p_payment_method,
    payment_date   = p_payment_date
  where id = p_id;

  if p_benefit_id is not null and not coalesce(p_is_expectation, false) then
    update benefit_cards set balance = balance - p_amount where id = p_benefit_id;
  end if;
end;
$$;

-- Confirma a importação em lote (extrato/fatura) — delega pra
-- add_transaction linha a linha (não reimplementa a lógica de débito
-- de benefício), sempre is_expectation = false (lançamento importado
-- já é real, nunca previsto).
create or replace function import_transactions_bulk(p_rows jsonb)
returns setof bigint
language plpgsql
as $$
declare
  r record;
  v_id bigint;
begin
  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      month_id       bigint,
      type           text,
      description    text,
      amount         numeric,
      category       text,
      payment_method text,
      payment_date   date,
      card_id        bigint,
      benefit_id     bigint,
      debit_card_id  bigint
    )
  loop
    v_id := add_transaction(
      r.month_id, r.type, r.description, r.amount, r.category,
      r.card_id, r.benefit_id, false, r.debit_card_id, r.payment_method,
      r.payment_date
    );
    return next v_id;
  end loop;
end;
$$;

grant execute on function ensure_month(text, int, int)                                                                     to authenticated;
grant execute on function get_expenses_by_payment_method(bigint)                                                           to authenticated;
grant execute on function add_transaction(bigint, text, text, numeric, text, bigint, bigint, boolean, bigint, text, date)  to authenticated;
grant execute on function update_transaction(bigint, text, numeric, text, bigint, bigint, boolean, bigint, text, date)     to authenticated;
grant execute on function import_transactions_bulk(jsonb)                                                                  to authenticated;
