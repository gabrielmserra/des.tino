"""Parser do extrato da conta corrente do Banco Inter em PDF.

Formato observado (amostra real, 2026-07): agrupado por dia
("7 de Junho de 2026 Saldo do dia: R$ 1.368,99"), cada lançamento no
formato 'Tipo: "detalhe" ±R$ valor R$ saldo'. A extração de texto do
Inter remove acentos ("débito" vira "debito") e alguns lançamentos
quebram em mais de uma linha antes do valor — por isso a reconstrução
é feita acumulando linhas até achar o padrão de valor no fim.
"""
import io
import re
from datetime import date as _date
from typing import List

from parsers.base import NormalizedRow, guess_category, looks_like_investment
from parsers.inter.common import clean_description, guess_payment_method, parse_brl_amount, strip_accents

_MONTHS_NO_ACCENT = [
    "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

_DAY_RE          = re.compile(r"^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\b")
_START_RE        = re.compile(r'^([A-Za-zÀ-ÿ ]+?):\s*"(.*)$')
_AMOUNT_TAIL_RE  = re.compile(r"(-?R\$\s?[\d.,]+)\s+-?R\$\s?[\d.,]+\s*$")
_NOISE_PREFIXES  = ("Fale com a gente", "SAC:", "Solicitado em", "Ouvidoria")


class InterPdfExtratoParser:
    bank_id   = "inter"
    format_id = "pdf_extrato"

    def sniff(self, data: bytes, filename: str) -> bool:
        if not filename.lower().endswith(".pdf"):
            return False
        try:
            text = _extract_text(data, max_pages=1)
        except Exception:
            return False
        upper = strip_accents(text).upper()
        return "BANCO INTER" in upper and "SALDO DO DIA" in upper

    def parse(self, data: bytes) -> List[NormalizedRow]:
        return parse_text(_extract_text(data))


def parse_text(text: str) -> List[NormalizedRow]:
    """Núcleo do parser, separado de parse() pra poder ser testado sem um
    PDF de verdade (recebendo diretamente o texto já extraído)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    rows: List[NormalizedRow] = []
    current_date = None
    buffer: List[str] = []
    tipo = None

    def flush():
        nonlocal buffer, tipo
        if not tipo or not buffer or current_date is None:
            buffer, tipo = [], None
            return
        full = " ".join(buffer)
        m = _AMOUNT_TAIL_RE.search(full)
        if not m:
            buffer, tipo = [], None
            return
        valor_str = m.group(1)
        detail    = full[:m.start()].strip().rstrip('"').strip()
        amount    = parse_brl_amount(valor_str)
        direction = "saida" if amount < 0 else "entrada"
        amount    = abs(amount)
        desc      = clean_description(detail)
        is_inv    = looks_like_investment(tipo)
        rows.append(NormalizedRow(
            date=current_date,
            description=desc or tipo,
            amount=amount,
            direction=direction,
            suggested_category="Investimentos" if is_inv else guess_category(desc),
            suggested_payment_method=guess_payment_method(tipo),
            is_investment_like=is_inv,
            raw=full,
        ))
        buffer, tipo = [], None

    for ln in lines:
        if ln.startswith(_NOISE_PREFIXES):
            buffer, tipo = [], None
            continue

        day_m = _DAY_RE.match(ln)
        if day_m:
            flush()
            current_date = _parse_day_header(day_m)
            continue

        start_m = _START_RE.match(ln)
        if start_m:
            flush()
            tipo   = start_m.group(1).strip()
            buffer = [start_m.group(2)]
            if _AMOUNT_TAIL_RE.search(ln):
                flush()
            continue

        if tipo is not None:
            buffer.append(ln)
            if _AMOUNT_TAIL_RE.search(ln):
                flush()

    flush()
    return rows


def _parse_day_header(m) -> _date:
    day        = int(m.group(1))
    month_name = strip_accents(m.group(2)).lower()
    year       = int(m.group(3))
    month      = _MONTHS_NO_ACCENT.index(month_name) + 1
    return _date(year, month, day)


def _extract_text(data: bytes, max_pages: int = None) -> str:
    import pdfplumber
    parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = pdf.pages[:max_pages] if max_pages else pdf.pages
        for page in pages:
            parts.append(page.extract_text() or "")
    return "\n".join(parts)
