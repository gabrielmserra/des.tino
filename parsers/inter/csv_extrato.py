"""Parser do extrato da conta corrente do Banco Inter em CSV.

Formato observado (amostra real, 2026-07): 4 linhas de metadado
("Extrato Conta Corrente", "Conta ;...", "Período ;...", "Saldo ;...") +
uma linha em branco, depois o cabeçalho real:

    Data Lançamento;Histórico;Descrição;Valor;Saldo

separado por ";", datas dd/mm/aaaa, valores em formato BR
(milhar "." decimal ",", sinal negativo = saída).
"""
from datetime import datetime
from typing import List

from parsers.base import NormalizedRow, guess_category, looks_like_investment
from parsers.inter.common import (
    clean_description, decode_bytes, guess_payment_method, parse_brl_amount, strip_accents,
)


class InterCsvExtratoParser:
    bank_id   = "inter"
    format_id = "csv_extrato"

    def sniff(self, data: bytes, filename: str) -> bool:
        if not filename.lower().endswith(".csv"):
            return False
        text = decode_bytes(data[:4096])
        upper = strip_accents(text).upper()
        return "EXTRATO CONTA CORRENTE" in upper or (
            "DATA LANCAMENTO" in upper and "HISTORICO" in upper
        )

    def parse(self, data: bytes) -> List[NormalizedRow]:
        text  = decode_bytes(data)
        lines = [ln for ln in text.splitlines() if ln.strip()]

        header_idx = None
        for i, ln in enumerate(lines):
            upper = strip_accents(ln).upper()
            if "DATA LANCAMENTO" in upper and "HISTORICO" in upper:
                header_idx = i
                break
        if header_idx is None:
            return []

        rows: List[NormalizedRow] = []
        for ln in lines[header_idx + 1:]:
            parts = ln.split(";")
            if len(parts) < 4:
                continue
            date_str, historico, descricao = parts[0].strip(), parts[1].strip(), parts[2].strip()
            valor_str = parts[3].strip()
            try:
                d = datetime.strptime(date_str, "%d/%m/%Y").date()
            except ValueError:
                continue
            amount = parse_brl_amount(valor_str)
            direction = "saida" if amount < 0 else "entrada"
            amount = abs(amount)

            desc = clean_description(descricao) or clean_description(historico)
            is_inv = looks_like_investment(historico)
            rows.append(NormalizedRow(
                date=d,
                description=desc,
                amount=amount,
                direction=direction,
                suggested_category="Investimentos" if is_inv else guess_category(desc),
                suggested_payment_method=guess_payment_method(historico),
                is_investment_like=is_inv,
                raw=ln,
            ))
        return rows
