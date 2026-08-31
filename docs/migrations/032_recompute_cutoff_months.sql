-- =====================================================================
-- Dia de corte retroativo: quando o usuário muda o dia de corte, os
-- lançamentos ANTIGOS que vieram da importação de extrato são
-- recalculados pra caírem no mês certo com a regra nova (ex.: 25/04
-- que hoje está em "Maio" por causa do corte-24 volta pra "Abril" se o
-- corte virar 01). Lançamentos manuais nunca se movem sozinhos — só os
-- que passaram pela importação (nova coluna transactions.imported).
-- Rodar no SQL Editor do Supabase (após 001-031).
-- =====================================================================

-- Marca a origem do lançamento (só a importação de extrato marca true,
-- a partir de agora — ver import_transactions_bulk abaixo).
alter table transactions add column if not exists imported boolean not null default false;

-- Backfill por melhor esforço pra dados já existentes: não existe uma
-- marcação histórica de "isso veio da importação", então a única pista
-- disponível é que um lançamento manual normalmente fica no mês
-- calendário da própria data (ou no mês que o usuário escolheu de
-- propósito); um lançamento deslocado pela regra do dia de corte é o
-- único caso em que o mês atribuído diverge do mês calendário da data.
update transactions t
set imported = true
from months m
where t.month_id = m.id
  and t.payment_date is not null
  and (extract(year from t.payment_date)::int, extract(month from t.payment_date)::int)
      != (m.year, m.month);

-- import_transactions_bulk passa a marcar imported=true nos lançamentos
-- que cria (delega em add_transaction, que não muda de assinatura — só
-- soma um UPDATE depois do insert).
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
    update transactions set imported = true where id = v_id;
    return next v_id;
  end loop;
end;
$$;

-- Réplica em SQL de utils/helpers.py:billing_month — manter as duas
-- em sincronia caso a regra do dia de corte mude no futuro.
create or replace function billing_month(p_date date, p_cutoff_day int)
returns table(y int, m int)
language plpgsql
immutable
as $$
declare
  v_year  int := extract(year from p_date)::int;
  v_month int := extract(month from p_date)::int;
  v_day   int := extract(day from p_date)::int;
  v_days_in_month     int;
  v_effective_cutoff  int;
begin
  if p_cutoff_day <= 1 then
    y := v_year; m := v_month;
    return next;
    return;
  end if;

  v_days_in_month := extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int;
  v_effective_cutoff := least(p_cutoff_day, v_days_in_month);

  if v_day >= v_effective_cutoff then
    v_month := v_month + 1;
    if v_month > 12 then
      v_month := 1;
      v_year := v_year + 1;
    end if;
  end if;

  y := v_year; m := v_month;
  return next;
end;
$$;

-- Move cada lançamento importado pro mês correto sob o novo dia de
-- corte (cria o mês de destino via ensure_month, já existente, se
-- precisar). Retorna quantos lançamentos foram movidos.
create or replace function recompute_cutoff_months(p_cutoff_day int)
returns int
language plpgsql
as $$
declare
  r record;
  v_y int;
  v_m int;
  v_target_id bigint;
  v_month_names text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  v_moved int := 0;
begin
  for r in
    select id, month_id, payment_date from transactions
    where user_id = auth.uid() and imported = true and payment_date is not null
  loop
    select y, m into v_y, v_m from billing_month(r.payment_date, p_cutoff_day);

    select id into v_target_id from months
    where user_id = auth.uid() and year = v_y and month = v_m;

    if v_target_id is null then
      v_target_id := ensure_month(v_month_names[v_m] || ' ' || v_y::text, v_y, v_m);
    end if;

    if v_target_id != r.month_id then
      update transactions set month_id = v_target_id where id = r.id;
      v_moved := v_moved + 1;
    end if;
  end loop;
  return v_moved;
end;
$$;

grant execute on function import_transactions_bulk(jsonb) to authenticated;
grant execute on function billing_month(date, int)        to authenticated;
grant execute on function recompute_cutoff_months(int)    to authenticated;

-- create_month (011) copia pro novo mês as compras no cartão feitas após
-- o fechamento do ciclo anterior — precisa preservar "imported" nessa
-- cópia, senão um lançamento importado perde a elegibilidade pro
-- recálculo do dia de corte ao ser copiado pra um mês novo.
create or replace function create_month(p_name text, p_year int, p_month int)
returns bigint
language plpgsql
as $$
declare
  v_id       bigint;
  v_prev_id  bigint;
begin
  select id into v_id from months where name = p_name;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_prev_id from months order by year desc, month desc limit 1;

  insert into months (user_id, name, year, month)
  values (auth.uid(), p_name, p_year, p_month)
  returning id into v_id;

  if v_prev_id is not null then
    insert into transactions (month_id, user_id, type, description, amount, category, card_id, imported)
    select v_id, auth.uid(), t.type, t.description, t.amount, t.category, t.card_id, t.imported
    from transactions t
    join credit_cards c on c.id = t.card_id
    where t.month_id = v_prev_id
      and t.type = 'saida_variavel'
      and t.card_id is not null
      and coalesce(t.is_expectation, false) = false
      and extract(day from t.created_at::date)::int > c.closing_day;
  end if;

  return v_id;
end;
$$;

grant execute on function create_month(text, int, int) to authenticated;
