"""Helpers compartilhados entre os parsers do Banco Inter (todos os formatos).

decode_bytes/strip_accents/parse_brl_amount/clean_description foram
promovidos pra parsers/base.py (são genéricos, usados pelo Bradesco
também) — reexportados aqui pra não precisar tocar nos imports que já
existiam nos parsers do Inter."""
from parsers.base import (  # noqa: F401 (reexport)
    clean_description,
    decode_bytes,
    guess_payment_method_from_table,
    parse_brl_amount,
    strip_accents,
)

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
    return guess_payment_method_from_table(historico, _METHOD_KEYWORDS)
