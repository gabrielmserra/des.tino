-- =====================================================================
-- Feature 5 (web) — Funções de ESCRITA centralizadas no Postgres
-- add/update/delete de transação, replicando a lógica do database.py
-- (inclui débito/estorno do saldo de VR/VA). Fonte única de verdade:
-- o site chama estas RPCs; o desktop migra pra elas na Fase 3.
-- SECURITY INVOKER (padrão) → RLS continua valendo.
-- Rodar no SQL Editor do Supabase (após 001-004).
-- =====================================================================

create or replace function add_transaction(
  p_month_id       bigint,
  p_type           text,
  p_description    text,
  p_amount         numeric,
  p_category       text default 'Outros',
  p_card_id        bigint default null,
  p_benefit_id     bigint default null,
  p_is_expectation boolean default false
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into transactions (
    month_id, user_id, type, description, amount, category,
    card_id, benefit_id, is_expectation
  ) values (
    p_month_id, auth.uid(), p_type, p_description, p_amount,
    coalesce(p_category, 'Outros'), p_card_id, p_benefit_id,
    coalesce(p_is_expectation, false)
  )
  returning id into v_id;

  -- Gasto com VR/VA debita o saldo na hora (previsão não debita)
  if p_benefit_id is not null and not coalesce(p_is_expectation, false) then
    update benefit_cards set balance = balance - p_amount where id = p_benefit_id;
  end if;

  return v_id;
end;
$$;

create or replace function update_transaction(
  p_id             bigint,
  p_description    text,
  p_amount         numeric,
  p_category       text,
  p_card_id        bigint default null,
  p_benefit_id     bigint default null,
  p_is_expectation boolean default false
) returns void
language plpgsql
as $$
declare
  v_old transactions;
begin
  select * into v_old from transactions where id = p_id;   -- RLS garante que é do próprio usuário
  if not found then return; end if;

  -- Estorna o efeito antigo no saldo do benefício
  if v_old.benefit_id is not null and not coalesce(v_old.is_expectation, false) then
    update benefit_cards set balance = balance + v_old.amount where id = v_old.benefit_id;
  end if;

  update transactions set
    description    = p_description,
    amount         = p_amount,
    category       = coalesce(p_category, 'Outros'),
    card_id        = p_card_id,
    benefit_id     = p_benefit_id,
    is_expectation = coalesce(p_is_expectation, false)
  where id = p_id;

  -- Aplica o novo débito, se for gasto real com benefício
  if p_benefit_id is not null and not coalesce(p_is_expectation, false) then
    update benefit_cards set balance = balance - p_amount where id = p_benefit_id;
  end if;
end;
$$;

create or replace function delete_transaction(p_id bigint)
returns void
language plpgsql
as $$
declare
  v_old transactions;
begin
  select * into v_old from transactions where id = p_id;
  if not found then return; end if;

  if v_old.benefit_id is not null and not coalesce(v_old.is_expectation, false) then
    update benefit_cards set balance = balance + v_old.amount where id = v_old.benefit_id;
  end if;

  delete from transactions where id = p_id;
end;
$$;

grant execute on function add_transaction(bigint, text, text, numeric, text, bigint, bigint, boolean) to authenticated;
grant execute on function update_transaction(bigint, text, numeric, text, bigint, bigint, boolean)       to authenticated;
grant execute on function delete_transaction(bigint)                                                     to authenticated;
