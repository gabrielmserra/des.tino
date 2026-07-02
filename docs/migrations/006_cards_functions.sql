-- =====================================================================
-- Feature 5 (web) — Fase 3a: Cartões de crédito
-- Funções de leitura (overview com gasto/disponível/dias) e de escrita
-- (pagar fatura), replicando exatamente ui/credit_cards.py + database.py.
-- CRUD simples (criar/editar/excluir cartão) é feito direto pela tabela
-- no site, sem RPC — sem regra de negócio envolvida.
-- Rodar no SQL Editor do Supabase (após 001-005).
-- =====================================================================

-- Dias até o próximo dia-alvo (fechamento/vencimento), com clamp para
-- meses curtos — réplica de ui/credit_cards.py:_days_until
create or replace function _days_until(p_target_day int)
returns int
language plpgsql
stable
as $$
declare
  v_today date := current_date;
  v_next_month_start date;
  v_max_day int;
  v_next date;
begin
  if extract(day from v_today)::int <= p_target_day then
    return p_target_day - extract(day from v_today)::int;
  end if;

  v_next_month_start := (date_trunc('month', v_today) + interval '1 month')::date;
  v_max_day := extract(day from (v_next_month_start + interval '1 month - 1 day'))::int;
  v_next := v_next_month_start + (least(p_target_day, v_max_day) - 1);
  return (v_next - v_today);
end;
$$;

-- Início do ciclo de faturamento atual — réplica de _cycle_start
create or replace function _cycle_start(p_closing_day int)
returns date
language plpgsql
stable
as $$
declare
  v_today date := current_date;
  v_month_start date := date_trunc('month', v_today)::date;
  v_max_day int := extract(day from (v_month_start + interval '1 month - 1 day'))::int;
  v_prev_month_start date;
  v_prev_max_day int;
begin
  if extract(day from v_today)::int >= p_closing_day then
    if p_closing_day <= v_max_day then
      return make_date(extract(year from v_today)::int, extract(month from v_today)::int, p_closing_day);
    else
      return make_date(extract(year from v_today)::int, extract(month from v_today)::int, 1);
    end if;
  end if;

  v_prev_month_start := (v_month_start - interval '1 month')::date;
  v_prev_max_day := extract(day from (v_month_start - interval '1 day'))::int;
  return v_prev_month_start + (least(p_closing_day, v_prev_max_day) - 1);
end;
$$;

-- Visão geral dos cartões para o mês selecionado: gasto do ciclo, pago,
-- em aberto, disponível e dias até fechar/vencer.
create or replace function get_cards_overview(p_month_id bigint)
returns table (
  id bigint,
  name text,
  card_limit numeric,
  due_day int,
  closing_day int,
  color text,
  spent numeric,
  paid numeric,
  unpaid numeric,
  available numeric,
  days_until_closing int,
  days_until_due int,
  cycle_open boolean
)
language plpgsql
stable
as $$
begin
  return query
  select
    c.id,
    c.name,
    c."limit" as card_limit,
    c.due_day,
    c.closing_day,
    c.color,
    coalesce(spend.total, 0) as spent,
    coalesce(pay.total, 0) as paid,
    greatest(0, coalesce(spend.total, 0) - coalesce(pay.total, 0)) as unpaid,
    case when c."limit" > 0
         then greatest(0, c."limit" - coalesce(spend.total, 0))
         else null end as available,
    _days_until(c.closing_day) as days_until_closing,
    _days_until(c.due_day) as days_until_due,
    (extract(day from current_date)::int < c.closing_day) as cycle_open
  from credit_cards c
  left join lateral (
    select sum(t.amount) as total
    from transactions t
    where t.card_id = c.id
      and t.month_id = p_month_id
      and t.type = 'saida_variavel'
      and t.created_at::date >= _cycle_start(c.closing_day)
  ) spend on true
  left join lateral (
    select sum(p.amount) as total
    from credit_card_payments p
    where p.card_id = c.id and p.month_id = p_month_id
  ) pay on true
  order by c.created_at;
end;
$$;

-- Paga a fatura: soma as compras reais do ciclo (exclui previstos),
-- exclui esses lançamentos e cria uma saída única consolidada — réplica
-- de database.py:settle_card_bill. Retorna o valor pago (0 se nada a pagar).
create or replace function pay_card_bill(p_card_id bigint, p_month_id bigint)
returns numeric
language plpgsql
as $$
declare
  v_card credit_cards;
  v_start date;
  v_total numeric := 0;
begin
  select * into v_card from credit_cards where id = p_card_id;
  if not found then return 0; end if;

  v_start := _cycle_start(v_card.closing_day);

  select coalesce(sum(amount), 0) into v_total
  from transactions
  where card_id = p_card_id
    and month_id = p_month_id
    and type = 'saida_variavel'
    and coalesce(is_expectation, false) = false
    and created_at::date >= v_start;

  if v_total <= 0 then
    return 0;
  end if;

  delete from transactions
  where card_id = p_card_id
    and month_id = p_month_id
    and type = 'saida_variavel'
    and coalesce(is_expectation, false) = false
    and created_at::date >= v_start;

  insert into transactions (month_id, user_id, type, description, amount, category)
  values (
    p_month_id, auth.uid(), 'saida_variavel',
    'Pagamento fatura cartão de crédito — ' || v_card.name,
    v_total, 'Outros'
  );

  return v_total;
end;
$$;

grant execute on function _days_until(int)                to authenticated;
grant execute on function _cycle_start(int)                to authenticated;
grant execute on function get_cards_overview(bigint)       to authenticated;
grant execute on function pay_card_bill(bigint, bigint)    to authenticated;
