"""Geração do Relatório Financeiro Completo (PDF) — resumo do período,
evolução de saldo, gastos por categoria/forma de pagamento, gastos diários,
maiores gastos e a lista completa de lançamentos."""
from __future__ import annotations

import io
from datetime import datetime as _dt
from typing import Dict, List

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
)

import database as db
from utils.helpers import (
    EXPENSE_TYPES, INCOME_TYPES, PAYMENT_METHODS, format_currency,
)

GREEN = colors.HexColor("#1F8A5B")
RED = colors.HexColor("#C0392B")
HEADER_BG = colors.HexColor("#1F2937")
ACCENT = colors.HexColor("#2E7D5B")
MUTED = colors.HexColor("#6B7280")
ROW_ALT = colors.HexColor("#F3F4F6")

_TYPE_LABELS = {
    "entrada_fixa": "Entrada Fixa",
    "entrada_variavel": "Entrada Variável",
    "saida_fixa": "Saída Fixa",
    "saida_variavel": "Saída Variável",
}


def _is_real_expense(row: dict) -> bool:
    """Mesma regra de get_month_summary: ignora previstos, compras no
    cartão ainda não pagas e gastos cobertos por VR/VA."""
    if row["type"] not in EXPENSE_TYPES:
        return False
    if row.get("is_expectation"):
        return False
    if row.get("card_id"):
        return False
    if row.get("benefit_id"):
        return False
    return True


def _row_date(row: dict):
    raw = row.get("payment_date") or row.get("created_at")
    if not raw:
        return None
    try:
        return _dt.fromisoformat(str(raw)[:19]).date()
    except ValueError:
        return None


def _fig_to_image(fig, width_cm: float) -> Image:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    w = width_cm * cm
    h = w * (fig.get_figheight() / fig.get_figwidth())
    return Image(buf, width=w, height=h)


def _line_chart(labels: List[str], values: List[float], color: str, ylabel: str,
                 show_markers: bool = True) -> Image:
    fig, ax = plt.subplots(figsize=(7.2, 2.6))
    marker = "o" if show_markers else None
    ax.plot(labels, values, color=color, linewidth=1.6, marker=marker, markersize=4)
    ax.axhline(0, color="#999999", linewidth=0.8)
    ax.set_ylabel(ylabel, fontsize=8)
    max_ticks = 18
    if len(labels) > max_ticks:
        step = -(-len(labels) // max_ticks)  # ceil division
        ax.set_xticks(range(0, len(labels), step))
        ax.set_xticklabels([labels[i] for i in range(0, len(labels), step)])
    ax.tick_params(axis="x", labelsize=7, rotation=35)
    ax.tick_params(axis="y", labelsize=7)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    return _fig_to_image(fig, 16)


def _pie_chart(totals: Dict[str, float]) -> Image:
    items = sorted(totals.items(), key=lambda kv: -kv[1])
    labels = [k for k, _ in items]
    values = [v for _, v in items]
    total = sum(values) or 1.0

    def _autopct(pct):
        return f"{pct:.0f}%" if pct >= 4 else ""

    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    colors_cycle = plt.cm.Set2.colors
    ax.pie(values, autopct=_autopct, startangle=90,
           colors=[colors_cycle[i % len(colors_cycle)] for i in range(len(values))],
           textprops={"fontsize": 8})
    legend_labels = [f"{lbl}  ·  {v / total * 100:.1f}%" for lbl, v in items]
    ax.legend(legend_labels, loc="center left", bbox_to_anchor=(1.0, 0.5), fontsize=7.5)
    ax.axis("equal")
    fig.tight_layout()
    return _fig_to_image(fig, 16)


def _bar_chart(totals: Dict[str, float]) -> Image:
    items = sorted(totals.items(), key=lambda kv: -kv[1])
    labels = [k for k, _ in items]
    values = [v for _, v in items]
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    ax.bar(labels, values, color="#2E7D5B")
    ax.tick_params(axis="x", labelsize=7.5, rotation=25)
    ax.tick_params(axis="y", labelsize=7)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    return _fig_to_image(fig, 16)


def generate_account_report_pdf(months: List[dict], output_path: str) -> None:
    """months: meses selecionados (em qualquer ordem) — a função ordena
    cronologicamente. Escreve o PDF em output_path."""
    ordered = sorted(months, key=lambda m: (m["year"], m["month"]))
    if not ordered:
        raise ValueError("Nenhum mês selecionado.")

    all_rows: List[dict] = []
    monthly_saldo: List[tuple] = []
    for m in ordered:
        rows = db.get_transactions(m["id"])
        all_rows.extend(rows)
        summary = db.get_month_summary(m["id"])
        monthly_saldo.append((m["name"], summary["saldo"]))

    real_expenses = [r for r in all_rows if _is_real_expense(r)]
    real_income = [r for r in all_rows if r["type"] in INCOME_TYPES and not r.get("is_expectation")]

    total_entradas = sum(float(r["amount"] or 0) for r in real_income)
    total_saidas = sum(float(r["amount"] or 0) for r in real_expenses)
    saldo_periodo = total_entradas - total_saidas
    taxa_poupanca = (saldo_periodo / total_entradas * 100) if total_entradas > 0 else 0.0

    cat_totals: Dict[str, float] = {}
    method_totals: Dict[str, float] = {}
    daily_totals: Dict[str, float] = {}
    for r in real_expenses:
        cat = r.get("category") or "Outros"
        cat_totals[cat] = cat_totals.get(cat, 0.0) + float(r["amount"] or 0)
        method = PAYMENT_METHODS.get(r.get("payment_method"), "Outro") if r.get("payment_method") else "Outro"
        method_totals[method] = method_totals.get(method, 0.0) + float(r["amount"] or 0)
        d = _row_date(r)
        if d:
            key = d.strftime("%d/%m")
            daily_totals[key] = daily_totals.get(key, 0.0) + float(r["amount"] or 0)

    top_gastos = sorted(real_expenses, key=lambda r: -float(r["amount"] or 0))[:10]

    all_rows_sorted = sorted(all_rows, key=lambda r: _row_date(r) or _dt(1970, 1, 1).date())

    period_label = ordered[0]["name"] if len(ordered) == 1 else f"{ordered[0]['name']} – {ordered[-1]['name']}"

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleX", parent=styles["Title"], textColor=HEADER_BG, fontSize=20)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=HEADER_BG, spaceBefore=14, spaceAfter=6)
    normal = styles["Normal"]
    muted = ParagraphStyle("Muted", parent=styles["Normal"], textColor=MUTED, fontSize=10)

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        leftMargin=1.6 * cm, rightMargin=1.6 * cm,
        title="des.tino — Relatório Financeiro",
    )

    story = []
    story.append(Paragraph("des.tino — Relatório Financeiro", title_style))
    story.append(Paragraph(f"Período: {period_label}", muted))
    story.append(Paragraph(f"Gerado em {_dt.now().strftime('%d/%m/%Y às %H:%M')}", muted))
    story.append(Spacer(1, 0.6 * cm))

    kpi_data = [
        ["Entradas", "Saídas", "Saldo do período", "Taxa de poupança"],
        [format_currency(total_entradas), format_currency(total_saidas),
         format_currency(saldo_periodo), f"{taxa_poupanca:.1f}%"],
    ]
    kpi_table = Table(kpi_data, colWidths=[4.2 * cm] * 4)
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 13),
        ("TEXTCOLOR", (0, 1), (0, 1), GREEN),
        ("TEXTCOLOR", (1, 1), (1, 1), RED),
        ("TEXTCOLOR", (2, 1), (2, 1), GREEN if saldo_periodo >= 0 else RED),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
    ]))
    story.append(kpi_table)

    if len(monthly_saldo) > 1:
        story.append(Paragraph("Evolução do saldo", h2))
        labels = [s[0].split(" ")[0][:3] + "/" + s[0].split(" ")[-1][-2:] for s in monthly_saldo]
        values = [s[1] for s in monthly_saldo]
        story.append(_line_chart(labels, values, "#2E7D5B", "Saldo (R$)"))

    if cat_totals:
        story.append(Paragraph("Gastos por categoria", h2))
        story.append(_pie_chart(cat_totals))

    if method_totals:
        story.append(Paragraph("Gastos por forma de pagamento", h2))
        story.append(_bar_chart(method_totals))

    if len(daily_totals) > 1:
        story.append(Paragraph("Gastos ao longo do período", h2))
        story.append(_line_chart(list(daily_totals.keys()), list(daily_totals.values()), "#C0392B",
                                  "Gasto (R$)", show_markers=len(daily_totals) <= 40))

    if top_gastos:
        story.append(Paragraph("Maiores gastos do período", h2))
        rows = [["Descrição", "Categoria", "Data", "Valor"]]
        for r in top_gastos:
            d = _row_date(r)
            rows.append([
                (r["description"] or "")[:40],
                r.get("category") or "Outros",
                d.strftime("%d/%m/%Y") if d else "—",
                format_currency(float(r["amount"] or 0)),
            ])
        t = Table(rows, colWidths=[7 * cm, 4 * cm, 3 * cm, 3 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("TEXTCOLOR", (3, 1), (3, -1), RED),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)

    story.append(Paragraph("Lançamentos completos", h2))
    tx_rows = [["Tipo", "Descrição", "Categoria", "Forma", "Valor", "Data"]]
    for r in all_rows_sorted:
        is_income = r["type"] in INCOME_TYPES
        d = _row_date(r)
        tx_rows.append([
            _TYPE_LABELS.get(r["type"], r["type"]),
            (r["description"] or "")[:34],
            r.get("category") or "Outros",
            PAYMENT_METHODS.get(r.get("payment_method"), "") if r.get("payment_method") else "",
            format_currency(float(r["amount"] or 0)),
            d.strftime("%d/%m/%Y") if d else "—",
        ])
    tx_table = Table(tx_rows, colWidths=[2.4 * cm, 5.6 * cm, 3 * cm, 2.4 * cm, 2.6 * cm, 2.4 * cm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (4, 0), (4, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, r in enumerate(all_rows_sorted, start=1):
        is_income = r["type"] in INCOME_TYPES
        style_cmds.append(("TEXTCOLOR", (4, i), (4, i), GREEN if is_income else RED))
    tx_table.setStyle(TableStyle(style_cmds))
    story.append(tx_table)

    doc.build(story)
