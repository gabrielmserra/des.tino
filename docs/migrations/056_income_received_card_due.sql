-- =====================================================================
-- 1) Botão "Recebido" pra entrada prevista do planejamento: salário que
--    cai dividido em vários Pix não é reconhecido pela regra automática da
--    052 (que procura UM lançamento de valor parecido). A marcação manual
--    fica em plan_income_receipts, chaveada por (data prevista, valor) —
--    não pelo id do item, porque save_plan apaga e recria os itens de
--    renda a cada edição do plano.
--
-- 2) Previsto lançado num cartão de crédito (parcela futura) passa a
--    aparecer no VENCIMENTO DA FATURA do ciclo em que cai — é quando o
--    dinheiro sai de verdade —, não na data da compra.
--
-- 3) get_calendar_events ganha a coluna raw_date (data original do
--    evento, antes de "vencido/atrasado → hoje"), usada pra marcar a
--    entrada recebida certa. Mudar o tipo de retorno exige DROP + CREATE.
--
-- Rodar no SQL Editor do Supabase (após 001-055).
-- =====================================================================

create table if not exists plan_income_receipts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users,
  expected_date date not null,
  amount        numeric not null,
  received_at   timestamptz not null default now(),
  unique (user_id, expected_date, amount)
);

alter table plan_income_receipts enable row level security;

create policy "own plan_income_receipts" on plan_income_receipts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vencimento da fatura do ciclo que contém p_date: compra a partir do dia
-- de fechamento cai no ciclo que fecha no mês seguinte; vence no mês do
-- fechamento (due_day >= closing_day) ou no seguinte. Mesma convenção de
-- _cycle_start/_cycle_due_date, só que pra uma data qualquer.
create or replace function _card_due_for(p_closing_day int, p_due_day int, p_date date)
returns date
language plpgsql
immutable
as $$
declare
  v_close_month date;
  v_due_month   date;
begin
  if extract(day from p_date)::int >= p_closing_day then
    v_close_month := (date_trunc('month', p_date) + interval '1 month')::date;
  else
    v_close_month := date_trunc('month', p_date)::date;
  end if;
  if p_due_day >= p_closing_day then
    v_due_month := v_close_month;
  else
    v_due_month := (v_close_month + interval '1 month')::date;
  end if;
  return make_date(extract(year from v_due_month)::int, extract(month from v_due_month)::int,
                   least(p_due_day, extract(day from (v_due_month + interval '1 month - 1 day'))::int));
end;
$$;

drop function if exists get_calendar_events(date, date);

create or replace function get_calendar_events(p_start date, p_end date)
returns table (
  event_date date,
  source     text,
  ref_table  text,
  ref_id     bigint,
  label      text,
  amount     numeric,
  is_income  boolean,
  status     text,
  raw_date   date
)
language sql
stable
as $$
  with months_span as (
    select m::date as m
    from generate_series(
      date_trunc('month', greatest(p_start, current_date)),
      date_trunc('month', p_end),
      interval '1 month') m
    where p_end >= current_date
  ),
  last_plan_before as (
    select ms.m,
      (select mp2.id
         from monthly_plans mp2
         join months mo2 on mo2.id = mp2.month_id
        where mp2.user_id = auth.uid()
          and make_date(mo2.year, mo2.month, 1) < ms.m
          and exists (select 1 from plan_income_items p3 where p3.plan_id = mp2.id)
        order by mo2.year desc, mo2.month desc
        limit 1) as plan_id
    from months_span ms
    where not exists (
      select 1
        from plan_income_items p4
        join monthly_plans mp4 on mp4.id = p4.plan_id
        join months mo4 on mo4.id = mp4.month_id
       where p4.user_id = auth.uid()
         and mo4.year = extract(year from ms.m)::int
         and mo4.month = extract(month from ms.m)::int)
  ),
  income_raw as (
    -- Entradas do plano do próprio mês
    select
      case when pii.is_last_business_day then _last_business_day(m.year, m.month)
           else make_date(m.year, m.month, least(pii.expected_day,
                  extract(day from (make_date(m.year, m.month, 1) + interval '1 month - 1 day'))::int))
      end as raw_date,
      'income'::text as source, pii.id as ref_id,
      case when pii.is_last_business_day then 'Entrada prevista (último dia útil)'
           else 'Entrada prevista' end as label,
      pii.amount as amount
    from plan_income_items pii
    join monthly_plans mp on mp.id = pii.plan_id
    join months m on m.id = mp.month_id
    where pii.user_id = auth.uid()

    union all
    -- Entradas repetidas do último plano (mês sem planejamento de renda)
    select
      case when pii.is_last_business_day
             then _last_business_day(extract(year from lp.m)::int, extract(month from lp.m)::int)
           else make_date(extract(year from lp.m)::int, extract(month from lp.m)::int, least(pii.expected_day,
                  extract(day from (lp.m + interval '1 month - 1 day'))::int))
      end,
      'income_projected', pii.id,
      case when pii.is_last_business_day then 'Entrada prevista (último dia útil, repete o último plano)'
           else 'Entrada prevista (repete o último plano)' end,
      pii.amount
    from last_plan_before lp
    join plan_income_items pii on pii.plan_id = lp.plan_id
  ),
  income_open as (
    -- Tira a entrada prevista que já foi recebida (lançamento real parecido,
    -- até 7 dias antes ou depois); a atrasada há até 7 dias vai pra hoje.
    select
      case when ir.raw_date < current_date then current_date else ir.raw_date end as raw_date,
      ir.source, ir.ref_id, ir.label, ir.amount,
      ir.raw_date < current_date as late,
      ir.raw_date as orig_date
    from income_raw ir
    where not exists (
        select 1 from transactions t
         where t.user_id = auth.uid()
           and coalesce(t.is_expectation, false) = false
           and coalesce(t.is_investment_movement, false) = false
           and t.type in ('entrada_fixa', 'entrada_variavel')
           and t.payment_date between ir.raw_date - 7 and ir.raw_date + 7
           and t.amount between ir.amount * 0.8 and ir.amount * 1.2)
      and (ir.raw_date >= current_date - 7)
      and not exists (
        select 1 from plan_income_receipts rc
         where rc.user_id = auth.uid() and rc.expected_date = ir.raw_date
           and abs(rc.amount - ir.amount) < 0.01)
    union all
    -- Entrada antiga (mais de 7 dias), sem lançamento: fica na data original
    select ir.raw_date, ir.source, ir.ref_id, ir.label, ir.amount, false, ir.raw_date
    from income_raw ir
    where ir.raw_date < current_date - 7
      and not exists (
        select 1 from plan_income_receipts rc
         where rc.user_id = auth.uid() and rc.expected_date = ir.raw_date
           and abs(rc.amount - ir.amount) < 0.01)
      and not exists (
        select 1 from transactions t
         where t.user_id = auth.uid()
           and coalesce(t.is_expectation, false) = false
           and coalesce(t.is_investment_movement, false) = false
           and t.type in ('entrada_fixa', 'entrada_variavel')
           and t.payment_date between ir.raw_date - 7 and ir.raw_date + 7
           and t.amount between ir.amount * 0.8 and ir.amount * 1.2)
  ),
  raw as (
    -- Contas fixas pendentes (instância já criada)
    select
      make_date(fbi.due_year, fbi.due_month, least(fb.due_day,
        extract(day from (make_date(fbi.due_year, fbi.due_month, 1) + interval '1 month - 1 day'))::int)) as raw_date,
      'fixed_bill'::text as source, 'fixed_bill_instances'::text as ref_table,
      fbi.id as ref_id, fb.name as label, fbi.amount as amount, false as is_income
    from fixed_bill_instances fbi
    join fixed_bills fb on fb.id = fbi.bill_id
    where fbi.user_id = auth.uid() and fbi.paid_at is null

    union all
    -- Contas fixas projetadas (mês sem instância criada ainda)
    select
      make_date(extract(year from ms.m)::int, extract(month from ms.m)::int, least(fb.due_day,
        extract(day from (ms.m + interval '1 month - 1 day'))::int)),
      'fixed_bill_projected', 'fixed_bills', fb.id, fb.name, fb.expected_amount, false
    from months_span ms
    join fixed_bills fb on fb.user_id = auth.uid() and fb.active
      and date_trunc('month', fb.created_at)::date <= ms.m
    where not exists (
      select 1 from fixed_bill_instances i
       where i.bill_id = fb.id
         and i.due_year = extract(year from ms.m)::int
         and i.due_month = extract(month from ms.m)::int)

    union all
    -- Parcelas de dívida (dia da dívida, ou dia 1)
    select
      make_date(di.due_year, di.due_month, least(coalesce(d.due_day, 1),
        extract(day from (make_date(di.due_year, di.due_month, 1) + interval '1 month - 1 day'))::int)),
      'debt', 'debt_installments', di.id, d.description, di.amount, false
    from debt_installments di
    join debts d on d.id = di.debt_id
    where di.user_id = auth.uid() and di.paid_at is null

    union all
    -- Parcelas de meta (dia da parcela, senão dia da meta, senão dia 1)
    select
      make_date(gi.due_year, gi.due_month, least(coalesce(gi.due_day, g.due_day, 1),
        extract(day from (make_date(gi.due_year, gi.due_month, 1) + interval '1 month - 1 day'))::int)),
      'goal', 'goal_installments', gi.id, g.name, gi.amount, false
    from goal_installments gi
    join goals g on g.id = gi.goal_id
    where gi.user_id = auth.uid() and gi.contributed_at is null

    union all
    -- Fatura de cartão já fechada, ainda não paga
    select x.due_date, 'card_invoice', 'credit_cards', c.id, c.name || ' (fatura)', x.total, false
    from credit_cards c
    cross join lateral (
      select
        coalesce((select sum(t.amount) from transactions t
                  where t.user_id = auth.uid() and t.card_id = c.id
                    and t.type = 'saida_variavel' and coalesce(t.is_expectation, false) = false
                    and t.invoice_id is null and t.payment_date < _cycle_start(c.closing_day)), 0) as total,
        _cycle_due_date(c.closing_day, c.due_day) as due_date
    ) x
    where c.user_id = auth.uid() and x.total > 0

    union all
    -- Fatura do ciclo ainda aberto, no vencimento projetado
    select x.due_date, 'card_invoice_open', 'credit_cards', c.id, c.name || ' (fatura em aberto)', x.total, false
    from credit_cards c
    cross join lateral (
      select
        coalesce((select sum(t.amount) from transactions t
                  where t.user_id = auth.uid() and t.card_id = c.id
                    and t.type = 'saida_variavel' and coalesce(t.is_expectation, false) = false
                    and t.invoice_id is null and t.payment_date >= _cycle_start(c.closing_day)), 0) as total,
        _next_cycle_due_date(c.closing_day, c.due_day) as due_date
    ) x
    where c.user_id = auth.uid() and x.total > 0

    union all
    -- Previstos avulsos e parcelas futuras de cartão
    select case when t.card_id is not null
                then coalesce((select _card_due_for(c.closing_day, c.due_day, t.payment_date)
                                 from credit_cards c where c.id = t.card_id), t.payment_date)
                else t.payment_date end,
      case when t.card_purchase_id is not null then 'card_installment' else 'expectation' end,
      'transactions', t.id, t.description, t.amount,
      t.type in ('entrada_fixa', 'entrada_variavel')
    from transactions t
    where t.user_id = auth.uid() and t.is_expectation = true and t.payment_date is not null
  ),
  placed as (
    select
      case when not is_income and raw_date < current_date then current_date else raw_date end as event_date,
      source, ref_table, ref_id, label, amount, is_income,
      case when raw_date < current_date then 'overdue' else 'pending' end as status,
      raw_date
    from raw
    union all
    select raw_date, source, 'plan_income_items', ref_id, label, amount, true,
           case when late then 'overdue' else 'pending' end,
           orig_date
    from income_open
  )
  select event_date, source, ref_table, ref_id, label, amount, is_income, status, raw_date
  from placed
  where event_date between p_start and p_end
$$;

grant execute on function _card_due_for(int, int, date)    to authenticated;
grant execute on function get_calendar_events(date, date)  to authenticated;
