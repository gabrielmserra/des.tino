-- =====================================================================
-- Parcelamento real de compra no cartão de crédito + agregador de
-- compromissos futuros (parcelas de cartão + dívidas + contas fixas).
--
-- Hoje "parcelamento" era só uma instrução na documentação — o usuário
-- calculava a fração e digitava o valor já dividido no campo Valor
-- normal. Não existia nenhuma coluna/lógica de parcela em `transactions`.
--
-- Uma compra parcelada de verdade gera UMA transação real por parcela,
-- uma por mês (mesmo mecanismo de qualquer gasto no cartão — card_id +
-- payment_method='credito'), então get_cards_overview/pay_card_bill
-- continuam funcionando sem nenhuma mudança: parcela é só uma transação
-- normal no mês dela. A parcela do mês corrente entra como gasto real; as
-- futuras entram como "previstas" (is_expectation=true), reaproveitando o
-- mecanismo de previsto que já existe em todo o app.
--
-- Rodar no SQL Editor do Supabase (após 001-026).
-- =====================================================================

create table if not exists card_purchases (
  id                bigint generated always as identity primary key,
  user_id           uuid not null default auth.uid() references auth.users,
  card_id           bigint not null references credit_cards(id) on delete cascade,
  description       text not null,
  category          text not null,
  total_amount      numeric not null,
  installment_count int not null,
  created_at        timestamptz not null default now()
);

alter table transactions add column if not exists card_purchase_id bigint references card_purchases(id) on delete set null;
alter table transactions add column if not exists installment_number int;
alter table transactions add column if not exists installment_total  int;

alter table card_purchases enable row level security;

create policy "own card_purchases" on card_purchases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cria a compra + uma transação real/prevista por parcela. Parcela do mês
-- corrente é gasto real; parcelas de meses futuros entram como previstas.
create or replace function create_card_purchase(
  p_card_id      bigint,
  p_description  text,
  p_category     text,
  p_installments jsonb  -- [{"amount","year","month"}]
) returns bigint
language plpgsql
as $$
declare
  v_purchase_id bigint;
  v_total       numeric := 0;
  v_count       int := 0;
  v_item        jsonb;
  v_month_id    bigint;
  v_number      int := 0;
  v_today       date := current_date;
  v_is_future   boolean;
begin
  select count(*), coalesce(sum((x->>'amount')::numeric), 0)
    into v_count, v_total
    from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) x;

  insert into card_purchases (user_id, card_id, description, category, total_amount, installment_count)
  values (auth.uid(), p_card_id, p_description, coalesce(p_category, 'Outros'), v_total, v_count)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
  loop
    v_number := v_number + 1;
    v_month_id := ensure_month((v_item->>'year')::int, (v_item->>'month')::int);
    v_is_future := (v_item->>'year')::int * 12 + (v_item->>'month')::int
                 > extract(year from v_today)::int * 12 + extract(month from v_today)::int;

    insert into transactions (
      month_id, user_id, type, description, amount, category,
      card_id, payment_method, is_expectation, payment_date,
      card_purchase_id, installment_number, installment_total
    ) values (
      v_month_id, auth.uid(), 'saida_variavel', p_description, (v_item->>'amount')::numeric,
      coalesce(p_category, 'Outros'), p_card_id, 'credito', v_is_future,
      make_date((v_item->>'year')::int, (v_item->>'month')::int, 1),
      v_purchase_id, v_number, v_count
    );
  end loop;

  return v_purchase_id;
end;
$$;

-- Apaga só as parcelas AINDA previstas (futuras) de uma compra — parcelas
-- já reais (mês corrente ou passado) ficam intactas. Uso: compra quitada
-- antecipadamente ou devolvida.
create or replace function delete_remaining_card_purchase_installments(p_purchase_id bigint)
returns void
language plpgsql
as $$
begin
  delete from transactions
  where card_purchase_id = p_purchase_id and is_expectation = true;
end;
$$;

-- Agrega, mês a mês a partir do mês corrente, tudo que já está
-- comprometido pra frente: parcelas de cartão previstas + dívidas em
-- aberto + contas fixas pendentes.
create or replace function get_future_commitments(p_months int default 6)
returns table (
  year int,
  month int,
  card_total numeric,
  debt_total numeric,
  bills_total numeric,
  grand_total numeric
)
language plpgsql
stable
as $$
declare
  v_today date := date_trunc('month', current_date);
begin
  return query
  with months_series as (
    select extract(year from d)::int as yr, extract(month from d)::int as mo
    from generate_series(v_today, v_today + ((greatest(p_months, 1) - 1) || ' months')::interval, interval '1 month') d
  ),
  card_agg as (
    select extract(year from t.payment_date)::int as yr,
           extract(month from t.payment_date)::int as mo,
           sum(t.amount) as total
    from transactions t
    where t.card_purchase_id is not null and t.is_expectation and t.payment_date is not null
    group by 1, 2
  ),
  debt_agg as (
    select due_year as yr, due_month as mo, sum(amount) as total
    from debt_installments
    where paid_at is null
    group by 1, 2
  ),
  bills_agg as (
    select due_year as yr, due_month as mo, sum(amount) as total
    from fixed_bill_instances
    where paid_at is null
    group by 1, 2
  )
  select
    ms.yr, ms.mo,
    coalesce(c.total, 0), coalesce(d.total, 0), coalesce(b.total, 0),
    coalesce(c.total, 0) + coalesce(d.total, 0) + coalesce(b.total, 0)
  from months_series ms
  left join card_agg  c on c.yr = ms.yr and c.mo = ms.mo
  left join debt_agg  d on d.yr = ms.yr and d.mo = ms.mo
  left join bills_agg b on b.yr = ms.yr and b.mo = ms.mo
  order by ms.yr, ms.mo;
end;
$$;

grant execute on function create_card_purchase(bigint, text, text, jsonb)         to authenticated;
grant execute on function delete_remaining_card_purchase_installments(bigint)     to authenticated;
grant execute on function get_future_commitments(int)                            to authenticated;
