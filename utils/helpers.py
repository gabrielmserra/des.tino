"""
Funções utilitárias reutilizáveis.
"""

APP_NAME    = "des.tino"
APP_VERSION = "2.0"

MONTHS_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

CATEGORIES = [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Saúde",
    "Lazer",
    "Educação",
    "Vestuário",
    "Assinaturas",
    "Cuidados Pessoais",
    "Viagem",
    "Pets",
    "Outros",
]

TRANSACTION_TYPES = {
    "entrada_fixa":     "Entradas Fixas",
    "entrada_variavel": "Entradas Variáveis",
    "saida_fixa":       "Saídas Fixas",
    "saida_variavel":   "Saídas Variáveis",
    "investimento":     "Investimentos",
}

EXPENSE_TYPES = {"saida_fixa", "saida_variavel"}
INCOME_TYPES  = {"entrada_fixa", "entrada_variavel"}

INVESTMENT_CATEGORIES = [
    "Ações",
    "FIIs",
    "Criptomoedas",
    "CDB / LCI / LCA",
    "Tesouro Direto",
    "Previdência",
    "Poupança",
    "Outros",
]


def format_currency(value: float) -> str:
    """Formata um número como moeda brasileira: R$ 1.234,56"""
    abs_val = abs(value)
    formatted = f"{abs_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if value < 0:
        return f"- R$ {formatted}"
    return f"R$ {formatted}"


def month_name_from_num(month_num: int, year: int) -> str:
    """Retorna o nome completo do mês: ex. 'Janeiro 2026'"""
    return f"{MONTHS_PT[month_num - 1]} {year}"
