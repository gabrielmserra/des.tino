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
    _inv_net_cache.pop(month_id, None)
    _bill_cache.pop(month_id, None)


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


def rename_month(month_id: int, new_name: str, new_year: int, new_month: int) -> None:
    client  = get_client()
    user_id = client.auth.get_user().user.id
    existing = client.table("months").select("id").eq("name", new_name).eq("user_id", user_id).execute()
    if existing.data and existing.data[0]["id"] != month_id:
        raise ValueError(f'"{new_name}" já existe.')
    client.table("months").update({
        "name": new_name, "year": new_year, "month": new_month,
    }).eq("id", month_id).execute()


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
    is_expectation: bool = False,
) -> None:
    client  = get_client()
    user_id = client.auth.get_user().user.id
    row = {
        "month_id":       month_id,
        "user_id":        user_id,
        "type":           tx_type,
        "description":    description,
        "amount":         amount,
        "category":       category,
        "is_expectation": is_expectation,
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
    is_expectation: Optional[bool] = None,
) -> None:
    update = {
        "description": description,
        "amount":      amount,
        "category":    category,
        "card_id":     card_id,
    }
    if is_expectation is not None:
        update["is_expectation"] = is_expectation
    get_client().table("transactions").update(update).eq("id", transaction_id).execute()
    _invalidate(month_id)


def delete_transaction(transaction_id: int, month_id: int) -> None:
    get_client().table("transactions").delete().eq("id", transaction_id).execute()
    _invalidate(month_id)


def confirm_expectation(transaction_id: int, month_id: int,
                        description: str, amount: float) -> None:
    """Confirma uma transação prevista: atualiza valor/descrição e marca como real."""
    get_client().table("transactions").update({
        "is_expectation": False,
        "description":    description,
        "amount":         amount,
    }).eq("id", transaction_id).execute()
    _invalidate(month_id)


def get_total_investments() -> float:
    """Soma líquida de todas as movimentações de investimento do usuário (aportes − saques)."""
    client  = get_client()
    user_id = client.auth.get_user().user.id
    resp = client.table("investment_movements") \
        .select("movement_type,amount") \
        .eq("user_id", user_id) \
        .execute()
    total = 0.0
    for r in (resp.data or []):
        amt = float(r["amount"] or 0)
        if r["movement_type"] == "saque":
            total -= amt
        else:
            total += amt
    return total


def get_month_summary(month_id: int) -> Dict[str, float]:
    rows = get_transactions(month_id)

    real: Dict[str, float] = {
        "entrada_fixa": 0.0, "entrada_variavel": 0.0,
        "saida_fixa":   0.0, "saida_variavel":   0.0,
    }
    proj_extra: Dict[str, float] = {
        "entrada_fixa": 0.0, "entrada_variavel": 0.0,
        "saida_fixa":   0.0, "saida_variavel":   0.0,
    }
    n_expectations = 0
    for row in rows:
        t   = row["type"]
        amt = float(row["amount"] or 0)
        if t not in real:
            continue
        # Compras no cartão não afetam o saldo — só debitam quando a fatura é paga
        if row.get("card_id") and t == "saida_variavel":
            continue
        if row.get("is_expectation"):
            proj_extra[t] += amt
            n_expectations += 1
        else:
            real[t] += amt

    # Pagamentos de fatura são saídas reais do mês em que foram registrados
    bill_total = sum(float(p["amount"]) for p in get_card_payments(month_id))

    total_entradas      = real["entrada_fixa"] + real["entrada_variavel"]
    total_saidas        = real["saida_fixa"]   + real["saida_variavel"] + bill_total
    total_investimentos = get_month_investment_net(month_id)
    saldo = total_entradas - total_saidas - total_investimentos

    proj_entradas   = total_entradas + proj_extra["entrada_fixa"] + proj_extra["entrada_variavel"]
    proj_saidas     = total_saidas   + proj_extra["saida_fixa"]   + proj_extra["saida_variavel"]
    saldo_projetado = proj_entradas - proj_saidas - total_investimentos

    return {
        **real,
        "total_entradas":      total_entradas,
        "total_saidas":        total_saidas,
        "total_investimentos": total_investimentos,
        "saldo":               saldo,
        "saldo_projetado":     saldo_projetado,
        "n_expectations":      float(n_expectations),
        "has_expectations":    n_expectations > 0,
    }


def copy_transactions_to_month(from_month_id: int, to_month_id: int) -> int:
    """Copia gastos pós-fechamento de cartão do mês anterior para o novo mês."""
    from datetime import date as _date
    client  = get_client()
    user_id = client.auth.get_user().user.id

    # Mapeamento card_id → closing_day para filtrar pelo ciclo correto
    cards        = get_cards()
    card_closing = {c["id"]: c.get("closing_day", 1) for c in cards}

    rows    = get_transactions(from_month_id)
    to_copy = []
    for r in rows:
        if r["type"] == "saida_variavel" and r.get("card_id") and not r.get("is_expectation"):
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
        if row["type"] in ("saida_fixa", "saida_variavel") and not row.get("is_expectation"):
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


def update_goal(goal_id: int, name: str, target_amount: float) -> None:
    get_client().table("goals").update({
        "name": name, "target_amount": target_amount,
    }).eq("id", goal_id).execute()


def delete_goal(goal_id: int) -> None:
    get_client().table("goals").delete().eq("id", goal_id).execute()


# ---------------------------------------------------------------------------
# Cartões de Crédito
# ---------------------------------------------------------------------------

_card_tx_cache: Dict[str, list] = {}  # key: "{card_id}_{month_id}"
_inv_net_cache: Dict[int, float] = {}  # key: month_id → net investment do mês
_bill_cache:    Dict[int, list]  = {}  # key: month_id → credit_card_payments


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


def get_card_payments(month_id: int) -> List[dict]:
    """Retorna os pagamentos de fatura registrados no mês."""
    if month_id not in _bill_cache:
        resp = get_client().table("credit_card_payments") \
            .select("*") \
            .eq("month_id", month_id) \
            .execute()
        _bill_cache[month_id] = resp.data or []
    return list(_bill_cache[month_id])


def pay_card_bill(card_id: int, month_id: int, amount: float, note: str = "") -> None:
    """Registra o pagamento de uma fatura de cartão."""
    client  = get_client()
    user_id = client.auth.get_user().user.id
    client.table("credit_card_payments").insert({
        "card_id":  card_id,
        "month_id": month_id,
        "amount":   amount,
        "note":     note or None,
        "user_id":  user_id,
    }).execute()
    _bill_cache.pop(month_id, None)


def clear_cache() -> None:
    """Limpa todo o cache (chamado no logout)."""
    _tx_cache.clear()
    _card_tx_cache.clear()
    _inv_net_cache.clear()
    _bill_cache.clear()
    _plan_cache.clear()
    _plan_items_cache.clear()


# ---------------------------------------------------------------------------
# Investimentos
# ---------------------------------------------------------------------------

def get_month_investment_net(month_id: int) -> float:
    """Retorna o valor líquido de investimentos do mês (aportes − saques). Usa cache."""
    if month_id not in _inv_net_cache:
        resp = get_client().table("investment_movements") \
            .select("movement_type,amount") \
            .eq("month_id", month_id) \
            .execute()
        total = 0.0
        for r in (resp.data or []):
            amt = float(r["amount"] or 0)
            if r["movement_type"] == "saque":
                total -= amt
            else:
                total += amt
        _inv_net_cache[month_id] = total
    return _inv_net_cache[month_id]


def get_investments(include_archived: bool = False) -> List[dict]:
    """Retorna todos os investimentos do usuário. Por padrão exclui arquivados."""
    query = get_client().table("investments") \
        .select("*") \
        .order("created_at", desc=False)
    if not include_archived:
        query = query.is_("archived_at", "null")
    return query.execute().data or []


def create_investment(
    name: str,
    category: str,
    month_id: int,
    amount: float,
    note: str = "",
) -> dict:
    """Cria a entidade de investimento e registra o aporte inicial."""
    client  = get_client()
    user_id = client.auth.get_user().user.id

    inv_resp = client.table("investments").insert({
        "user_id":  user_id,
        "name":     name,
        "category": category,
    }).execute()
    if not inv_resp.data:
        raise RuntimeError("Falha ao criar investimento.")
    inv = inv_resp.data[0]

    client.table("investment_movements").insert({
        "investment_id": inv["id"],
        "user_id":       user_id,
        "month_id":      month_id,
        "movement_type": "aporte_inicial",
        "amount":        amount,
        "note":          note or None,
    }).execute()
    _inv_net_cache.pop(month_id, None)
    return inv


def get_investment_movements(investment_id: int) -> List[dict]:
    """Retorna todas as movimentações de um investimento, mais recente primeiro."""
    resp = get_client().table("investment_movements") \
        .select("*") \
        .eq("investment_id", investment_id) \
        .order("created_at", desc=True) \
        .execute()
    return resp.data or []


def add_movement(
    investment_id: int,
    month_id: int,
    movement_type: str,
    amount: float,
    note: str = "",
) -> None:
    """Adiciona um aporte ou saque a um investimento existente."""
    client  = get_client()
    user_id = client.auth.get_user().user.id
    client.table("investment_movements").insert({
        "investment_id": investment_id,
        "user_id":       user_id,
        "month_id":      month_id,
        "movement_type": movement_type,
        "amount":        amount,
        "note":          note or None,
    }).execute()
    _inv_net_cache.pop(month_id, None)


def update_investment(investment_id: int, name: str, category: str) -> None:
    get_client().table("investments").update({
        "name": name, "category": category,
    }).eq("id", investment_id).execute()


def update_movement(movement_id: int, amount: float, note: str) -> None:
    get_client().table("investment_movements").update({
        "amount": amount, "note": note or None,
    }).eq("id", movement_id).execute()
    _inv_net_cache.clear()


def delete_movement(movement_id: int) -> None:
    get_client().table("investment_movements").delete().eq("id", movement_id).execute()
    _inv_net_cache.clear()


def archive_investment(investment_id: int) -> None:
    """Arquiva o investimento (some da lista mas mantém saldo nos totais)."""
    from datetime import datetime, timezone
    get_client().table("investments").update({
        "archived_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", investment_id).execute()


def delete_investment(investment_id: int) -> None:
    """Exclui permanentemente o investimento e todas as suas movimentações."""
    client = get_client()
    client.table("investment_movements").delete().eq("investment_id", investment_id).execute()
    client.table("investments").delete().eq("id", investment_id).execute()
    _inv_net_cache.clear()


def get_all_investment_movements() -> List[dict]:
    """Retorna todas as movimentações do usuário (para cálculo de saldos em lote)."""
    client  = get_client()
    user_id = client.auth.get_user().user.id
    resp = client.table("investment_movements") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return resp.data or []


# ---------------------------------------------------------------------------
# Planejamento Mensal
# ---------------------------------------------------------------------------

_plan_cache:       Dict[int, Optional[dict]] = {}  # month_id → plano (ou None)
_plan_items_cache: Dict[int, List[dict]]     = {}  # plan_id  → itens


def get_plan(month_id: int) -> Optional[dict]:
    """Retorna o plano do mês, ou None se ainda não existir."""
    if month_id not in _plan_cache:
        resp = get_client().table("monthly_plans") \
            .select("*") \
            .eq("month_id", month_id) \
            .execute()
        _plan_cache[month_id] = resp.data[0] if resp.data else None
    return _plan_cache[month_id]


def get_plan_items(plan_id: int) -> List[dict]:
    """Retorna os itens (alocações por categoria) de um plano."""
    if plan_id not in _plan_items_cache:
        resp = get_client().table("monthly_plan_items") \
            .select("*") \
            .eq("plan_id", plan_id) \
            .order("planned_amount", desc=True) \
            .execute()
        _plan_items_cache[plan_id] = resp.data or []
    return list(_plan_items_cache[plan_id])


def save_plan(month_id: int, income: float, items: List[dict]) -> dict:
    """Cria ou atualiza o plano do mês e substitui seus itens.

    Nunca duplica: se o plano já existe (constraint unique month_id),
    edita o existente. Ao criar um plano novo, fecha automaticamente
    planos `ativo` de meses anteriores.

    items: [{"category", "planned_amount", "suggested_amount", "is_eventual"}]
    """
    from datetime import datetime, timezone
    client  = get_client()
    user_id = client.auth.get_user().user.id
    now_iso = datetime.now(timezone.utc).isoformat()

    _plan_cache.pop(month_id, None)
    plan   = get_plan(month_id)
    is_new = plan is None

    if is_new:
        try:
            resp = client.table("monthly_plans").insert({
                "month_id": month_id, "user_id": user_id, "income": income,
            }).execute()
            plan = resp.data[0]
        except Exception:
            # Plano criado em paralelo (unique month_id) → edita o existente
            _plan_cache.pop(month_id, None)
            plan = get_plan(month_id)
            if plan is None:
                raise
            is_new = False

    if not is_new:
        client.table("monthly_plans").update({
            "income": income, "updated_at": now_iso,
        }).eq("id", plan["id"]).execute()
        client.table("monthly_plan_items").delete().eq("plan_id", plan["id"]).execute()
    else:
        _close_previous_plans(month_id)

    rows = [{
        "plan_id":          plan["id"],
        "user_id":          user_id,
        "category":         it["category"],
        "planned_amount":   float(it.get("planned_amount") or 0),
        "suggested_amount": it.get("suggested_amount"),
        "is_eventual":      bool(it.get("is_eventual")),
    } for it in items]
    if rows:
        client.table("monthly_plan_items").insert(rows).execute()

    _plan_cache.pop(month_id, None)
    _plan_items_cache.pop(plan["id"], None)
    return plan


def _close_previous_plans(month_id: int) -> None:
    """Fecha planos `ativo` de meses anteriores ao mês dado."""
    months  = get_months()
    current = next((m for m in months if m["id"] == month_id), None)
    if current is None:
        return
    key       = (current["year"], current["month"])
    prior_ids = [m["id"] for m in months if (m["year"], m["month"]) < key]
    if not prior_ids:
        return
    get_client().table("monthly_plans") \
        .update({"status": "fechado"}) \
        .eq("status", "ativo") \
        .in_("month_id", prior_ids) \
        .execute()
    for mid in prior_ids:
        _plan_cache.pop(mid, None)


def get_plan_history(month_id: int, n: int = 3) -> tuple:
    """Histórico para a sugestão do plano: até n meses anteriores ao mês dado.

    Retorna (gastos, rendas), ambos do mês mais recente ao mais antigo:
      gastos: [{categoria: total}, ...]
      rendas: [total_entradas, ...]  (apenas entradas confirmadas)
    """
    months  = get_months()  # já vem ordenado do mais recente ao mais antigo
    current = next((m for m in months if m["id"] == month_id), None)
    if current is None:
        return [], []
    key   = (current["year"], current["month"])
    prior = [m for m in months if (m["year"], m["month"]) < key][:n]

    expenses, incomes = [], []
    for m in prior:
        cat_totals = {r["category"]: float(r["total"]) for r in get_expenses_by_category(m["id"])}
        inv_net = get_month_investment_net(m["id"])
        if inv_net > 0:
            cat_totals["Investimentos"] = inv_net
        expenses.append(cat_totals)
        incomes.append(get_month_income(m["id"]))
    return expenses, incomes


def get_plan_realized(month_id: int) -> Dict[str, float]:
    """Realizado por categoria para o plano: gastos + aportes líquidos do mês."""
    realized = {r["category"]: float(r["total"]) for r in get_expenses_by_category(month_id)}
    inv_net = get_month_investment_net(month_id)
    if inv_net > 0:
        realized["Investimentos"] = inv_net
    return realized


def get_month_income(month_id: int, include_expectations: bool = False) -> float:
    """Soma das entradas do mês (fixas + variáveis)."""
    total = 0.0
    for r in get_transactions(month_id):
        if r["type"] not in ("entrada_fixa", "entrada_variavel"):
            continue
        if r.get("is_expectation") and not include_expectations:
            continue
        total += float(r["amount"] or 0)
    return total


def export_month_csv(month_id: int) -> str:
    _LABELS = {
        "entrada_fixa":     "Entrada Fixa",
        "entrada_variavel": "Entrada Variável",
        "saida_fixa":       "Saída Fixa",
        "saida_variavel":   "Saída Variável",
        "investimento":     "Investimento",
    }
    rows  = get_transactions(month_id)
    lines = ["Tipo,Descrição,Categoria,Valor,Data,Previsto"]
    for r in rows:
        tipo  = _LABELS.get(r["type"], r["type"])
        desc  = str(r["description"]).replace(",", ";")
        cat   = str(r["category"] or "Outros").replace(",", ";")
        valor = f"{float(r['amount']):.2f}".replace(".", ",")
        data  = str(r["created_at"] or "")[:10]
        prev  = "Sim" if r.get("is_expectation") else "Não"
        lines.append(f"{tipo},{desc},{cat},{valor},{data},{prev}")
    return "\n".join(lines)
