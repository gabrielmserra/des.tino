"""Aba de Planejamento: gerar plano de alocação por categoria, revisar e acompanhar."""
import threading
import customtkinter as ctk
from typing import Callable, Optional

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import format_currency, apply_app_icon, PLAN_CATEGORIES
from utils.plan_strategy import suggest_allocations, estimate_income, INVESTMENT_CAP_PCT


def _parse_amount(raw: str) -> float:
    raw = raw.strip().replace(".", "").replace(",", ".") if raw.count(",") else raw.strip().replace(",", ".")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


class PlanningTab(ctk.CTkFrame):
    def __init__(self, parent, month_id: int, on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self.month_id   = month_id
        self._on_change = on_change
        self._review_rows: dict = {}  # categoria → widgets (modo revisão)

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        self._header = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=12,
                                    border_width=1, border_color=T.BORDER)
        self._header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        self._header.grid_columnconfigure((0, 1, 2), weight=1)

        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._scroll.grid(row=1, column=0, sticky="nsew", padx=28, pady=(14, 24))
        self._scroll.grid_columnconfigure(0, weight=1)

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        self._clear()
        self._header.grid_remove()
        ctk.CTkLabel(self._scroll, text="Carregando plano…",
                     font=F(13), text_color=T.MUTED).pack(pady=40)
        month_id = self.month_id

        def _fetch():
            try:
                plan     = db.get_plan(month_id)
                items    = db.get_plan_items(plan["id"]) if plan else []
                realized = db.get_plan_realized(month_id)
            except Exception:
                plan, items, realized = None, [], {}
            if month_id == self.month_id:
                self.after(0, lambda: self._apply(plan, items, realized))

        threading.Thread(target=_fetch, daemon=True).start()

    def _apply(self, plan, items, realized) -> None:
        self._clear()
        if plan is None:
            self._render_empty()
        else:
            self._render_tracking(plan, items, realized)

    def _clear(self) -> None:
        for w in self._header.winfo_children():
            w.destroy()
        for w in self._scroll.winfo_children():
            w.destroy()
        self._review_rows = {}

    # ==================================================================
    # Estado 1 — sem plano
    # ==================================================================
    def _render_empty(self) -> None:
        box = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=14,
                           border_width=1, border_color=T.BORDER)
        box.pack(fill="x", pady=(30, 0))

        ctk.CTkLabel(box, text="📋", font=F(34)).pack(pady=(36, 6))
        ctk.CTkLabel(box, text="Este mês ainda não tem um plano",
                     font=F(17, "bold"), text_color=T.TEXT).pack()
        ctk.CTkLabel(
            box,
            text="Gere uma sugestão de alocação por categoria com base no seu\n"
                 "histórico de gastos e destine sua renda antes de gastar.",
            font=F(12), text_color=T.MUTED, justify="center",
        ).pack(pady=(6, 18))

        ctk.CTkButton(
            box, text="⚡  Gerar plano do mês", command=self._generate,
            height=42, width=240, corner_radius=10,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).pack(pady=(0, 36))

    # ==================================================================
    # Geração da sugestão
    # ==================================================================
    def _generate(self) -> None:
        self._clear()
        ctk.CTkLabel(self._scroll, text="Calculando sugestão com base no histórico…",
                     font=F(13), text_color=T.MUTED).pack(pady=40)
        month_id = self.month_id

        def _fetch():
            try:
                expenses_hist, income_hist = db.get_plan_history(month_id)
                income = db.get_month_income(month_id, include_expectations=True)
            except Exception:
                expenses_hist, income_hist, income = [], [], 0.0
            if month_id == self.month_id:
                self.after(0, lambda: self._ask_income_and_render(
                    expenses_hist, income_hist, income))

        threading.Thread(target=_fetch, daemon=True).start()

    def _ask_income_and_render(self, expenses_hist: list, income_hist: list,
                               income: float) -> None:
        """Mês sem entradas → pede uma estimativa de renda antes de sugerir."""
        if income <= 0:
            dlg = _IncomeDialog(self.winfo_toplevel(),
                                suggested=estimate_income(income_hist))
            self.winfo_toplevel().wait_window(dlg)
            income = dlg.amount or 0.0

        suggestions = suggest_allocations(expenses_hist, income_hist, income)
        rows = [{
            "category":         cat,
            "planned_amount":   s["amount"],
            "suggested_amount": s["amount"],
            "is_eventual":      s["eventual"],
            "capped":           s.get("capped", False),
        } for cat, s in suggestions.items()]
        rows.sort(key=lambda r: r["planned_amount"], reverse=True)
        self._render_review(income, rows, n_hist=len(expenses_hist))

    # ==================================================================
    # Estado 2 — revisão / edição do plano
    # ==================================================================
    def _render_review(self, income: float, rows: list, n_hist: int = -1) -> None:
        self._clear()
        self._header.grid()

        ctk.CTkLabel(self._header, text="Revisão do plano",
                     font=F(14, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, padx=18, pady=(14, 2), sticky="w")

        # Renda editável + totais dinâmicos
        ctk.CTkLabel(self._header, text="RENDA DO MÊS (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, padx=(18, 6), sticky="w")
        ctk.CTkLabel(self._header, text="TOTAL ALOCADO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=1, padx=6, sticky="w")
        ctk.CTkLabel(self._header, text="SOBRA NÃO ALOCADA", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=2, padx=6, sticky="w")

        self._income_entry = ctk.CTkEntry(
            self._header, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._income_entry.grid(row=2, column=0, padx=(18, 6), pady=(4, 0), sticky="ew")
        if income > 0:
            self._income_entry.insert(0, f"{income:.2f}".replace(".", ","))
        self._income_entry.bind("<KeyRelease>", lambda _: self._recalc())

        self._alloc_lbl = ctk.CTkLabel(self._header, text="R$ 0,00",
                                       font=F(16, "bold"), text_color=T.BLUE, anchor="w")
        self._alloc_lbl.grid(row=2, column=1, padx=6, sticky="w")

        self._spare_lbl = ctk.CTkLabel(self._header, text="R$ 0,00",
                                       font=F(16, "bold"), text_color=T.GREEN, anchor="w")
        self._spare_lbl.grid(row=2, column=2, padx=6, sticky="w")

        self._spare_hint = ctk.CTkLabel(self._header, text="", font=F(11),
                                        text_color=T.MUTED, anchor="w")
        self._spare_hint.grid(row=3, column=0, columnspan=3, padx=18, pady=(4, 0), sticky="w")

        # Botões
        btns = ctk.CTkFrame(self._header, fg_color="transparent")
        btns.grid(row=4, column=0, columnspan=3, padx=18, pady=(8, 14), sticky="w")
        ctk.CTkButton(
            btns, text="✓  Confirmar plano", command=self._confirm,
            height=36, width=170, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(12, "bold"),
        ).pack(side="left", padx=(0, 8))
        ctk.CTkButton(
            btns, text="Cancelar", command=self.refresh,
            height=36, width=110, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L, text_color=T.MUTED,
        ).pack(side="left")

        # Aviso de histórico insuficiente
        if n_hist == 0 and not rows:
            notice = ctk.CTkFrame(self._scroll, fg_color=T.GOLD_DIM, corner_radius=10)
            notice.pack(fill="x", pady=(0, 10))
            ctk.CTkLabel(
                notice,
                text="💡  Ainda não há histórico de gastos para sugerir valores.\n"
                     "Sem problemas: adicione as categorias abaixo e monte seu primeiro plano manualmente.",
                font=F(12), text_color=T.GOLD, justify="left",
            ).pack(anchor="w", padx=14, pady=10)
        elif 1 <= n_hist <= 2:
            ctk.CTkLabel(
                self._scroll,
                text=f"Sugestão proporcional à renda, com base em {n_hist} {'mês' if n_hist == 1 else 'meses'} de histórico "
                     f"(teto de Investimentos: {INVESTMENT_CAP_PCT * 100:.0f}% da renda).",
                font=F(11), text_color=T.MUTED, anchor="w",
            ).pack(anchor="w", pady=(0, 8))
        elif n_hist >= 3:
            ctk.CTkLabel(
                self._scroll,
                text="Sugestão proporcional à renda: percentuais médios dos últimos 3 meses (pesos 50/30/20), "
                     f"limitada à renda do mês e com teto de {INVESTMENT_CAP_PCT * 100:.0f}% para Investimentos.",
                font=F(11), text_color=T.MUTED, anchor="w",
            ).pack(anchor="w", pady=(0, 8))

        # Adicionar categoria
        add_bar = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=10,
                               border_width=1, border_color=T.BORDER)
        add_bar.pack(fill="x", pady=(0, 12))
        add_bar.grid_columnconfigure(0, weight=1)
        self._add_combo = ctk.CTkComboBox(
            add_bar, values=self._available_categories(),
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.CARD2, button_hover_color=T.BORDER_L,
            dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
            dropdown_hover_color=T.BORDER_L, corner_radius=8,
        )
        self._add_combo.set("")
        self._add_combo.grid(row=0, column=0, padx=(12, 6), pady=10, sticky="ew")
        ctk.CTkButton(
            add_bar, text="+ Adicionar categoria", command=self._add_category,
            height=32, width=170, corner_radius=8,
            fg_color=T.GREEN_DIM, hover_color=T.GREEN, text_color=T.GREEN,
        ).grid(row=0, column=1, padx=(0, 12), pady=10)

        self._rows_box = ctk.CTkFrame(self._scroll, fg_color="transparent")
        self._rows_box.pack(fill="x")

        for r in rows:
            self._make_review_row(
                r["category"],
                float(r.get("planned_amount") or 0),
                r.get("suggested_amount"),
                bool(r.get("is_eventual")),
                bool(r.get("capped")),
            )
        self._recalc()

    def _available_categories(self) -> list:
        return [c for c in PLAN_CATEGORIES if c not in self._review_rows]

    def _make_review_row(self, category: str, planned: float,
                         suggested, eventual: bool, capped: bool = False) -> None:
        row = ctk.CTkFrame(self._rows_box, fg_color=T.CARD, corner_radius=10,
                           border_width=1, border_color=T.BORDER)
        row.pack(fill="x", pady=(0, 8))
        row.grid_columnconfigure(0, weight=1)

        name_box = ctk.CTkFrame(row, fg_color="transparent")
        name_box.grid(row=0, column=0, padx=16, pady=12, sticky="w")
        ctk.CTkLabel(name_box, text=category, font=F(13, "bold"),
                     text_color=T.TEXT, anchor="w").pack(side="left")
        if eventual:
            badge = ctk.CTkFrame(name_box, fg_color=T.GOLD_DIM, corner_radius=6)
            badge.pack(side="left", padx=(8, 0))
            ctk.CTkLabel(badge, text="eventual", font=F(10, "bold"),
                         text_color=T.GOLD).pack(padx=7, pady=1)
        if capped:
            badge = ctk.CTkFrame(name_box, fg_color=T.VIOLET_DIM, corner_radius=6)
            badge.pack(side="left", padx=(8, 0))
            ctk.CTkLabel(badge, text=f"teto {INVESTMENT_CAP_PCT * 100:.0f}%",
                         font=F(10, "bold"), text_color=T.VIOLET).pack(padx=7, pady=1)
        if suggested is not None and float(suggested) > 0:
            ctk.CTkLabel(name_box, text=f"sugerido: {format_currency(float(suggested))}",
                         font=F(11), text_color=T.MUTED).pack(side="left", padx=(10, 0))

        entry = ctk.CTkEntry(
            row, width=130, placeholder_text="0,00", justify="right",
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        entry.grid(row=0, column=1, padx=6, pady=12)
        if planned > 0:
            entry.insert(0, f"{planned:.2f}".replace(".", ","))
        entry.bind("<KeyRelease>", lambda _: self._recalc())

        ctk.CTkButton(
            row, text="✕", width=32, height=32, corner_radius=8,
            fg_color="transparent", hover_color=T.RED,
            border_width=1, border_color=T.BORDER_L, text_color=T.MUTED,
            command=lambda c=category: self._remove_category(c),
        ).grid(row=0, column=2, padx=(0, 12), pady=12)

        self._review_rows[category] = {
            "frame": row, "entry": entry,
            "suggested": suggested, "eventual": eventual,
        }

    def _add_category(self) -> None:
        cat = self._add_combo.get().strip()
        if not cat or cat in self._review_rows:
            return
        self._make_review_row(cat, 0.0, None, False)
        self._add_combo.configure(values=self._available_categories())
        self._add_combo.set("")
        self._recalc()

    def _remove_category(self, category: str) -> None:
        info = self._review_rows.pop(category, None)
        if info:
            info["frame"].destroy()
        self._add_combo.configure(values=self._available_categories())
        self._recalc()

    def _recalc(self) -> None:
        income = _parse_amount(self._income_entry.get())
        total  = sum(_parse_amount(i["entry"].get()) for i in self._review_rows.values())
        self._alloc_lbl.configure(text=format_currency(total))

        if income > 0:
            spare = income - total
            self._spare_lbl.configure(
                text=format_currency(spare),
                text_color=T.RED if spare < 0 else T.GREEN,
            )
            inv_info = self._review_rows.get("Investimentos")
            inv_val  = _parse_amount(inv_info["entry"].get()) if inv_info else 0.0
            if spare < 0:
                self._spare_hint.configure(
                    text="⚠  O total alocado ultrapassa a renda do mês.",
                    text_color=T.RED)
            elif inv_val > income * INVESTMENT_CAP_PCT:
                self._spare_hint.configure(
                    text=f"⚠  Investimentos acima do teto recomendado de "
                         f"{INVESTMENT_CAP_PCT * 100:.0f}% da renda "
                         f"(máx. sugerido: {format_currency(income * INVESTMENT_CAP_PCT)}).",
                    text_color=T.GOLD)
            else:
                self._spare_hint.configure(
                    text="A sobra não alocada pode virar poupança ou investimento.",
                    text_color=T.MUTED)
        else:
            self._spare_lbl.configure(text="—", text_color=T.MUTED)
            self._spare_hint.configure(
                text="Sem renda informada — a sobra não é calculada.",
                text_color=T.MUTED)

    def _confirm(self) -> None:
        income = _parse_amount(self._income_entry.get())
        items  = [{
            "category":         cat,
            "planned_amount":   _parse_amount(info["entry"].get()),
            "suggested_amount": info["suggested"],
            "is_eventual":      info["eventual"],
        } for cat, info in self._review_rows.items()]
        month_id = self.month_id

        def _save():
            try:
                db.save_plan(month_id, income, items)
            except Exception as e:
                self.after(0, lambda err=e: self._save_failed(err))
                return
            if month_id == self.month_id:
                self.after(0, self._save_done)

        threading.Thread(target=_save, daemon=True).start()

    def _save_done(self) -> None:
        self.refresh()
        if self._on_change:
            self._on_change()

    def _save_failed(self, err: Exception) -> None:
        from ui.dialogs import show_error
        show_error(self.winfo_toplevel(), "Erro ao salvar plano", str(err)[:200])

    # ==================================================================
    # Estado 3 — acompanhamento (plano vs. realizado) / fechamento
    # ==================================================================
    def _render_tracking(self, plan: dict, items: list, realized: dict) -> None:
        self._header.grid()
        closed  = plan.get("status") == "fechado"
        income  = float(plan.get("income") or 0)
        planned_total = sum(float(i["planned_amount"] or 0) for i in items)
        spent_in_plan = sum(realized.get(i["category"], 0.0) for i in items)
        out_of_plan   = {c: v for c, v in realized.items()
                         if v > 0 and c not in {i["category"] for i in items}}
        spent_total   = spent_in_plan + sum(out_of_plan.values())

        # ── Header ────────────────────────────────────────────────────
        title_row = ctk.CTkFrame(self._header, fg_color="transparent")
        title_row.grid(row=0, column=0, columnspan=3, padx=18, pady=(14, 2), sticky="ew")
        ctk.CTkLabel(title_row, text="Plano do mês",
                     font=F(14, "bold"), text_color=T.TEXT).pack(side="left")

        chip_color = T.MUTED if closed else T.GREEN
        chip_dim   = T.CARD2 if closed else T.GREEN_DIM
        chip = ctk.CTkFrame(title_row, fg_color=chip_dim, corner_radius=6)
        chip.pack(side="left", padx=(10, 0))
        ctk.CTkLabel(chip, text="fechado" if closed else "ativo",
                     font=F(10, "bold"), text_color=chip_color).pack(padx=8, pady=1)

        upd = str(plan.get("updated_at") or "")[:16].replace("T", " às ")
        if upd:
            ctk.CTkLabel(title_row, text=f"última modificação: {upd}",
                         font=F(11), text_color=T.SUBTLE).pack(side="left", padx=(10, 0))

        if not closed:
            ctk.CTkButton(
                title_row, text="✎  Editar plano",
                command=lambda: self._render_review(income, items, n_hist=-1),
                height=30, width=130, corner_radius=8,
                fg_color="transparent", hover_color=T.CARD2,
                border_width=1, border_color=T.BORDER_L,
                text_color=T.MUTED, font=F(12),
            ).pack(side="right")

        for col, (label, value, color) in enumerate([
            ("RENDA",         income,        T.GREEN),
            ("ALOCADO",       planned_total, T.BLUE),
            ("GASTO ATÉ AGORA" if not closed else "GASTO FINAL", spent_total, T.RED),
        ]):
            ctk.CTkLabel(self._header, text=label, font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=1, column=col, padx=(18 if col == 0 else 6, 6), sticky="w")
            ctk.CTkLabel(self._header, text=format_currency(value),
                         font=F(16, "bold"), text_color=color, anchor="w").grid(
                row=2, column=col, padx=(18 if col == 0 else 6, 6), pady=(0, 4), sticky="w")

        if income > 0:
            spare = income - planned_total
            saldo = income - spent_total
            extra = (f"Sobra não alocada: {format_currency(spare)}"
                     f"   •   {'Saldo final do mês' if closed else 'Saldo atual do mês'}: {format_currency(saldo)}")
            ctk.CTkLabel(self._header, text=extra, font=F(12),
                         text_color=T.RED if saldo < 0 else T.MUTED, anchor="w").grid(
                row=3, column=0, columnspan=3, padx=18, pady=(0, 14), sticky="w")
        else:
            ctk.CTkLabel(self._header, text="Renda não informada — sobra e saldo não calculados.",
                         font=F(12), text_color=T.MUTED, anchor="w").grid(
                row=3, column=0, columnspan=3, padx=18, pady=(0, 14), sticky="w")

        # ── Linhas por categoria ──────────────────────────────────────
        if not items:
            ctk.CTkLabel(self._scroll,
                         text="Plano sem categorias. Use “Editar plano” para adicioná-las.",
                         font=F(13), text_color=T.MUTED).pack(pady=30)
        for item in items:
            cat     = item["category"]
            planned = float(item["planned_amount"] or 0)
            spent   = realized.get(cat, 0.0)
            self._make_tracking_row(cat, planned, spent, bool(item.get("is_eventual")))

        # ── Fora do plano ─────────────────────────────────────────────
        if out_of_plan:
            block = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=12,
                                 border_width=1, border_color=T.BORDER)
            block.pack(fill="x", pady=(12, 0))
            hdr = ctk.CTkFrame(block, fg_color="transparent")
            hdr.pack(fill="x", padx=16, pady=(14, 6))
            ctk.CTkLabel(hdr, text="Fora do plano", font=F(13, "bold"),
                         text_color=T.VIOLET).pack(side="left")
            ctk.CTkLabel(hdr, text=f"{format_currency(sum(out_of_plan.values()))} em categorias não planejadas",
                         font=F(11), text_color=T.MUTED).pack(side="left", padx=(10, 0))
            for cat, val in sorted(out_of_plan.items(), key=lambda x: x[1], reverse=True):
                line = ctk.CTkFrame(block, fg_color="transparent")
                line.pack(fill="x", padx=16, pady=(0, 6))
                ctk.CTkLabel(line, text=cat, font=F(12),
                             text_color=T.TEXT, anchor="w").pack(side="left")
                ctk.CTkLabel(line, text=format_currency(val), font=F(12, "bold"),
                             text_color=T.VIOLET, anchor="e").pack(side="right")
            ctk.CTkFrame(block, height=8, fg_color="transparent").pack()

    def _make_tracking_row(self, category: str, planned: float,
                           spent: float, eventual: bool) -> None:
        pct = (spent / planned) if planned > 0 else (1.0 if spent > 0 else 0.0)
        is_investment = category == "Investimentos"
        if is_investment:
            # Semântica invertida: atingir/ultrapassar o aporte planejado é positivo
            color = T.GREEN if pct >= 1.0 else T.VIOLET
        elif pct >= 1.0:
            color = T.RED
        elif pct >= 0.7:
            color = T.GOLD
        else:
            color = T.GREEN

        row = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=12,
                           border_width=1, border_color=T.BORDER)
        row.pack(fill="x", pady=(0, 8))
        row.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(row, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=16, pady=(12, 2))
        top.grid_columnconfigure(0, weight=1)

        name_box = ctk.CTkFrame(top, fg_color="transparent")
        name_box.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(name_box, text=category, font=F(13, "bold"),
                     text_color=T.TEXT, anchor="w").pack(side="left")
        if eventual:
            badge = ctk.CTkFrame(name_box, fg_color=T.GOLD_DIM, corner_radius=6)
            badge.pack(side="left", padx=(8, 0))
            ctk.CTkLabel(badge, text="eventual", font=F(10, "bold"),
                         text_color=T.GOLD).pack(padx=7, pady=1)

        pct_txt = f"{pct * 100:.0f}%" if planned > 0 else "sem teto"
        if pct >= 1.0 and planned > 0:
            pct_txt = f"✓ {pct_txt}" if is_investment else f"⚠ {pct_txt}"
        ctk.CTkLabel(top, text=pct_txt, font=F(13, "bold"),
                     text_color=color, anchor="e").grid(row=0, column=1, sticky="e")

        restante = planned - spent
        verb = "aportado" if is_investment else "gasto"
        if restante < 0:
            tail = ("acima do plano em " if is_investment else "excedido em ") + format_currency(abs(restante))
        else:
            tail = ("falta aportar " if is_investment else "restante ") + format_currency(restante)
        ctk.CTkLabel(
            row,
            text=f"planejado {format_currency(planned)}   •   {verb} {format_currency(spent)}"
                 f"   •   {tail}",
            font=F(11), text_color=T.MUTED, anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=16, pady=(0, 8))

        bar_bg = ctk.CTkFrame(row, height=8, fg_color=T.CARD2, corner_radius=4)
        bar_bg.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 14))
        bar_bg.grid_propagate(False)
        if pct > 0:
            ctk.CTkFrame(bar_bg, height=8, fg_color=color, corner_radius=4).place(
                x=0, y=0, relheight=1, relwidth=min(pct, 1.0))


# ──────────────────────────────────────────────────────────────────────
class _IncomeDialog(ctk.CTkToplevel):
    """Pede uma estimativa de renda quando o mês ainda não tem entradas."""

    def __init__(self, parent, suggested: float = 0.0):
        super().__init__(parent)
        self.title("Renda do mês")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self.amount: Optional[float] = None
        self._build(suggested)
        self._center(parent)
        self.lift()
        self.focus()
        apply_app_icon(self)

    def _center(self, parent) -> None:
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width()  - 420) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 280) // 2
        self.geometry(f"420x280+{px}+{py}")

    def _build(self, suggested: float) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Quanto deve entrar este mês?",
                     font=F(15, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 4))
        ctk.CTkLabel(
            self,
            text="Ainda não há entradas registradas neste mês.\n"
                 "Informe uma estimativa: ela será o máximo distribuível entre\n"
                 f"as categorias, com teto de {INVESTMENT_CAP_PCT * 100:.0f}% para Investimentos.",
            font=F(11), text_color=T.MUTED, justify="center",
        ).grid(row=1, column=0)

        ctk.CTkLabel(self, text="RENDA ESTIMADA (R$)", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=2, column=0, pady=(12, 0))
        self._entry = ctk.CTkEntry(
            self, placeholder_text="0,00", width=200, justify="center",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._entry.grid(row=3, column=0, pady=(4, 0))
        if suggested > 0:
            self._entry.insert(0, f"{suggested:.2f}".replace(".", ","))
            ctk.CTkLabel(self, text="pré-preenchido com a média das suas entradas recentes",
                         font=F(10), text_color=T.SUBTLE).grid(row=4, column=0, pady=(3, 0))
        self._entry.bind("<Return>", lambda _: self._confirm())
        self._entry.focus()

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=5, column=0, pady=16)

        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Continuar", width=120,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        self.amount = _parse_amount(self._entry.get())
        self.destroy()
