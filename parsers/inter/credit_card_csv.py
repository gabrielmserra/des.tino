"""Parser da fatura de cartão de crédito do Banco Inter em CSV — único
formato exportável pro cartão (diferente do extrato da conta corrente).

Formato observado (amostra real, 2026-08):

    "Data","Lançamento","Categoria","Tipo","Valor"
    "27/08/2026","SL MARECHAL","COMPRAS","Compra à vista","R$ 32,80"
    "12/08/2026","PAGTO DEBITO AUTOMATICO","OUTROS","Compra à vista","-R$ 50,00"

CSV com vírgula e campos entre aspas (ao contrário do extrato da conta
corrente, que usa ";"). A coluna "Categoria" é a categorização própria do
Inter — ignorada aqui em favor de guess_category (mesma lógica de
palavra-chave usada em todo o app). Linhas com valor negativo são o
pagamento automático da fatura em si (não uma compra) e são descartadas —
o app já tem seu próprio fluxo de "Pagar Fatura", importar essa linha
duplicaria o pagamento.
"""
import csv
import io
from datetime import datetime
from typing import List

from parsers.base import NormalizedRow, guess_category
from parsers.inter.common import clean_description, decode_bytes, parse_brl_amount, strip_accents


class InterCreditCardCsvParser:
    bank_id   = "inter"
    format_id = "credit_card_csv"

    def sniff(self, data: bytes, filename: str) -> bool:
        if not filename.lower().endswith(".csv"):
            return False
        text = decode_bytes(data[:4096])
        upper = strip_accents(text).upper()
        return "LANCAMENTO" in upper and "CATEGORIA" in upper and "VALOR" in upper and '","' in text[:200]

    def parse(self, data: bytes) -> List[NormalizedRow]:
        text = decode_bytes(data)
        reader = csv.reader(io.StringIO(text))
        rows_raw = [r for r in reader if r]
        if not rows_raw:
            return []

        header = [strip_accents(h).strip().upper() for h in rows_raw[0]]
        try:
            i_date = header.index("DATA")
            i_desc = header.index("LANCAMENTO")
            i_val  = header.index("VALOR")
        except ValueError:
            return []

        rows: List[NormalizedRow] = []
        for parts in rows_raw[1:]:
            if len(parts) <= max(i_date, i_desc, i_val):
                continue
            try:
                d = datetime.strptime(parts[i_date].strip(), "%d/%m/%Y").date()
            except ValueError:
                continue

            amount = parse_brl_amount(parts[i_val])
            if amount < 0:
                # Pagamento automático da fatura — não é uma compra, o app
                # já tem seu próprio fluxo de "Pagar Fatura" pra isso.
                continue

            desc = clean_description(parts[i_desc])
            rows.append(NormalizedRow(
                date=d,
                description=desc,
                amount=amount,
                direction="saida",
                suggested_category=guess_category(desc),
                suggested_payment_method="credito",
                is_credit_card_charge=True,
                raw=",".join(parts),
            ))
        return rows
