-- =====================================================================
-- Saldo do mês deixa de descontar investimentos (aportes/resgates).
-- Antes: saldo = entradas - saídas - investido no mês.
-- Agora: saldo = entradas - saídas (investido continua informativo,
-- devolvido em total_investimentos, só não afeta mais o saldo).
-- Mesma mudança feita em database.py (desktop) — rodar no SQL Editor
-- do Supabase.
-- =====================================================================

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
  -- Investimentos não descontam mais o saldo (só ficam informativos em
  -- total_investimentos) — aportar pela aba Investimentos não é a mesma
  -- coisa que gastar.
  saldo           := total_entradas - total_saidas;
  proj_entradas   := total_entradas + proj_ef + proj_ev;
  proj_saidas     := total_saidas   + proj_sf + proj_sv;
  saldo_projetado := proj_entradas - proj_saidas;

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
