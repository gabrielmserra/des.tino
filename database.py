"""
Módulo de dados — todas as operações via Supabase (PostgreSQL na nuvem).
Cada usuário vê apenas os próprios dados via Row Level Security (RLS).
"""

from typing import Optional, List, Dict
from config import get_client

# Cache em memória: evita re-buscar transações do mesmo mês a cada ação
_tx_cache: Dict[int, List[dict]] = {}


def _invalidate(month_id: int) -> None:
    _tx_cache.pop(month_id, None)


def is_cached(month_id: int) -> bool:
    return month_id in _tx_cache


def init_db() -> None:
    get_client()


# ---------------------------------------------------------------------------
# Operações de Meses
# ---------------------------------------------------------------------------

def get_months() -> List[dict]:
    """Retorna os meses do usuário logado, do mais recente ao mais antigo."""
    resp = get_client().table("months") \
        .select("*") \
        .order("year", desc=True) \
        .order("month", desc=True) \
        .execute()
    return resp.data or []


def create_month(name: str, year: int, month: int) -> Optional[dict]:
    """Cria um novo mês para o usuário logado (ignora se já existir)."""
    client  = get_client()
    user_id = client.auth.get_user().user.id

    existing = client.table("months").select("*").eq("name", name).execute()
    if existing.data:
        return existing.data[0]

    resp = client.table("months").insert({
        "name": name, "year": year, "month": month, "user_id": user_id,
    }).execute()
    return resp.data[0] if resp.data else None


def get_month_by_name(name: str) -> Optional[dict]:
    resp = get_client().table("months").select("*").eq("name", name).execute()
    return resp.data[0] if resp.data else None


def delete_month(month_id: int) -> None:
    get_client().table("months").delete().eq("id", month_id).execute()


# ---------------------------------------------------------------------------
# Operações de Transações
# ---------------------------------------------------------------------------

def get_transactions(month_id: int, tx_type: Optional[str] = None) -> List[dict]:
    if month_id not in _tx_cache:
        resp = get_client().table("transactions") \
            .select("*") \
            .eq("month_id", month_id) \
            .order("id", desc=True) \
            .execute()
        _tx_cache[month_id] = resp.data or []
    txs = _tx_cache[month_id]
    if tx_type:
        return [t for t in txs if t["type"] == tx_type]
    return list(txs)


def add_transaction(
    month_id: int,
    tx_type: str,
    description: str,
    amount: float,
    category: str = "Outros",
    card_id: Optional[int] = None,
) -> None:
    client  = get_client()
    user_id = client.auth.get_user().user.id
    row = {
        "month_id":    month_id,
        "user_id":     user_id,
        "type":        tx_type,
        "description": description,
        "amount":      amount,
        "category":    category,
    }
    if card_id is not None:
        row["card_id"] = card_id
    client.table("transactions").insert(row).execute()
    _invalidate(month_id)


def update_transaction(
    transaction_id: int,
    month_id: int,
    description: str,
    amount: float,
    category: str,
    card_id: Optional[int] = None,
) -> None:
    get_client().table("transactions").update({
        "description": description,
        "amount":      amount,
        "category":    category,
        "card_id":     card_id,
    }).eq("id", transaction_id).execute()
    _invalidate(month_id)


def delete_transaction(transaction_id: int, month_id: int) -> None:
    get_client().table("transactions").delete().eq("id", transaction_id).execute()
    _invalidate(month_id)


def get_month_summary(month_id: int) -> Dict[str, float]:
    rows = get_transactions(month_id)

    summary: Dict[str, float] = {
        "entrada_fixa":     0.0,
        "entrada_variavel": 0.0,
        "saida_fixa":       0.0,
        "saida_variavel":   0.0,
        "investimento":     0.0,
    }
    for row in rows:
        t = row["type"]
        if t in summary:
            summary[t] += float(row["amount"] or 0)

    total_entradas      = summary["entrada_fixa"] + summary["entrada_variavel"]
    total_saidas        = summary["saida_fixa"]   + summary["saida_variavel"]
    total_investimentos = summary["investimento"]
    saldo = total_entradas - total_saidas - total_investimentos

    return {
        **summary,
        "total_entradas":      total_entradas,
        "total_saidas":        total_saidas,
        "total_investimentos": total_investimentos,
        "saldo":               saldo,
    }


def copy_transactions_to_month(from_month_id: int, to_month_id: int) -> int:
    """Copia investimentos e gastos pós-fechamento de cartão para o novo mês."""
    from datetime import date as _date
    client  = get_client()
    user_id = client.auth.get_user().user.id

    # Mapeamento card_id → closing_day para filtrar pelo ciclo correto
    cards        = get_cards()
    card_closing = {c["id"]: c.get("closing_day", 1) for c in cards}

    rows    = get_transactions(from_month_id)
    to_copy = []
    for r in rows:
        if r["type"] == "investimento":
            to_copy.append(r)
        elif r["type"] == "saida_variavel" and r.get("card_id"):
            # Só copia se foi adicionado APÓS o fechamento (pertence ao próximo ciclo)
            card_id  = r["card_id"]
            closing  = card_closing.get(card_id, 1)
            raw_date = str(r.get("created_at") or "")[:10]
            try:
                tx_day = _date.fromisoformat(raw_date).day
                if tx_day > closing:
                    to_copy.append(r)
            except ValueError:
                pass  # data inválida → não copia

    for r in to_copy:
        row = {
            "month_id":    to_month_id,
            "user_id":     user_id,
            "type":        r["type"],
            "description": r["description"],
            "amount":      float(r["amount"]),
            "category":    r["category"] or "Outros",
        }
        if r.get("card_id"):
            row["card_id"] = r["card_id"]
        client.table("transactions").insert(row).execute()

    _invalidate(to_month_id)
    return len(to_copy)


def get_expenses_by_category(month_id: int) -> List[dict]:
    rows   = get_transactions(month_id)
    totals: Dict[str, float] = {}
    for row in rows:
        if row["type"] in ("saida_fixa", "saida_variavel"):
            cat = row["category"] or "Outros"
            totals[cat] = totals.get(cat, 0.0) + float(row["amount"] or 0)
    result = [{"category": c, "total": t} for c, t in totals.items()]
    result.sort(key=lambda x: x["total"], reverse=True)
    return result


def get_investments_by_category(month_id: int) -> List[dict]:
    rows   = get_transactions(month_id)
    totals: Dict[str, float] = {}
    for row in rows:
        if row["type"] == "investimento":
            cat = row["category"] or "Outros"
            totals[cat] = totals.get(cat, 0.0) + float(row["amount"] or 0)
    result = [{"category": c, "total": t} for c, t in totals.items()]
    result.sort(key=lambda x: x["total"], reverse=True)
    return result


# ---------------------------------------------------------------------------
# Operações de Metas
# ---------------------------------------------------------------------------

def get_goals() -> List[dict]:
    resp = get_client().table("goals").select("*").order("created_at", desc=False).execute()
    return resp.data or []


def create_goal(name: str, target_amount: float) -> Optional[dict]:
    client  = get_client()
    user_id = client.auth.get_user().user.id
    resp = client.table("goals").insert({
        "name": name, "target_amount": target_amount,
        "saved_amount": 0, "user_id": user_id,
    }).execute()
    return resp.data[0] if resp.data else None


def add_goal_contribution(goal_id: int, amount: float) -> None:
    resp = get_client().table("goals").select("saved_amount").eq("id", goal_id).execute()
    if resp.data:
        current = float(resp.data[0]["saved_amount"] or 0)
        get_client().table("goals").update(
            {"saved_amount": max(0.0, current + amount)}
        ).eq("id", goal_id).execute()


def delete_goal(goal_id: int) -> None:
    get_client().table("goals").delete().eq("id", goal_id).execute()


# ---------------------------------------------------------------------------
# Cartões de Crédito
# ---------------------------------------------------------------------------

_card_tx_cache: Dict[str, list] = {}  # key: "{card_id}_{month_id}"


def get_cards() -> List[dict]:
    resp = get_client().table("credit_cards").select("*").order("created_at").execute()
    return resp.data or []


def create_card(name: str, limit: float, due_day: int, closing_day: int, color: str) -> Optional[dict]:
    client  = get_client()
    user_id = client.auth.get_user().user.id
    resp = client.table("credit_cards").insert({
        "name": name, "limit": limit, "due_day": due_day,
        "closing_day": closing_day, "color": color, "user_id": user_id,
    }).execute()
    return resp.data[0] if resp.data else None


def update_card(card_id: int, name: str, limit: float, due_day: int, closing_day: int, color: str) -> None:
    get_client().table("credit_cards").update({
        "name": name, "limit": limit, "due_day": due_day,
        "closing_day": closing_day, "color": color,
    }).eq("id", card_id).execute()


def delete_card(card_id: int) -> None:
    get_client().table("credit_cards").delete().eq("id", card_id).execute()
    # Limpa cache de transações deste cartão
    keys = [k for k in _card_tx_cache if k.startswith(f"{card_id}_")]
    for k in keys:
        _card_tx_cache.pop(k, None)


def get_card_transactions(card_id: int, month_id: int) -> List[dict]:
    key = f"{card_id}_{month_id}"
    if key not in _card_tx_cache:
        resp = get_client().table("card_transactions") \
            .select("*") \
            .eq("card_id", card_id) \
            .eq("month_id", month_id) \
            .order("id", desc=True) \
            .execute()
        _card_tx_cache[key] = resp.data or []
    return list(_card_tx_cache[key])


def add_card_transaction(card_id: int, month_id: int, description: str, amount: float) -> None:
    client  = get_client()
    user_id = client.auth.get_user().user.id
    client.table("card_transactions").insert({
        "card_id": card_id, "month_id": month_id,
        "description": description, "amount": amount, "user_id": user_id,
    }).execute()
    _card_tx_cache.pop(f"{card_id}_{month_id}", None)


def delete_card_transaction(tx_id: int, card_id: int, month_id: int) -> None:
    get_client().table("card_transactions").delete().eq("id", tx_id).execute()
    _card_tx_cache.pop(f"{card_id}_{month_id}", None)


def clear_cache() -> None:
    """Limpa todo o cache (chamado no logout)."""
    _tx_cache.clear()
    _card_tx_cache.clear()


def export_month_csv(month_id: int) -> str:
    _LABELS = {
        "entrada_fixa":     "Entrada Fixa",
        "entrada_variavel": "Entrada Variável",
        "saida_fixa":       "Saída Fixa",
        "saida_variavel":   "Saída Variável",
        "investimento":     "Investimento",
    }
    rows  = get_transactions(month_id)
    lines = ["Tipo,Descrição,Categoria,Valor,Data"]
    for r in rows:
        tipo  = _LABELS.get(r["type"], r["type"])
        desc  = str(r["description"]).replace(",", ";")
        cat   = str(r["category"] or "Outros").replace(",", ";")
        valor = f"{float(r['amount']):.2f}".replace(".", ",")
        data  = str(r["created_at"] or "")[:10]
        lines.append(f"{tipo},{desc},{cat},{valor},{data}")
    return "\n".join(lines)
