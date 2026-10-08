/**
 * Réplica exata de utils/target_allocation_defaults.py — valores-padrão
 * de alocação-alvo por perfil, usados só pra semear a tabela
 * investor_target_allocations na primeira vez que o usuário abre a
 * tela de Alocação pra cada perfil. Editável livre pelo usuário dentro
 * do app depois disso.
 */
import type { AssetClass } from './assetClasses'

export type TargetDefault = { target_pct: number; tolerance_pct: number }

export const DEFAULT_TARGET_ALLOCATIONS: Record<string, Record<AssetClass, TargetDefault>> = {
  Conservador: {
    reserva_liquidez: { target_pct: 0.3, tolerance_pct: 0.05 },
    renda_fixa_pos: { target_pct: 0.45, tolerance_pct: 0.05 },
    renda_fixa_inflacao_pre: { target_pct: 0.2, tolerance_pct: 0.05 },
    acoes: { target_pct: 0.03, tolerance_pct: 0.02 },
    fiis: { target_pct: 0.02, tolerance_pct: 0.02 },
    internacional: { target_pct: 0, tolerance_pct: 0 },
    cripto: { target_pct: 0, tolerance_pct: 0 },
  },
  Moderado: {
    reserva_liquidez: { target_pct: 0.15, tolerance_pct: 0.05 },
    renda_fixa_pos: { target_pct: 0.3, tolerance_pct: 0.05 },
    renda_fixa_inflacao_pre: { target_pct: 0.2, tolerance_pct: 0.05 },
    acoes: { target_pct: 0.15, tolerance_pct: 0.05 },
    fiis: { target_pct: 0.1, tolerance_pct: 0.03 },
    internacional: { target_pct: 0.07, tolerance_pct: 0.03 },
    cripto: { target_pct: 0.03, tolerance_pct: 0.02 },
  },
  Arrojado: {
    reserva_liquidez: { target_pct: 0.1, tolerance_pct: 0.03 },
    renda_fixa_pos: { target_pct: 0.15, tolerance_pct: 0.05 },
    renda_fixa_inflacao_pre: { target_pct: 0.1, tolerance_pct: 0.05 },
    acoes: { target_pct: 0.3, tolerance_pct: 0.07 },
    fiis: { target_pct: 0.15, tolerance_pct: 0.05 },
    internacional: { target_pct: 0.12, tolerance_pct: 0.05 },
    cripto: { target_pct: 0.08, tolerance_pct: 0.03 },
  },
}
