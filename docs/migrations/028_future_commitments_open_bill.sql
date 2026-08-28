-- =====================================================================
-- Compromissos Futuros também deve mostrar a fatura em aberto do mês
-- corrente (gasto real já feito no cartão e ainda não pago), não só as
-- parcelas futuras previstas — hoje o mês corrente sempre aparecia com
-- "R$0 de cartão" mesmo com fatura em aberto, porque card_agg só soma
-- transações previstas (is_expectation=true).
--
-- Reaproveita get_cards_overview (mesma função da tela de Cartões) pra
-- calcular o "unpaid" do mês corrente, em vez de duplicar a lógica de
-- ciclo de fechamento — soma o unpaid de todos os cartões e adiciona ao
-- card_total só da linha do mês corrente.
--
-- Rodar no SQL Editor do Supabase (após 001-027).
-- =====================================================================

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
  v_today         date := date_trunc('month', current_date);
  v_cur_year      int  := extract(year from v_today)::int;
  v_cur_month     int  := extract(month from v_today)::int;
  v_cur_month_id  bigint;
  v_unpaid_total  numeric := 0;
begin
  select m.id into v_cur_month_id
  from months m
  where m.year = v_cur_year and m.month = v_cur_month
  limit 1;

  if v_cur_month_id is not null then
    select coalesce(sum(o.unpaid), 0) into v_unpaid_total
    from get_cards_overview(v_cur_month_id) o;
  end if;

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
    coalesce(c.total, 0) + case when ms.yr = v_cur_year and ms.mo = v_cur_month
                                 then v_unpaid_total else 0 end as card_total,
    coalesce(d.total, 0) as debt_total,
    coalesce(b.total, 0) as bills_total,
    coalesce(c.total, 0) + case when ms.yr = v_cur_year and ms.mo = v_cur_month
                                 then v_unpaid_total else 0 end
      + coalesce(d.total, 0) + coalesce(b.total, 0) as grand_total
  from months_series ms
  left join card_agg  c on c.yr = ms.yr and c.mo = ms.mo
  left join debt_agg  d on d.yr = ms.yr and d.mo = ms.mo
  left join bills_agg b on b.yr = ms.yr and b.mo = ms.mo
  order by ms.yr, ms.mo;
end;
$$;

grant execute on function get_future_commitments(int) to authenticated;
