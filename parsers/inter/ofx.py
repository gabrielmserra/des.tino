"""Parser de extrato bancário em OFX (padrão SGML/XML usado por bancos
brasileiros). Ainda não validado contra uma amostra real do Inter — segue
o padrão OFX 1.x (tags <STMTTRN>/<TRNTYPE>/<DTPOSTED>/<TRNAMT>/<MEMO>),
comum à maioria dos bancos. Ajustar se o formato real do Inter divergir.
"""
import re
from datetime import datetime
from typing import List

from parsers.base import NormalizedRow, guess_category, looks_like_investment
from parsers.inter.common import clean_description, decode_bytes, guess_payment_method, parse_brl_amount

_TRN_RE = re.compile(r"<STMTTRN>(.*?)</STMTTRN>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<(\w+)>([^<\r\n]*)")


def _parse_ofx_date(raw: str):
    # OFX: YYYYMMDD[HHMMSS][.xxx][[tz]]
    digits = raw.strip()[:8]
    return datetime.strptime(digits, "%Y%m%d").date()


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
            amount = parse_brl_amount(trnamt.replace(",", "."))
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
                suggested_category="Investimentos" if is_inv else guess_category(desc),
                suggested_payment_method=guess_payment_method(memo),
                is_investment_like=is_inv,
                raw=block.strip(),
            ))
        return rows
