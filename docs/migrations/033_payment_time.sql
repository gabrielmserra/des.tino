-- =====================================================================
-- Hora do lançamento (opcional): complementa payment_date sem
-- substituí-lo — usada pra ordenar/exibir com mais precisão dentro do
-- mesmo dia. Vem de 3 origens possíveis: digitada manualmente (opcional
-- no form), extraída do OFX quando o DTPOSTED trouxer HHMMSS, ou
-- preenchida automaticamente pelo quick-tx (lançamento por voz).
-- Rodar no SQL Editor do Supabase (após 001-032).
-- =====================================================================

alter table transactions add column if not exists payment_time time;

-- add_transaction/update_transaction ganham p_payment_time — muda a
-- assinatura (nº de parâmetros), precisa DROP + CREATE (mesmo padrão
-- já usado em 014/031).
drop function if exists add_transaction(bigint, text, text, numeric, text, bigint, bigint, boolean, bigint, text, date);
drop function if exists update_transaction(bigint, text, numeric, text, bigint, bigint, boolean, bigint, text, date);

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
  p_payment_date   date default null,
  p_payment_time   time default null
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into transactions (
    month_id, user_id, type, description, amount, category,
    card_id, benefit_id, is_expectation, debit_card_id, payment_method,
    payment_date, payment_time
  ) values (
    p_month_id, auth.uid(), p_type, p_description, p_amount,
    coalesce(p_category, 'Outros'), p_card_id, p_benefit_id,
    coalesce(p_is_expectation, false), p_debit_card_id, p_payment_method,
    p_payment_date, p_payment_time
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
  p_payment_date   date default null,
  p_payment_time   time default null
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
    payment_date   = p_payment_date,
    payment_time   = p_payment_time
  where id = p_id;

  if p_benefit_id is not null and not coalesce(p_is_expectation, false) then
    update benefit_cards set balance = balance - p_amount where id = p_benefit_id;
  end if;
end;
$$;

-- import_transactions_bulk (já reescrita na 032 pra marcar imported=true)
-- ganha payment_time no jsonb_to_recordset e repassa pro add_transaction
-- acima. Mesma assinatura (p_rows jsonb) — não precisa DROP.
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
      payment_time   time,
      card_id        bigint,
      benefit_id     bigint,
      debit_card_id  bigint
    )
  loop
    v_id := add_transaction(
      r.month_id, r.type, r.description, r.amount, r.category,
      r.card_id, r.benefit_id, false, r.debit_card_id, r.payment_method,
      r.payment_date, r.payment_time
    );
    update transactions set imported = true where id = v_id;
    return next v_id;
  end loop;
end;
$$;

grant execute on function add_transaction(bigint, text, text, numeric, text, bigint, bigint, boolean, bigint, text, date, time)  to authenticated;
grant execute on function update_transaction(bigint, text, numeric, text, bigint, bigint, boolean, bigint, text, date, time)     to authenticated;
grant execute on function import_transactions_bulk(jsonb)                                                                       to authenticated;
