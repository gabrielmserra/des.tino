"""Interface comum dos parsers de extrato/fatura bancária."""
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional, Protocol


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


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
      "PADARIA", "PANIFIC", "CAFE", "CAFFE", "PANQUECA", "BAR ", "CHURRASCARIA", "PIZZARIA",
      "PIZZA", "BURGER", "BURGUER", "ACOUGUE", "MERCADO", "SUPERMERCADO",
      "HORTIFRUTI", "CULINARIA", "GASTRONOMIA", "DOCERIA", "SORVETERIA",
      "CONVENIENCIA", "EMPORIO", "BISTRO", "COZINHA", "BOTECO", "CERVEJARIA",
      "ADEGA", "TODESCHINI", "BLUMENAUENSE", "CASA LUCE", "GRSA VOLVO",
      "MASSAS", "ESPETINHOS", "ESPACO SOCCER", "ESFIHA", "ESFIRRA", "TEMAKI",
      "SUSHI", "YAKISOBA", "CHURRASCO", "GRELHADOS", "QUITANDA", "ROTISSERIE",
      "FOOD TRUCK", "FOODTRUCK", "ACAI", "ACAITERIA", "CROCERIA", "PARRILLA",
      "CANTINA", "TRATTORIA", "PIZZA HUT", "DOMINOS", "MC DONALD", "MCDONALD",
      "BURGER KING", "BOBS", "HABIBS", "SUBWAY", "GIRAFFAS", "SPOLETO",
      "CHINA IN BOX", "OUTBACK", "MADERO", "COCO BAMBU", "KFC", "POPEYES",
      "STARBUCKS", "CACAU SHOW", "KOPENHAGEN", "GELATERIA", "TAPIOCARIA",
      "CREPERIA", "HAMBURGUERIA", "PASTELARIA", "PASTEL", "COXINHA",
      "SALGADERIA", "CARREFOUR", "ATACADAO", "ASSAI", "EXTRA", "PAO DE ACUCAR",
      "DIA SUPERMERCADO", "ANGELONI", "GIASSI", "BISTEK", "KOCH", "CONDOR",
      "ZAFFARI", "MUFFATO", "FRIGORIFICO"), "Alimentação"),
    (("UBER", "99APP", "99POP", "POSTO", "COMBUSTIVEL", "GASOLINA", "ETANOL",
      "AUTO POSTO", "PETRO", "ESTACIONAMENTO", "PEDAGIO", "METRO", "ONIBUS",
      "PASSAGEM", "LOCADORA", "OFICINA", "AUTOPECAS", "BORRACHARIA",
      "MECANICA", "TRANSPORTE", "CABIFY", "INDRIVER", "IN DRIVER",
      "ALUGUEL DE CARRO", "LOCALIZA", "MOVIDA", "UNIDAS", "IPVA",
      "DESPACHANTE", "PNEU", "LAVA JATO", "LAVAJATO", "BILHETE UNICO",
      "SPTRANS", "CPTM", "VIA MOBILIDADE", "BRT", "RECARGA VEICULAR",
      "TROCA DE OLEO", "FUNILARIA"), "Transporte"),
    (("FARMACIA", "DROGARIA", "HOSPITAL", "CLINICA", "LABORATORIO",
      "CONSULTA", "PLANO DE SAUDE", "UNIMED", "AMIL", "ODONTO", "DENTISTA",
      "FISIOTERAPIA", "PSICOLOG", "ACADEMIA", "SMARTFIT", "PRONTO SOCORRO",
      "PRONTO ATENDIMENTO", "UPA ", "EXAME", "RAIO X", "TOMOGRAFIA",
      "ULTRASSOM", "HEMOGRAMA", "DASA", "FLEURY", "HAPVIDA", "NOTREDAME",
      "SULAMERICA", "PSIQUIATRA", "NUTRICIONISTA", "OFTALMO", "OTORRINO",
      "PEDIATRA", "GINECOLOG", "VACINA", "DROGASIL", "PAGUE MENOS",
      "PACHECO", "FARMACIA RAIA", "DROGARIA ONOFRE", "PANVEL", "CROSSFIT",
      "PILATES", "YOGA", "FISIO"), "Saúde"),
    (("NETFLIX", "SPOTIFY", "AMAZON PRIME", "DISNEY", "HBO", "YOUTUBE",
      "ASSINATURA", "MENSALIDADE", "ICLOUD", "GOOGLE ONE", "DEEZER",
      "PRIME VIDEO", "PARAMOUNT", "GLOBOPLAY", "APPLE MUSIC", "APPLE TV",
      "GAME PASS", "PLAYSTATION PLUS", "STEAM", "KINDLE UNLIMITED", "ADOBE",
      "CANVA", "CHATGPT", "OPENAI", "NOTION", "DROPBOX", "ONEDRIVE"), "Assinaturas"),
    (("CINEMA", "INGRESSO", "TEATRO", "SHOW", "BALADA", "JOGO", "GAMING",
      "APOSTA", "BET", "BOLICHE", "PARQUE", "CLUBE", "FESTA", "EVENTO",
      "RUINA", "SHOPPING", "KARTODROMO", "ESCAPE ROOM", "ZOOLOGICO",
      "MUSEU", "EXPOSICAO", "FESTIVAL", "CASA NOTURNA", "PUB ", "KARAOKE",
      "SINUCA", "BILHAR", "FLIPERAMA", "SYMPLA", "EVENTIM"), "Lazer"),
    (("ALUGUEL", "CONDOMINIO", "IPTU", "LUZ", "ENERGIA", "COPEL", "SABESP",
      "AGUA", "INTERNET", "TELEFONE", "CLARO", "VIVO", "TIM ", "OI ",
      "IMOBILIARIA", "REFORMA", "MATERIAL DE CONSTRUCAO", "PORTARIA",
      "SEGURO RESIDENCIAL", "ENCANADOR", "ELETRICISTA", "CHAVEIRO",
      "DEDETIZACAO", "GAS ENCANADO", "ULTRAGAZ", "COPAGAZ", "LIQUIGAS",
      "CEMIG", "ENEL", "CELESC", "CASAN", "CPFL"), "Moradia"),
    (("FACULDADE", "ESCOLA", "CURSO", "UDEMY", "ALURA", "COLEGIO",
      "UNIVERSIDADE", "LIVRARIA", "MATERIAL ESCOLAR", "APOSTILA", "SARAIVA",
      "KUMON", "WIZARD", "CCAA", "CNA ", "FISK", "COURSERA", "HOTMART"), "Educação"),
    (("LOJA", "MAGAZINE", "VESTUARIO", "CALCADOS", "BOUTIQUE",
      "MODA", "CONFECCOES", "RENNER", "RIACHUELO", "ZARA", "HERING",
      "MARISA", "CENTAURO", "NIKE", "ADIDAS", "DECATHLON", "MELISSA",
      "AREZZO", "TRACK FIELD", "SAPATARIA"), "Vestuário"),
    (("PET ", "VETERINAR", "PETSHOP", "PET SHOP", "RACAO", "BANHO E TOSA",
      "ADESTRAMENTO", "COBASI", "PETZ", "PETLOVE"), "Pets"),
    (("SALAO", "BARBEARIA", "ESTETICA", "MANICURE", "CABELEIREIRO",
      "COSMETICO", "PERFUMARIA", "SPA ", "DEPILACAO", "BRONZEAMENTO",
      "PODOLOGIA", "TATUAGEM", "PIERCING", "BOTICARIO", "NATURA",
      "EUDORA", "AVON", "MASSAGEM"), "Cuidados Pessoais"),
    (("HOTEL", "POUSADA", "HOSTEL", "AIRBNB", "CVC", "AGENCIA DE VIAGEM",
      "PASSAGEM AEREA", "AZUL", "GOL LINHAS", "LATAM", "DECOLAR",
      "123 MILHAS", "MAXMILHAS", "BOOKING", "TRIVAGO", "EXPEDIA",
      "SEGURO VIAGEM"), "Viagem"),
]

_INVESTMENT_KEYWORDS = ("TESOURO DIRETO", "APLICACAO", "APLICAÇÃO", "RESGATE",
                         "CDB", "LCI", "LCA", "FUNDO DE INVESTIMENTO")


def guess_category(description: str) -> str:
    upper = _strip_accents(description).upper()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(k in upper for k in keywords):
            return category
    return "Outros"


def looks_like_investment(historico: str) -> bool:
    upper = _strip_accents(historico).upper()
    return any(_strip_accents(k) in upper for k in _INVESTMENT_KEYWORDS)
