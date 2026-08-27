-- =====================================================================
-- Metas: terceiro modo de cronograma — "Personalizado". Além da meta
-- simples (aporte avulso) e da recorrente (valor mensal fixo, 1 parcela
-- por mês), o usuário agora pode montar um cronograma manual com
-- parcelas em qualquer dia e qualquer valor (ex: dia 20 e dia 24, datas
-- de salário) — sem cadência mensal imposta.
--
-- goals.monthly_amount continua sendo o único discriminador de meta
-- recorrente (zero mudança pro que já existe). goals.schedule_type é
-- novo e só é usado com o valor 'custom' — metas antigas ficam com
-- schedule_type null e continuam se comportando exatamente como hoje.
--
-- goal_installments.due_day é novo e nullable — parcelas mensais
-- continuam sem dia (due_day null), mostrando só "Mês Ano" como hoje;
-- só parcelas personalizadas preenchem due_day.
--
-- Diferença de comportamento pra metas com alvo (target_amount): metas
-- mensais continuam com o alvo recalculado como soma das parcelas
-- (código de 022, inalterado) — o alvo "é" o cronograma. Metas
-- personalizadas têm alvo independente (definido na criação): o app
-- compara soma-cadastrada x alvo, sem o RPC sobrescrever o alvo.
--
-- Rodar no SQL Editor do Supabase (após 001-025).
-- =====================================================================

alter table goals add column if not exists schedule_type text;
alter table goal_installments add column if not exists due_day int
  check (due_day is null or due_day between 1 and 31);

-- Cria uma meta de cronograma personalizado + suas parcelas iniciais
-- numa única operação. Nunca tem monthly_amount (não existe cadência
-- fixa) — schedule_type='custom' é o que a distingue de meta simples.
create or replace function create_custom_goal(
  p_name          text,
  p_target_amount numeric,
  p_installments  jsonb  -- [{"number","amount","year","month","day"}]
) returns bigint
language plpgsql
as $$
declare
  v_goal_id bigint;
  v_item    jsonb;
begin
  insert into goals (user_id, name, target_amount, saved_amount, monthly_amount, schedule_type)
  values (auth.uid(), p_name, p_target_amount, 0, null, 'custom')
  returning id into v_goal_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
  loop
    insert into goal_installments (goal_id, user_id, installment_number, amount, due_year, due_month, due_day)
    values (
      v_goal_id, auth.uid(),
      (v_item->>'number')::int,
      (v_item->>'amount')::numeric,
      (v_item->>'year')::int,
      (v_item->>'month')::int,
      nullif(v_item->>'day', '')::int
    );
  end loop;

  return v_goal_id;
end;
$$;

-- add_goal_installments (022) passa a gravar due_day também — chave
-- "day" opcional no jsonb; ausente = null, então "Gerar mais meses"
-- (recorrente) continua idêntico, sem passar essa chave.
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
    insert into goal_installments (goal_id, user_id, installment_number, amount, due_year, due_month, due_day)
    values (
      p_goal_id, auth.uid(),
      (v_item->>'number')::int,
      (v_item->>'amount')::numeric,
      (v_item->>'year')::int,
      (v_item->>'month')::int,
      nullif(v_item->>'day', '')::int
    );
  end loop;
end;
$$;

-- update_goal_installment_amount (022): o recálculo de target_amount
-- como soma das parcelas passa a rodar só quando a meta NÃO é de
-- cronograma personalizado — meta mensal mantém o comportamento atual.
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
  if v_goal.target_amount is not null and v_goal.schedule_type is distinct from 'custom' then
    select coalesce(sum(amount), 0) into v_total from goal_installments where goal_id = v_inst.goal_id;
    update goals set target_amount = v_total where id = v_inst.goal_id;
  end if;
end;
$$;

-- delete_goal_installment (022): mesma guarda condicional.
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
  if v_goal.target_amount is not null and v_goal.schedule_type is distinct from 'custom' then
    select coalesce(sum(amount), 0) into v_total from goal_installments where goal_id = v_inst.goal_id;
    update goals set target_amount = v_total where id = v_inst.goal_id;
  end if;
end;
$$;

grant execute on function create_custom_goal(text, numeric, jsonb) to authenticated;
