-- =====================================================================
-- Planejamento: múltiplas entradas de renda com dia do mês, em vez de
-- um único número livre. Continua sendo só uma estimativa/meta do
-- Planejamento — nunca cria lançamento real (mesma filosofia de
-- Dívidas/Metas/Contas Fixas). monthly_plans.income continua existindo
-- como o total (soma dos itens), só ganha um detalhamento por trás.
--
-- Rodar no SQL Editor do Supabase (após 001-030).
-- =====================================================================

create table plan_income_items (
  id           bigint generated always as identity primary key,
  plan_id      bigint not null references monthly_plans(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users,
  amount       numeric not null,
  expected_day int not null check (expected_day between 1 and 31),
  created_at   timestamptz not null default now()
);

alter table plan_income_items enable row level security;

create policy "own plan_income_items" on plan_income_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Backfill: um item por plano já existente com income>0 — dia 1 porque
-- não temos o dia real desses planos antigos, só o total já salvo.
insert into plan_income_items (plan_id, user_id, amount, expected_day)
select mp.id, mp.user_id, mp.income, 1
from monthly_plans mp
where mp.income > 0
  and not exists (select 1 from plan_income_items pii where pii.plan_id = mp.id);

-- save_plan ganha um 4º parâmetro (p_income_items). Drop explícito
-- porque "create or replace" não substitui uma função com aridade
-- diferente — sem isso ficariam duas versões (3 e 4 argumentos)
-- coexistindo.
drop function if exists save_plan(bigint, numeric, jsonb);

create or replace function save_plan(
  p_month_id     bigint,
  p_income       numeric,
  p_items        jsonb,
  p_income_items jsonb default '[]'::jsonb
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

  delete from plan_income_items where plan_id = v_plan_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_income_items, '[]'::jsonb))
  loop
    insert into plan_income_items (plan_id, user_id, amount, expected_day)
    values (
      v_plan_id,
      auth.uid(),
      (v_item->>'amount')::numeric,
      (v_item->>'expected_day')::int
    );
  end loop;

  return v_plan_id;
end;
$$;

grant execute on function save_plan(bigint, numeric, jsonb, jsonb) to authenticated;
