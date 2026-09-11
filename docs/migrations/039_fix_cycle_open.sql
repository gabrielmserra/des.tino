-- =====================================================================
-- Corrige get_cards_overview: "Gasto no ciclo" ficava 0 mesmo com
-- lancamentos novos no ciclo aberto, sempre que o dia de fechamento do
-- cartao nao e 1.
--
-- Causa raiz: cycle_open (aqui chamado "is_open") usava a heuristica
-- antiga extract(day from current_date) < closing_day -- herdada sem
-- mudanca desde a migration 006, e nunca corrigida quando a 035
-- reescreveu o resto da funcao com invoice_id/payment_date. Pra um
-- cartao que fecha dia 4, essa formula so da "aberto" nos dias 1-3 do
-- mes e "fechado" do dia 4 ao fim do mes -- exatamente invertido do
-- que a UI espera (a fatura fica "fechada" so entre o fechamento e o
-- pagamento/vencimento; no resto do tempo, incluindo a maior parte do
-- mes, o ciclo esta aberto e acumulando).
--
-- Corrige trocando o criterio: cycle_open = nao existe fatura fechada
-- pendente (closed_spend <= 0) -- mesmo criterio que credit_cards.py /
-- Cards.tsx / dashboard.py / dashboardWidgets.tsx ja usam (via
-- `unpaid`) pra decidir o texto "Fatura aberta"/"Fatura fechada" desde
-- a v4.4.0. "spent" passa a seguir o mesmo criterio: mostra o gasto
-- fechado pendente quando existir, senao o gasto do ciclo aberto.
--
-- Rodar no SQL Editor do Supabase (apos 001-038).
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
    case when coalesce(closed_spend.total, 0) > 0 then closed_spend.total
         else coalesce(open_spend.total, 0) end as spent,
    coalesce(pay.total, 0) as paid,
    coalesce(closed_spend.total, 0) as unpaid,
    case when c."limit" > 0
         then greatest(0, c."limit" - (coalesce(open_spend.total, 0) + coalesce(closed_spend.total, 0)))
         else null end as available,
    _days_until(c.closing_day) as days_until_closing,
    _days_until(c.due_day) as days_until_due,
    (coalesce(closed_spend.total, 0) <= 0) as cycle_open
  from credit_cards c
  cross join lateral (
    select _cycle_start(c.closing_day) as cycle_start
  ) win
  left join lateral (
    -- ciclo aberto, ainda acumulando (compras reais desde o último fechamento)
    select sum(t.amount) as total
    from transactions t
    where t.card_id = c.id
      and t.type = 'saida_variavel'
      and coalesce(t.is_expectation, false) = false
      and t.invoice_id is null
      and t.payment_date >= win.cycle_start
  ) open_spend on true
  left join lateral (
    -- fatura fechada, ainda não paga nem vencida
    select sum(t.amount) as total
    from transactions t
    where t.card_id = c.id
      and t.type = 'saida_variavel'
      and coalesce(t.is_expectation, false) = false
      and t.invoice_id is null
      and t.payment_date < win.cycle_start
  ) closed_spend on true
  left join lateral (
    -- credit_card_payments não é mais escrita por nenhum fluxo real de
    -- pagamento (pagamento agora é via invoice_id) -- mantido só por
    -- compatibilidade de schema, deve ficar sempre 0.
    select sum(p.amount) as total
    from credit_card_payments p
    where p.card_id = c.id
  ) pay on true
  order by c.created_at;
end;
$$;

grant execute on function get_cards_overview(bigint) to authenticated;
