-- =====================================================================
-- Feature — Classe de ativo por investimento
-- Coluna nova (nullable, editável por investimento), separada de
-- investments.category -- não mexe no dropdown existente nem na
-- heurística de concentração do Guru Financeiro, que continuam usando
-- category normalmente. asset_class é só pra alocação-alvo (feature
-- nova) e pode ser corrigida manualmente por investimento a qualquer
-- momento, mesmo depois do backfill abaixo.
-- Rodar no SQL Editor do Supabase (após 045).
-- =====================================================================

alter table investments add column if not exists asset_class text;

-- Backfill por categoria existente -- chute razoável, não definitivo.
-- 'Outros' fica null ("Não classificado" na tela de alocação).
update investments set asset_class = 'reserva_liquidez'
  where category = 'Poupança' and asset_class is null;

update investments set asset_class = 'renda_fixa_pos'
  where category in ('CDB / LCI / LCA', 'Tesouro Direto', 'Previdência')
    and asset_class is null;

update investments set asset_class = 'acoes'
  where category = 'Ações' and asset_class is null;

update investments set asset_class = 'fiis'
  where category = 'FIIs' and asset_class is null;

update investments set asset_class = 'cripto'
  where category = 'Criptomoedas' and asset_class is null;
