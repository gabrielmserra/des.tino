-- =====================================================================
-- Corrige Contas Fixas (migration 024):
--   1. Instâncias mensais passam a usar due_year/due_month (calendário
--      real) em vez de month_id (mês de cobrança, deslocado pelo dia de
--      corte da importação) — mesmo modelo de debt_installments/
--      goal_installments.
--   2. Pagar deixa de criar lançamento/mexer no saldo — vira um
--      checklist puro, igual pay_installment (migration 021).
--
-- Se já existirem instâncias reais (ligadas a month_id), due_year/
-- due_month são preenchidos a partir do year/month do mês vinculado antes
-- de travar as colunas como NOT NULL.
--
-- Rodar no SQL Editor do Supabase (após 001-024).
-- =====================================================================

alter table fixed_bill_instances drop constraint if exists fixed_bill_instances_bill_id_month_id_key;
alter table fixed_bill_instances add column if not exists due_year int;
alter table fixed_bill_instances add column if not exists due_month int;

update fixed_bill_instances i
set due_year = m.year, due_month = m.month
from months m
where i.month_id = m.id and i.due_year is null;

alter table fixed_bill_instances drop column if exists month_id;
alter table fixed_bill_instances alter column due_year set not null;
alter table fixed_bill_instances alter column due_month set not null;
alter table fixed_bill_instances add constraint fixed_bill_instances_bill_due_key unique (bill_id, due_year, due_month);

-- ── Instâncias mensais (due_year/due_month em vez de month_id) ────────

drop function if exists ensure_fixed_bill_instances(bigint);

create or replace function ensure_fixed_bill_instances(p_year int, p_month int)
returns void
language plpgsql
as $$
begin
  insert into fixed_bill_instances (bill_id, user_id, due_year, due_month, amount)
  select b.id, auth.uid(), p_year, p_month, b.expected_amount
  from fixed_bills b
  where b.user_id = auth.uid() and b.active
    and not exists (
      select 1 from fixed_bill_instances i
      where i.bill_id = b.id and i.due_year = p_year and i.due_month = p_month
    );
end;
$$;

drop function if exists get_pending_fixed_bills_total(bigint);

create or replace function get_pending_fixed_bills_total(p_year int, p_month int)
returns numeric
language sql
stable
as $$
  select coalesce(sum(amount), 0)
  from fixed_bill_instances
  where due_year = p_year and due_month = p_month and paid_at is null;
$$;

-- ── Pagar vira checklist puro — não cria lançamento, não mexe no saldo ─

drop function if exists pay_fixed_bill_instance(bigint, text);

create or replace function pay_fixed_bill_instance(p_instance_id bigint)
returns void
language plpgsql
as $$
begin
  update fixed_bill_instances set paid_at = now()
  where id = p_instance_id;
end;
$$;

create or replace function undo_fixed_bill_payment(p_instance_id bigint)
returns void
language plpgsql
as $$
begin
  update fixed_bill_instances set paid_at = null
  where id = p_instance_id;
end;
$$;

grant execute on function ensure_fixed_bill_instances(int, int)     to authenticated;
grant execute on function get_pending_fixed_bills_total(int, int)   to authenticated;
grant execute on function pay_fixed_bill_instance(bigint)           to authenticated;
grant execute on function undo_fixed_bill_payment(bigint)           to authenticated;
