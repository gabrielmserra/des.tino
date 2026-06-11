"""
Estratégias de sugestão para o planejamento mensal.

Isolado da UI e do banco de propósito: para trocar o método de cálculo
(ex: mediana, regressão, sazonalidade) basta substituir as funções aqui.
"""
from typing import Dict, List

# Pesos da média ponderada — índice 0 é o mês mais recente
WEIGHTS = [0.5, 0.3, 0.2]

# Teto recomendado de aporte em investimentos: 50% da renda do mês
INVESTMENT_CAP_PCT = 0.50


def suggest_allocations(
    history: List[Dict[str, float]],
    income_history: List[float] = None,
    target_income: float = 0.0,
) -> Dict[str, dict]:
    """Sugere alocação por categoria a partir do histórico.

    history:        gastos por categoria de cada mês anterior, do mais
                    recente ao mais antigo (usa no máximo len(WEIGHTS) meses).
    income_history: renda de cada um desses mesmos meses, na mesma ordem.
    target_income:  renda (real ou estimada) do mês sendo planejado.

    Método: quando há renda no histórico e `target_income` > 0, a sugestão
    é proporcional — calcula o PERCENTUAL da renda gasto em cada categoria
    nos meses anteriores (média ponderada 0.5/0.3/0.2, ou simples com 1-2
    meses) e aplica esse percentual à renda do mês planejado. Sem renda
    conhecida, cai para a média dos valores absolutos.

    Limites aplicados quando `target_income` > 0:
    - "Investimentos" é limitado a 50% da renda (flag "capped"=True);
    - a soma das sugestões nunca passa da renda — se passar, todas as
      categorias são reduzidas proporcionalmente (o dinheiro que entra
      é o máximo distribuível).

    Categoria presente em apenas 1 dos meses (havendo 2+) é marcada como
    "eventual": a ponderação já reduz o valor sugerido e o badge dá
    visibilidade para o usuário decidir manter, ajustar ou remover.

    Retorna {categoria: {"amount": float, "eventual": bool, "capped": bool}}.
    """
    history        = history[: len(WEIGHTS)]
    income_history = list(income_history or [])[: len(WEIGHTS)]
    n = len(history)
    if n == 0:
        return {}

    use_pct = target_income > 0 and any(v > 0 for v in income_history)

    cats: set = set()
    for month in history:
        cats.update(month.keys())

    result: Dict[str, dict] = {}
    for cat in sorted(cats):
        values  = [float(month.get(cat, 0.0) or 0.0) for month in history]
        present = sum(1 for v in values if v > 0)

        if use_pct:
            # Percentual da renda nos meses com renda conhecida
            pairs = [(v, float(inc)) for v, inc in zip(values, income_history) if inc and inc > 0]
            if pairs:
                shares = [v / inc for v, inc in pairs]
                m = len(shares)
                if m >= 3:
                    share = sum(w * s for w, s in zip(WEIGHTS, shares))
                else:
                    share = sum(shares) / m
                amount = share * target_income
            else:
                amount = sum(values) / n
        else:
            if n >= 3:
                amount = sum(w * v for w, v in zip(WEIGHTS, values))
            else:
                amount = sum(values) / n

        if amount <= 0:
            continue
        result[cat] = {
            "amount":   round(amount, 2),
            "eventual": n >= 2 and present == 1,
            "capped":   False,
        }

    if target_income > 0 and result:
        # Teto de investimentos: 50% da renda
        inv = result.get("Investimentos")
        cap = round(INVESTMENT_CAP_PCT * target_income, 2)
        if inv and inv["amount"] > cap:
            inv["amount"] = cap
            inv["capped"] = True

        # A renda é o máximo distribuível: reduz tudo proporcionalmente
        total = sum(r["amount"] for r in result.values())
        if total > target_income:
            factor = target_income / total
            for r in result.values():
                r["amount"] = round(r["amount"] * factor, 2)

    return result


def estimate_income(income_history: List[float]) -> float:
    """Estima a renda do mês aplicando a mesma ponderação às entradas passadas."""
    income_history = [v for v in income_history[: len(WEIGHTS)]]
    n = len(income_history)
    if n == 0:
        return 0.0
    if n >= 3:
        return round(sum(w * v for w, v in zip(WEIGHTS, income_history)), 2)
    return round(sum(income_history) / n, 2)
