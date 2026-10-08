"""
Comparação entre a carteira de investimentos (real ou fictícia) e a
alocação-alvo por classe de ativo, com diagnóstico em texto no mesmo
estilo/tom do Guru Financeiro (ui/dashboard.py:_build_tips).

Isolado da UI e do banco de propósito, mesmo espírito de
utils/plan_strategy.py. Nunca escreve em transactions nem em
investment_movements -- só lê e calcula.
"""
from typing import Dict, List, Optional

from utils.asset_classes import ASSET_CLASSES, ASSET_CLASS_LABELS, NAO_CLASSIFICADO
from utils.helpers import format_currency

# Acima desse percentual do total da carteira num único investimento,
# entra o alerta de concentração.
CONCENTRATION_THRESHOLD_PCT = 0.25

# Reserva de liquidez abaixo disso (em meses de gasto) entra o alerta
# de reserva de emergência insuficiente -- mesmo "6 meses" usado como
# referência no restante do app, mas aplicado especificamente à classe
# reserva_liquidez (mais preciso que a heurística do Dashboard, que usa
# o patrimônio investido total como proxy).
EMERGENCY_FUND_MONTHS_TARGET = 6
EMERGENCY_FUND_MONTHS_MIN = 3


def _investment_balances(investments: List[dict], movements: List[dict]) -> Dict[int, float]:
    """{investment_id: saldo} -- aporte_inicial+aporte-saque, mesma
    lógica de ui/investments.py:_calc_balance / investmentBalance.ts,
    reimplementada aqui pra não acoplar utils/ à camada de UI."""
    by_id: Dict[int, float] = {inv["id"]: 0.0 for inv in investments}
    for m in movements:
        inv_id = m.get("investment_id")
        if inv_id not in by_id:
            continue
        amt = float(m.get("amount") or 0)
        by_id[inv_id] += -amt if m.get("movement_type") == "saque" else amt
    return by_id


def aggregate_by_class(investments: List[dict], movements: List[dict]) -> Dict[str, float]:
    """Soma o saldo de cada investimento (ignora saldo <= 0, já
    totalmente resgatado) agrupado por asset_class -- None vira
    "nao_classificado", linha própria na comparação."""
    balances = _investment_balances(investments, movements)
    result: Dict[str, float] = {}
    for inv in investments:
        balance = balances.get(inv["id"], 0.0)
        if balance <= 0:
            continue
        cls = inv.get("asset_class") or NAO_CLASSIFICADO
        result[cls] = result.get(cls, 0.0) + balance
    return result


def aggregate_mock_by_class(items: List[dict]) -> Dict[str, float]:
    """Mesma agregação, pra itens de carteira fictícia
    ({asset_class, value})."""
    result: Dict[str, float] = {}
    for it in items:
        cls = it.get("asset_class") or NAO_CLASSIFICADO
        value = float(it.get("value") or 0)
        if value <= 0:
            continue
        result[cls] = result.get(cls, 0.0) + value
    return result


def compare_allocation(
    actual_by_class: Dict[str, float],
    target_by_class: Dict[str, dict],
) -> List[dict]:
    """target_by_class: {asset_class: {"target_pct", "tolerance_pct"}}.

    Retorna uma linha por classe (ordem de ASSET_CLASSES, com
    "nao_classificado" no fim se houver saldo): valor atual, % atual,
    % alvo, tolerância, desvio, status ('dentro'|'acima'|'abaixo') e
    suggested_move_value -- **só informativo**, nunca executa nada.
    Convenção de sinal: positivo = sugestão de mover dinheiro PRA essa
    classe; negativo = mover DESSA classe pras outras.
    """
    total = sum(actual_by_class.values())

    classes_seen = set(actual_by_class.keys()) | set(target_by_class.keys())
    ordered = [c for c in ASSET_CLASSES if c in classes_seen]
    if NAO_CLASSIFICADO in classes_seen:
        ordered.append(NAO_CLASSIFICADO)

    rows: List[dict] = []
    for cls in ordered:
        actual_value = actual_by_class.get(cls, 0.0)
        actual_pct = (actual_value / total) if total > 0 else 0.0
        t = target_by_class.get(cls, {"target_pct": 0.0, "tolerance_pct": 0.0})
        target_pct = float(t.get("target_pct") or 0.0)
        tolerance_pct = float(t.get("tolerance_pct") or 0.0)
        deviation_pct = actual_pct - target_pct

        if deviation_pct > tolerance_pct:
            status = "acima"
        elif deviation_pct < -tolerance_pct:
            status = "abaixo"
        else:
            status = "dentro"

        rows.append({
            "asset_class":          cls,
            "actual_value":         round(actual_value, 2),
            "actual_pct":           round(actual_pct, 4),
            "target_pct":           round(target_pct, 4),
            "tolerance_pct":        round(tolerance_pct, 4),
            "deviation_pct":        round(deviation_pct, 4),
            "status":               status,
            "suggested_move_value": round(-deviation_pct * total, 2) if total > 0 else 0.0,
        })
    return rows


def diagnose(
    comparisons: List[dict],
    investments: List[dict],
    movements: List[dict],
    monthly_expenses: float = 0.0,
) -> List[tuple]:
    """Gera dicas (icon, title, body, tone) no mesmo estilo/tom do Guru
    Financeiro -- tone: 'red'|'gold'|'green'|'blue'. Prioridade:
    alertas → neutros → positivos, no máximo 5 (tela dedicada, não o
    top-3 do Dashboard)."""
    alerts: List[tuple] = []
    neutral: List[tuple] = []
    positive: List[tuple] = []

    total = sum(c["actual_value"] for c in comparisons)

    # 1. Desvios fora da faixa de tolerância, por classe
    for c in comparisons:
        if c["status"] == "dentro":
            continue
        label = ASSET_CLASS_LABELS.get(c["asset_class"], "Não classificado")
        pct_atual = c["actual_pct"] * 100
        pct_alvo  = c["target_pct"] * 100
        pct_desv  = abs(c["deviation_pct"]) * 100
        valor_mover = format_currency(abs(c["suggested_move_value"]))
        if c["status"] == "acima":
            alerts.append((
                "⚠️", f"{label} acima da meta",
                f"{label} está em {pct_atual:.0f}% da carteira, {pct_desv:.0f} "
                f"pontos acima da meta de {pct_alvo:.0f}%. Considere mover "
                f"cerca de {valor_mover} para outras classes.",
                "gold",
            ))
        else:
            neutral.append((
                "💡", f"{label} abaixo da meta",
                f"{label} está em {pct_atual:.0f}% da carteira, {pct_desv:.0f} "
                f"pontos abaixo da meta de {pct_alvo:.0f}%. Considere "
                f"direcionar cerca de {valor_mover} pra essa classe nos "
                f"próximos aportes.",
                "blue",
            ))

    # 2. Concentração: um único investimento com peso excessivo
    if total > 0:
        balances = _investment_balances(investments, movements)
        for inv in investments:
            bal = balances.get(inv["id"], 0.0)
            if bal <= 0:
                continue
            share = bal / total
            if share > CONCENTRATION_THRESHOLD_PCT:
                alerts.append((
                    "⚠️", "Concentração em um único ativo",
                    f'"{inv["name"]}" representa {share * 100:.0f}% da sua '
                    f"carteira. Concentração alta num único ativo aumenta o "
                    f"risco -- considere diversificar.",
                    "red",
                ))

    # 3. Reserva de emergência (classe reserva_liquidez vs meses de gasto)
    if monthly_expenses > 0:
        reserva = next(
            (c["actual_value"] for c in comparisons if c["asset_class"] == "reserva_liquidez"),
            0.0,
        )
        months_covered = reserva / monthly_expenses
        if months_covered < EMERGENCY_FUND_MONTHS_MIN:
            alerts.append((
                "⚠️", "Reserva de emergência baixa",
                f"Sua reserva de liquidez cobre {months_covered:.1f} meses de "
                f"gastos. O ideal é ter de {EMERGENCY_FUND_MONTHS_MIN} a "
                f"{EMERGENCY_FUND_MONTHS_TARGET} meses guardados antes de "
                f"priorizar outras classes.",
                "red",
            ))
        elif months_covered < EMERGENCY_FUND_MONTHS_TARGET:
            neutral.append((
                "💡", "Reserva de emergência incompleta",
                f"Você já tem {months_covered:.1f} meses de gastos reservados. "
                f"Faltam cerca de "
                f"{format_currency(max(0.0, (EMERGENCY_FUND_MONTHS_TARGET - months_covered) * monthly_expenses))} "
                f"para completar {EMERGENCY_FUND_MONTHS_TARGET} meses de segurança.",
                "blue",
            ))

    if not alerts and not neutral:
        positive.append((
            "✅", "Carteira alinhada ao seu perfil",
            "Todas as classes de ativo estão dentro da faixa-alvo do seu "
            "perfil. Continue assim.",
            "green",
        ))

    return (alerts + neutral + positive)[:5]
