"""Interface comum dos parsers de extrato/fatura bancária."""
from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional, Protocol


@dataclass
class NormalizedRow:
    """Uma linha normalizada, independente de banco/formato — o que a tela
    de revisão de importação mostra e o que vira um lançamento ao confirmar."""
    date:                    date
    description:             str
    amount:                  float          # sempre positivo; direction carrega o sinal
    direction:                str            # "entrada" | "saida"
    suggested_category:      str  = "Outros"
    suggested_payment_method: str = "outro"
    is_investment_like:      bool = False   # aporte/resgate — sugerido fora por padrão
    raw:                     str  = ""      # texto original da linha, p/ debug
    note:                    str  = ""


class BankParser(Protocol):
    bank_id: str
    format_id: str

    def sniff(self, data: bytes, filename: str) -> bool:
        """Retorna True se este parser reconhece o arquivo."""
        ...

    def parse(self, data: bytes) -> List[NormalizedRow]:
        """Lê o arquivo e retorna as linhas normalizadas."""
        ...


# Palavras-chave → categoria, aplicadas sobre a descrição em maiúsculas sem
# acento. Best-effort — o usuário sempre pode ajustar na tela de revisão.
_CATEGORY_KEYWORDS = [
    (("IFOOD", "RAPPI", "UBER EATS", "RESTAURANTE", "LANCHONETE", "PADARIA",
      "PANIFICADORA", "CAFE", "BAR ", "CHURRASCARIA", "PIZZARIA", "BURGER",
      "ACOUGUE", "MERCADO", "SUPERMERCADO", "HORTIFRUTI"), "Alimentação"),
    (("UBER", "99APP", "POSTO", "COMBUSTIVEL", "ESTACIONAMENTO", "PEDAGIO",
      "METRO", "ONIBUS", "PASSAGEM"), "Transporte"),
    (("FARMACIA", "DROGARIA", "HOSPITAL", "CLINICA", "LABORATORIO",
      "CONSULTA", "PLANO DE SAUDE", "UNIMED", "AMIL"), "Saúde"),
    (("NETFLIX", "SPOTIFY", "AMAZON PRIME", "DISNEY", "HBO", "YOUTUBE",
      "ASSINATURA", "MENSALIDADE"), "Assinaturas"),
    (("CINEMA", "INGRESSO", "TEATRO", "SHOW", "BALADA", "JOGO"), "Lazer"),
    (("ALUGUEL", "CONDOMINIO", "IPTU", "LUZ", "ENERGIA", "COPEL", "SABESP",
      "AGUA", "INTERNET", "TELEFONE", "CLARO", "VIVO", "TIM", "OI "), "Moradia"),
    (("FACULDADE", "ESCOLA", "CURSO", "UDEMY", "ALURA"), "Educação"),
    (("LOJA", "MAGAZINE", "SHOPPING", "VESTUARIO", "CALCADOS"), "Vestuário"),
    (("PET ", "VETERINAR", "PETSHOP"), "Pets"),
]

_INVESTMENT_KEYWORDS = ("TESOURO DIRETO", "APLICACAO", "APLICAÇÃO", "RESGATE",
                         "CDB", "LCI", "LCA", "FUNDO DE INVESTIMENTO")


def guess_category(description: str) -> str:
    upper = description.upper()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(k in upper for k in keywords):
            return category
    return "Outros"


def looks_like_investment(historico: str) -> bool:
    upper = historico.upper()
    return any(k in upper for k in _INVESTMENT_KEYWORDS)
