-- =====================================================================
-- Metas com recorrência mensal — mesmo mecanismo de checklist das
-- Dívidas (parcelas por mês, marcar como feito), mas pra Metas, e sem
-- NUNCA criar lançamento nem mexer no saldo (mesma filosofia aplicada
-- em pay_installment na migration 021).
--
-- target_amount vira opcional: metas recorrentes "sem fim" (sem valor
-- final em mente) não têm alvo, só um valor mensal — nesse caso a UI
-- mostra "guardado até agora" em vez de barra de progresso.
--
-- Rodar no SQL Editor do Supabase (após 001-021).
-- =====================================================================

alter table goals alter column target_amount drop not null;
alter table goals add column if not exists monthly_amount numeric;

create table if not exists goal_installments (
  id                  bigint generated always as identity primary key,
  goal_id             bigint not null references goals(id) on delete cascade,
  user_id             uuid not null default auth.uid() references auth.users,
  installment_number  int not null,
  amount              numeric not null,
  due_year            int not null,
  due_month           int not null,
  contributed_at      timestamptz,
  created_at          timestamptz not null default now()
);

alter table goal_installments enable row level security;

create policy "goal_installments_all" on goal_installments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cria a meta + as parcelas do cronograma numa única operação. Se
-- p_target_amount vier null, a meta é "sem fim" (só valor mensal).
create or replace function create_recurring_goal(
  p_name           text,
  p_target_amount  numeric,
  p_monthly_amount numeric,
  p_installments   jsonb  -- [{"number","amount","year","month"}]
) returns bigint
language plpgsql
as $$
declare
  v_goal_id bigint;
  v_item    jsonb;
begin
  insert into goals (user_id, name, target_amount, saved_amount, monthly_amount)
  values (auth.uid(), p_name, p_target_amount, 0, p_monthly_amount)
  returning id into v_goal_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
  loop
    insert into goal_installments (goal_id, user_id, installment_number, amount, due_year, due_month)
    values (
      v_goal_id, auth.uid(),
      (v_item->>'number')::int,
      (v_item->>'amount')::numeric,
      (v_item->>'year')::int,
      (v_item->>'month')::int
    );
  end loop;

  return v_goal_id;
end;
$$;

-- Adiciona mais parcelas a uma meta recorrente já existente ("Gerar mais meses").
create or replace function add_goal_installments(
  p_goal_id      bigint,
  p_installments jsonb
) returns void
language plpgsql
as $$
declare
  v_item jsonb;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
  loop
    insert into goal_installments (goal_id, user_id, installment_number, amount, due_year, due_month)
    values (
      p_goal_id, auth.uid(),
      (v_item->>'number')::int,
      (v_item->>'amount')::numeric,
      (v_item->>'year')::int,
      (v_item->>'month')::int
    );
  end loop;
end;
$$;

-- Marca uma parcela como guardada — só isso, sem lançamento nem saldo.
create or replace function contribute_goal_installment(p_inst_id bigint)
returns void
language plpgsql
as $$
declare
  v_inst goal_installments;
begin
  select * into v_inst from goal_installments where id = p_inst_id;
  if not found or v_inst.contributed_at is not null then return; end if;

  update goal_installments set contributed_at = now() where id = p_inst_id;
  update goals set saved_amount = greatest(0, saved_amount + v_inst.amount) where id = v_inst.goal_id;
end;
$$;

create or replace function undo_goal_installment_contribution(p_inst_id bigint)
returns void
language plpgsql
as $$
declare
  v_inst goal_installments;
begin
  select * into v_inst from goal_installments where id = p_inst_id;
  if not found or v_inst.contributed_at is null then return; end if;

  update goal_installments set contributed_at = null where id = p_inst_id;
  update goals set saved_amount = greatest(0, saved_amount - v_inst.amount) where id = v_inst.goal_id;
end;
$$;

-- Edita o valor de uma parcela específica; se ela já tinha sido marcada
-- como guardada, ajusta saved_amount pela diferença; se a meta tem
-- target_amount definido, recalcula como soma das parcelas.
create or replace function update_goal_installment_amount(p_inst_id bigint, p_amount numeric)
returns void
language plpgsql
as $$
declare
  v_inst  goal_installments;
  v_delta numeric;
  v_total numeric;
  v_goal  goals;
begin
  select * into v_inst from goal_installments where id = p_inst_id;
  if not found then return; end if;
  v_delta := p_amount - v_inst.amount;

  update goal_installments set amount = p_amount where id = p_inst_id;

  select * into v_goal from goals where id = v_inst.goal_id;
  if v_inst.contributed_at is not null and v_delta <> 0 then
    update goals set saved_amount = greatest(0, saved_amount + v_delta) where id = v_inst.goal_id;
  end if;
  if v_goal.target_amount is not null then
    select coalesce(sum(amount), 0) into v_total from goal_installments where goal_id = v_inst.goal_id;
    update goals set target_amount = v_total where id = v_inst.goal_id;
  end if;
end;
$$;

-- Exclui uma parcela; se estava guardada, desconta de saved_amount; se
-- a meta tem target_amount definido, recalcula como soma das restantes.
create or replace function delete_goal_installment(p_inst_id bigint)
returns void
language plpgsql
as $$
declare
  v_inst  goal_installments;
  v_goal  goals;
  v_total numeric;
begin
  select * into v_inst from goal_installments where id = p_inst_id;
  if not found then return; end if;

  delete from goal_installments where id = p_inst_id;

  select * into v_goal from goals where id = v_inst.goal_id;
  if v_inst.contributed_at is not null then
    update goals set saved_amount = greatest(0, saved_amount - v_inst.amount) where id = v_inst.goal_id;
  end if;
  if v_goal.target_amount is not null then
    select coalesce(sum(amount), 0) into v_total from goal_installments where goal_id = v_inst.goal_id;
    update goals set target_amount = v_total where id = v_inst.goal_id;
  end if;
end;
$$;

grant execute on function create_recurring_goal(text, numeric, numeric, jsonb)      to authenticated;
grant execute on function add_goal_installments(bigint, jsonb)                      to authenticated;
grant execute on function contribute_goal_installment(bigint)                       to authenticated;
grant execute on function undo_goal_installment_contribution(bigint)                to authenticated;
grant execute on function update_goal_installment_amount(bigint, numeric)           to authenticated;
grant execute on function delete_goal_installment(bigint)                           to authenticated;
