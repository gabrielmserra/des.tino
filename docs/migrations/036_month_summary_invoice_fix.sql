-- =====================================================================
-- Corrige get_month_summary/get_month_real_flow: o saldo do mês excluía
-- compras no cartão até serem pagas, e "pago" era detectado pela soma de
-- credit_card_payments -- tabela que, desde a migration 035, não é mais
-- escrita por nenhum fluxo real de pagamento (pagar fatura agora marca
-- invoice_id nas transações, em vez de inserir ali). Sem este ajuste,
-- pagar uma fatura pararia de refletir no saldo do mês.
--
-- Troca a exclusão "card_id is not null" por "card_id is not null and
-- invoice_id is null" -- uma vez faturada/paga, a compra passa a contar
-- como saída real, igual antes (quando o pagamento virava um lançamento
-- consolidado avulso).
--
-- Rodar no SQL Editor do Supabase (após 001-035).
-- =====================================================================

create or replace function get_month_real_flow(p_month_id bigint)
returns table(entradas numeric, saidas numeric)
language plpgsql
stable
as $$
declare
  real_ef numeric := 0; real_ev numeric := 0; real_sf numeric := 0; real_sv numeric := 0;
  r record;
begin
  for r in
    select type,
           coalesce(amount, 0) as amount,
           card_id, benefit_id, invoice_id,
           coalesce(is_expectation, false) as is_exp
    from transactions
    where month_id = p_month_id
  loop
    if r.type not in ('entrada_fixa', 'entrada_variavel', 'saida_fixa', 'saida_variavel') then
      continue;
    end if;
    if r.card_id is not null and r.type = 'saida_variavel' and r.invoice_id is null then
      continue;
    end if;
    if r.benefit_id is not null and r.type in ('saida_fixa', 'saida_variavel') then
      continue;
    end if;
    if r.is_exp then
      continue;
    end if;

    if    r.type = 'entrada_fixa'     then real_ef := real_ef + r.amount;
    elsif r.type = 'entrada_variavel' then real_ev := real_ev + r.amount;
    elsif r.type = 'saida_fixa'       then real_sf := real_sf + r.amount;
    elsif r.type = 'saida_variavel'   then real_sv := real_sv + r.amount;
    end if;
  end loop;

  entradas := real_ef + real_ev;
  saidas   := real_sf + real_sv;
  return next;
end;
$$;

create or replace function get_month_summary(p_month_id bigint)
returns json
language plpgsql
stable
as $$
declare
  real_ef numeric := 0; real_ev numeric := 0; real_sf numeric := 0; real_sv numeric := 0;
  proj_ef numeric := 0; proj_ev numeric := 0; proj_sf numeric := 0; proj_sv numeric := 0;
  n_exp int := 0;
  inv_net numeric := 0;
  total_entradas numeric; total_saidas numeric; saldo numeric;
  proj_entradas numeric; proj_saidas numeric; saldo_projetado numeric;
  saldo_acumulado numeric;
  r record;
begin
  for r in
    select type,
           coalesce(amount, 0) as amount,
           card_id, benefit_id, invoice_id,
           coalesce(is_expectation, false) as is_exp
    from transactions
    where month_id = p_month_id
  loop
    if r.type not in ('entrada_fixa', 'entrada_variavel', 'saida_fixa', 'saida_variavel') then
      continue;
    end if;
    if r.card_id is not null and r.type = 'saida_variavel' and r.invoice_id is null then
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

  inv_net := get_month_investment_net(p_month_id);

  total_entradas  := real_ef + real_ev;
  total_saidas    := real_sf + real_sv;
  saldo           := total_entradas - total_saidas;
  proj_entradas   := total_entradas + proj_ef + proj_ev;
  proj_saidas     := total_saidas   + proj_sf + proj_sv;
  saldo_projetado := proj_entradas - proj_saidas;
  saldo_acumulado := get_saldo_acumulado(p_month_id);

  return json_build_object(
    'entrada_fixa', real_ef, 'entrada_variavel', real_ev,
    'saida_fixa', real_sf, 'saida_variavel', real_sv,
    'total_entradas', total_entradas,
    'total_saidas', total_saidas,
    'total_investimentos', inv_net,
    'saldo', saldo,
    'saldo_projetado', saldo_projetado,
    'saldo_acumulado', saldo_acumulado,
    'n_expectations', n_exp,
    'has_expectations', n_exp > 0
  );
end;
$$;

grant execute on function get_month_real_flow(bigint) to authenticated;
grant execute on function get_month_summary(bigint)   to authenticated;
