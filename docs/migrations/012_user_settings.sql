-- =====================================================================
-- Feature 5 (web) — Fase 4: tema sincronizado entre desktop e site
-- Tabela simples de preferências do usuário (por enquanto, só o tema).
-- CRUD direto pela tabela, sem RPC (sem regra de negócio envolvida).
-- Rodar no SQL Editor do Supabase (após 001-011).
-- =====================================================================

create table user_settings (
  user_id    uuid primary key references auth.users default auth.uid(),
  theme      text not null default 'Esmeralda',
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "user_settings_all" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
