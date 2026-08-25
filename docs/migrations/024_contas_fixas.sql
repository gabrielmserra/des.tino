-- =====================================================================
-- Contas Fixas — internet, luz, água, aluguel, condomínio, etc. Um
-- template ("fixed_bills", com dia de vencimento) gera uma instância por
-- mês ("fixed_bill_instances"), atrelada a months.id (não a
-- due_year/due_month solto como em Dívidas/Metas) porque, ao contrário
-- daquelas, marcar como paga AQUI precisa criar um lançamento real —
-- mesmo espírito do pay_card_bill (migration 006), que também insere
-- direto em `transactions` dentro da própria RPC.
--
-- Rodar no SQL Editor do Supabase (após 001-023).
-- =====================================================================

create table if not exists fixed_bills (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users,
  name text not null,
  expected_amount numeric not null,
  due_day int not null check (due_day between 1 and 31),
  category text not null default 'Moradia',
  payment_method text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists fixed_bill_instances (
  id bigint generated always as identity primary key,
  bill_id bigint not null references fixed_bills(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users,
  month_id bigint not null references months(id) on delete cascade,
  amount numeric not null,
  paid_at timestamptz,
  expense_id bigint references transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bill_id, month_id)
);

alter table fixed_bills enable row level security;
alter table fixed_bill_instances enable row level security;

create policy "own fixed_bills" on fixed_bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own fixed_bill_instances" on fixed_bill_instances
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── CRUD do template ──────────────────────────────────────────────────

create or replace function create_fixed_bill(
  p_name text, p_amount numeric, p_due_day int,
  p_category text, p_payment_method text
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
begin
  insert into fixed_bills (user_id, name, expected_amount, due_day, category, payment_method)
  values (auth.uid(), p_name, p_amount, p_due_day, coalesce(p_category, 'Moradia'), p_payment_method)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function update_fixed_bill(
  p_bill_id bigint, p_name text, p_amount numeric, p_due_day int,
  p_category text, p_payment_method text, p_active boolean
) returns void
language plpgsql
as $$
begin
  update fixed_bills set
    name = p_name, expected_amount = p_amount, due_day = p_due_day,
    category = coalesce(p_category, 'Moradia'), payment_method = p_payment_method,
    active = p_active
  where id = p_bill_id;
end;
$$;

-- Cascade apaga as instâncias (FK on delete cascade); transações já
-- criadas por instâncias pagas continuam existindo normalmente — só
-- perdem o vínculo (expense_id vivia na instância, não na transação).
create or replace function delete_fixed_bill(p_bill_id bigint)
returns void
language plpgsql
as $$
begin
  delete from fixed_bills where id = p_bill_id;
end;
$$;

-- ── Instâncias mensais ──────────────────────────────────────────────

-- Idempotente: garante uma instância pendente nesse mês pra cada conta
-- fixa ativa que ainda não tem uma. Mesmo espírito do ensure_month.
create or replace function ensure_fixed_bill_instances(p_month_id bigint)
returns void
language plpgsql
as $$
begin
  insert into fixed_bill_instances (bill_id, user_id, month_id, amount)
  select b.id, auth.uid(), p_month_id, b.expected_amount
  from fixed_bills b
  where b.user_id = auth.uid() and b.active
    and not exists (
      select 1 from fixed_bill_instances i
      where i.bill_id = b.id and i.month_id = p_month_id
    );
end;
$$;

create or replace function update_fixed_bill_instance_amount(p_instance_id bigint, p_amount numeric)
returns void
language plpgsql
as $$
declare
  v_expense_id bigint;
begin
  update fixed_bill_instances set amount = p_amount
  where id = p_instance_id
  returning expense_id into v_expense_id;

  if v_expense_id is not null then
    update transactions set amount = p_amount where id = v_expense_id;
  end if;
end;
$$;

-- Cria o lançamento real (Saída Fixa) e marca a instância como paga —
-- diferente de pay_installment (Dívidas)/contribute_goal_installment
-- (Metas), que nunca tocam o saldo: aqui é o ponto central da feature.
create or replace function pay_fixed_bill_instance(p_instance_id bigint, p_payment_method text)
returns bigint
language plpgsql
as $$
declare
  v_inst  fixed_bill_instances;
  v_bill  fixed_bills;
  v_tx_id bigint;
begin
  select * into v_inst from fixed_bill_instances where id = p_instance_id;
  if not found then
    raise exception 'Instância não encontrada';
  end if;
  select * into v_bill from fixed_bills where id = v_inst.bill_id;

  v_tx_id := add_transaction(
    v_inst.month_id, 'saida_fixa', v_bill.name, v_inst.amount,
    v_bill.category, null, null, false, null,
    coalesce(p_payment_method, v_bill.payment_method), current_date
  );

  update fixed_bill_instances
  set paid_at = now(), expense_id = v_tx_id
  where id = p_instance_id;

  return v_tx_id;
end;
$$;

create or replace function undo_fixed_bill_payment(p_instance_id bigint)
returns void
language plpgsql
as $$
declare
  v_expense_id bigint;
begin
  select expense_id into v_expense_id from fixed_bill_instances where id = p_instance_id;
  if v_expense_id is not null then
    delete from transactions where id = v_expense_id;
  end if;
  update fixed_bill_instances set paid_at = null, expense_id = null
  where id = p_instance_id;
end;
$$;

create or replace function get_pending_fixed_bills_total(p_month_id bigint)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount), 0)
  from fixed_bill_instances
  where month_id = p_month_id and paid_at is null;
$$;

grant execute on function create_fixed_bill(text, numeric, int, text, text)                 to authenticated;
grant execute on function update_fixed_bill(bigint, text, numeric, int, text, text, boolean) to authenticated;
grant execute on function delete_fixed_bill(bigint)                                          to authenticated;
grant execute on function ensure_fixed_bill_instances(bigint)                                 to authenticated;
grant execute on function update_fixed_bill_instance_amount(bigint, numeric)                  to authenticated;
grant execute on function pay_fixed_bill_instance(bigint, text)                                to authenticated;
grant execute on function undo_fixed_bill_payment(bigint)                                      to authenticated;
grant execute on function get_pending_fixed_bills_total(bigint)                                to authenticated;
