-- =====================================================================
-- Feature 5 (web) — Fase 3b: Benefícios VR/VA
-- Funções de data/renovação e leitura com cálculo (RPC); CRUD simples
-- (editar/ajustar saldo/arquivar) é feito direto pela tabela no site.
-- Réplica exata de database.py (create_benefit, get_benefits, days_until_renewal,
-- apply_all_due_renewals). Rodar no SQL Editor do Supabase (após 001-006).
-- =====================================================================

-- Data de renovação num (ano, mês) dado, com clamp para meses curtos —
-- réplica de _clamp_day + _renewal_date
create or replace function _renewal_date(p_year int, p_month int, p_renewal_day int)
returns date
language sql
stable
as $$
  select make_date(
    p_year, p_month,
    least(p_renewal_day,
          extract(day from (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int)
  );
$$;

-- Última renovação <= referência — réplica de _last_occurrence
create or replace function _last_occurrence(p_renewal_day int, p_ref date)
returns date
language plpgsql
stable
as $$
declare
  v_d date := _renewal_date(extract(year from p_ref)::int, extract(month from p_ref)::int, p_renewal_day);
  v_y int; v_m int;
begin
  if v_d <= p_ref then
    return v_d;
  end if;
  if extract(month from p_ref)::int = 1 then
    v_y := extract(year from p_ref)::int - 1; v_m := 12;
  else
    v_y := extract(year from p_ref)::int; v_m := extract(month from p_ref)::int - 1;
  end if;
  return _renewal_date(v_y, v_m, p_renewal_day);
end;
$$;

-- Dias até a próxima renovação — réplica de days_until_renewal
create or replace function _days_until_renewal(p_renewal_day int)
returns int
language plpgsql
stable
as $$
declare
  v_today date := current_date;
  v_d date := _renewal_date(extract(year from v_today)::int, extract(month from v_today)::int, p_renewal_day);
  v_y int; v_m int;
begin
  if v_d <= v_today then
    if extract(month from v_today)::int = 12 then
      v_y := extract(year from v_today)::int + 1; v_m := 1;
    else
      v_y := extract(year from v_today)::int; v_m := extract(month from v_today)::int + 1;
    end if;
    v_d := _renewal_date(v_y, v_m, p_renewal_day);
  end if;
  return (v_d - v_today);
end;
$$;

-- Lista de benefícios ativos com dias até renovar (para a tela de Benefícios)
create or replace function get_benefits_overview()
returns table (
  id bigint,
  name text,
  benefit_type text,
  balance numeric,
  renewal_day int,
  recharge_amount numeric,
  recharge_mode text,
  color text,
  days_until_renewal int
)
language sql
stable
as $$
  select b.id, b.name, b.benefit_type, b.balance, b.renewal_day,
         b.recharge_amount, b.recharge_mode, b.color,
         _days_until_renewal(b.renewal_day)
  from benefit_cards b
  where b.archived_at is null
  order by b.created_at;
$$;

-- Cria o benefício. last_renewal é fixado na última renovação já ocorrida
-- (o saldo inicial não gera registro de renovação) — réplica de create_benefit
create or replace function create_benefit(
  p_name            text,
  p_benefit_type    text,
  p_balance         numeric,
  p_renewal_day     int,
  p_recharge_amount numeric,
  p_recharge_mode   text,
  p_color           text
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into benefit_cards (
    user_id, name, benefit_type, balance, renewal_day,
    recharge_amount, recharge_mode, color, last_renewal
  ) values (
    auth.uid(), p_name, p_benefit_type, p_balance, p_renewal_day,
    p_recharge_amount, p_recharge_mode, p_color,
    _last_occurrence(p_renewal_day, current_date)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Aplica todas as renovações pendentes de todos os benefícios do usuário
-- (roda na abertura do app/site) — réplica de apply_all_due_renewals.
-- Retorna um resumo por benefício renovado, para feedback na tela.
create or replace function apply_all_due_renewals()
returns json
language plpgsql
as $$
declare
  v_benefit record;
  v_today date := current_date;
  v_last date;
  v_balance numeric;
  v_recharge numeric;
  v_mode text;
  v_y int; v_m int;
  v_nxt date;
  v_before numeric;
  v_count int;
  v_total numeric;
  v_balance_after numeric;
  v_summary json[] := array[]::json[];
begin
  for v_benefit in
    select * from benefit_cards where archived_at is null
  loop
    if v_benefit.last_renewal is null then
      continue;
    end if;

    v_last     := v_benefit.last_renewal;
    v_balance  := v_benefit.balance;
    v_recharge := coalesce(v_benefit.recharge_amount, 0);
    v_mode     := coalesce(v_benefit.recharge_mode, 'acumula');
    v_count    := 0;
    v_total    := 0;
    v_y        := extract(year from v_last)::int;
    v_m        := extract(month from v_last)::int;

    loop
      if v_m = 12 then v_y := v_y + 1; v_m := 1; else v_m := v_m + 1; end if;
      v_nxt := _renewal_date(v_y, v_m, v_benefit.renewal_day);
      exit when v_nxt > v_today;

      v_before := v_balance;
      v_balance := case when v_mode = 'zera' then v_recharge else v_balance + v_recharge end;

      insert into benefit_renewals (benefit_id, user_id, renewed_at, amount, balance_before, balance_after)
      values (v_benefit.id, v_benefit.user_id, v_nxt, v_recharge, v_before, v_balance);

      v_count := v_count + 1;
      v_total := v_total + v_recharge;
      v_balance_after := v_balance;
      v_last := v_nxt;
    end loop;

    if v_count > 0 then
      update benefit_cards set balance = v_balance, last_renewal = v_last where id = v_benefit.id;
      v_summary := v_summary || json_build_object(
        'name', v_benefit.name,
        'benefit_type', v_benefit.benefit_type,
        'total', v_total,
        'count', v_count,
        'balance_after', v_balance_after
      );
    end if;
  end loop;

  return coalesce(array_to_json(v_summary), '[]'::json);
end;
$$;

grant execute on function _renewal_date(int, int, int)                                          to authenticated;
grant execute on function _last_occurrence(int, date)                                            to authenticated;
grant execute on function _days_until_renewal(int)                                               to authenticated;
grant execute on function get_benefits_overview()                                                to authenticated;
grant execute on function create_benefit(text, text, numeric, int, numeric, text, text)           to authenticated;
grant execute on function apply_all_due_renewals()                                                to authenticated;
