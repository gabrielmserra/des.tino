-- =====================================================================
-- Calendário: pendência vencida aparece em HOJE, não no início da
-- janela pedida.
--
-- A 049 jogava toda saída vencida e não paga em greatest(data_real,
-- p_start). Certo quando a janela começa hoje, errado ao navegar pra um
-- mês futuro: toda conta ainda pendente de meses anteriores (e até uma
-- que só vence no fim do mês corrente) aparecia empilhada no dia 1 do
-- mês futuro, duplicada em dois meses.
--
-- Regra nova, a mesma da get_balance_projection (043): saída vencida e
-- não paga conta como devida HOJE (current_date). Aparece uma vez só, no
-- mês corrente, marcada como vencida; meses futuros mostram só o que
-- vence neles. Entrada atrasada (previsto de entrada não confirmado)
-- fica na data original — trazer pra hoje somaria dinheiro que talvez
-- nunca caia. Entrada do planejamento continua sem mudança.
--
-- Rodar no SQL Editor do Supabase (após 001-049).
-- =====================================================================

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
  with raw as (
    -- Contas fixas pendentes
    select
      make_date(fbi.due_year, fbi.due_month, least(fb.due_day,
        extract(day from (make_date(fbi.due_year, fbi.due_month, 1) + interval '1 month - 1 day'))::int)) as raw_date,
      'fixed_bill'::text as source, 'fixed_bill_instances'::text as ref_table,
      fbi.id as ref_id, fb.name as label, fbi.amount as amount, false as is_income
    from fixed_bill_instances fbi
    join fixed_bills fb on fb.id = fbi.bill_id
    where fbi.user_id = auth.uid() and fbi.paid_at is null

    union all
    -- Parcelas de dívida (sem coluna de dia — dia 1 do mês)
    select make_date(di.due_year, di.due_month, 1),
      'debt', 'debt_installments', di.id, d.description, di.amount, false
    from debt_installments di
    join debts d on d.id = di.debt_id
    where di.user_id = auth.uid() and di.paid_at is null

    union all
    -- Parcelas de meta (recorrente sem dia — dia 1 do mês)
    select
      make_date(gi.due_year, gi.due_month, least(coalesce(gi.due_day, 1),
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

    union all
    -- Entradas esperadas do planejamento
    select
      make_date(m.year, m.month, least(pii.expected_day,
        extract(day from (make_date(m.year, m.month, 1) + interval '1 month - 1 day'))::int)),
      'income', 'plan_income_items', pii.id, 'Entrada prevista', pii.amount, true
    from plan_income_items pii
    join monthly_plans mp on mp.id = pii.plan_id
    join months m on m.id = mp.month_id
    where pii.user_id = auth.uid()
  ),
  placed as (
    select
      case when not is_income and raw_date < current_date then current_date else raw_date end as event_date,
      source, ref_table, ref_id, label, amount, is_income,
      case when source = 'income' then 'pending'
           when raw_date < current_date then 'overdue'
           else 'pending' end as status
    from raw
  )
  select event_date, source, ref_table, ref_id, label, amount, is_income, status
  from placed
  where event_date between p_start and p_end
$$;

grant execute on function get_calendar_events(date, date) to authenticated;
