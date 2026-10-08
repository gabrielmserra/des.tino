"""
Taxonomia de classes de ativo para a alocação-alvo por perfil de
investidor. Separada de utils/helpers.py:INVESTMENT_CATEGORIES de
propósito -- aquela lista alimenta o dropdown de categoria do
investimento e a heurística de concentração do Guru Financeiro, que
não mudam. asset_class é um recorte diferente (mais próximo de "risco/
liquidez" que de "produto"), usado só pela tela de Alocação.
"""

ASSET_CLASSES = [
    "reserva_liquidez",
    "renda_fixa_pos",
    "renda_fixa_inflacao_pre",
    "acoes",
    "fiis",
    "internacional",
    "cripto",
]

ASSET_CLASS_LABELS = {
    "reserva_liquidez":        "Reserva / Liquidez",
    "renda_fixa_pos":          "Renda Fixa Pós-fixada",
    "renda_fixa_inflacao_pre": "Renda Fixa Inflação/Prefixada",
    "acoes":                   "Ações",
    "fiis":                    "FIIs",
    "internacional":           "Internacional",
    "cripto":                  "Criptomoedas",
}

# Mapeamento usado só no backfill da migração 046 e como sugestão
# inicial no diálogo de editar investimento -- sempre sobrescrevível
# pelo usuário por investimento. Categorias não listadas aqui (ex.
# "Outros") ficam sem classe ("Não classificado" na tela).
CATEGORY_TO_ASSET_CLASS = {
    "Poupança":          "reserva_liquidez",
    "CDB / LCI / LCA":   "renda_fixa_pos",
    "Tesouro Direto":    "renda_fixa_pos",
    "Previdência":       "renda_fixa_pos",
    "Ações":             "acoes",
    "FIIs":              "fiis",
    "Criptomoedas":      "cripto",
}

NAO_CLASSIFICADO = "nao_classificado"
