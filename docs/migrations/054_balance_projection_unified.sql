-- =====================================================================
-- Alerta de saldo projetado negativo (043) passa a usar o MESMO cálculo
-- do card "Livre para gastar" (051): mesmo saldo de partida
-- (get_saldo_acumulado) e os mesmos eventos (get_calendar_events), com
-- todas as regras novas — último dia útil, entrada já recebida que some,
-- entrada atrasada que vai pra hoje, contas fixas projetadas, parcelas de
-- meta, fatura do ciclo aberto, dia de vencimento de dívida/meta.
--
-- Antes, a 043 tinha a própria lista de fontes e regras, e os dois
-- avisos do Dashboard podiam se contradizer (ex.: a 043 somava de novo
-- uma entrada já recebida antes do dia, e ignorava entrada no dia 31 em
-- mês de 30 dias).
--
-- Contrato de retorno igual ao da 043 — {day, balance, next_income_day}
-- ou null —, então desktop e site não mudam. O alcance continua sendo
-- hoje → fim do mês corrente; o card olha 45 dias, então o alerta é um
-- pedaço do card: se o alerta acusa um dia negativo, o card também.
--
-- Rodar no SQL Editor do Supabase (após 001-053).
-- =====================================================================

create or replace function get_balance_projection(p_month_id bigint)
returns json
language plpgsql
stable
as $$
declare
  v_year            int;
  v_month           int;
  v_today           date := current_date;
  v_end             date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_balance         numeric;
  v_first_date      date;
  v_first_balance   numeric;
  v_next_income_day int;
  r                 record;
begin
  select year, month into v_year, v_month
  from months
  where id = p_month_id and user_id = auth.uid();

  if v_year is null
     or v_year  <> extract(year from v_today)::int
     or v_month <> extract(month from v_today)::int then
    return null;
  end if;

  v_balance := get_saldo_acumulado(p_month_id);

  for r in
    select d::date as day,
           coalesce(sum(case when e.is_income then e.amount else 0 end), 0) as inc,
           coalesce(sum(case when e.is_income then 0 else e.amount end), 0) as outg
    from generate_series(v_today, v_end, interval '1 day') d
    left join get_calendar_events(v_today, v_end) e on e.event_date = d::date
    group by d
    order by d
  loop
    v_balance := v_balance + r.inc - r.outg;
    if v_balance < 0 and v_first_date is null then
      v_first_date    := r.day;
      v_first_balance := v_balance;
    end if;
  end loop;

  if v_first_date is null then
    return null;
  end if;

  select extract(day from min(e.event_date))::int into v_next_income_day
  from get_calendar_events(v_today, v_end) e
  where e.is_income and e.event_date > v_first_date;

  return json_build_object(
    'day', extract(day from v_first_date)::int,
    'balance', v_first_balance,
    'next_income_day', v_next_income_day
  );
end;
$$;

grant execute on function get_balance_projection(bigint) to authenticated;
