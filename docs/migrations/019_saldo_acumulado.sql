-- =====================================================================
-- Saldo acumulado: o Dashboard passa a mostrar o saldo real (somando a
-- sobra dos meses anteriores), não só o fluxo do mês isolado.
--
-- Novo campo opcional months.opening_balance: quando definido num mês,
-- vira a "âncora" — o saldo acumulado desse mês em diante parte desse
-- valor (ex: quanto você tinha na conta no seu primeiro mês registrado).
-- Meses sem opening_balance herdam o saldo final do mês cronologicamente
-- anterior. Sem nenhuma âncora definida, o cálculo assume que o mês mais
-- antigo começou com R$0.
--
-- Rodar no SQL Editor do Supabase (após 001-018).
-- =====================================================================

alter table months add column if not exists opening_balance numeric;

-- Fluxo real (entradas/saídas) de um mês — mesma regra de get_month_summary
-- (ignora projeções, compras no cartão ainda não pagas, gastos em VR/VA),
-- fatorado num helper pra ser reaproveitado pelo cálculo acumulado.
create or replace function get_month_real_flow(p_month_id bigint)
returns table(entradas numeric, saidas numeric)
language plpgsql
stable
as $$
declare
  real_ef numeric := 0; real_ev numeric := 0; real_sf numeric := 0; real_sv numeric := 0;
  bill_total numeric := 0;
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

  select coalesce(sum(amount), 0) into bill_total
  from credit_card_payments where month_id = p_month_id;

  entradas := real_ef + real_ev;
  saidas   := real_sf + real_sv + bill_total;
  return next;
end;
$$;

-- Saldo acumulado até (e incluindo) o mês informado: acha a âncora mais
-- recente com opening_balance definido em ou antes desse mês (ou o mês
-- mais antigo do usuário, partindo de R$0, se nenhuma âncora existir) e
-- soma o fluxo real de cada mês em ordem cronológica até o mês alvo.
create or replace function get_saldo_acumulado(p_month_id bigint)
returns numeric
language plpgsql
stable
as $$
declare
  v_user_id uuid; v_year int; v_month int;
  v_anchor_id bigint; v_anchor_year int; v_anchor_month int; v_anchor_balance numeric;
  v_total numeric := 0;
  m record; f record;
begin
  select user_id, year, month into v_user_id, v_year, v_month from months where id = p_month_id;
  if v_user_id is null then
    return 0;
  end if;

  select id, year, month, opening_balance
    into v_anchor_id, v_anchor_year, v_anchor_month, v_anchor_balance
  from months
  where user_id = v_user_id
    and opening_balance is not null
    and (year, month) <= (v_year, v_month)
  order by year desc, month desc
  limit 1;

  if v_anchor_id is null then
    select id, year, month into v_anchor_id, v_anchor_year, v_anchor_month
    from months
    where user_id = v_user_id
    order by year asc, month asc
    limit 1;
    v_anchor_balance := 0;
  end if;

  if v_anchor_id is null then
    return 0;
  end if;

  v_total := v_anchor_balance;
  for m in
    select id from months
    where user_id = v_user_id
      and (year, month) >= (v_anchor_year, v_anchor_month)
      and (year, month) <= (v_year, v_month)
    order by year asc, month asc
  loop
    select entradas, saidas into f from get_month_real_flow(m.id);
    v_total := v_total + f.entradas - f.saidas;
  end loop;

  return v_total;
end;
$$;

-- get_month_summary passa a incluir 'saldo_acumulado' no JSON de retorno.
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

  select coalesce(sum(amount), 0) into bill_total
  from credit_card_payments where month_id = p_month_id;

  inv_net := get_month_investment_net(p_month_id);

  total_entradas  := real_ef + real_ev;
  total_saidas    := real_sf + real_sv + bill_total;
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
