-- =====================================================================
-- Renomeia user_settings.dashboard_widgets -> dashboard_cards. Puro
-- rename de coluna (o app já chama esses blocos configuráveis do
-- Dashboard de "card" no texto visível ao usuário — o código interno
-- e o site ainda diziam "widget", agora ficam consistentes). Os dados
-- salvos (array de {id, enabled}) não mudam em nada, só o nome da
-- coluna que os guarda.
--
-- Rodar no SQL Editor do Supabase (após 001-043).
-- =====================================================================

alter table user_settings rename column dashboard_widgets to dashboard_cards;
