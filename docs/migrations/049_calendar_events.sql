-- =====================================================================
-- Calendário financeiro: uma VISÃO unificada sobre tudo que já tem data
-- no app — contas fixas, parcelas de dívida, parcelas de meta, fatura
-- de cartão (fechada e em aberto), parcelas futuras de compra no cartão
-- e lançamentos previstos/entradas do planejamento — pro intervalo
-- [p_start, p_end]. Nenhuma tabela nova de compromissos: é só leitura.
-- Marcar como feito continua usando os RPCs que já existiam antes desta
-- migração (pay_fixed_bill_instance, pay_installment,
-- contribute_goal_installment, pay_card_bill, confirm_expectation) —
-- ref_table/ref_id dizem pra UI qual deles chamar.
--
-- Contas fixas/dívidas/metas ainda pendentes e já vencidas aparecem no
-- início da janela pedida (greatest(data_real, p_start)), não na data
-- real já passada — mesma convenção conservadora de
-- get_balance_projection (migration 043: "vencido conta a partir de
-- hoje"), só generalizada pra qualquer janela, não só o mês corrente.
-- Isso é o que permite get_livre_para_gastar (próxima migração) reusar
-- esta função sem perder nenhuma pendência vencida na soma. Parcela de
-- dívida (não tem coluna de dia) ou de meta recorrente sem dia certo
-- cadastrado (goal_installments.due_day null) cai no dia 1 do mês como
-- padrão visível.
--
-- Entrada prevista do planejamento é diferente: se o dia esperado já
-- passou dentro do mês corrente, ela NÃO entra de novo (mesma exclusão
-- que a 043 já fazia) — presume-se já refletida no saldo real, se de
-- fato caiu.
--
-- Rodar no SQL Editor do Supabase (após 001-048).
-- =====================================================================

-- Data de vencimento da fatura do CICLO AINDA ABERTO (quando ele fechar
-- e vencer) — mesma lógica de _cycle_due_date (migration 035), só
-- aplicada um ciclo à frente (o aberto, não o já fechado). Não existia
-- nenhuma função até agora que projetasse esse vencimento futuro.
create or replace function _next_cycle_due_date(p_closing_day int, p_due_day int)
returns date
language plpgsql
stable
as $$
declare
  v_open_start      date := _cycle_start(p_closing_day);
  v_next_month_base date := (date_trunc('month', v_open_start) + interval '1 month')::date;
  v_next_max_day    int  := extract(day from (v_next_month_base + interval '1 month - 1 day'))::int;
  v_closing_date    date := v_next_month_base + (least(p_closing_day, v_next_max_day) - 1);
  v_ref_month       date;
  v_max_day         int;
begin
  if p_due_day >= p_closing_day then
    v_ref_month := date_trunc('month', v_closing_date)::date;
  else
    v_ref_month := (date_trunc('month', v_closing_date) + interval '1 month')::date;
  end if;
  v_max_day := extract(day from (v_ref_month + interval '1 month - 1 day'))::int;
  return make_date(extract(year from v_ref_month)::int, extract(month from v_ref_month)::int,
                    least(p_due_day, v_max_day));
end;
$$;

create or replace function get_calendar_events(p_start date, p_end date)
returns table (
  event_date date,
  source     text,    -- 'fixed_bill'|'debt'|'goal'|'card_invoice'|'card_invoice_open'|'card_installment'|'expectation'|'income'
  ref_table  text,    -- tabela a usar pra "marcar como feito" (ver database.py:mark_calendar_event_done)
  ref_id     bigint,
  label      text,
  amount     numeric, -- sempre positivo
  is_income  boolean,
  status     text      -- 'pending'|'overdue' (nunca retorna item já pago/confirmado/aportado)
)
language sql
stable
as $$
  with fixed_bills_raw as (
    select
      make_date(fbi.due_year, fbi.due_month, least(fb.due_day,
        extract(day from (make_date(fbi.due_year, fbi.due_month, 1) + interval '1 month - 1 day'))::int)) as raw_date,
      fbi.id as id, fb.name as name, fbi.amount as amount
    from fixed_bill_instances fbi
    join fixed_bills fb on fb.id = fbi.bill_id
    where fbi.user_id = auth.uid() and fbi.paid_at is null
  ),
  debts_raw as (
    select
      -- debt_installments não tem coluna de dia (só due_year/due_month)
      make_date(di.due_year, di.due_month, 1) as raw_date,
      di.id as id, d.description as name, di.amount as amount
    from debt_installments di
    join debts d on d.id = di.debt_id
    where di.user_id = auth.uid() and di.paid_at is null
  ),
  goals_raw as (
    select
      make_date(gi.due_year, gi.due_month, least(coalesce(gi.due_day, 1),
        extract(day from (make_date(gi.due_year, gi.due_month, 1) + interval '1 month - 1 day'))::int)) as raw_date,
      gi.id as id, g.name as name, gi.amount as amount
    from goal_installments gi
    join goals g on g.id = gi.goal_id
    where gi.user_id = auth.uid() and gi.contributed_at is null
  ),
  card_closed_raw as (
    select c.id as id, c.name as name, x.total as total, x.due_date as raw_date
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
  ),
  card_open_raw as (
    select c.id as id, c.name as name, x.total as total, x.due_date as raw_date
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
  ),
  income_raw as (
    select
      make_date(m.year, m.month, least(pii.expected_day,
        extract(day from (make_date(m.year, m.month, 1) + interval '1 month - 1 day'))::int)) as raw_date,
      pii.id as id, pii.amount as amount
    from plan_income_items pii
    join monthly_plans mp on mp.id = pii.plan_id
    join months m on m.id = mp.month_id
    where pii.user_id = auth.uid()
  )
  select greatest(raw_date, p_start), 'fixed_bill', 'fixed_bill_instances', id, name, amount, false,
         case when raw_date < current_date then 'overdue' else 'pending' end
  from fixed_bills_raw where greatest(raw_date, p_start) between p_start and p_end

  union all
  select greatest(raw_date, p_start), 'debt', 'debt_installments', id, name, amount, false,
         case when raw_date < current_date then 'overdue' else 'pending' end
  from debts_raw where greatest(raw_date, p_start) between p_start and p_end

  union all
  select greatest(raw_date, p_start), 'goal', 'goal_installments', id, name, amount, false,
         case when raw_date < current_date then 'overdue' else 'pending' end
  from goals_raw where greatest(raw_date, p_start) between p_start and p_end

  union all
  select raw_date, 'card_invoice', 'credit_cards', id, name || ' (fatura)', total, false,
         case when raw_date < current_date then 'overdue' else 'pending' end
  from card_closed_raw where raw_date between p_start and p_end

  union all
  select raw_date, 'card_invoice_open', 'credit_cards', id, name || ' (fatura em aberto)', total, false, 'pending'
  from card_open_raw where raw_date between p_start and p_end

  union all
  select t.payment_date,
         case when t.card_purchase_id is not null then 'card_installment' else 'expectation' end,
         'transactions', t.id, t.description, t.amount,
         t.type in ('entrada_fixa', 'entrada_variavel'),
         case when t.payment_date < current_date then 'overdue' else 'pending' end
  from transactions t
  where t.user_id = auth.uid() and t.is_expectation = true and t.payment_date is not null
    and t.payment_date between p_start and p_end

  union all
  select raw_date, 'income', 'plan_income_items', id, 'Entrada prevista', amount, true, 'pending'
  from income_raw where raw_date between p_start and p_end
$$;

grant execute on function _next_cycle_due_date(int, int)  to authenticated;
grant execute on function get_calendar_events(date, date) to authenticated;
