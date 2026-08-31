-- =====================================================================
-- Unifica o "gasto no ciclo" do cartão pela regra de fechamento do
-- cartão (mesma usada em get_future_commitments), não mais pelo
-- month_id do mês do app — hoje as duas condições eram exigidas juntas
-- (card_id + month_id + ciclo aberto), o que faz o gasto sumir de uma
-- página de mês sempre que o dia de corte muda e as transações se
-- reorganizam entre meses (o mês do app e o ciclo de fatura do cartão
-- são conceitos independentes). Assinaturas inalteradas — create or
-- replace, sem DROP.
-- Rodar no SQL Editor do Supabase (após 001-033).
-- =====================================================================

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
      and t.type = 'saida_variavel'
      and t.created_at::date >= _cycle_start(c.closing_day)
  ) spend on true
  left join lateral (
    select sum(p.amount) as total
    from credit_card_payments p
    where p.card_id = c.id
      and p.created_at::date >= _cycle_start(c.closing_day)
  ) pay on true
  order by c.created_at;
end;
$$;

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
    and type = 'saida_variavel'
    and coalesce(is_expectation, false) = false
    and created_at::date >= v_start;

  if v_total <= 0 then
    return 0;
  end if;

  delete from transactions
  where card_id = p_card_id
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

grant execute on function get_cards_overview(bigint)       to authenticated;
grant execute on function pay_card_bill(bigint, bigint)    to authenticated;
