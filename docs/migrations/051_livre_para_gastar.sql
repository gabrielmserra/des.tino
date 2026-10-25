-- =====================================================================
-- Card "Livre para gastar" + duas projeções que faltavam no calendário.
--
-- 1) get_calendar_events passa a PROJETAR:
--    - Contas fixas de meses (corrente ou futuros) que ainda não têm a
--      instância criada — instância só nasce quando o mês chega ou quando
--      a tela de Contas Fixas é aberta (ensure_fixed_bill_instances), então
--      sem isso nenhum mês futuro tinha conta fixa. Usa o template
--      (expected_amount, due_day). ref_table='fixed_bills' / ref_id = id da
--      conta: marcar como feito cria a instância do mês e paga ela.
--    - Entradas de meses (corrente ou futuros) sem planejamento de renda:
--      repete os itens de renda do último mês ANTERIOR que tem plano
--      (decisão do usuário: salário fixo, mesmas datas todo mês). Assim que
--      o plano do mês é criado, ele passa a valer no lugar da repetição.
--    Meses passados nunca são projetados.
--
-- 2) get_livre_para_gastar(p_horizon_days): simula o saldo dia a dia de
--    hoje até hoje + H - 1, sobre get_calendar_events:
--      B(0) = saldo acumulado real (get_saldo_acumulado do mês corrente,
--             ou do último mês cadastrado antes dele)
--      B(t) = B(t-1) + entradas(t) - saídas(t)          (t = 1 é hoje)
--      livre      = max(0, min B(t))
--      limite_dia = max(0, min B(t)/t)
--    NÃO é "saldo − pendências até a próxima entrada": a soma corrida pega
--    o ponto mais apertado de todo o horizonte, mesmo que ele esteja depois
--    de uma entrada.
--
-- Rodar no SQL Editor do Supabase (após 001-050).
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
  with months_span as (
    -- Meses (início de cada um) cobertos pela janela, só do corrente em diante
    select m::date as m
    from generate_series(
      date_trunc('month', greatest(p_start, current_date)),
      date_trunc('month', p_end),
      interval '1 month') m
    where p_end >= current_date
  ),
  last_plan_before as (
    -- Pra cada mês da janela sem plano de renda: o último plano anterior com renda
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
    -- Entradas esperadas do planejamento do próprio mês
    select
      make_date(m.year, m.month, least(pii.expected_day,
        extract(day from (make_date(m.year, m.month, 1) + interval '1 month - 1 day'))::int)),
      'income', 'plan_income_items', pii.id, 'Entrada prevista', pii.amount, true
    from plan_income_items pii
    join monthly_plans mp on mp.id = pii.plan_id
    join months m on m.id = mp.month_id
    where pii.user_id = auth.uid()

    union all
    -- Entradas repetidas do último plano (mês sem planejamento de renda)
    select
      make_date(extract(year from lp.m)::int, extract(month from lp.m)::int, least(pii.expected_day,
        extract(day from (lp.m + interval '1 month - 1 day'))::int)),
      'income_projected', 'plan_income_items', pii.id, 'Entrada prevista (repete o último plano)', pii.amount, true
    from last_plan_before lp
    join plan_income_items pii on pii.plan_id = lp.plan_id
  ),
  placed as (
    select
      case when not is_income and raw_date < current_date then current_date else raw_date end as event_date,
      source, ref_table, ref_id, label, amount, is_income,
      case when is_income and source in ('income', 'income_projected') then 'pending'
           when raw_date < current_date then 'overdue'
           else 'pending' end as status
    from raw
  )
  select event_date, source, ref_table, ref_id, label, amount, is_income, status
  from placed
  where event_date between p_start and p_end
$$;

create or replace function get_livre_para_gastar(p_horizon_days int default 45)
returns json
language plpgsql
stable
as $$
declare
  v_days      int  := greatest(coalesce(p_horizon_days, 45), 1);
  v_today     date := current_date;
  v_end       date := current_date + (greatest(coalesce(p_horizon_days, 45), 1) - 1);
  v_month_id  bigint;
  v_start     numeric;
  v_balance   numeric;
  v_min       numeric;
  v_min_day   date;
  v_limit     numeric;
  v_t         int := 0;
  v_in        numeric := 0;
  v_out       numeric := 0;
  r           record;
begin
  select id into v_month_id
  from months
  where user_id = auth.uid()
    and (year, month) <= (extract(year from v_today)::int, extract(month from v_today)::int)
  order by year desc, month desc
  limit 1;

  if v_month_id is null then
    return null;
  end if;

  v_start   := get_saldo_acumulado(v_month_id);
  v_balance := v_start;

  for r in
    select d::date as day,
           coalesce(sum(case when e.is_income then e.amount else 0 end), 0) as inc,
           coalesce(sum(case when e.is_income then 0 else e.amount end), 0) as outg
    from generate_series(v_today, v_end, interval '1 day') d
    left join get_calendar_events(v_today, v_end) e on e.event_date = d::date
    group by d
    order by d
  loop
    v_t       := v_t + 1;
    v_balance := v_balance + r.inc - r.outg;
    v_in      := v_in + r.inc;
    v_out     := v_out + r.outg;
    if v_min is null or v_balance < v_min then
      v_min     := v_balance;
      v_min_day := r.day;
    end if;
    if v_limit is null or v_balance / v_t < v_limit then
      v_limit := v_balance / v_t;
    end if;
  end loop;

  return json_build_object(
    'saldo_atual',  v_start,
    'livre',        greatest(0, v_min),
    'limite_dia',   greatest(0, v_limit),
    'saldo_minimo', v_min,
    'dia_critico',  v_min_day,
    'entradas',     v_in,
    'saidas',       v_out,
    'dias',         v_days,
    'sem_renda',    v_in = 0
  );
end;
$$;

grant execute on function get_calendar_events(date, date) to authenticated;
grant execute on function get_livre_para_gastar(int)      to authenticated;
