"""Parser do extrato da conta corrente do Bradesco em CSV.

Formato observado (amostra real, 2026-09): UTF-8 com BOM, separado por
";", cabeçalho "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo
(R$)" — ao contrário do Inter, crédito e débito são colunas separadas
(sem coluna única com sinal). O arquivo tem metadado antes do
cabeçalho, uma segunda mini-tabela "Últimos Lancamentos" com seu
próprio cabeçalho, e uma linha de Total no fim — em vez de procurar um
índice de cabeçalho, cada linha tenta virar uma data válida; o que não
vira é ruído e é ignorado de graça (mesmo truque que filtra tudo isso
sem precisar de lógica ciente de seção). Único caso à parte: linhas
"COD. LANC. N" são marcador de saldo (sem movimentação real), não
entram como transação.
"""
from datetime import datetime
from typing import List

from parsers.base import (
    NormalizedRow, decode_bytes, guess_category, looks_like_investment,
    parse_brl_amount, strip_accents,
)
from parsers.bradesco.common import guess_payment_method


class BradescoCsvExtratoParser:
    bank_id   = "bradesco"
    format_id = "csv_extrato"

    def sniff(self, data: bytes, filename: str) -> bool:
        if not filename.lower().endswith(".csv"):
            return False
        text = decode_bytes(data[:4096])
        upper = strip_accents(text).upper()
        return (
            "HISTORICO" in upper and "DOCTO" in upper
            and ("CREDITO" in upper or "DEBITO" in upper)
        )

    def parse(self, data: bytes) -> List[NormalizedRow]:
        text  = decode_bytes(data)
        lines = [ln for ln in text.splitlines() if ln.strip()]

        rows: List[NormalizedRow] = []
        for ln in lines:
            parts = ln.split(";")
            if len(parts) < 6:
                continue
            date_str  = parts[0].strip()
            historico = parts[1].strip()
            try:
                d = datetime.strptime(date_str, "%d/%m/%Y").date()
            except ValueError:
                continue
            if strip_accents(historico).upper().startswith("COD. LANC."):
                continue

            credito = parts[3].strip()
            debito  = parts[4].strip()
            if credito and credito != "0,00":
                amount, direction = parse_brl_amount(credito), "entrada"
            elif debito and debito != "0,00":
                amount, direction = parse_brl_amount(debito), "saida"
            else:
                continue

            desc = historico
            is_inv = looks_like_investment(historico)
            rows.append(NormalizedRow(
                date=d,
                description=desc,
                amount=abs(amount),
                direction=direction,
                suggested_category="Investimentos" if is_inv else guess_category(desc),
                suggested_payment_method=guess_payment_method(historico),
                is_investment_like=is_inv,
                raw=ln,
            ))
        return rows
