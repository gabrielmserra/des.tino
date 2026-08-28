-- =====================================================================
-- Corrige get_future_commitments: a fatura em aberto deve ser rotulada
-- pelo mês em que o CICLO DO CARTÃO começou (dia de fechamento de cada
-- cartão, já usado em get_cards_overview via _cycle_start), não pelo mês
-- do lançamento no app (que depende do dia de corte GLOBAL da
-- importação de extrato — uma configuração totalmente diferente e sem
-- relação com o fechamento do cartão).
--
-- Exemplo: cartão com fechamento dia 4 — ciclo que fecha 04/09 e vence
-- 12/09 começou em 04/08, então é "a fatura de Agosto"; o ciclo que
-- começa em 04/09 é "a fatura de Setembro".
--
-- Deixa de depender de qual `month_id` a transação caiu (get_cards_
-- overview é month_id-scoped, pensado pra tela de Cartões por mês) —
-- calcula gasto/pago do ciclo aberto direto pela data real da transação/
-- pagamento, por cartão, com a mesma lógica de _cycle_start já usada em
-- toda a parte de cartões.
--
-- Rodar no SQL Editor do Supabase (após 001-029).
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
  v_today date := date_trunc('month', current_date);
begin
  return query
  with months_series as (
    select extract(year from d)::int as yr, extract(month from d)::int as mo
    from generate_series(v_today, v_today + ((greatest(p_months, 1) - 1) || ' months')::interval, interval '1 month') d
  ),
  -- Fatura em aberto (gasto real do ciclo atual, ainda não pago) de cada
  -- cartão, rotulada pelo mês em que o ciclo começou.
  open_bill_agg as (
    select
      -- greatest(...) trava no mês corrente se o ciclo começou no mês
      -- passado (primeiros dias do mês, antes do fechamento do cartão
      -- chegar) — sem isso, essa fatura sumiria da lista em vez de cair
      -- no mês corrente (months_series nunca inclui mês já passado).
      extract(year from greatest(_cycle_start(c.closing_day), v_today))::int as yr,
      extract(month from greatest(_cycle_start(c.closing_day), v_today))::int as mo,
      sum(greatest(0, coalesce(spend.total, 0) - coalesce(pay.total, 0))) as total
    from credit_cards c
    left join lateral (
      select sum(t.amount) as total
      from transactions t
      where t.card_id = c.id
        and t.type = 'saida_variavel'
        and coalesce(t.is_expectation, false) = false
        and t.created_at::date >= _cycle_start(c.closing_day)
    ) spend on true
    left join lateral (
      select sum(p.amount) as total
      from credit_card_payments p
      where p.card_id = c.id
        and p.created_at::date >= _cycle_start(c.closing_day)
    ) pay on true
    group by 1, 2
  ),
  -- Parcelas futuras previstas (mês do próprio parcelamento, escolhido
  -- pelo usuário na hora de criar a compra) — não pega a parcela do mês
  -- corrente (is_expectation=false), essa já está no open_bill_agg.
  installment_agg as (
    select extract(year from t.payment_date)::int as yr,
           extract(month from t.payment_date)::int as mo,
           sum(t.amount) as total
    from transactions t
    where t.card_purchase_id is not null and t.is_expectation and t.payment_date is not null
    group by 1, 2
  ),
  card_agg as (
    select coalesce(o.yr, i.yr) as yr, coalesce(o.mo, i.mo) as mo,
           coalesce(o.total, 0) + coalesce(i.total, 0) as total
    from open_bill_agg o
    full outer join installment_agg i on i.yr = o.yr and i.mo = o.mo
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
    coalesce(c.total, 0) as card_total,
    coalesce(d.total, 0) as debt_total,
    coalesce(b.total, 0) as bills_total,
    coalesce(c.total, 0) + coalesce(d.total, 0) + coalesce(b.total, 0) as grand_total
  from months_series ms
  left join card_agg  c on c.yr = ms.yr and c.mo = ms.mo
  left join debt_agg  d on d.yr = ms.yr and d.mo = ms.mo
  left join bills_agg b on b.yr = ms.yr and b.mo = ms.mo
  order by ms.yr, ms.mo;
end;
$$;

grant execute on function get_future_commitments(int) to authenticated;
