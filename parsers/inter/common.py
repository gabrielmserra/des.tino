"""Helpers compartilhados entre os parsers do Banco Inter (todos os formatos)."""
import re
import unicodedata


def decode_bytes(data: bytes) -> str:
    """Tenta decodificar o arquivo do Inter em várias codificações comuns —
    o Inter já foi visto exportando tanto UTF-8 quanto Latin-1/cp1252."""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1", errors="replace")


def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def parse_brl_amount(raw: str) -> float:
    """Converte "-1.234,56" ou "1234.56" em float. Sinal decide entrada/saída
    fora daqui — este helper sempre retorna o valor absoluto."""
    s = raw.strip().replace("R$", "").strip()
    negative = s.startswith("-")
    s = s.lstrip("+-").strip()
    s = s.replace(".", "").replace(",", ".")
    try:
        val = float(s)
    except ValueError:
        val = 0.0
    return -val if negative else val


# "Histórico" do Inter (sem acento, maiúsculo) → forma de pagamento sugerida.
# "Pagamento efetuado" no extrato do Inter é o débito automático da fatura do
# cartão (ou outro pagamento agendado) — mapeado como transferência.
_METHOD_KEYWORDS = [
    (("PIX ENVIADO", "PIX RECEBIDO"), "pix"),
    (("COMPRA NO DEBITO",), "debito"),
    (("PAGAMENTO DE BOLETO", "BOLETO"), "boleto"),
    (("PAGAMENTO EFETUADO", "TED", "DOC", "TRANSFERENCIA"), "transferencia"),
]


def guess_payment_method(historico: str) -> str:
    upper = strip_accents(historico).upper()
    for keywords, method in _METHOD_KEYWORDS:
        if any(k in upper for k in keywords):
            return method
    return "outro"


_WS_RE = re.compile(r"\s+")


def clean_description(text: str) -> str:
    return _WS_RE.sub(" ", text).strip()
