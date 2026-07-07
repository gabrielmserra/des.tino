-- =====================================================================
-- Feature 5 (web) — Investimentos e Metas de Poupança
-- As tabelas investments, investment_movements e goals já existem
-- (criadas antes das migrations, usadas pelo desktop e por
-- get_total_investments/get_month_investment_net do migration 004).
-- Só o que tem efeito colateral / múltiplas escritas vira RPC; o resto
-- (listar, editar nome/categoria/nota, arquivar, excluir movimentação)
-- é CRUD direto na tabela no site, igual o padrão de cartões/débito.
-- Rodar no SQL Editor do Supabase (após 001-012).
-- =====================================================================

-- Cria o investimento + registra o aporte inicial numa única operação —
-- réplica de database.py:create_investment.
create or replace function create_investment(
  p_name     text,
  p_category text,
  p_month_id bigint,
  p_amount   numeric,
  p_note     text default null
) returns bigint
language plpgsql
as $$
declare
  v_inv_id bigint;
begin
  insert into investments (user_id, name, category)
  values (auth.uid(), p_name, p_category)
  returning id into v_inv_id;

  insert into investment_movements (investment_id, user_id, month_id, movement_type, amount, note)
  values (v_inv_id, auth.uid(), p_month_id, 'aporte_inicial', p_amount, p_note);

  return v_inv_id;
end;
$$;

-- Exclui o investimento e todas as suas movimentações — réplica de
-- database.py:delete_investment (2 deletes em ordem, sem depender de
-- on delete cascade existir na tabela).
create or replace function delete_investment(p_investment_id bigint)
returns void
language plpgsql
as $$
begin
  delete from investment_movements where investment_id = p_investment_id;
  delete from investments where id = p_investment_id;
end;
$$;

-- Aporta/saca de uma meta — réplica de database.py:add_goal_contribution
-- (chamada com valor negativo pra sacar), mas atômica (UPDATE direto em
-- vez do read-then-write do desktop, que tem race condition). Nunca
-- deixa saved_amount negativo, igual ao desktop.
create or replace function add_goal_contribution(p_goal_id bigint, p_amount numeric)
returns numeric
language plpgsql
as $$
declare
  v_new numeric;
begin
  update goals
  set saved_amount = greatest(0, saved_amount + p_amount)
  where id = p_goal_id
  returning saved_amount into v_new;
  return v_new;
end;
$$;

grant execute on function create_investment(text, text, bigint, numeric, text) to authenticated;
grant execute on function delete_investment(bigint)                           to authenticated;
grant execute on function add_goal_contribution(bigint, numeric)              to authenticated;
