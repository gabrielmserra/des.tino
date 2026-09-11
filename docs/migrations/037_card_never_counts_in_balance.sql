-- =====================================================================
-- Reverte parte da migration 036: compras no cartao NUNCA devem contar
-- no saldo/saidas/entradas (saldo atual, saldo acumulado, saldo apos
-- contas em aberto), nem em aberto nem depois de pagas. A 036 fazia a
-- compra contar como saida real assim que invoice_id era setado (pago),
-- pra imitar o comportamento antigo (que criava um lancamento
-- consolidado ao pagar). Decisao do usuario: não quer isso -- o
-- dinheiro saindo de verdade so deve ser contado quando o extrato da
-- CONTA CORRENTE (nao a fatura do cartao) for importado com a
-- transacao real do pagamento. A fatura do cartao vira so controle/
-- acompanhamento (aba Cartoes + historico de faturas), nunca mexe no
-- saldo -- volta a excluir card_id incondicionalmente, igual antes da
-- 019/036.
--
-- Rodar no SQL Editor do Supabase (apos 001-036).
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
