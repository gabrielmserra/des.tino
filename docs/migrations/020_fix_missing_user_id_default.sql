-- =====================================================================
-- Corrige bug real: inserir direto pelo site em credit_cards,
-- investment_movements e goals falhava com "new row violates row-level
-- security policy" — essas 3 tabelas nunca tiveram
-- "default auth.uid()" na coluna user_id (foram criadas antes das
-- migrations, só usadas pelo desktop até agora, que sempre manda o
-- user_id manualmente em todo insert). O site nunca manda user_id no
-- insert (confia no default, como todo o resto do app) — sem o default,
-- a linha ficava sem user_id e a RLS rejeitava.
--
-- Passou despercebido até agora porque essas tabelas já tinham dados
-- criados pelo desktop; só quebrava na hora de criar algo NOVO pelo
-- site (cartão novo, aportar/sacar num investimento existente, criar
-- meta nova).
--
-- Rodar no SQL Editor do Supabase (após 001-019).
-- =====================================================================

alter table credit_cards         alter column user_id set default auth.uid();
alter table investment_movements alter column user_id set default auth.uid();
alter table goals                alter column user_id set default auth.uid();
