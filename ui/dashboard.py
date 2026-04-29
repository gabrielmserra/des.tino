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
        ]

        # ── KPI cards ─────────────────────────────────────────────────
        kpi_row = ctk.CTkFrame(self, fg_color="transparent")
        kpi_row.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        for col in range(4):
            kpi_row.grid_columnconfigure(col, weight=1)

        for col, (key, label, color) in enumerate(kpi):
            card = self._make_kpi(kpi_row, label, color)
            card.grid(row=0, column=col, padx=(0 if col == 0 else 7, 0), sticky="nsew")
            self._card_lbls[key] = (card.val_lbl, color)

        # ── Guru Financeiro ───────────────────────────────────────────
        tips_card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                 border_width=1, border_color=T.BORDER)
        tips_card.grid(row=2, column=0, sticky="ew", padx=28, pady=(16, 0))
        tips_card.grid_columnconfigure(0, weight=1)

        header_row = ctk.CTkFrame(tips_card, fg_color="transparent")
        header_row.grid(row=0, column=0, sticky="ew", padx=20, pady=(14, 6))
        ctk.CTkLabel(header_row, text="🧠", font=F(15)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(header_row, text="Guru Financeiro",
                     font=F(13, "bold"), text_color=T.GREEN, anchor="w").pack(side="left")
        ctk.CTkLabel(header_row, text="dicas personalizadas do mês",
                     font=F(11), text_color=T.MUTED, anchor="w").pack(side="left", padx=(8, 0))

        self._tips_frame = ctk.CTkFrame(tips_card, fg_color="transparent")
        self._tips_frame.grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 14))
        self._tips_frame.grid_columnconfigure((0, 1, 2), weight=1)

        # ── Charts ────────────────────────────────────────────────────
        charts = ctk.CTkFrame(self, fg_color="transparent")
        charts.grid(row=3, column=0, sticky="nsew", padx=28, pady=(16, 0))
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
        self._savings_card.grid(row=4, column=0, sticky="ew", padx=28, pady=(16, 0))
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

        # ── Situação dos Cartões ──────────────────────────────────────
        credit_outer = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                    border_width=1, border_color=T.BORDER)
        credit_outer.grid(row=1, column=0, sticky="ew", padx=28, pady=(16, 0))
        credit_outer.grid_columnconfigure(0, weight=1)

        credit_hdr = ctk.CTkFrame(credit_outer, fg_color="transparent")
        credit_hdr.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 6))
        ctk.CTkLabel(credit_hdr, text="💳", font=F(15)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(credit_hdr, text="Situação dos Cartões",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").pack(side="left")
        ctk.CTkLabel(credit_hdr, text="limite, gastos e alertas do ciclo atual",
                     font=F(11), text_color=T.MUTED, anchor="w").pack(side="left", padx=(8, 0))

        self._credit_frame = ctk.CTkFrame(credit_outer, fg_color="transparent")
        self._credit_frame.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 16))

        # ── Metas de poupança ─────────────────────────────────────────
        goals_card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                  border_width=1, border_color=T.BORDER)
        goals_card.grid(row=5, column=0, sticky="ew", padx=28, pady=(16, 28))
        goals_card.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(goals_card, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 8))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text="🎯  Metas de Poupança",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w")
        self._goals_count_lbl = ctk.CTkLabel(
            hdr, text="", font=F(11), text_color=T.MUTED, anchor="e")
        self._goals_count_lbl.grid(row=0, column=1, sticky="e")

        self._goals_frame = ctk.CTkFrame(goals_card, fg_color="transparent")
        self._goals_frame.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 16))
        self._goals_frame.grid_columnconfigure(0, weight=1)

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
        import threading
        s = db.get_month_summary(self.month_id)

        for key, (lbl, default_color) in self._card_lbls.items():
            val   = s.get(key, 0.0)
            color = (T.GREEN if val >= 0 else T.RED) if key in ("saldo", "dinheiro_livre") else default_color
            lbl.configure(text=format_currency(val), text_color=color)

        self._draw_savings(s)
        self._draw_tips(s)

        def _background():
            # Constrói as figuras Matplotlib fora do main thread (pura matemática, sem Tkinter)
            pie_data = db.get_expenses_by_category(self.month_id)
            pie_fig  = self._build_pie_figure(pie_data)
            bar_fig  = self._build_bar_figure(s)
            try:
                goals = db.get_goals()
            except Exception:
                goals = []
            try:
                cards = db.get_cards()
            except Exception:
                cards = []
            # Volta ao main thread só para embutir os widgets Tkinter
            self.after(0, lambda: self._embed_pie(pie_fig))
            self.after(0, lambda: self._embed_bar(bar_fig))
            self.after(0, lambda: self._draw_goals(goals))
            self.after(0, lambda: self._draw_credit_panel(cards, s))

        threading.Thread(target=_background, daemon=True).start()

    # ------------------------------------------------------------------
    def _build_pie_figure(self, data: list):
        """Constrói a Figure do pie chart fora do main thread."""
        import matplotlib
        matplotlib.use("TkAgg")
        from matplotlib.figure import Figure

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
        return fig

    def _embed_pie(self, fig) -> None:
        """Embute a Figure do pie no Tkinter — roda no main thread."""
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        try:
            for w in self._pie_host.winfo_children():
                w.destroy()
            canvas = FigureCanvasTkAgg(fig, master=self._pie_host)
            canvas.draw()
            canvas.get_tk_widget().pack(fill="both", expand=True)
        except Exception:
            pass
        finally:
            plt.close(fig)

    # ------------------------------------------------------------------
    def _build_bar_figure(self, s: dict):
        """Constrói a Figure do bar chart fora do main thread."""
        import matplotlib
        matplotlib.use("TkAgg")
        from matplotlib.figure import Figure

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
            lbl.set_color(T.TEXT); lbl.set_fontsize(11); lbl.set_fontweight("bold")

        fig.tight_layout(pad=0.8)
        return fig

    def _embed_bar(self, fig) -> None:
        """Embute a Figure do bar chart no Tkinter — roda no main thread."""
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        try:
            for w in self._bar_host.winfo_children():
                w.destroy()
            canvas = FigureCanvasTkAgg(fig, master=self._bar_host)
            canvas.draw()
            canvas.get_tk_widget().pack(fill="both", expand=True)
        except Exception:
            pass
        finally:
            plt.close(fig)

    # ------------------------------------------------------------------
    def _draw_goals(self, goals: list) -> None:
        for w in self._goals_frame.winfo_children():
            w.destroy()

        n = len(goals)
        done = sum(1 for g in goals if float(g.get("saved_amount") or 0) >= float(g.get("target_amount") or 1))
        self._goals_count_lbl.configure(
            text=f"{done}/{n} concluída{'s' if done != 1 else ''}" if n else "")

        if not goals:
            ctk.CTkLabel(self._goals_frame,
                         text="Nenhuma meta criada. Acesse a aba Metas para começar.",
                         font=F(12), text_color=T.MUTED, anchor="w").pack(anchor="w", pady=(0, 4))
            return

        for goal in goals:
            target = float(goal.get("target_amount") or 0)
            saved  = float(goal.get("saved_amount")  or 0)
            pct    = min(1.0, saved / target) if target > 0 else 0.0
            done   = pct >= 1.0
            color  = T.GREEN if done else T.BLUE

            row = ctk.CTkFrame(self._goals_frame, fg_color="transparent")
            row.pack(fill="x", pady=(0, 10))
            row.grid_columnconfigure(1, weight=1)

            # Nome + status
            ctk.CTkLabel(row, text=goal["name"], font=F(12, "bold"),
                         text_color=T.TEXT, anchor="w").grid(
                row=0, column=0, sticky="w")
            status = "✓ Concluída" if done else f"{pct*100:.0f}%"
            ctk.CTkLabel(row, text=f"{format_currency(saved)} / {format_currency(target)}  {status}",
                         font=F(11), text_color=color, anchor="e").grid(
                row=0, column=1, sticky="e")

            # Barra de progresso
            bar_bg = ctk.CTkFrame(row, height=6, fg_color=T.CARD2, corner_radius=3)
            bar_bg.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(4, 0))
            bar_bg.grid_propagate(False)
            ctk.CTkFrame(bar_bg, height=6, fg_color=color, corner_radius=3).place(
                x=0, y=0, relheight=1, relwidth=pct)

    # ------------------------------------------------------------------
    def _draw_tips(self, s: dict) -> None:
        for w in self._tips_frame.winfo_children():
            w.destroy()

        tips = _build_tips(s)
        if not tips:
            ctk.CTkLabel(self._tips_frame,
                         text="Adicione lançamentos para receber dicas personalizadas.",
                         font=F(12), text_color=T.MUTED, anchor="w").grid(
                row=0, column=0, columnspan=3, sticky="w", pady=8)
            return

        for col, (icon, title, body, color, dim) in enumerate(tips):
            card = ctk.CTkFrame(self._tips_frame, fg_color=dim, corner_radius=10)
            card.grid(row=0, column=col, sticky="nsew",
                      padx=(0 if col == 0 else 6, 0))
            card.grid_columnconfigure(0, weight=1)

            hdr = ctk.CTkFrame(card, fg_color="transparent")
            hdr.grid(row=0, column=0, sticky="ew", padx=12, pady=(12, 4))
            ctk.CTkLabel(hdr, text=icon, font=F(15), text_color=color,
                         width=22).pack(side="left")
            ctk.CTkLabel(hdr, text=title, font=F(12, "bold"),
                         text_color=color, anchor="w").pack(side="left", padx=(6, 0))

            ctk.CTkLabel(card, text=body, font=F(11), text_color=T.MUTED,
                         anchor="w", wraplength=300, justify="left").grid(
                row=1, column=0, sticky="ew", padx=12, pady=(0, 12))

    # ------------------------------------------------------------------
    def _draw_credit_panel(self, cards: list, s: dict) -> None:
        from ui.credit_cards import _all_card_spendings, _days_until

        for w in self._credit_frame.winfo_children():
            w.destroy()

        if not cards:
            ctk.CTkLabel(
                self._credit_frame,
                text="Nenhum cartão cadastrado. Adicione em Saídas Variáveis para ver a análise aqui.",
                font=F(12), text_color=T.MUTED, anchor="w",
            ).pack(anchor="w")
            return

        saldo          = s.get("saldo", 0)
        card_spendings = _all_card_spendings(cards, self.month_id)

        for i, card in enumerate(cards):
            if i > 0:
                ctk.CTkFrame(self._credit_frame, height=1,
                             fg_color=T.BORDER).pack(fill="x", pady=(10, 10))

            color       = card.get("color", "#6C8EFF")
            limit       = float(card.get("limit") or 0)
            due_day     = card.get("due_day", 10)
            closing_day = card.get("closing_day", 1)
            spent       = card_spendings.get(card["id"], 0.0)
            days_cls    = _days_until(closing_day)
            days_due    = _days_until(due_day)
            avail       = max(0.0, limit - spent) if limit > 0 else None
            pct_used    = spent / limit if limit > 0 else 0.0

            safety_msg, safety_color = _credit_safety(
                pct_used, days_due, spent, saldo, avail)

            # Linha superior: ponto colorido + nome + indicador
            top = ctk.CTkFrame(self._credit_frame, fg_color="transparent")
            top.pack(fill="x")

            name_box = ctk.CTkFrame(top, fg_color="transparent")
            name_box.pack(side="left")
            ctk.CTkFrame(name_box, width=10, height=10,
                         fg_color=color, corner_radius=5).pack(side="left", padx=(0, 7))
            ctk.CTkLabel(name_box, text=card["name"], font=F(13, "bold"),
                         text_color=T.TEXT).pack(side="left")

            badge = ctk.CTkFrame(top, fg_color="transparent")
            badge.pack(side="right")
            ctk.CTkFrame(badge, width=8, height=8,
                         fg_color=safety_color, corner_radius=4).pack(side="left", padx=(0, 5))
            ctk.CTkLabel(badge, text=safety_msg,
                         font=F(11), text_color=safety_color).pack(side="left")

            # Linha de info
            info_parts = [f"Gasto: {format_currency(spent)}"]
            if avail is not None:
                info_parts.append(f"Disponível: {format_currency(avail)}")
            info_parts += [f"Fecha em {days_cls}d", f"Vence em {days_due}d"]
            ctk.CTkLabel(self._credit_frame,
                         text="  •  ".join(info_parts),
                         font=F(11), text_color=T.MUTED, anchor="w").pack(
                fill="x", pady=(3, 0))

            # Barra de progresso (só se tiver limite)
            if limit > 0:
                bar_bg = ctk.CTkFrame(self._credit_frame, height=4,
                                      fg_color=T.CARD2, corner_radius=2)
                bar_bg.pack(fill="x", pady=(6, 0))
                bar_bg.pack_propagate(False)
                if pct_used > 0:
                    fill_col = T.RED if pct_used > 0.85 else color
                    ctk.CTkFrame(bar_bg, height=4, fg_color=fill_col,
                                 corner_radius=2).place(
                        x=0, y=0, relheight=1, relwidth=min(pct_used, 1.0))

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
def _credit_safety(pct_used: float, days_due: int, spent: float,
                   saldo: float, avail) -> tuple:
    """Retorna (mensagem, cor) do indicador de segurança do cartão."""
    if pct_used >= 0.90:
        return ("Limite quase esgotado — evite novos gastos", T.RED)
    if days_due <= 3 and spent > 0 and saldo < 0:
        return (f"Vence em {days_due}d e o mês está no negativo", T.RED)
    if pct_used >= 0.70:
        return (f"{pct_used*100:.0f}% do limite usado — reduza os gastos", T.GOLD)
    if days_due <= 5 and spent > 0:
        return (f"Vence em {days_due}d — {format_currency(spent)} a pagar", T.GOLD)
    if days_due <= 5:
        return (f"Vencimento em {days_due} dias — prepare o pagamento", T.GOLD)
    if days_due <= 7 and spent > 0:
        return (f"Fatura de {format_currency(spent)} vence em {days_due}d", T.GOLD)
    if spent == 0:
        return ("Nenhum gasto neste ciclo", T.GREEN)
    if avail is not None:
        return (f"Pode gastar mais — {format_currency(avail)} disponível", T.GREEN)
    return ("Situação tranquila", T.GREEN)


def _build_tips(s: dict) -> list:
    entradas = s.get("total_entradas", 0)
    if entradas <= 0:
        return []

    saidas     = s.get("total_saidas", 0)
    investidos = s.get("total_investimentos", 0)
    saldo      = s.get("saldo", 0)
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

    if saldo > 0 and inv_pct < 0.15:
        tips.append(("i", "Saldo disponível",
            f"Você tem {format_currency(saldo)} de saldo no mês. "
            "Considere direcionar parte disso para sua reserva de emergência "
            "(ideal: 6 meses de despesas guardados).", T.GOLD, gold_dim))

    return tips[:3]
