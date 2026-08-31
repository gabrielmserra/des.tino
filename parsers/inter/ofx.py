"""Parser de extrato bancário em OFX (padrão SGML/XML usado por bancos
brasileiros). Ainda não validado contra uma amostra real do Inter — segue
o padrão OFX 1.x (tags <STMTTRN>/<TRNTYPE>/<DTPOSTED>/<TRNAMT>/<MEMO>),
comum à maioria dos bancos. Ajustar se o formato real do Inter divergir.
"""
import re
from datetime import datetime
from typing import List

from parsers.base import NormalizedRow, guess_category, looks_like_investment
from parsers.inter.common import clean_description, decode_bytes, guess_payment_method

_TRN_RE = re.compile(r"<STMTTRN>(.*?)</STMTTRN>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<(\w+)>([^<\r\n]*)")


def _parse_ofx_date(raw: str):
    # OFX: YYYYMMDD[HHMMSS][.xxx][[tz]]
    digits = raw.strip()[:8]
    return datetime.strptime(digits, "%Y%m%d").date()


def _parse_ofx_time(raw: str):
    # HHMMSS logo após os 8 dígitos da data, quando o banco inclui a hora.
    hhmmss = raw.strip()[8:14]
    if len(hhmmss) != 6 or not hhmmss.isdigit():
        return None
    try:
        return datetime.strptime(hhmmss, "%H%M%S").time()
    except ValueError:
        return None


class InterOfxParser:
    bank_id   = "inter"
    format_id = "ofx"

    def sniff(self, data: bytes, filename: str) -> bool:
        if filename.lower().endswith(".ofx"):
            return True
        head = decode_bytes(data[:512]).upper()
        return "OFXHEADER" in head or "<OFX>" in head

    def parse(self, data: bytes) -> List[NormalizedRow]:
        text = decode_bytes(data)
        rows: List[NormalizedRow] = []
        for block in _TRN_RE.findall(text):
            fields = {m.group(1).upper(): m.group(2).strip() for m in _TAG_RE.finditer(block)}
            dtposted = fields.get("DTPOSTED")
            trnamt   = fields.get("TRNAMT")
            if not dtposted or not trnamt:
                continue
            try:
                d = _parse_ofx_date(dtposted)
            except ValueError:
                continue
            # TRNAMT do OFX já vem em formato numérico padrão (ponto decimal,
            # ex: "-48.33") — NÃO é formato BR ("48,33"), então não passa por
            # parse_brl_amount (que assume ponto = separador de milhar e
            # apagaria o decimal de verdade, virando 48.33 em 4833.0).
            try:
                amount = float(trnamt.replace(",", "."))
            except ValueError:
                amount = 0.0
            direction = "saida" if amount < 0 else "entrada"
            amount = abs(amount)

            memo = fields.get("MEMO") or fields.get("NAME") or fields.get("TRNTYPE") or ""
            desc = clean_description(memo)
            is_inv = looks_like_investment(memo)
            rows.append(NormalizedRow(
                date=d,
                description=desc or "Lançamento importado",
                amount=amount,
                direction=direction,
                time=_parse_ofx_time(dtposted),
                suggested_category="Investimentos" if is_inv else guess_category(desc),
                suggested_payment_method=guess_payment_method(memo),
                is_investment_like=is_inv,
                raw=block.strip(),
            ))
        return rows
