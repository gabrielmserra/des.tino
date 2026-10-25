-- =====================================================================
-- Regras de renda e dia de vencimento opcional (Fase 3 do calendário).
--
-- 1) "Último dia útil do mês" como regra de data de uma entrada do
--    planejamento (plan_income_items.is_last_business_day). Resolve pro
--    último dia do mês, recuando pra sexta se cair sábado/domingo
--    (feriados ficam pra depois). expected_day continua preenchido (31)
--    só por compatibilidade com get_balance_projection (043).
--
-- 2) Recebimento antecipado/atrasado, sem duplicar nem deixar previsão
--    fantasma, sem nenhuma ação manual: uma entrada prevista (do plano do
--    mês ou repetida do último plano) é considerada RECEBIDA quando existe
--    um lançamento real de entrada (não previsto, não aporte/resgate de
--    investimento) com payment_date até 7 dias antes ou depois da data
--    prevista e valor até 20% diferente (renda variável, ex. desconto de
--    atraso no ponto). Recebida → some da projeção (o dinheiro já está no
--    saldo). Não recebida e com data já passada há até 7 dias → aparece
--    HOJE como atrasada (status 'overdue'). Mais antiga que isso → fica na
--    data original (presume-se que não vem mais / já entrou sem registro).
--
-- 3) Dia de vencimento opcional na DÍVIDA e na META (debts.due_day,
--    goals.due_day) — vale pra todas as parcelas, inclusive as geradas
--    depois. Parcela de meta personalizada continua com o próprio dia
--    (goal_installments.due_day, migração 026), que tem prioridade. Sem
--    dia definido, continua caindo no dia 1 do mês.
--
-- Rodar no SQL Editor do Supabase (após 001-051).
-- =====================================================================

alter table plan_income_items add column if not exists is_last_business_day boolean not null default false;
alter table debts add column if not exists due_day int check (due_day is null or due_day between 1 and 31);
alter table goals add column if not exists due_day int check (due_day is null or due_day between 1 and 31);

create or replace function _last_business_day(p_year int, p_month int)
returns date
language sql
immutable
as $$
  select d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end
  from (select (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date as d) x
$$;

-- save_plan (031) passa a gravar is_last_business_day (chave opcional no
-- jsonb; ausente = false).
create or replace function save_plan(
  p_month_id     bigint,
  p_income       numeric,
  p_items        jsonb,
  p_income_items jsonb default '[]'::jsonb
) returns bigint
language plpgsql
as $$
declare
  v_plan_id bigint;
  v_is_new  boolean;
  v_year    int;
  v_month   int;
  v_item    jsonb;
begin
  select id into v_plan_id from monthly_plans where month_id = p_month_id;
  v_is_new := v_plan_id is null;

  if v_is_new then
    insert into monthly_plans (month_id, user_id, income)
    values (p_month_id, auth.uid(), p_income)
    returning id into v_plan_id;

    select year, month into v_year, v_month from months where id = p_month_id;
    if found then
      update monthly_plans mp
      set status = 'fechado'
      from months m
      where mp.month_id = m.id
        and mp.status = 'ativo'
        and mp.id <> v_plan_id
        and (m.year, m.month) < (v_year, v_month);
    end if;
  else
    update monthly_plans
    set income = p_income, updated_at = now()
    where id = v_plan_id;

    delete from monthly_plan_items where plan_id = v_plan_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into monthly_plan_items (
      plan_id, user_id, category, suggested_amount, planned_amount,
      is_eventual, is_mandatory
    ) values (
      v_plan_id,
      auth.uid(),
      v_item->>'category',
      nullif(v_item->>'suggested_amount', '')::numeric,
      coalesce((v_item->>'planned_amount')::numeric, 0),
      coalesce((v_item->>'is_eventual')::boolean, false),
      coalesce((v_item->>'is_mandatory')::boolean, false)
    );
  end loop;

  delete from plan_income_items where plan_id = v_plan_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_income_items, '[]'::jsonb))
  loop
    insert into plan_income_items (plan_id, user_id, amount, expected_day, is_last_business_day)
    values (
      v_plan_id,
      auth.uid(),
      (v_item->>'amount')::numeric,
      (v_item->>'expected_day')::int,
      coalesce((v_item->>'is_last_business_day')::boolean, false)
    );
  end loop;

  return v_plan_id;
end;
$$;

create or replace function get_calendar_events(p_start date, p_end date)
returns table (
  event_date date,
  source     text,
  ref_table  text,
  ref_id     bigint,
  label      text,
  amount     numeric,
  is_income  boolean,
  status     text
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
      ir.raw_date < current_date as late
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
    union all
    -- Entrada antiga (mais de 7 dias), sem lançamento: fica na data original
    select ir.raw_date, ir.source, ir.ref_id, ir.label, ir.amount, false
    from income_raw ir
    where ir.raw_date < current_date - 7
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
    select t.payment_date,
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
      case when raw_date < current_date then 'overdue' else 'pending' end as status
    from raw
    union all
    select raw_date, source, 'plan_income_items', ref_id, label, amount, true,
           case when late then 'overdue' else 'pending' end
    from income_open
  )
  select event_date, source, ref_table, ref_id, label, amount, is_income, status
  from placed
  where event_date between p_start and p_end
$$;

grant execute on function _last_business_day(int, int)                  to authenticated;
grant execute on function save_plan(bigint, numeric, jsonb, jsonb)       to authenticated;
grant execute on function get_calendar_events(date, date)                to authenticated;
