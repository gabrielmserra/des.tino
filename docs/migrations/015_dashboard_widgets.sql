-- =====================================================================
-- Feature 7 — Dashboard configurável (mostrar/esconder e reordenar
-- cards/widgets), sincronizado entre desktop, site e celular.
-- Aditivo: coluna nova, nullable — sem config salva ainda, todo mundo
-- continua vendo o dashboard padrão de sempre.
-- Rodar no SQL Editor do Supabase (após 001-014).
-- =====================================================================

-- Array ordenado de {"id": "<widget_id>", "enabled": true|false} — a
-- ordem do array é a ordem de exibição. Widgets ainda não presentes na
-- lista salva do usuário (ex.: lançados numa versão futura) entram no
-- fim, habilitados por padrão — tratado na aplicação, não aqui.
alter table user_settings add column if not exists dashboard_widgets jsonb;
