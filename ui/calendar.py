"""Calendário financeiro: uma VISÃO sobre tudo que já tem data no app —
contas fixas, dívidas, metas, fatura de cartão e previstos/renda
planejada (migration 049, get_calendar_events) — não uma tabela nova de
compromissos. Marcar como feito reaproveita os RPCs que já existiam
antes desta tela (ver database.py:mark_calendar_event_done)."""
import calendar as _pycalendar
import threading
from datetime import date, datetime, timedelta
from typing import Callable, Optional

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from ui.debts import _BaseDialog, _parse_amount
from utils.helpers import format_currency, MONTHS_PT

_WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]

_SOURCE_LABELS = {
    "fixed_bill": "Conta fixa",
    "fixed_bill_projected": "Conta fixa (prevista)",
    "debt": "Dívida",
    "goal": "Meta",
    "card_invoice": "Fatura de cartão",
    "card_invoice_open": "Fatura em aberto",
    "card_installment": "Parcela de cartão",
    "expectation": "Previsto",
    "income": "Entrada prevista",
    "income_projected": "Entrada prevista (repete o último plano)",
}


class CalendarTab(ctk.CTkFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._on_change = on_change or (lambda: None)
        today = date.today()
        self._year = today.year
        self._month = today.month
        self._events: list = []
        self._by_day: dict = {}

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        header = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        header.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(header, text="Calendário", font=F(26, "bold"),
                     text_color=T.TEXT, anchor="w").grid(row=0, column=0, sticky="w")

        ctk.CTkLabel(
            self, text="Tudo que já tem data neste app, num lugar só — contas fixas, "
                        "dívidas, metas, fatura de cartão e previstos.",
            font=F(12), text_color=T.MUTED, anchor="w",
        ).grid(row=1, column=0, sticky="ew", padx=28, pady=(6, 0))

        nav = ctk.CTkFrame(self, fg_color="transparent")
        nav.grid(row=1, column=0, sticky="ew", padx=28, pady=(10, 0))
        nav.grid_columnconfigure(1, weight=1)
        ctk.CTkButton(nav, text="‹", width=36, height=32, corner_radius=8,
                      fg_color=T.CARD2, hover_color=T.BORDER_L, text_color=T.TEXT,
                      command=self._prev_month).grid(row=0, column=0)
        self._month_lbl = ctk.CTkLabel(nav, text="", font=F(14, "bold"), text_color=T.TEXT)
        self._month_lbl.grid(row=0, column=1)
        ctk.CTkButton(nav, text="›", width=36, height=32, corner_radius=8,
                      fg_color=T.CARD2, hover_color=T.BORDER_L, text_color=T.TEXT,
                      command=self._next_month).grid(row=0, column=2)

        body = ctk.CTkFrame(self, fg_color="transparent")
        body.grid(row=2, column=0, sticky="nsew", padx=28, pady=(14, 24))
        for c in range(7):
            body.grid_columnconfigure(c, weight=1)
        self._grid = body

    # ------------------------------------------------------------------
    def _prev_month(self) -> None:
        if self._month == 1:
            self._year -= 1
            self._month = 12
        else:
            self._month -= 1
        self.refresh()

    def _next_month(self) -> None:
        if self._month == 12:
            self._year += 1
            self._month = 1
        else:
            self._month += 1
        self.refresh()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        self._month_lbl.configure(text=f"{MONTHS_PT[self._month - 1]} {self._year}")
        for w in self._grid.winfo_children():
            w.destroy()
        ctk.CTkLabel(self._grid, text="Carregando…", font=F(13),
                     text_color=T.MUTED).grid(row=0, column=0, columnspan=7, pady=40)

        year, month = self._year, self._month
        last_day = _pycalendar.monthrange(year, month)[1]
        start = date(year, month, 1)
        end = date(year, month, last_day)

        def _fetch():
            try:
                events = db.get_calendar_events(start, end)
            except Exception:
                events = []
            self.after(0, lambda: self._apply(events))

        threading.Thread(target=_fetch, daemon=True).start()

    def _apply(self, events: list) -> None:
        self._events = events
        self._by_day = {}
        for e in events:
            day = int(str(e["event_date"])[8:10])
            self._by_day.setdefault(day, []).append(e)
        self._render_grid()

    # ------------------------------------------------------------------
    def _render_grid(self) -> None:
        for w in self._grid.winfo_children():
            w.destroy()

        for col, wd in enumerate(_WEEKDAYS):
            ctk.CTkLabel(self._grid, text=wd, font=F(11, "bold"),
                         text_color=T.MUTED).grid(row=0, column=col, pady=(0, 4))

        year, month = self._year, self._month
        first_weekday = (date(year, month, 1).weekday() + 1) % 7  # 0=domingo
        last_day = _pycalendar.monthrange(year, month)[1]
        today = date.today()

        row, col = 1, first_weekday
        for day in range(1, last_day + 1):
            day_events = self._by_day.get(day, [])
            is_today = (year == today.year and month == today.month and day == today.day)
            has_overdue = any(e["status"] == "overdue" for e in day_events)
            income = sum(float(e["amount"]) for e in day_events if e["is_income"])
            expense = sum(float(e["amount"]) for e in day_events if not e["is_income"])

            cell = ctk.CTkFrame(
                self._grid, corner_radius=8, height=72,
                fg_color=T.RED_DIM if has_overdue else T.CARD,
                border_width=2 if is_today else 1,
                border_color=T.BLUE if is_today else T.BORDER,
            )
            cell.grid(row=row, column=col, sticky="nsew", padx=2, pady=2)
            cell.grid_propagate(False)
            cell.bind("<Button-1>", lambda ev, d=day: self._open_day(d))

            lbl = ctk.CTkLabel(cell, text=str(day), font=F(12, "bold"), text_color=T.TEXT)
            lbl.place(x=6, y=4)
            lbl.bind("<Button-1>", lambda ev, d=day: self._open_day(d))

            y_off = 26
            if expense > 0:
                l = ctk.CTkLabel(cell, text=f"-{format_currency(expense)}", font=F(9, "bold"), text_color=T.RED)
                l.place(x=6, y=y_off)
                l.bind("<Button-1>", lambda ev, d=day: self._open_day(d))
                y_off += 16
            if income > 0:
                l = ctk.CTkLabel(cell, text=f"+{format_currency(income)}", font=F(9, "bold"), text_color=T.GREEN)
                l.place(x=6, y=y_off)
                l.bind("<Button-1>", lambda ev, d=day: self._open_day(d))

            col += 1
            if col > 6:
                col = 0
                row += 1

    # ------------------------------------------------------------------
    def _open_day(self, day: int) -> None:
        events = self._by_day.get(day, [])
        dlg = _DayEventsDialog(self.winfo_toplevel(), self._year, self._month, day, events)
        self.winfo_toplevel().wait_window(dlg)
        if dlg.changed:
            self.refresh()
            self._on_change()


# ──────────────────────────────────────────────────────────────────────
class _DayEventsDialog(_BaseDialog):
    def __init__(self, parent, year: int, month: int, day: int, events: list):
        self.changed = False
        self._year, self._month, self._day = year, month, day
        self._events = events
        super().__init__(parent, f"{day} de {MONTHS_PT[month - 1]}", 460, 640)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(self, text=f"{self._day} de {MONTHS_PT[self._month - 1]}",
                     font=F(15, "bold"), text_color=T.TEXT).grid(row=0, column=0, pady=(16, 6))

        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=T.BORDER, scrollbar_button_hover_color=T.MUTED,
        )
        self._scroll.grid(row=1, column=0, sticky="nsew", padx=20)
        self._scroll.grid_columnconfigure(0, weight=1)
        self._render_events()

        self._add_box = ctk.CTkFrame(self, fg_color=T.CARD2, corner_radius=10)
        self._add_box.grid(row=2, column=0, sticky="ew", padx=20, pady=(10, 0))
        self._build_add_form(self._add_box)

        ctk.CTkButton(self, text="Fechar", command=self.destroy,
                      height=34, corner_radius=8, fg_color="transparent",
                      hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED).grid(row=3, column=0, pady=14)

    def _render_events(self) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()
        if not self._events:
            ctk.CTkLabel(self._scroll, text="Nada previsto pra este dia.",
                         font=F(12), text_color=T.MUTED).pack(pady=24)
            return
        for e in self._events:
            self._make_event_row(e)

    def _make_event_row(self, e: dict) -> None:
        row = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=10,
                            border_width=1, border_color=T.BORDER)
        row.pack(fill="x", pady=(0, 8))
        row.grid_columnconfigure(0, weight=1)

        info = ctk.CTkFrame(row, fg_color="transparent")
        info.grid(row=0, column=0, sticky="w", padx=12, pady=8)
        ctk.CTkLabel(info, text=e["label"], font=F(12, "bold"), text_color=T.TEXT,
                     anchor="w").pack(anchor="w")
        sub = _SOURCE_LABELS.get(e["source"], e["source"])
        if e["status"] == "overdue":
            sub += "  ·  atrasada" if e["is_income"] else "  ·  vencido"
        ctk.CTkLabel(info, text=sub, font=F(10), text_color=T.RED if e["status"] == "overdue" else T.MUTED,
                     anchor="w").pack(anchor="w")

        color = T.GREEN if e["is_income"] else T.RED
        sign = "+" if e["is_income"] else "-"
        ctk.CTkLabel(row, text=f"{sign}{format_currency(float(e['amount']))}",
                     font=F(13, "bold"), text_color=color).grid(row=0, column=1, padx=(4, 8))

        if e["ref_table"] != "plan_income_items":
            ctk.CTkButton(row, text="Feito", width=64, height=28, corner_radius=7,
                          fg_color=T.GREEN_DIM, hover_color=T.GREEN, text_color=T.GREEN,
                          font=F(11, "bold"),
                          command=lambda ev=e: self._mark_done(ev)).grid(row=0, column=2, padx=(0, 12))

    def _mark_done(self, e: dict) -> None:
        def op():
            db.mark_calendar_event_done(e["ref_table"], e["ref_id"], date(self._year, self._month, self._day))

        def _work():
            err = None
            try:
                op()
            except Exception as ex:
                err = ex
            self.after(0, lambda: self._after_mark(e, err))

        threading.Thread(target=_work, daemon=True).start()

    def _after_mark(self, e: dict, err) -> None:
        if err:
            from ui.dialogs import show_error
            show_error(self, "Erro ao confirmar", str(err)[:200])
            return
        self._events = [ev for ev in self._events if ev is not e]
        self.changed = True
        self._render_events()

    # ------------------------------------------------------------------
    def _build_add_form(self, parent) -> None:
        parent.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(parent, text="+ ADICIONAR PREVISTO NESTE DIA", font=F(10, "bold"),
                     text_color=T.MUTED, anchor="w").grid(row=0, column=0, columnspan=2,
                                                          padx=12, pady=(10, 4), sticky="w")

        self._type_var = ctk.StringVar(value="saida_variavel")
        type_row = ctk.CTkFrame(parent, fg_color="transparent")
        type_row.grid(row=1, column=0, columnspan=2, padx=12, sticky="ew")
        type_row.grid_columnconfigure((0, 1), weight=1)
        self._btn_saida = ctk.CTkButton(type_row, text="Saída", height=28, corner_radius=7,
                                         command=lambda: self._set_type("saida_variavel"))
        self._btn_saida.grid(row=0, column=0, sticky="ew", padx=(0, 3))
        self._btn_entrada = ctk.CTkButton(type_row, text="Entrada", height=28, corner_radius=7,
                                           command=lambda: self._set_type("entrada_variavel"))
        self._btn_entrada.grid(row=0, column=1, sticky="ew", padx=(3, 0))
        self._set_type("saida_variavel")

        self._desc = self._entry(parent, "Descrição")
        self._desc.grid(row=2, column=0, columnspan=2, padx=12, pady=(8, 0), sticky="ew")
        self._amount = self._entry(parent, "Valor (R$)")
        self._amount.grid(row=3, column=0, columnspan=2, padx=12, pady=(8, 0), sticky="ew")

        # Despesa dividida: parte volta pra você depois — cria junto uma
        # entrada prevista com esse valor, na data informada.
        self._split_var = ctk.BooleanVar(value=False)
        self._split_chk = ctk.CTkCheckBox(
            parent, text="Despesa dividida — vou receber parte de volta",
            variable=self._split_var, font=F(10), text_color=T.MUTED,
            checkbox_width=16, checkbox_height=16, command=self._toggle_split)
        self._split_chk.grid(row=4, column=0, columnspan=2, padx=12, pady=(8, 0), sticky="w")
        self._split_box = ctk.CTkFrame(parent, fg_color="transparent")
        self._split_box.grid_columnconfigure((0, 1), weight=1)
        self._back_amount = self._entry(self._split_box, "Volta (padrão: metade)")
        self._back_amount.grid(row=0, column=0, sticky="ew", padx=(0, 4))
        back_default = date(self._year, self._month, self._day) + timedelta(days=7)
        self._back_date = self._entry(self._split_box, "dd/mm/aaaa")
        self._back_date.insert(0, back_default.strftime("%d/%m/%Y"))
        self._back_date.grid(row=0, column=1, sticky="ew", padx=(4, 0))

        self._add_err = ctk.CTkLabel(parent, text="", font=F(10), text_color=T.RED)
        self._add_err.grid(row=6, column=0, columnspan=2, padx=12, pady=(4, 0), sticky="w")

        ctk.CTkButton(parent, text="Adicionar", height=32, corner_radius=8,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER, text_color="#ffffff",
                      font=F(12, "bold"), command=self._submit_add).grid(
            row=7, column=0, columnspan=2, padx=12, pady=(8, 12), sticky="ew")

    def _toggle_split(self) -> None:
        if self._split_var.get() and self._type_var.get() == "saida_variavel":
            self._split_box.grid(row=5, column=0, columnspan=2, padx=12, pady=(6, 0), sticky="ew")
        else:
            self._split_box.grid_remove()

    def _set_type(self, type_: str) -> None:
        self._type_var.set(type_)
        if hasattr(self, "_split_chk"):
            if type_ == "saida_variavel":
                self._split_chk.grid()
            else:
                self._split_chk.grid_remove()
            self._toggle_split()
        self._btn_saida.configure(
            fg_color=T.RED if type_ == "saida_variavel" else "transparent",
            text_color="#ffffff" if type_ == "saida_variavel" else T.MUTED,
            border_width=0 if type_ == "saida_variavel" else 1, border_color=T.BORDER_L,
        )
        self._btn_entrada.configure(
            fg_color=T.GREEN if type_ == "entrada_variavel" else "transparent",
            text_color="#ffffff" if type_ == "entrada_variavel" else T.MUTED,
            border_width=0 if type_ == "entrada_variavel" else 1, border_color=T.BORDER_L,
        )

    def _submit_add(self) -> None:
        desc = self._desc.get().strip()
        amount = _parse_amount(self._amount.get())
        if not desc or amount <= 0:
            self._add_err.configure(text="Preencha a descrição e um valor positivo.")
            return
        tx_type = self._type_var.get()
        day_date = date(self._year, self._month, self._day)

        is_split = self._split_var.get() and tx_type == "saida_variavel"
        back, back_date = 0.0, None
        if is_split:
            raw_back = self._back_amount.get().strip()
            back = _parse_amount(raw_back) if raw_back else amount / 2
            try:
                back_date = datetime.strptime(self._back_date.get().strip(), "%d/%m/%Y").date()
            except ValueError:
                back_date = None
            if back <= 0 or back > amount or back_date is None:
                self._add_err.configure(text="Informe quanto volta (até o valor gasto) e a data dd/mm/aaaa.")
                return

        def op():
            month = db._ensure_month(self._year, self._month)
            db.add_transaction(month["id"], tx_type, desc, amount, "Outros",
                                is_expectation=True, payment_date=day_date)
            if is_split:
                back_month = db._ensure_month(back_date.year, back_date.month)
                db.add_transaction(back_month["id"], "entrada_variavel",
                                    f"{desc} (parte que volta)", round(back, 2), "Receita",
                                    is_expectation=True, payment_date=back_date)

        def _work():
            err = None
            try:
                op()
            except Exception as ex:
                err = ex
            self.after(0, lambda: self._after_add(err))

        threading.Thread(target=_work, daemon=True).start()

    def _after_add(self, err) -> None:
        if err:
            self._add_err.configure(text=str(err)[:120])
            return
        self._desc.delete(0, "end")
        self._amount.delete(0, "end")
        self._split_var.set(False)
        self._toggle_split()
        self._add_err.configure(text="")
        self.changed = True
        ctk.CTkLabel(self._scroll, text="Adicionado — feche e reabra o dia pra ver na lista.",
                     font=F(10), text_color=T.GREEN).pack(pady=(0, 6))
