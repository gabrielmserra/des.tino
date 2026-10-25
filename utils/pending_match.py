"""Baixa automática na importação (Fase 4 do calendário): acha a pendência
do Calendário (conta fixa, dívida, meta, fatura) que uma linha de saída do
extrato provavelmente está pagando. Só SUGERE — quem decide é o usuário, no
checkbox da tela de revisão. Réplica exata de web/src/lib/pendingMatch.ts."""
import difflib
import re
import unicodedata
from datetime import date
from typing import List, Optional

NAME_MIN_RATIO = 0.7
AMOUNT_TOLERANCE = 0.2
DATE_WINDOW_DAYS = 5


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn").lower().strip()


def _event_name(label: str) -> str:
    """Nome da pendência sem o sufixo que o Calendário acrescenta
    ("Nubank (fatura)" → "nubank")."""
    return _normalize(re.sub(r"\s*\((fatura|fatura em aberto)\)\s*$", "", label, flags=re.I))


def _bill_match_ratio(a: str, b: str) -> float:
    """Réplica de textSimilarity.ts:billMatchRatio — maior trecho contínuo
    em comum dividido pelo tamanho do texto mais curto."""
    if not a or not b:
        return 0.0
    m = difflib.SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b))
    return m.size / min(len(a), len(b))


def is_matchable(e: dict) -> bool:
    return (not e["is_income"] and e["ref_table"] != "plan_income_items"
            and e["source"] != "card_invoice_open")


def event_matches_line(e: dict, description: str, amount: float, line_date: date) -> bool:
    if not is_matchable(e):
        return False
    name = _event_name(e["label"])
    if len(name) < 3:
        return False
    if _bill_match_ratio(name, _normalize(description)) < NAME_MIN_RATIO:
        return False
    expected = float(e["amount"])
    if expected <= 0 or abs(amount - expected) > expected * AMOUNT_TOLERANCE:
        return False
    # Pendência vencida aparece em "hoje" no Calendário (a data real se
    # perde), então aceita qualquer data do extrato; pendente exige a data
    # perto do vencimento.
    if e["status"] == "overdue":
        return True
    ev_date = date.fromisoformat(str(e["event_date"])[:10])
    return abs((line_date - ev_date).days) <= DATE_WINDOW_DAYS


def match_pending_to_lines(events: List[dict], lines: List[dict]) -> List[Optional[dict]]:
    """lines: [{"description", "amount", "date" (date), "is_expense"}]. Casa
    cada linha com no máximo uma pendência e cada pendência com no máximo
    uma linha (a primeira que bater, na ordem das linhas)."""
    used = set()
    result: List[Optional[dict]] = []
    for line in lines:
        hit = None
        if line["is_expense"]:
            for e in events:
                key = (e["ref_table"], e["ref_id"])
                if key not in used and event_matches_line(
                        e, line["description"], line["amount"], line["date"]):
                    hit = e
                    used.add(key)
                    break
        result.append(hit)
    return result
