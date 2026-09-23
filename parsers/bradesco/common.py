"""Helpers compartilhados entre os parsers do Bradesco (CSV e PDF).

decode_bytes/strip_accents/parse_brl_amount/clean_description vêm de
parsers/base.py (genéricos, compartilhados com o Inter) — aqui só a
tabela de forma de pagamento, que é específica da redação do Bradesco
("Compra Elo Débito Vista" não bate com o "Compra no débito" do Inter)."""
from parsers.base import guess_payment_method_from_table

_METHOD_KEYWORDS = [
    (("PIX ENVIADO", "PIX RECEBIDO", "PIX QR CODE"), "pix"),
    (("COMPRA ELO DEBITO", "COMPRA DEBITO"), "debito"),
    (("PAGTO ELETRON", "COBRANCA", "BOLETO"), "boleto"),
    (("TED", "DOC", "TRANSFERENCIA"), "transferencia"),
]


def guess_payment_method(historico: str) -> str:
    return guess_payment_method_from_table(historico, _METHOD_KEYWORDS)
