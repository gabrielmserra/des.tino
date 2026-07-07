-- =====================================================================
-- Feature 5 (web) — Criar novo período (mês) pelo site/mobile
-- Réplica de ui/app.py:_add_month + database.py:create_month +
-- copy_transactions_to_month (copia pro novo mês as compras no cartão
-- feitas após o fechamento do ciclo anterior).
-- SECURITY INVOKER (padrão) → RLS continua valendo.
-- Rodar no SQL Editor do Supabase (após 001-010).
-- =====================================================================

create or replace function create_month(p_name text, p_year int, p_month int)
returns bigint
language plpgsql
as $$
declare
  v_id       bigint;
  v_prev_id  bigint;
begin
  -- Ignora se já existir (mesmo comportamento do desktop)
  select id into v_id from months where name = p_name;
  if v_id is not null then
    return v_id;
  end if;

  -- Mês mais recente antes de criar o novo (para copiar gastos pós-fechamento)
  select id into v_prev_id from months order by year desc, month desc limit 1;

  insert into months (user_id, name, year, month)
  values (auth.uid(), p_name, p_year, p_month)
  returning id into v_id;

  if v_prev_id is not null then
    insert into transactions (month_id, user_id, type, description, amount, category, card_id)
    select v_id, auth.uid(), t.type, t.description, t.amount, t.category, t.card_id
    from transactions t
    join credit_cards c on c.id = t.card_id
    where t.month_id = v_prev_id
      and t.type = 'saida_variavel'
      and t.card_id is not null
      and coalesce(t.is_expectation, false) = false
      and extract(day from t.created_at::date)::int > c.closing_day;
  end if;

  return v_id;
end;
$$;

grant execute on function create_month(text, int, int) to authenticated;
