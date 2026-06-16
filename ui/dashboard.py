"""Dashboard: KPI cards + gráficos + barra de taxa de poupança."""
import customtkinter as ctk
from typing import Optional, Callable

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import format_currency, MONTHS_PT


class Dashboard(ctk.CTkScrollableFrame):
    def __init__(self, parent, month_id: int,
                 on_investments: Optional[Callable] = None,
                 on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG,
                         scrollbar_button_color=T.BORDER,
                         scrollbar_button_hover_color=T.MUTED)
        self.month_id        = month_id
        self._on_investments = on_investments
        self._on_change      = on_change
        self._card_lbls: dict = {}
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        # KPI definitions (evaluated at build time = after apply_theme)
        kpi = [
            ("total_entradas",      "ENTRADAS",             T.GREEN),
            ("total_saidas",        "SAÍDAS",               T.RED),
            ("total_investimentos", "INVESTIMENTOS MÊS",    T.VIOLET),
            ("investimentos_total", "INVESTIMENTOS TOTAIS", T.VIOLET),
            ("saldo_beneficios",    "SALDO VR/VA",          T.GOLD),
            ("saldo",               "SALDO",                T.BLUE),
        ]

        # ── KPI section (cards + barra de saldo projetado) ────────────
        kpi_section = ctk.CTkFrame(self, fg_color="transparent")
        kpi_section.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        kpi_section.grid_columnconfigure(0, weight=1)

        kpi_row = ctk.CTkFrame(kpi_section, fg_color="transparent")
        kpi_row.grid(row=0, column=0, sticky="ew")
        for col in range(len(kpi)):
            kpi_row.grid_columnconfigure(col, weight=1)

        _inv_keys = {"total_investimentos", "investimentos_total"}
        for col, (key, label, color) in enumerate(kpi):
            card = self._make_kpi(kpi_row, label, color)
            card.grid(row=0, column=col, padx=(0 if col == 0 else 7, 0), sticky="nsew")
            self._card_lbls[key] = (card.val_lbl, color)
            if key in _inv_keys and self._on_investments:
                self._bind_click(card, self._on_investments)

        self._proj_bar = ctk.CTkFrame(kpi_section, fg_color=T.CARD, corner_radius=10,
                                      border_width=1, border_color=T.BORDER)
        self._proj_lbl = ctk.CTkLabel(
            self._proj_bar, text="",
            font=F(12), text_color=T.GOLD, anchor="w",
        )
        self._proj_lbl.pack(side="left", padx=16, pady=10)

        # Alerta de categorias estouradas no plano do mês (escondido por padrão)
        self._plan_alert = ctk.CTkFrame(kpi_section, fg_color=T.RED_DIM, corner_radius=10,
                                        border_width=1, border_color=T.RED)
        self._plan_alert_lbl = ctk.CTkLabel(
            self._plan_alert, text="",
            font=F(12, "bold"), text_color=T.RED, anchor="w",
        )
        self._plan_alert_lbl.pack(side="left", padx=16, pady=10)

        # ── Guru Financeiro ───────────────────────────────────────────
        tips_card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                 border_width=1, border_color=T.BORDER)
        tips_card.grid(row=1, column=0, sticky="ew", padx=28, pady=(16, 0))
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
        credit_outer.grid(row=2, column=0, sticky="ew", padx=28, pady=(16, 0))
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

    @staticmethod
    def _bind_click(widget, command: Callable) -> None:
        """Bind click + hand cursor recursively to widget and all descendants."""
        def _apply(w):
            try:
                w.configure(cursor="hand2")
            except Exception:
                pass
            try:
                w.bind("<Button-1>", lambda e: command())
            except Exception:
                pass
            for child in w.winfo_children():
                _apply(child)
        _apply(widget)

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        import threading
        s = db.get_month_summary(self.month_id)

        for key, (lbl, default_color) in self._card_lbls.items():
            if key in ("investimentos_total", "saldo_beneficios"):
                lbl.configure(text="...", text_color=default_color)
                continue
            val   = s.get(key, 0.0)
            color = (T.GREEN if val >= 0 else T.RED) if key == "saldo" else default_color
            lbl.configure(text=format_currency(val), text_color=color)

        self._draw_savings(s)
        self._draw_tips(s)

        # Barra de saldo projetado (Modo Expectativa)
        if s.get("has_expectations"):
            n    = int(s.get("n_expectations", 0))
            proj = s.get("saldo_projetado", 0.0)
            proj_color = T.GREEN if proj >= 0 else T.RED
            label_n = f"{n} lançamento{'s' if n != 1 else ''} previsto{'s' if n != 1 else ''}"
            self._proj_lbl.configure(
                text=f"📋  Saldo projetado com {label_n}: {format_currency(proj)}",
                text_color=proj_color,
            )
            self._proj_bar.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        else:
            self._proj_bar.grid_remove()

        def _background():
            pie_data  = db.get_expenses_by_category(self.month_id)
            pie_fig   = self._build_pie_figure(pie_data)
            bar_fig   = self._build_bar_figure(s)
            try:
                total_inv = db.get_total_investments()
            except Exception:
                total_inv = 0.0
            try:
                benefit_total = sum(float(b.get("balance") or 0) for b in db.get_benefits())
            except Exception:
                benefit_total = 0.0
            try:
                goals = db.get_goals()
            except Exception:
                goals = []
            try:
                cards         = db.get_cards()
                card_payments = db.get_card_payments(self.month_id)
            except Exception:
                cards, card_payments = [], []
            try:
                all_months  = db.get_months()
                cur_idx     = next((i for i, m in enumerate(all_months)
                                    if m["id"] == self.month_id), 0)
                prev_months = all_months[cur_idx + 1: cur_idx + 4]
                history     = [db.get_month_summary(m["id"]) for m in prev_months]
                investments = db.get_investments()
            except Exception:
                history, investments = [], []
            try:
                from ui.credit_cards import _all_card_spendings
                spendings    = _all_card_spendings(cards, self.month_id) if cards else {}
                paid_by_card = {}
                for p in card_payments:
                    cid = p.get("card_id")
                    if cid:
                        paid_by_card[cid] = paid_by_card.get(cid, 0.0) + float(p["amount"])
                total_unpaid_cards = sum(
                    max(0.0, spendings.get(c["id"], 0.0) - paid_by_card.get(c["id"], 0.0))
                    for c in cards
                )
            except Exception:
                total_unpaid_cards = 0.0
            try:
                plan          = db.get_plan(self.month_id)
                plan_items    = db.get_plan_items(plan["id"]) if plan else []
                plan_realized = db.get_plan_realized(self.month_id) if plan else {}
            except Exception:
                plan, plan_items, plan_realized = None, [], {}
            self.after(0, lambda p=plan, it=plan_items, pr=plan_realized:
                       self._update_plan_alert(p, it, pr))
            self.after(0, lambda: self._embed_pie(pie_fig))
            self.after(0, lambda: self._embed_bar(bar_fig))
            self.after(0, lambda: self._draw_goals(goals))
            self.after(0, lambda cp=card_payments: self._draw_credit_panel(cards, s, cp))
            self.after(0, lambda t=total_inv: self._update_total_inv(t))
            self.after(0, lambda t=benefit_total: self._update_benefit_balance(t))
            self.after(0, lambda g=goals, c=pie_data, h=history,
                       iv=investments, ti=total_inv, uc=total_unpaid_cards:
                       self._draw_tips(s, g, c, h, iv, ti, uc))

        threading.Thread(target=_background, daemon=True).start()

    def _update_plan_alert(self, plan, items: list, spent: dict) -> None:
        """Mostra alerta quando categorias do plano ativo estouram o planejado."""
        try:
            if not plan or plan.get("status") != "ativo" or not items:
                self._plan_alert.grid_remove()
                return
            spent = spent or {}
            # Investimentos fora do alerta: ultrapassar o aporte planejado é positivo
            burst = [i["category"] for i in items
                     if i["category"] != "Investimentos"
                     and float(i["planned_amount"] or 0) > 0
                     and spent.get(i["category"], 0.0) >= float(i["planned_amount"])]
            if burst:
                names = ", ".join(burst[:3]) + ("…" if len(burst) > 3 else "")
                self._plan_alert_lbl.configure(
                    text=f"⚠  Plano do mês estourado em: {names} — veja a aba Planejamento")
                self._plan_alert.grid(row=2, column=0, sticky="ew", pady=(10, 0))
            else:
                self._plan_alert.grid_remove()
        except Exception:
            self._plan_alert.grid_remove()

    def _update_total_inv(self, total: float) -> None:
        entry = self._card_lbls.get("investimentos_total")
        if entry:
            lbl, color = entry
            lbl.configure(text=format_currency(total), text_color=color)

    def _update_benefit_balance(self, total: float) -> None:
        entry = self._card_lbls.get("saldo_beneficios")
        if entry:
            lbl, color = entry
            lbl.configure(text=format_currency(total), text_color=color)

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
    def _draw_tips(self, s: dict, goals: list = None, categories: list = None,
                   history: list = None, investments: list = None,
                   total_inv: float = 0.0, unpaid_cards: float = 0.0) -> None:
        for w in self._tips_frame.winfo_children():
            w.destroy()

        tips = _build_tips(s, goals, categories, history, investments, total_inv, unpaid_cards)
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
    def _draw_credit_panel(self, cards: list, s: dict,
                           card_payments: list = None) -> None:
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
        paid_by_card: dict = {}
        for p in (card_payments or []):
            cid = p.get("card_id")
            if cid:
                paid_by_card[cid] = paid_by_card.get(cid, 0.0) + float(p["amount"])

        for i, card in enumerate(cards):
            if i > 0:
                ctk.CTkFrame(self._credit_frame, height=1,
                             fg_color=T.BORDER).pack(fill="x", pady=(10, 10))

            color       = card.get("color", "#6C8EFF")
            limit       = float(card.get("limit") or 0)
            due_day     = card.get("due_day", 10)
            closing_day = card.get("closing_day", 1)
            spent       = card_spendings.get(card["id"], 0.0)
            paid        = paid_by_card.get(card["id"], 0.0)
            unpaid      = max(0.0, spent - paid)
            days_cls    = _days_until(closing_day)
            days_due    = _days_until(due_day)
            avail       = max(0.0, limit - spent) if limit > 0 else None
            pct_used    = spent / limit if limit > 0 else 0.0

            safety_msg, safety_color = _credit_safety(
                pct_used, days_due, unpaid, saldo, avail)

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

            # Status de pagamento da fatura
            if spent > 0:
                if paid >= spent:
                    ctk.CTkLabel(self._credit_frame,
                                 text=f"✓ Fatura paga ({format_currency(paid)})",
                                 font=F(11, "bold"), text_color=T.GREEN, anchor="w").pack(
                        fill="x", pady=(4, 0))
                else:
                    bill_row = ctk.CTkFrame(self._credit_frame, fg_color="transparent")
                    bill_row.pack(fill="x", pady=(4, 0))
                    extra = f"  •  Pago: {format_currency(paid)}" if paid > 0 else ""
                    ctk.CTkLabel(bill_row,
                                 text=f"Fatura em aberto: {format_currency(unpaid)}{extra}",
                                 font=F(11), text_color=T.GOLD, anchor="w").pack(side="left")
                    ctk.CTkButton(
                        bill_row, text="Pagar Fatura", height=24, width=110, corner_radius=6,
                        fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                        text_color="#ffffff", font=F(11, "bold"),
                        command=lambda c=card, u=unpaid: self._pay_bill(c, u),
                    ).pack(side="right")

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

    def _pay_bill(self, card: dict, unpaid: float) -> None:
        from ui.dialogs import ConfirmDialog, show_error

        def do_pay():
            try:
                db.settle_card_bill(card["id"], self.month_id,
                                    card.get("closing_day", 1), card["name"])
            except Exception as e:
                show_error(self.winfo_toplevel(), "Erro ao pagar fatura", str(e)[:200])
                return
            self.refresh()
            if self._on_change:
                self._on_change()   # marca Saídas Variáveis / Planejamento p/ atualizar

        ConfirmDialog(
            self.winfo_toplevel(),
            title="Pagar fatura?",
            message=f"A fatura de {format_currency(unpaid)} do cartão "
                    f"{card['name']} será paga.\n\n"
                    "Um lançamento \"Pagamento fatura cartão de crédito\" entra em\n"
                    "Saídas Variáveis (debitando o saldo) e o cartão é zerado.",
            confirm_text="Pagar fatura",
            on_confirm=do_pay,
            danger=False,
        )

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


def _month_label(months_from_now: int) -> str:
    """Retorna 'Mês Ano' a partir de hoje + N meses inteiros."""
    from datetime import date
    today = date.today()
    total = today.month - 1 + months_from_now
    return f"{MONTHS_PT[total % 12]} {today.year + total // 12}"


def _fv(pmt: float, annual_rate: float, years: int) -> float:
    """Valor futuro de aportes mensais com juros compostos."""
    r = (1 + annual_rate) ** (1 / 12) - 1
    n = years * 12
    return pmt * ((1 + r) ** n - 1) / r if r > 0 else pmt * n


def _build_tips(
    s: dict,
    goals:         list  = None,
    categories:    list  = None,
    history:       list  = None,   # summaries de meses anteriores (mais recente primeiro)
    investments:   list  = None,   # objetos de investimento com "category"
    total_inv:     float = 0.0,
    unpaid_cards:  float = 0.0,    # total de faturas em aberto nos cartões
) -> list:
    entradas    = s.get("total_entradas", 0)
    if entradas <= 0:
        return []

    saidas      = s.get("total_saidas", 0)
    saida_fixa  = s.get("saida_fixa", 0)
    entrada_var = s.get("entrada_variavel", 0)
    investidos  = s.get("total_investimentos", 0)
    saldo       = s.get("saldo", 0)
    inv_pct     = investidos / entradas
    gasto_pct   = saidas     / entradas
    savings_pct = max(0.0, saldo / entradas)

    gold_dim  = T.GOLD_DIM
    blue_dim  = T.BLUE_DIM
    green_dim = T.GREEN_DIM
    red_dim   = T.RED_DIM

    alerts   = []
    neutral  = []
    positive = []

    # 0. Fatura(s) de cartão em aberto — sempre no topo
    if unpaid_cards > 0:
        alerts.insert(0, ("💳", "Fatura de cartão em aberto",
            f"Você tem {format_currency(unpaid_cards)} em faturas não pagas. "
            "Acesse a aba de Cartões ou o painel abaixo para pagar antes do vencimento "
            "e evitar juros.",
            T.RED, red_dim))

    # ── Média de aportes (meses com investimento > 0) ─────────────────
    hist_inv = [h.get("total_investimentos", 0) for h in (history or [])]
    all_inv  = [v for v in [investidos] + hist_inv if v > 0]
    avg_inv  = sum(all_inv) / len(all_inv) if all_inv else 0.0

    # =========================================================
    # ALERTAS
    # =========================================================

    # 1. Déficit
    if saldo < 0:
        alerts.append(("!", "Déficit este mês",
            f"Você está gastando {format_currency(abs(saldo))} a mais do que ganha. "
            "Revise os gastos variáveis com urgência e corte o que não é essencial.",
            T.RED, red_dim))

    # 2. Gastos elevados
    elif gasto_pct > 0.80:
        alerts.append(("!", "Gastos elevados",
            f"Despesas consumindo {gasto_pct*100:.0f}% da renda "
            f"({format_currency(saidas)}). Abaixo de 70% é o ideal para ter margem.",
            T.GOLD, gold_dim))

    # 3. Tendência de alta nos gastos (vs mês anterior)
    if history and saidas > 0:
        prev_saidas = history[0].get("total_saidas", 0)
        if prev_saidas > 0:
            crescimento = (saidas - prev_saidas) / prev_saidas
            if crescimento > 0.12:
                alerts.append(("!", "Gastos em tendência de alta",
                    f"Seus gastos subiram {crescimento*100:.0f}% em relação ao mês "
                    f"anterior ({format_currency(prev_saidas)} → {format_currency(saidas)}). "
                    "Se a tendência continuar, seu saldo vai encolher.",
                    T.GOLD, gold_dim))

    # 4. Comprometimento de gastos fixos
    if saida_fixa > 0 and saida_fixa / entradas > 0.55 and saldo >= 0:
        alerts.append(("!", "Compromissos fixos elevados",
            f"Gastos fixos representam {saida_fixa/entradas*100:.0f}% da renda "
            f"({format_currency(saida_fixa)}). Revise assinaturas, parcelas e "
            "aluguéis — quanto menos fixo, mais flexibilidade.",
            T.GOLD, gold_dim))

    # 5. Categorias pesadas
    if categories and saidas > 0:
        pesadas = [c for c in categories if c["total"] / entradas > 0.20]
        if len(pesadas) >= 2:
            nomes = " e ".join(c["category"] for c in pesadas[:2])
            total_pesadas = sum(c["total"] for c in pesadas[:2])
            alerts.append(("!", "Múltiplas categorias pesadas",
                f"{nomes} juntas consomem {total_pesadas/entradas*100:.0f}% da renda "
                f"({format_currency(total_pesadas)}). Focar o corte aqui gera mais impacto.",
                T.GOLD, gold_dim))
        elif len(pesadas) == 1:
            top = pesadas[0]
            alerts.append(("!", f"{top['category']} em destaque",
                f"Gastos com {top['category'].lower()} consomem "
                f"{top['total']/entradas*100:.0f}% da renda "
                f"({format_currency(top['total'])}). Veja se há margem para redução.",
                T.GOLD, gold_dim))

    # =========================================================
    # NEUTROS / EDUCATIVOS
    # =========================================================

    # 6. Queda na taxa de poupança ao longo de 3 meses
    if history and len(history) >= 2:
        rates = []
        for h in history[:3]:
            ent = h.get("total_entradas", 0)
            if ent > 0:
                rates.append(h.get("saldo", 0) / ent)
        if len(rates) >= 2 and rates[0] > savings_pct + 0.07:
            trend = " → ".join(f"{r*100:.0f}%" for r in reversed(rates))
            trend += f" → {savings_pct*100:.0f}%"
            neutral.append(("i", "Taxa de poupança em queda",
                f"Sua taxa de poupança caiu: {trend}. "
                "Identifique o que mudou nos seus gastos antes que vire déficit.",
                T.GOLD, gold_dim))

    # 7. Renda majoritariamente variável
    if entrada_var / entradas > 0.55:
        neutral.append(("i", "Renda predominantemente variável",
            f"{entrada_var/entradas*100:.0f}% das entradas vêm de fontes variáveis. "
            "Para rendas irregulares, a reserva de emergência ideal é de "
            "9 a 12 meses de despesas — não apenas 6.",
            T.GOLD, gold_dim))

    # 8. Reserva de emergência em meses (patrimônio / despesa mensal)
    if total_inv > 0 and saidas > 0:
        meses_cobertos = total_inv / saidas
        if meses_cobertos < 3:
            neutral.append(("i", f"Reserva cobre só {meses_cobertos:.1f} mês(es)",
                f"Seu patrimônio total ({format_currency(total_inv)}) cobre apenas "
                f"{meses_cobertos:.1f} meses de despesas. "
                f"Para 6 meses, você precisa de {format_currency(saidas * 6)}.",
                T.GOLD, gold_dim))
        elif meses_cobertos < 6:
            falta_meses = 6 - meses_cobertos
            neutral.append(("i", f"Reserva em {meses_cobertos:.1f} de 6 meses",
                f"Você está a caminho da reserva ideal. Faltam "
                f"{format_currency(saidas * falta_meses)} para completar 6 meses "
                "de segurança.",
                T.GOLD, gold_dim))

    # 9. Investimentos — dica com valor concreto
    ideal_10 = entradas * 0.10
    ideal_20 = entradas * 0.20
    if investidos == 0:
        sugestao = min(saldo, ideal_10) if saldo > 0 else ideal_10
        neutral.append(("$", "Comece a investir",
            f"Sem investimentos este mês. Aplicar {format_currency(sugestao)} "
            "(10% da renda) em Tesouro Selic ou CDB liquidez diária já é um ótimo começo.",
            T.BLUE, blue_dim))
    elif inv_pct < 0.10:
        neutral.append(("$", "Aumente seus investimentos",
            f"Investindo {inv_pct*100:.1f}% da renda. Mais "
            f"{format_currency(ideal_10 - investidos)} chegaria ao mínimo de 10%.",
            T.BLUE, blue_dim))
    elif inv_pct < 0.20:
        neutral.append(("$", "Você está no caminho certo",
            f"Investindo {inv_pct*100:.1f}% da renda. Mais "
            f"{format_currency(ideal_20 - investidos)} atingiria os 20% da regra 50/30/20.",
            T.BLUE, blue_dim))

    # 10. Concentração do portfólio
    if investments and len(investments) >= 2:
        from collections import Counter
        cats = Counter(i.get("category", "Outros") for i in investments)
        top_cat, top_n = cats.most_common(1)[0]
        conc = top_n / len(investments)
        if conc >= 0.75:
            neutral.append(("i", "Portfólio concentrado",
                f"{top_n} de {len(investments)} investimentos estão em {top_cat} "
                f"({conc*100:.0f}% do portfólio). Diversificar reduz risco e "
                "pode melhorar a rentabilidade.",
                T.GOLD, gold_dim))

    # 11. Metas sem aporte
    if goals is not None and len(goals) > 0:
        active  = [g for g in goals if float(g.get("target_amount") or 0) > 0]
        paradas = [g for g in active if float(g.get("saved_amount") or 0) == 0]
        if len(paradas) >= 2:
            neutral.append(("i", f"{len(paradas)} metas sem nenhum aporte",
                f'"{paradas[0]["name"]}" e "{paradas[1]["name"]}" ainda não têm '
                "progresso. Aportes regulares, mesmo pequenos, fazem a diferença.",
                T.GOLD, gold_dim))

    # =========================================================
    # POSITIVOS
    # =========================================================

    # 12. Projeção de conclusão de meta com data
    if goals and avg_inv > 0:
        active = [g for g in goals
                  if float(g.get("target_amount") or 0) > float(g.get("saved_amount") or 0) > 0]
        if active:
            g       = active[0]
            target  = float(g["target_amount"])
            saved   = float(g["saved_amount"])
            restante = target - saved
            meses   = max(1, round(restante / avg_inv))
            label   = _month_label(meses)
            positive.append(("*", f"Previsão: {g['name']}",
                f"No ritmo atual ({format_currency(avg_inv)}/mês), você conclui "
                f'"{g["name"]}" em ~{meses} {"meses" if meses > 1 else "mês"} '
                f"({label}).",
                T.GREEN, green_dim))

    # 13. Projeção de juros compostos (5 e 10 anos)
    if avg_inv >= 50:
        fv5  = _fv(avg_inv, 0.12, 5)
        fv10 = _fv(avg_inv, 0.12, 10)
        depositos5 = avg_inv * 60
        positive.append(("$", "Poder dos juros compostos",
            f"Mantendo {format_currency(avg_inv)}/mês a 12% a.a. (≈CDI): "
            f"em 5 anos → {format_currency(fv5)} "
            f"(depósitos: {format_currency(depositos5)}). "
            f"Em 10 anos → {format_currency(fv10)}.",
            T.BLUE, blue_dim))

    # 14. Reserva de emergência completa
    if total_inv > 0 and saidas > 0 and total_inv / saidas >= 6:
        meses_cobertos = total_inv / saidas
        positive.append(("*", f"Reserva de emergência OK",
            f"Seu patrimônio ({format_currency(total_inv)}) cobre "
            f"{meses_cobertos:.1f} meses de despesas — acima dos 6 meses "
            "recomendados. Excelente segurança financeira!",
            T.GREEN, green_dim))

    # 15. Todas as metas concluídas
    if goals is not None and len(goals) > 0:
        active = [g for g in goals if float(g.get("target_amount") or 0) > 0]
        done   = [g for g in active
                  if float(g.get("saved_amount") or 0) >= float(g.get("target_amount") or 1)]
        if active and len(done) == len(active):
            positive.append(("*", "Todas as metas concluídas!",
                f"Parabéns! Todas as suas {len(active)} metas foram atingidas. "
                "Hora de definir novos desafios — ou elevar os aportes.",
                T.GREEN, green_dim))
        else:
            for g in active:
                tgt = float(g.get("target_amount") or 1)
                svd = float(g.get("saved_amount") or 0)
                pct = svd / tgt if tgt > 0 else 0
                if 0.80 <= pct < 1.0:
                    positive.append(("*", "Meta quase concluída!",
                        f'"{g["name"]}" está em {pct*100:.0f}%! '
                        f"Falta apenas {format_currency(tgt - svd)}.",
                        T.GREEN, green_dim))
                    break

    # 16. Ótimo investidor
    if inv_pct >= 0.20:
        positive.append(("*", "Ótimo investidor!",
            f"Parabéns! {inv_pct*100:.1f}% da renda investida "
            f"({format_currency(investidos)}). Considere diversificar entre "
            "renda fixa (CDB, LCI/LCA, Tesouro IPCA+) e variável (ações, FIIs).",
            T.GREEN, green_dim))

    # 17. Taxa de poupança excelente
    if savings_pct >= 0.25 and inv_pct >= 0.15 and not alerts:
        positive.append(("*", "Taxa de poupança excelente",
            f"Guardando {savings_pct*100:.0f}% da renda e investindo "
            f"{inv_pct*100:.0f}%. Os juros compostos trabalham por você "
            "— cada mês de consistência vale muito.",
            T.GREEN, green_dim))

    # 18. Mês equilibrado (fallback)
    elif saldo >= 0 and inv_pct >= 0.10 and gasto_pct <= 0.70 and not alerts:
        positive.append(("*", "Mês equilibrado",
            f"Gastos em {gasto_pct*100:.0f}%, {inv_pct*100:.0f}% investido e "
            f"saldo positivo de {format_currency(saldo)}. Continue assim.",
            T.GREEN, green_dim))

    # Prioridade: alertas → neutros → positivos, máximo 3
    return (alerts + neutral + positive)[:3]
