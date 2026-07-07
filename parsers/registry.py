"""Registro de parsers disponíveis — detecta qual usar por conteúdo/nome do arquivo."""
from typing import List, Optional

from parsers.base import BankParser
from parsers.inter.csv_extrato import InterCsvExtratoParser
from parsers.inter.ofx import InterOfxParser
from parsers.inter.pdf_extrato import InterPdfExtratoParser

PARSERS: List[BankParser] = [
    InterCsvExtratoParser(),
    InterOfxParser(),
    InterPdfExtratoParser(),
]


def detect_parser(data: bytes, filename: str) -> Optional[BankParser]:
    for parser in PARSERS:
        try:
            if parser.sniff(data, filename):
                return parser
        except Exception:
            continue
    return None
