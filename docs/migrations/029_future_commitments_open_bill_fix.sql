-- =====================================================================
-- Corrige get_future_commitments (028): a fatura em aberto não aparecia
-- porque o "mês corrente" era achado pela data real do calendário
-- (current_date), mas o app usa o dia de corte da importação pra decidir
-- em qual `months` os gastos do cartão caem — então o mês "atual" de
-- verdade (o que o app abre por padrão, o de maior year/month) pode já
-- ser o mês seguinte ao calendário quando o corte já passou.
--
-- Corrige achando o mês corrente do mesmo jeito que o app: o registro de
-- `months` com maior (year, month) — o mesmo que fetchMonths()/get_months()
-- seleciona por padrão ao abrir o app nas duas plataformas.
--
-- Rodar no SQL Editor do Supabase (após 001-028).
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
  v_cur_month_id  bigint;
  v_cur_year      int;
  v_cur_month     int;
  v_unpaid_total  numeric := 0;
begin
  -- Mês "atual" na visão do app: o de maior (year, month) cadastrado —
  -- mesmo critério de fetchMonths()/get_months() (order by year desc,
  -- month desc), não a data real do calendário.
  select m.id, m.year, m.month
    into v_cur_month_id, v_cur_year, v_cur_month
  from months m
  order by m.year desc, m.month desc
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
    coalesce(c.total, 0) + case when v_cur_year is not null and ms.yr = v_cur_year and ms.mo = v_cur_month
                                 then v_unpaid_total else 0 end as card_total,
    coalesce(d.total, 0) as debt_total,
    coalesce(b.total, 0) as bills_total,
    coalesce(c.total, 0) + case when v_cur_year is not null and ms.yr = v_cur_year and ms.mo = v_cur_month
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
