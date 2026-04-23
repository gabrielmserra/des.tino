"""Dashboard: KPI cards + gráficos + barra de taxa de poupança."""
import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import format_currency


class Dashboard(ctk.CTkScrollableFrame):
    def __init__(self, parent, month_id: int):
        super().__init__(parent, fg_color=T.BG,
                         scrollbar_button_color=T.BORDER,
                         scrollbar_button_hover_color=T.MUTED)
        self.month_id = month_id
        self._card_lbls: dict = {}
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        # KPI definitions (evaluated at build time = after apply_theme)
        kpi = [
            ("total_entradas",      "ENTRADAS",      T.GREEN),
            ("total_saidas",        "SAÍDAS",        T.RED),
            ("total_investimentos", "INVESTIMENTOS", T.VIOLET),
            ("saldo",               "SALDO",         T.BLUE),
            ("dinheiro_livre",      "SOBRA LIVRE",   T.GOLD),
        ]

        # ── KPI cards ─────────────────────────────────────────────────
        kpi_row = ctk.CTkFrame(self, fg_color="transparent")
        kpi_row.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        for col in range(5):
            kpi_row.grid_columnconfigure(col, weight=1)

        for col, (key, label, color) in enumerate(kpi):
            card = self._make_kpi(kpi_row, label, color)
            card.grid(row=0, column=col, padx=(0 if col == 0 else 7, 0), sticky="nsew")
            self._card_lbls[key] = (card.val_lbl, color)

        # ── Guru Financeiro ───────────────────────────────────────────
        tips_card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                 border_width=1, border_color=T.BORDER)
        tips_card.grid(row=1, column=0, sticky="ew", padx=28, pady=(14, 0))
        tips_card.grid_columnconfigure(0, weight=1)

        header_row = ctk.CTkFrame(tips_card, fg_color="transparent")
        header_row.grid(row=0, column=0, sticky="ew", padx=20, pady=(14, 8))
        ctk.CTkLabel(header_row, text="🧠", font=F(16)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(header_row, text="Guru Financeiro",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").pack(side="left")

        self._tips_frame = ctk.CTkFrame(tips_card, fg_color="transparent")
        self._tips_frame.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 14))

        # ── Charts ────────────────────────────────────────────────────
        charts = ctk.CTkFrame(self, fg_color="transparent")
        charts.grid(row=2, column=0, sticky="nsew", padx=28, pady=(14, 0))
        charts.grid_columnconfigure((0, 1), weight=1)

        pie_card = ctk.CTkFrame(charts, fg_color=T.CARD, corner_radius=14,
                                border_width=1, border_color=T.BORDER)
        pie_card.grid(row=0, column=0, padx=(0, 7), sticky="nsew")
        pie_card.grid_rowconfigure(1, weight=1)
        pie_card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(pie_card, text="Despesas por Categoria",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, padx=20, pady=(16, 8), sticky="w")
        self._pie_host = ctk.CTkFrame(pie_card, fg_color="transparent")
        self._pie_host.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 12))

        bar_card = ctk.CTkFrame(charts, fg_color=T.CARD, corner_radius=14,
                                border_width=1, border_color=T.BORDER)
        bar_card.grid(row=0, column=1, padx=(7, 0), sticky="nsew")
        bar_card.grid_rowconfigure(1, weight=1)
        bar_card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(bar_card, text="Entradas vs Saídas vs Investimentos",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, padx=20, pady=(16, 8), sticky="w")
        self._bar_host = ctk.CTkFrame(bar_card, fg_color="transparent")
        self._bar_host.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 12))

        # ── Savings bar ───────────────────────────────────────────────
        self._savings_card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                          border_width=1, border_color=T.BORDER)
        self._savings_card.grid(row=3, column=0, sticky="ew", padx=28, pady=(14, 24))
        self._savings_card.grid_columnconfigure(2, weight=1)

        ctk.CTkLabel(self._savings_card, text="Taxa de poupança:",
                     font=F(12), text_color=T.MUTED).grid(
            row=0, column=0, padx=(22, 6), pady=16)
        self._savings_pct = ctk.CTkLabel(
            self._savings_card, text="0,0%", font=F(13, "bold"), text_color=T.GREEN)
        self._savings_pct.grid(row=0, column=1, padx=(0, 10))
        self._savings_bar_bg = ctk.CTkFrame(
            self._savings_card, height=6, fg_color=T.CARD2, corner_radius=3)
        self._savings_bar_bg.grid(row=0, column=2, sticky="ew", padx=(0, 12))
        self._savings_bar_bg.grid_propagate(False)
        self._savings_bar_fill = ctk.CTkFrame(
            self._savings_bar_bg, height=6, fg_color=T.BLUE, corner_radius=3)
        self._savings_bar_fill.place(x=0, y=0, relheight=1, relwidth=0.0)
        self._savings_label = ctk.CTkLabel(
            self._savings_card, text="", font=F(12), text_color=T.MUTED)
        self._savings_label.grid(row=0, column=3, padx=(4, 22))

    # ------------------------------------------------------------------
    @staticmethod
    def _make_kpi(parent, label: str, color: str) -> ctk.CTkFrame:
        card = ctk.CTkFrame(parent, fg_color=T.CARD, corner_radius=14,
                            border_width=1, border_color=T.BORDER)
        ctk.CTkFrame(card, height=3, fg_color=color, corner_radius=2).pack(
            fill="x", padx=8, pady=(10, 0))
        ctk.CTkLabel(card, text=label, font=F(10, "bold"), text_color=T.MUTED).pack(pady=(10, 2))
        card.val_lbl = ctk.CTkLabel(card, text="R$ 0,00",
                                    font=F(18, "bold"), text_color=color)
        card.val_lbl.pack(pady=(0, 16))
        return card

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        s = db.get_month_summary(self.month_id)

        for key, (lbl, default_color) in self._card_lbls.items():
            val   = s.get(key, 0.0)
            color = (T.GREEN if val >= 0 else T.RED) if key in ("saldo", "dinheiro_livre") else default_color
            lbl.configure(text=format_currency(val), text_color=color)

        self._draw_pie()
        self._draw_bar(s)
        self._draw_savings(s)
        self._draw_tips(s)

    # ------------------------------------------------------------------
    def _draw_pie(self) -> None:
        import matplotlib
        import matplotlib.pyplot as plt
        matplotlib.use("TkAgg")
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        from matplotlib.figure import Figure

        for w in self._pie_host.winfo_children():
            w.destroy()
        data = db.get_expenses_by_category(self.month_id)

        pie_colors = [T.RED, T.GOLD, T.VIOLET, T.BLUE, "#22d3ee", T.GREEN, "#fb923c", "#e879f9"]

        fig = Figure(figsize=(5.2, 3.4), facecolor=T.CARD)
        ax  = fig.add_subplot(111)
        ax.set_facecolor(T.CARD)

        has = data and any(float(r["total"] or 0) > 0 for r in data)
        if has:
            labels = [r["category"] for r in data]
            values = [float(r["total"] or 0) for r in data]
            colors = pie_colors[:len(values)]
            wedges, _, autotexts = ax.pie(
                values, labels=None, autopct="%1.1f%%",
                colors=colors, startangle=90, pctdistance=0.78,
                wedgeprops={"edgecolor": T.CARD, "linewidth": 2.5},
            )
            for at in autotexts:
                at.set_color(T.TEXT); at.set_fontsize(8)
            ax.legend(
                wedges, labels,
                loc="lower center", bbox_to_anchor=(0.5, -0.22),
                ncol=4, fontsize=7.5,
                facecolor=T.CARD, labelcolor=T.MUTED, edgecolor="none",
            )
        else:
            ax.text(0.5, 0.5, "Nenhuma despesa\nregistrada",
                    ha="center", va="center", transform=ax.transAxes,
                    color=T.MUTED, fontsize=12)
            ax.axis("off")

        fig.tight_layout(pad=0.8)
        canvas = FigureCanvasTkAgg(fig, master=self._pie_host)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)
        plt.close(fig)

    # ------------------------------------------------------------------
    def _draw_bar(self, s: dict) -> None:
        import matplotlib
        import matplotlib.pyplot as plt
        matplotlib.use("TkAgg")
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        from matplotlib.figure import Figure

        for w in self._bar_host.winfo_children():
            w.destroy()

        cats   = ["Entradas", "Saídas", "Investimentos"]
        values = [s["total_entradas"], s["total_saidas"], s["total_investimentos"]]
        colors = [T.GREEN, T.RED, T.VIOLET]
        max_v  = max(values) if any(v > 0 for v in values) else 1

        fig = Figure(figsize=(5.2, 3.4), facecolor=T.CARD)
        ax  = fig.add_subplot(111)
        ax.set_facecolor(T.CARD)

        bars = ax.bar(cats, values, color=colors, width=0.46, edgecolor="none", zorder=2)
        for bar, val in zip(bars, values):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + max_v * 0.03,
                format_currency(val),
                ha="center", va="bottom",
                color=T.TEXT, fontsize=8.5, fontweight="bold",
            )

        ax.set_ylim(0, max_v * 1.28)
        ax.set_yticks([])
        ax.yaxis.grid(True, color=T.BORDER, linewidth=0.5, zorder=0)
        for spine in ("top", "right", "left"):
            ax.spines[spine].set_visible(False)
        ax.spines["bottom"].set_color(T.BORDER)
        ax.tick_params(colors=T.MUTED, length=0)
        for lbl in ax.get_xticklabels():
            lbl.set_color(T.MUTED); lbl.set_fontsize(11); lbl.set_fontweight("bold")

        fig.tight_layout(pad=0.8)
        canvas = FigureCanvasTkAgg(fig, master=self._bar_host)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)
        plt.close(fig)

    # ------------------------------------------------------------------
    def _draw_tips(self, s: dict) -> None:
        for w in self._tips_frame.winfo_children():
            w.destroy()

        tips = _build_tips(s)
        if not tips:
            ctk.CTkLabel(self._tips_frame,
                         text="Adicione lançamentos para receber dicas personalizadas.",
                         font=F(12), text_color=T.MUTED, anchor="w").pack(anchor="w")
            return

        for icon, title, body, color, dim in tips:
            row = ctk.CTkFrame(self._tips_frame, fg_color=dim, corner_radius=10)
            row.pack(fill="x", pady=(0, 8))
            row.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(row, text=icon, font=F(18), text_color=color, width=36).grid(
                row=0, column=0, rowspan=2, padx=(14, 0), pady=12)
            ctk.CTkLabel(row, text=title, font=F(12, "bold"),
                         text_color=color, anchor="w").grid(
                row=0, column=1, sticky="w", padx=(10, 14), pady=(10, 0))
            ctk.CTkLabel(row, text=body, font=F(11),
                         text_color=T.MUTED, anchor="w", wraplength=700, justify="left").grid(
                row=1, column=1, sticky="w", padx=(10, 14), pady=(0, 10))

    # ------------------------------------------------------------------
    def _draw_savings(self, s: dict) -> None:
        entradas = s.get("total_entradas", 0)
        saldo    = s.get("saldo", 0)
        if entradas > 0:
            pct = max(0.0, min(1.0, saldo / entradas))
            pct_txt = f"{pct * 100:.1f}%"
        else:
            pct = 0.0
            pct_txt = "—"

        color = T.GREEN if pct >= 0.1 else (T.GOLD if pct >= 0 else T.RED)
        self._savings_pct.configure(text=pct_txt, text_color=color)
        self._savings_bar_fill.place_configure(relwidth=pct)
        self._savings_label.configure(
            text=f"{format_currency(saldo)} de {format_currency(entradas)}")


# ──────────────────────────────────────────────────────────────────────
def _build_tips(s: dict) -> list:
    entradas = s.get("total_entradas", 0)
    if entradas <= 0:
        return []

    saidas     = s.get("total_saidas", 0)
    investidos = s.get("total_investimentos", 0)
    saldo      = s.get("saldo", 0)
    livre      = s.get("dinheiro_livre", 0)
    inv_pct    = investidos / entradas
    gasto_pct  = saidas / entradas
    tips = []

    # Evaluated at call time — reads current T.* values
    gold_dim   = T.GOLD_DIM
    blue_dim   = T.BLUE_DIM
    green_dim  = T.GREEN_DIM
    red_dim    = T.RED_DIM

    if saldo < 0:
        tips.append(("!", "Déficit este mês",
            "Você está gastando mais do que ganha. Revise seus gastos variáveis "
            "com urgência e corte o que não é essencial.", T.RED, red_dim))
    elif gasto_pct > 0.80:
        tips.append(("!", "Gastos elevados",
            f"Suas despesas consomem {gasto_pct*100:.0f}% da sua renda. "
            "Tente manter abaixo de 70% para ter mais margem de segurança.", T.GOLD, gold_dim))

    if investidos == 0:
        tips.append(("$", "Comece a investir",
            "Você ainda não fez nenhum investimento este mês. Mesmo R$50 aplicados "
            "regularmente fazem grande diferença ao longo dos anos.", T.BLUE, blue_dim))
    elif inv_pct < 0.10:
        tips.append(("$", "Aumente seus investimentos",
            f"Você está investindo {inv_pct*100:.1f}% da renda. "
            "Tente chegar a 10% — é o mínimo recomendado por especialistas.", T.BLUE, blue_dim))
    elif inv_pct >= 0.20:
        tips.append(("*", "Ótimo investidor!",
            f"Parabéns! Você está investindo {inv_pct*100:.1f}% da sua renda. "
            "Continue assim e considere diversificar entre renda fixa e variável.", T.GREEN, green_dim))
    else:
        tips.append(("$", "Você está no caminho certo",
            f"Você investe {inv_pct*100:.1f}% da renda. Tente aumentar para 20% — "
            "a regra 50/30/20 recomenda 50% necessidades, 30% desejos e 20% poupança.", T.BLUE, blue_dim))

    if livre > 0 and inv_pct < 0.15:
        tips.append(("i", "Sobra mensal disponível",
            f"Você tem {format_currency(livre)} de dinheiro livre. "
            "Considere direcionar parte disso para sua reserva de emergência "
            "(ideal: 6 meses de despesas guardados).", T.GOLD, gold_dim))

    return tips[:3]
