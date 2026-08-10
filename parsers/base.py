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
# Pix/TED pra pessoa física (só o nome, sem palavra-chave de estabelecimento)
# nunca vai ser categorizado automaticamente — não tem como saber o motivo
# só pela descrição, fica "Outros" mesmo e o usuário ajusta na revisão.
_CATEGORY_KEYWORDS = [
    (("IFOOD", "RAPPI", "UBER EATS", "RESTAURANTE", "LANCHONETE", "LANCHON",
      "PADARIA", "PANIFIC", "CAFE", "BAR ", "CHURRASCARIA", "PIZZARIA",
      "PIZZA", "BURGER", "BURGUER", "ACOUGUE", "MERCADO", "SUPERMERCADO",
      "HORTIFRUTI", "CULINARIA", "GASTRONOMIA", "DOCERIA", "SORVETERIA",
      "CONVENIENCIA", "EMPORIO", "BISTRO", "COZINHA", "BOTECO", "CERVEJARIA",
      "ADEGA", "TODESCHINI", "BLUMENAUENSE", "CASA LUCE"), "Alimentação"),
    (("UBER", "99APP", "99POP", "POSTO", "COMBUSTIVEL", "GASOLINA", "ETANOL",
      "AUTO POSTO", "PETRO", "ESTACIONAMENTO", "PEDAGIO", "METRO", "ONIBUS",
      "PASSAGEM", "LOCADORA", "OFICINA", "AUTOPECAS", "BORRACHARIA",
      "MECANICA", "TRANSPORTE"), "Transporte"),
    (("FARMACIA", "DROGARIA", "HOSPITAL", "CLINICA", "LABORATORIO",
      "CONSULTA", "PLANO DE SAUDE", "UNIMED", "AMIL", "ODONTO", "DENTISTA",
      "FISIOTERAPIA", "PSICOLOG", "ACADEMIA", "SMARTFIT"), "Saúde"),
    (("NETFLIX", "SPOTIFY", "AMAZON PRIME", "DISNEY", "HBO", "YOUTUBE",
      "ASSINATURA", "MENSALIDADE", "ICLOUD", "GOOGLE ONE", "DEEZER"), "Assinaturas"),
    (("CINEMA", "INGRESSO", "TEATRO", "SHOW", "BALADA", "JOGO", "GAMING",
      "APOSTA", "BET", "BOLICHE", "PARQUE", "CLUBE", "FESTA", "EVENTO"), "Lazer"),
    (("ALUGUEL", "CONDOMINIO", "IPTU", "LUZ", "ENERGIA", "COPEL", "SABESP",
      "AGUA", "INTERNET", "TELEFONE", "CLARO", "VIVO", "TIM ", "OI ",
      "IMOBILIARIA", "REFORMA", "MATERIAL DE CONSTRUCAO"), "Moradia"),
    (("FACULDADE", "ESCOLA", "CURSO", "UDEMY", "ALURA", "COLEGIO",
      "UNIVERSIDADE", "LIVRARIA"), "Educação"),
    (("LOJA", "MAGAZINE", "SHOPPING", "VESTUARIO", "CALCADOS", "BOUTIQUE",
      "MODA", "CONFECCOES"), "Vestuário"),
    (("PET ", "VETERINAR", "PETSHOP", "PET SHOP"), "Pets"),
    (("SALAO", "BARBEARIA", "ESTETICA", "MANICURE", "CABELEIREIRO",
      "COSMETICO", "PERFUMARIA"), "Cuidados Pessoais"),
    (("HOTEL", "POUSADA", "HOSTEL", "AIRBNB", "CVC", "AGENCIA DE VIAGEM",
      "PASSAGEM AEREA", "AZUL", "GOL LINHAS", "LATAM", "DECOLAR"), "Viagem"),
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
