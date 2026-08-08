-- =====================================================================
-- Corrige a exclusão de período (mês): algumas tabelas com month_id
-- não tinham "on delete cascade" na foreign key pra months(id), então
-- excluir um mês com faturas de cartão pagas (credit_card_payments) ou
-- lançamentos de cartão avulsos (card_transactions) falhava com erro de
-- violação de chave estrangeira.
--
-- transactions e monthly_plans já tinham cascade; investment_movements
-- recebe o mesmo tratamento por segurança. Rodar no SQL Editor do
-- Supabase (aditiva/idempotente — só recria a constraint).
-- =====================================================================

alter table transactions
  drop constraint if exists transactions_month_id_fkey,
  add constraint transactions_month_id_fkey
    foreign key (month_id) references months(id) on delete cascade;

alter table monthly_plans
  drop constraint if exists monthly_plans_month_id_fkey,
  add constraint monthly_plans_month_id_fkey
    foreign key (month_id) references months(id) on delete cascade;

alter table investment_movements
  drop constraint if exists investment_movements_month_id_fkey,
  add constraint investment_movements_month_id_fkey
    foreign key (month_id) references months(id) on delete cascade;

alter table credit_card_payments
  drop constraint if exists credit_card_payments_month_id_fkey,
  add constraint credit_card_payments_month_id_fkey
    foreign key (month_id) references months(id) on delete cascade;

alter table card_transactions
  drop constraint if exists card_transactions_month_id_fkey,
  add constraint card_transactions_month_id_fkey
    foreign key (month_id) references months(id) on delete cascade;
