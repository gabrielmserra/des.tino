"""
Valores-padrão de alocação-alvo por perfil, usados só pra semear a
tabela investor_target_allocations na primeira vez que o usuário abre
a tela de Alocação pra cada perfil -- depois disso o usuário edita
livremente dentro do app (CRUD em database.py:get_target_allocations/
save_target_allocation/reset_target_allocations), estes valores nunca
são lidos de novo a não ser que ele clique em "Restaurar padrão".

target_pct/tolerance_pct são frações 0-1. Cada perfil soma 100%.
Valores ilustrativos, não são orientação financeira -- editáveis livre
pelo usuário a qualquer momento.
"""
from typing import Dict

DEFAULT_TARGET_ALLOCATIONS: Dict[str, Dict[str, dict]] = {
    "Conservador": {
        "reserva_liquidez":        {"target_pct": 0.30, "tolerance_pct": 0.05},
        "renda_fixa_pos":          {"target_pct": 0.45, "tolerance_pct": 0.05},
        "renda_fixa_inflacao_pre": {"target_pct": 0.20, "tolerance_pct": 0.05},
        "acoes":                   {"target_pct": 0.03, "tolerance_pct": 0.02},
        "fiis":                    {"target_pct": 0.02, "tolerance_pct": 0.02},
        "internacional":           {"target_pct": 0.00, "tolerance_pct": 0.00},
        "cripto":                  {"target_pct": 0.00, "tolerance_pct": 0.00},
    },
    "Moderado": {
        "reserva_liquidez":        {"target_pct": 0.15, "tolerance_pct": 0.05},
        "renda_fixa_pos":          {"target_pct": 0.30, "tolerance_pct": 0.05},
        "renda_fixa_inflacao_pre": {"target_pct": 0.20, "tolerance_pct": 0.05},
        "acoes":                   {"target_pct": 0.15, "tolerance_pct": 0.05},
        "fiis":                    {"target_pct": 0.10, "tolerance_pct": 0.03},
        "internacional":           {"target_pct": 0.07, "tolerance_pct": 0.03},
        "cripto":                  {"target_pct": 0.03, "tolerance_pct": 0.02},
    },
    "Arrojado": {
        "reserva_liquidez":        {"target_pct": 0.10, "tolerance_pct": 0.03},
        "renda_fixa_pos":          {"target_pct": 0.15, "tolerance_pct": 0.05},
        "renda_fixa_inflacao_pre": {"target_pct": 0.10, "tolerance_pct": 0.05},
        "acoes":                   {"target_pct": 0.30, "tolerance_pct": 0.07},
        "fiis":                    {"target_pct": 0.15, "tolerance_pct": 0.05},
        "internacional":           {"target_pct": 0.12, "tolerance_pct": 0.05},
        "cripto":                  {"target_pct": 0.08, "tolerance_pct": 0.03},
    },
}
