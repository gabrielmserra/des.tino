-- =====================================================================
-- Feature 5 (web) — Fase 3c: Planejamento Mensal
-- save_plan centraliza a escrita (upsert + fechamento de planos
-- anteriores) — réplica de database.py:save_plan/_close_previous_plans.
-- get_month_income é leitura simples usada no histórico da sugestão.
-- Leituras de plano/itens são diretas nas tabelas (sem regra de negócio).
-- Rodar no SQL Editor do Supabase (após 001-007).
-- =====================================================================

create or replace function get_month_income(
  p_month_id bigint,
  p_include_expectations boolean default false
) returns numeric
language sql
stable
as $$
  select coalesce(sum(amount), 0)
  from transactions
  where month_id = p_month_id
    and type in ('entrada_fixa', 'entrada_variavel')
    and (p_include_expectations or coalesce(is_expectation, false) = false);
$$;

-- Cria ou atualiza o plano do mês e substitui seus itens. Nunca duplica
-- (unique em month_id); ao criar um plano novo, fecha os planos `ativo`
-- de meses anteriores. p_items: array json de
-- {category, planned_amount, suggested_amount, is_eventual, is_mandatory}.
create or replace function save_plan(
  p_month_id bigint,
  p_income   numeric,
  p_items    jsonb
) returns bigint
language plpgsql
as $$
declare
  v_plan_id bigint;
  v_is_new  boolean;
  v_year    int;
  v_month   int;
  v_item    jsonb;
begin
  select id into v_plan_id from monthly_plans where month_id = p_month_id;
  v_is_new := v_plan_id is null;

  if v_is_new then
    insert into monthly_plans (month_id, user_id, income)
    values (p_month_id, auth.uid(), p_income)
    returning id into v_plan_id;

    select year, month into v_year, v_month from months where id = p_month_id;
    if found then
      update monthly_plans mp
      set status = 'fechado'
      from months m
      where mp.month_id = m.id
        and mp.status = 'ativo'
        and mp.id <> v_plan_id
        and (m.year, m.month) < (v_year, v_month);
    end if;
  else
    update monthly_plans
    set income = p_income, updated_at = now()
    where id = v_plan_id;

    delete from monthly_plan_items where plan_id = v_plan_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into monthly_plan_items (
      plan_id, user_id, category, suggested_amount, planned_amount,
      is_eventual, is_mandatory
    ) values (
      v_plan_id,
      auth.uid(),
      v_item->>'category',
      nullif(v_item->>'suggested_amount', '')::numeric,
      coalesce((v_item->>'planned_amount')::numeric, 0),
      coalesce((v_item->>'is_eventual')::boolean, false),
      coalesce((v_item->>'is_mandatory')::boolean, false)
    );
  end loop;

  return v_plan_id;
end;
$$;

grant execute on function get_month_income(bigint, boolean) to authenticated;
grant execute on function save_plan(bigint, numeric, jsonb)  to authenticated;
