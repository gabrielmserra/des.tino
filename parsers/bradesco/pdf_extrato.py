"""Parser do extrato da conta corrente do Bradesco em PDF.

Formato observado (amostra real, 2026-09): cada lançamento normal vira
um bloco de 3 linhas, em ordem fixa, na extração de texto do
pdfplumber:

    PIX RECEBIDO                              <- rótulo do tipo, sozinho
    09/09/2026 1715281 23,70 9.796,56          <- [data opcional] docto valor saldo
    REM: FULANO DA SILVA 07/09                 <- detalhe (REM:/DES: ou nome do estabelecimento)

A data só aparece na primeira transação de cada dia (linhas seguintes
do mesmo dia omitem). Nenhuma posição de coluna sobrevive à extração de
texto — não dá pra saber se um valor era crédito ou débito pela
posição; a direção é inferida do prefixo da linha de detalhe (REM: =
entrada, DES: = saída) com fallback nas palavras do rótulo do tipo
(RECEBIDO/ENVIADO/COMPRA/PAGTO). Linhas "COD. LANC. N" são marcador de
saldo, vêm inteiras numa linha só (sem bloco de 3 linhas) — são
puladas.
"""
import io
import re
from datetime import datetime
from typing import List, Optional

from parsers.base import (
    NormalizedRow, clean_description, guess_category, looks_like_investment,
    parse_brl_amount, strip_accents,
)
from parsers.bradesco.common import guess_payment_method

_NOISE_PREFIXES = ("Bradesco Celular", "Data:", "Nome:", "Extrato de:", "Data Historico")
_TOTAL_RE       = re.compile(r"^Total\s+[\d.,]+")
_COD_LANC_RE    = re.compile(r"^(?:(\d{2}/\d{2}/\d{4})\s+)?COD\.?\s*LANC\.?", re.IGNORECASE)
_AMOUNT_LINE_RE = re.compile(r"^(?:(\d{2}/\d{2}/\d{4})\s+)?(\S+)\s+([\d.,]+)\s+([\d.,]+)\s*$")
_KNOWN_TYPE_LABELS = (
    "PIX RECEBIDO", "PIX ENVIADO", "PIX QR CODE",
    "COMPRA ELO DEBITO", "PAGTO ELETRON", "TED", "DOC", "TRANSFERENCIA",
)


class BradescoPdfExtratoParser:
    bank_id   = "bradesco"
    format_id = "pdf_extrato"

    def sniff(self, data: bytes, filename: str) -> bool:
        if not filename.lower().endswith(".pdf"):
            return False
        try:
            text = _extract_text(data, max_pages=1)
        except Exception:
            return False
        return "BRADESCO" in strip_accents(text).upper()

    def parse(self, data: bytes) -> List[NormalizedRow]:
        return parse_text(_extract_text(data))


def _is_noise(ln: str) -> bool:
    upper = strip_accents(ln).upper()
    if ln.startswith(_NOISE_PREFIXES):
        return True
    if upper.startswith("DATA HISTORICO"):
        return True
    if _TOTAL_RE.match(ln):
        return True
    return False


def _is_known_type_label(ln: str) -> bool:
    upper = strip_accents(ln).upper()
    return any(upper.startswith(t) for t in _KNOWN_TYPE_LABELS)


def parse_text(text: str) -> List[NormalizedRow]:
    """Núcleo do parser, separado de _extract_text() pra poder ser testado
    sem um PDF de verdade (recebendo diretamente o texto já extraído)."""
    raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    lines = [ln for ln in raw_lines if not _is_noise(ln)]

    rows: List[NormalizedRow] = []
    current_date: Optional[datetime] = None
    tipo_buffer: List[str] = []

    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]

        cod_m = _COD_LANC_RE.match(ln)
        if cod_m:
            if cod_m.group(1):
                current_date = _parse_date(cod_m.group(1))
            tipo_buffer = []
            i += 1
            continue

        amt_m = _AMOUNT_LINE_RE.match(ln)
        if amt_m:
            if amt_m.group(1):
                current_date = _parse_date(amt_m.group(1))
            tipo = clean_description(" ".join(tipo_buffer))
            tipo_buffer = []
            i += 1

            detail = ""
            if i < n:
                nxt = lines[i]
                if not _AMOUNT_LINE_RE.match(nxt) and not _COD_LANC_RE.match(nxt) \
                        and not _is_known_type_label(nxt):
                    detail = nxt
                    i += 1

            if tipo and current_date is not None:
                amount = parse_brl_amount(amt_m.group(3))
                direction = _infer_direction(tipo, detail)
                desc = clean_description(detail) or tipo
                is_inv = looks_like_investment(f"{tipo} {detail}")
                rows.append(NormalizedRow(
                    date=current_date,
                    description=desc,
                    amount=abs(amount),
                    direction=direction,
                    suggested_category="Investimentos" if is_inv else guess_category(desc),
                    suggested_payment_method=guess_payment_method(f"{tipo} {detail}"),
                    is_investment_like=is_inv,
                    raw=f"{tipo} | {ln} | {detail}".strip(" |"),
                ))
            continue

        tipo_buffer.append(ln)
        i += 1

    return rows


def _infer_direction(tipo: str, detail: str) -> str:
    detail_upper = strip_accents(detail).upper()
    if detail_upper.startswith("REM:"):
        return "entrada"
    if detail_upper.startswith("DES:"):
        return "saida"
    tipo_upper = strip_accents(tipo).upper()
    if "RECEBIDO" in tipo_upper:
        return "entrada"
    return "saida"


def _parse_date(date_str: str):
    return datetime.strptime(date_str, "%d/%m/%Y").date()


def _extract_text(data: bytes, max_pages: int = None) -> str:
    import pdfplumber
    parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = pdf.pages[:max_pages] if max_pages else pdf.pages
        for page in pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)
