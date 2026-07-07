-- =====================================================================
-- Feature 5 (web) — Fase 3d: Dívidas
-- Réplica exata da lógica de database.py (create_debt, pay_installment,
-- undo_payment, delete_installment/delete_debt, sync_debts_into_plan,
-- get_debt_overview). Leituras simples (get_debts/get_all_installments)
-- são diretas nas tabelas no site, sem RPC.
-- Rodar no SQL Editor do Supabase (após 001-009).
-- =====================================================================

-- Garante o período (mês) — cria se não existir. Réplica de _ensure_month.
create or replace function ensure_month(p_year int, p_month int)
returns bigint
language plpgsql
as $$
declare
  v_id   bigint;
  v_name text;
  v_months text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                           'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
begin
  v_name := v_months[p_month] || ' ' || p_year;
  select id into v_id from months where name = v_name;
  if v_id is not null then
    return v_id;
  end if;
  insert into months (user_id, name, year, month)
  values (auth.uid(), v_name, p_year, p_month)
  returning id into v_id;
  return v_id;
end;
$$;

-- Cria a dívida e suas parcelas — réplica de create_debt.
-- p_installments: array json de {number, amount, year, month}.
create or replace function create_debt(
  p_description  text,
  p_creditor     text,
  p_total_amount numeric,
  p_category     text,
  p_notes        text,
  p_installments jsonb
) returns bigint
language plpgsql
as $$
declare
  v_debt_id bigint;
  v_item    jsonb;
begin
  insert into debts (user_id, description, creditor, total_amount, category, notes)
  values (auth.uid(), p_description, p_creditor, p_total_amount,
          coalesce(p_category, 'Dívidas'), p_notes)
  returning id into v_debt_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb))
  loop
    insert into debt_installments (
      debt_id, user_id, installment_number, amount, due_year, due_month
    ) values (
      v_debt_id, auth.uid(),
      (v_item->>'number')::int,
      (v_item->>'amount')::numeric,
      (v_item->>'year')::int,
      (v_item->>'month')::int
    );
  end loop;

  return v_debt_id;
end;
$$;

-- Atualiza o valor de uma parcela e recalcula o total da dívida —
-- réplica de update_installment_amount.
create or replace function update_installment_amount(p_inst_id bigint, p_amount numeric)
returns void
language plpgsql
as $$
declare
  v_debt_id bigint;
  v_total   numeric;
begin
  update debt_installments set amount = p_amount where id = p_inst_id
  returning debt_id into v_debt_id;
  if v_debt_id is null then return; end if;

  select coalesce(sum(amount), 0) into v_total
  from debt_installments where debt_id = v_debt_id;

  update debts set total_amount = v_total where id = v_debt_id;
end;
$$;

-- Marca a parcela como paga; opcionalmente lança o gasto no mês dela —
-- réplica de pay_installment (cria o mês se necessário via ensure_month).
create or replace function pay_installment(p_inst_id bigint, p_launch_expense boolean default true)
returns void
language plpgsql
as $$
declare
  v_inst       debt_installments;
  v_debt       debts;
  v_n_total    int;
  v_month_id   bigint;
  v_desc       text;
  v_expense_id bigint := null;
begin
  select * into v_inst from debt_installments where id = p_inst_id;
  if not found then return; end if;
  select * into v_debt from debts where id = v_inst.debt_id;

  select count(*) into v_n_total from debt_installments where debt_id = v_inst.debt_id;

  if p_launch_expense then
    v_month_id := ensure_month(v_inst.due_year, v_inst.due_month);
    v_desc := v_debt.description;
    if v_n_total > 1 then
      v_desc := v_desc || ' (parcela ' || v_inst.installment_number || '/' || v_n_total || ')';
    end if;
    insert into transactions (month_id, user_id, type, description, amount, category)
    values (v_month_id, auth.uid(), 'saida_fixa', v_desc, v_inst.amount,
            coalesce(v_debt.category, 'Dívidas'))
    returning id into v_expense_id;
  end if;

  update debt_installments
  set paid_at = now(), expense_id = v_expense_id
  where id = p_inst_id;
end;
$$;

-- Desfaz o pagamento; remove o gasto vinculado, se houver — réplica de undo_payment.
create or replace function undo_installment_payment(p_inst_id bigint)
returns void
language plpgsql
as $$
declare
  v_inst debt_installments;
begin
  select * into v_inst from debt_installments where id = p_inst_id;
  if not found then return; end if;

  if v_inst.expense_id is not null then
    delete from transactions where id = v_inst.expense_id;
  end if;

  update debt_installments set paid_at = null, expense_id = null where id = p_inst_id;
end;
$$;

-- Exclui só a parcela (recalcula total; remove a dívida se ficou sem
-- parcelas) — réplica de delete_installment.
create or replace function delete_installment(p_inst_id bigint, p_delete_expense boolean default false)
returns void
language plpgsql
as $$
declare
  v_inst            debt_installments;
  v_remaining_count int;
  v_remaining_total numeric;
begin
  select * into v_inst from debt_installments where id = p_inst_id;
  if not found then return; end if;

  if p_delete_expense and v_inst.expense_id is not null then
    delete from transactions where id = v_inst.expense_id;
  end if;

  delete from debt_installments where id = p_inst_id;

  select count(*), coalesce(sum(amount), 0) into v_remaining_count, v_remaining_total
  from debt_installments where debt_id = v_inst.debt_id;

  if v_remaining_count > 0 then
    update debts set total_amount = v_remaining_total where id = v_inst.debt_id;
  else
    delete from debts where id = v_inst.debt_id;
  end if;
end;
$$;

-- Exclui a dívida inteira (parcelas somem via cascade); opcionalmente
-- remove também os gastos que as parcelas geraram — réplica de delete_debt.
create or replace function delete_debt(p_debt_id bigint, p_delete_expenses boolean default false)
returns void
language plpgsql
as $$
begin
  if p_delete_expenses then
    delete from transactions
    where id in (
      select expense_id from debt_installments
      where debt_id = p_debt_id and expense_id is not null
    );
  end if;
  delete from debts where id = p_debt_id;   -- cascade remove as parcelas
end;
$$;

-- Parcelas não pagas com vencimento no mês, somadas por categoria da
-- dívida — réplica de get_month_debt_totals_for.
create or replace function get_month_debt_totals(p_month_id bigint)
returns table (category text, total numeric)
language sql
stable
as $$
  select coalesce(d.category, 'Dívidas') as category, sum(di.amount) as total
  from debt_installments di
  join debts d on d.id = di.debt_id
  where di.paid_at is null
    and di.due_year  = (select year  from months where id = p_month_id)
    and di.due_month = (select month from months where id = p_month_id)
  group by coalesce(d.category, 'Dívidas');
$$;

-- Garante que o plano ativo do mês reflita as parcelas pendentes (itens
-- obrigatórios/travados) — réplica de sync_debts_into_plan.
create or replace function sync_debts_into_plan(p_month_id bigint)
returns boolean
language plpgsql
as $$
declare
  v_plan    monthly_plans;
  v_changed boolean := false;
  v_row     record;
  v_item    monthly_plan_items;
begin
  select * into v_plan from monthly_plans where month_id = p_month_id;
  if not found or v_plan.status <> 'ativo' then
    return false;
  end if;

  for v_row in select * from get_month_debt_totals(p_month_id)
  loop
    select * into v_item from monthly_plan_items
      where plan_id = v_plan.id and category = v_row.category;
    if not found then
      insert into monthly_plan_items (
        plan_id, user_id, category, planned_amount, suggested_amount, is_mandatory
      ) values (
        v_plan.id, auth.uid(), v_row.category, v_row.total, v_row.total, true
      );
      v_changed := true;
    elsif (not v_item.is_mandatory) or abs(coalesce(v_item.planned_amount, 0) - v_row.total) > 0.005 then
      update monthly_plan_items
      set planned_amount = v_row.total, suggested_amount = v_row.total, is_mandatory = true
      where id = v_item.id;
      v_changed := true;
    end if;
  end loop;

  for v_item in
    select * from monthly_plan_items
    where plan_id = v_plan.id and is_mandatory = true
      and category not in (select category from get_month_debt_totals(p_month_id))
  loop
    delete from monthly_plan_items where id = v_item.id;
    v_changed := true;
  end loop;

  return v_changed;
end;
$$;

-- Resumo: total em aberto, nº de atrasadas, comprometimento dos
-- próximos 6 meses — réplica de get_debt_overview.
create or replace function get_debt_overview()
returns json
language plpgsql
stable
as $$
declare
  v_total_aberto numeric := 0;
  v_n_atrasadas  int := 0;
  v_today        date := current_date;
  v_future       json[] := array[]::json[];
  v_y int; v_m int; v_total numeric; i int;
begin
  select coalesce(sum(amount), 0) into v_total_aberto
  from debt_installments where paid_at is null;

  select count(*) into v_n_atrasadas
  from debt_installments
  where paid_at is null
    and (due_year, due_month) < (extract(year from v_today)::int, extract(month from v_today)::int);

  v_y := extract(year from v_today)::int;
  v_m := extract(month from v_today)::int;
  for i in 1..6 loop
    select coalesce(sum(amount), 0) into v_total
    from debt_installments
    where paid_at is null and due_year = v_y and due_month = v_m;
    v_future := v_future || json_build_object('year', v_y, 'month', v_m, 'total', v_total);
    if v_m = 12 then v_y := v_y + 1; v_m := 1; else v_m := v_m + 1; end if;
  end loop;

  return json_build_object(
    'total_aberto', v_total_aberto,
    'n_atrasadas',  v_n_atrasadas,
    'future',       array_to_json(v_future)
  );
end;
$$;

grant execute on function ensure_month(int, int)                          to authenticated;
grant execute on function create_debt(text, text, numeric, text, text, jsonb) to authenticated;
grant execute on function update_installment_amount(bigint, numeric)      to authenticated;
grant execute on function pay_installment(bigint, boolean)                to authenticated;
grant execute on function undo_installment_payment(bigint)                to authenticated;
grant execute on function delete_installment(bigint, boolean)             to authenticated;
grant execute on function delete_debt(bigint, boolean)                    to authenticated;
grant execute on function get_month_debt_totals(bigint)                   to authenticated;
grant execute on function sync_debts_into_plan(bigint)                    to authenticated;
grant execute on function get_debt_overview()                             to authenticated;
