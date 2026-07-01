-- =====================================================================
-- Feature 5 (web) — Funções de leitura centralizadas no Postgres
-- Fonte única de verdade: replicam EXATAMENTE a lógica do database.py,
-- para que site e desktop mostrem números idênticos.
-- SECURITY INVOKER (padrão) → o RLS continua valendo (cada um vê só o seu).
-- Rodar no SQL Editor do Supabase (após as migrações 001-003).
-- =====================================================================

-- Líquido de investimentos do mês (aportes − saques)
create or replace function get_month_investment_net(p_month_id bigint)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case when movement_type = 'saque' then -amount else amount end
  ), 0)
  from investment_movements
  where month_id = p_month_id;
$$;

-- Gastos por categoria (exclui previstos e gastos carimbados de VR/VA;
-- inclui compras no cartão, igual ao desktop)
create or replace function get_expenses_by_category(p_month_id bigint)
returns table (category text, total numeric)
language sql
stable
as $$
  select coalesce(t.category, 'Outros') as category, sum(t.amount) as total
  from transactions t
  where t.month_id = p_month_id
    and t.type in ('saida_fixa', 'saida_variavel')
    and coalesce(t.is_expectation, false) = false
    and t.benefit_id is null
  group by coalesce(t.category, 'Outros')
  order by sum(t.amount) desc;
$$;

-- Resumo do mês (saldo, projeção, totais) — mesmas regras do get_month_summary do app:
--  • compras no cartão (card_id, saida_variavel) não entram no saldo (debitam na fatura)
--  • gastos com VR/VA (benefit_id) não entram no saldo (dinheiro carimbado)
--  • pagamentos de fatura (credit_card_payments) entram como saída
create or replace function get_month_summary(p_month_id bigint)
returns json
language plpgsql
stable
as $$
declare
  real_ef numeric := 0; real_ev numeric := 0; real_sf numeric := 0; real_sv numeric := 0;
  proj_ef numeric := 0; proj_ev numeric := 0; proj_sf numeric := 0; proj_sv numeric := 0;
  n_exp int := 0;
  bill_total numeric := 0;
  inv_net numeric := 0;
  total_entradas numeric; total_saidas numeric; saldo numeric;
  proj_entradas numeric; proj_saidas numeric; saldo_projetado numeric;
  r record;
begin
  for r in
    select type,
           coalesce(amount, 0) as amount,
           card_id, benefit_id,
           coalesce(is_expectation, false) as is_exp
    from transactions
    where month_id = p_month_id
  loop
    if r.type not in ('entrada_fixa', 'entrada_variavel', 'saida_fixa', 'saida_variavel') then
      continue;
    end if;
    if r.card_id is not null and r.type = 'saida_variavel' then
      continue;
    end if;
    if r.benefit_id is not null and r.type in ('saida_fixa', 'saida_variavel') then
      continue;
    end if;

    if r.is_exp then
      n_exp := n_exp + 1;
      if    r.type = 'entrada_fixa'     then proj_ef := proj_ef + r.amount;
      elsif r.type = 'entrada_variavel' then proj_ev := proj_ev + r.amount;
      elsif r.type = 'saida_fixa'       then proj_sf := proj_sf + r.amount;
      elsif r.type = 'saida_variavel'   then proj_sv := proj_sv + r.amount;
      end if;
    else
      if    r.type = 'entrada_fixa'     then real_ef := real_ef + r.amount;
      elsif r.type = 'entrada_variavel' then real_ev := real_ev + r.amount;
      elsif r.type = 'saida_fixa'       then real_sf := real_sf + r.amount;
      elsif r.type = 'saida_variavel'   then real_sv := real_sv + r.amount;
      end if;
    end if;
  end loop;

  select coalesce(sum(amount), 0) into bill_total
  from credit_card_payments where month_id = p_month_id;

  inv_net := get_month_investment_net(p_month_id);

  total_entradas  := real_ef + real_ev;
  total_saidas    := real_sf + real_sv + bill_total;
  saldo           := total_entradas - total_saidas - inv_net;
  proj_entradas   := total_entradas + proj_ef + proj_ev;
  proj_saidas     := total_saidas   + proj_sf + proj_sv;
  saldo_projetado := proj_entradas - proj_saidas - inv_net;

  return json_build_object(
    'entrada_fixa', real_ef, 'entrada_variavel', real_ev,
    'saida_fixa', real_sf, 'saida_variavel', real_sv,
    'total_entradas', total_entradas,
    'total_saidas', total_saidas,
    'total_investimentos', inv_net,
    'saldo', saldo,
    'saldo_projetado', saldo_projetado,
    'n_expectations', n_exp,
    'has_expectations', n_exp > 0
  );
end;
$$;

-- Saldo total dos benefícios VR/VA ativos (card do dashboard)
create or replace function get_benefit_balance_total()
returns numeric
language sql
stable
as $$
  select coalesce(sum(balance), 0)
  from benefit_cards
  where archived_at is null;
$$;

-- Patrimônio total de investimentos (aportes − saques, todos os meses)
create or replace function get_total_investments()
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case when movement_type = 'saque' then -amount else amount end
  ), 0)
  from investment_movements;
$$;

grant execute on function get_month_investment_net(bigint)  to authenticated;
grant execute on function get_expenses_by_category(bigint)  to authenticated;
grant execute on function get_month_summary(bigint)         to authenticated;
grant execute on function get_benefit_balance_total()       to authenticated;
grant execute on function get_total_investments()           to authenticated;
