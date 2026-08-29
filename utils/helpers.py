"""
Funções utilitárias reutilizáveis.
"""
import calendar

APP_NAME    = "des.tino"
APP_VERSION = "4.0.4"

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
    "Investimentos",
    "Outros",
]

# Categorias do planejamento mensal — mesma lista (já inclui Investimentos)
PLAN_CATEGORIES = CATEGORIES

TRANSACTION_TYPES = {
    "entrada_fixa":     "Entradas Fixas",
    "entrada_variavel": "Entradas Variáveis",
    "saida_fixa":       "Saídas Fixas",
    "saida_variavel":   "Saídas Variáveis",
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

PAYMENT_METHODS = {
    "dinheiro":     "Dinheiro",
    "pix":          "Pix",
    "debito":       "Débito",
    "credito":      "Crédito",
    "vr_va":        "VR/VA",
    "boleto":       "Boleto",
    "transferencia": "Transferência",
    "outro":        "Outro",
}


def apply_app_icon(dialog) -> None:
    """Aplica o ícone do app em qualquer CTkToplevel."""
    import sys, os
    def _set():
        try:
            if getattr(sys, "frozen", False):
                path = os.path.join(sys._MEIPASS, "assets", "app.ico")
            else:
                path = os.path.join(os.path.dirname(__file__), "..", "assets", "app.ico")
            path = os.path.abspath(path)
            dialog.iconbitmap(path)
        except Exception:
            pass
    # CTkToplevel sobrescreve o ícone durante o __init__ — esperar 200ms garante que o
    # nosso ícone seja aplicado por último.
    dialog.after(200, _set)


def format_currency(value: float) -> str:
    """Formata um número como moeda brasileira: R$ 1.234,56"""
    abs_val = abs(value)
    formatted = f"{abs_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if value < 0:
        return f"- R$ {formatted}"
    return f"R$ {formatted}"


DEFAULT_IMPORT_CUTOFF_DAY = 1


def billing_month(year: int, month: int, day: int, cutoff_day: int = DEFAULT_IMPORT_CUTOFF_DAY) -> tuple:
    """Lançamentos a partir do dia de corte (configurável pelo usuário nas
    Configurações) contam pro mês seguinte na importação de extrato —
    alinhado com a data em que o usuário recebe o salário. Dia de corte 1
    (padrão) significa "sem deslocamento": o mês calendário já é o próprio
    mês de cobrança. Se o dia de corte for maior que o número de dias do
    mês (ex: 31 num mês de 30 dias), usa o último dia do mês."""
    if cutoff_day <= 1:
        return year, month
    days_in_month = calendar.monthrange(year, month)[1]
    effective_cutoff = min(cutoff_day, days_in_month)
    if day >= effective_cutoff:
        month += 1
        if month > 12:
            month = 1
            year += 1
    return year, month


def month_name_from_num(month_num: int, year: int) -> str:
    """Retorna o nome completo do mês: ex. 'Janeiro 2026'"""
    return f"{MONTHS_PT[month_num - 1]} {year}"


def format_date_br(d) -> str:
    """Formata uma date/datetime como dd/mm/aaaa."""
    return d.strftime("%d/%m/%Y")
