-- =====================================================================
-- Dia de corte configurável pra importação de extrato: lançamentos a
-- partir desse dia do mês contam pro mês seguinte. Padrão 1 = sem
-- deslocamento (mês calendário normal); o usuário ajusta nas Configurações
-- pro dia em que recebe o salário.
-- Rodar no SQL Editor do Supabase (após 001-017).
-- =====================================================================

alter table user_settings
  add column if not exists import_cutoff_day smallint not null default 1
  check (import_cutoff_day between 1 and 31);
