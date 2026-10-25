-- =====================================================================
-- Fase 5 do calendário.
--
-- 1) Simulação "e se eu gastar R$ X?": get_livre_para_gastar ganha
--    p_extra_amount/p_extra_date — soma uma saída hipotética naquele dia
--    (hoje, se a data vier nula ou no passado) e devolve o mesmo JSON. Nada
--    é gravado. A versão antiga (1 argumento) precisa ser removida antes:
--    criar a nova com defaults ao lado dela deixaria a chamada com 1
--    argumento ambígua.
--
-- 2) get_livre_para_gastar_as(p_user_id): pra Edge Function quick-tx, que
--    usa a chave de serviço (auth.uid() é nulo ali) com um usuário fixo.
--    Só a role service_role pode executar — confere a role e o grant —, e
--    ela só fixa o usuário na transação (set_config local) antes de chamar
--    o cálculo normal. Usuário logado nunca consegue ler dados de outro.
--
-- Rodar no SQL Editor do Supabase (após 001-052).
-- =====================================================================

drop function if exists get_livre_para_gastar(int);

create or replace function get_livre_para_gastar(
  p_horizon_days int     default 45,
  p_extra_amount numeric default 0,
  p_extra_date   date    default null
)
returns json
language plpgsql
stable
as $$
declare
  v_days      int  := greatest(coalesce(p_horizon_days, 45), 1);
  v_today     date := current_date;
  v_end       date := current_date + (greatest(coalesce(p_horizon_days, 45), 1) - 1);
  v_extra_day date := greatest(coalesce(p_extra_date, current_date), current_date);
  v_extra     numeric := greatest(coalesce(p_extra_amount, 0), 0);
  v_month_id  bigint;
  v_start     numeric;
  v_balance   numeric;
  v_min       numeric;
  v_min_day   date;
  v_limit     numeric;
  v_t         int := 0;
  v_in        numeric := 0;
  v_out       numeric := 0;
  v_outg      numeric;
  r           record;
begin
  select id into v_month_id
  from months
  where user_id = auth.uid()
    and (year, month) <= (extract(year from v_today)::int, extract(month from v_today)::int)
  order by year desc, month desc
  limit 1;

  if v_month_id is null then
    return null;
  end if;

  v_start   := get_saldo_acumulado(v_month_id);
  v_balance := v_start;

  for r in
    select d::date as day,
           coalesce(sum(case when e.is_income then e.amount else 0 end), 0) as inc,
           coalesce(sum(case when e.is_income then 0 else e.amount end), 0) as outg
    from generate_series(v_today, v_end, interval '1 day') d
    left join get_calendar_events(v_today, v_end) e on e.event_date = d::date
    group by d
    order by d
  loop
    v_t    := v_t + 1;
    v_outg := r.outg + case when r.day = v_extra_day then v_extra else 0 end;
    v_balance := v_balance + r.inc - v_outg;
    v_in      := v_in + r.inc;
    v_out     := v_out + v_outg;
    if v_min is null or v_balance < v_min then
      v_min     := v_balance;
      v_min_day := r.day;
    end if;
    if v_limit is null or v_balance / v_t < v_limit then
      v_limit := v_balance / v_t;
    end if;
  end loop;

  return json_build_object(
    'saldo_atual',  v_start,
    'livre',        greatest(0, v_min),
    'limite_dia',   greatest(0, v_limit),
    'saldo_minimo', v_min,
    'dia_critico',  v_min_day,
    'entradas',     v_in,
    'saidas',       v_out,
    'dias',         v_days,
    'sem_renda',    v_in = 0
  );
end;
$$;

grant execute on function get_livre_para_gastar(int, numeric, date) to authenticated;

create or replace function get_livre_para_gastar_as(p_user_id uuid, p_horizon_days int default 45)
returns json
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'não autorizado';
  end if;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id, 'role', 'service_role')::text, true);
  return get_livre_para_gastar(p_horizon_days);
end;
$$;

revoke all on function get_livre_para_gastar_as(uuid, int) from public;
revoke all on function get_livre_para_gastar_as(uuid, int) from anon, authenticated;
grant execute on function get_livre_para_gastar_as(uuid, int) to service_role;
