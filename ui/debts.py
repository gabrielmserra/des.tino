"""Seção de Dívidas: cadastro com parcelas, pagamento, remanejo e comprometimento futuro."""
import threading
import customtkinter as ctk
from datetime import datetime
from typing import Callable, Optional

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import (format_currency, apply_app_icon,
                           MONTHS_PT, CATEGORIES, month_name_from_num)

DEBT_CATEGORIES = ["Dívidas"] + CATEGORIES

_ST_COLOR = {"pendente": "GOLD", "atrasada": "RED", "paga": "MUTED"}


def _parse_amount(raw: str) -> float:
    raw = raw.strip().replace(".", "").replace(",", ".") if raw.count(",") else raw.strip().replace(",", ".")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


def _month_label(year: int, month: int) -> str:
    return f"{MONTHS_PT[month - 1][:3]}/{year}"


class DebtsTab(ctk.CTkFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._on_change = on_change
        self._debts: list = []
        self._insts: list = []
        self._f_status   = "Todas"
        self._f_creditor = "Todos"
        self._f_month    = "Todos"

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        header = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(header, text="Dívidas", font=F(26, "bold"),
                     text_color=T.TEXT, anchor="w").grid(row=0, column=0, sticky="w")
        ctk.CTkButton(
            header, text="+ Nova dívida", command=self._new_debt,
            height=38, width=150, corner_radius=9,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).grid(row=0, column=1, sticky="e")

        self._overview = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                      border_width=1, border_color=T.BORDER)
        self._overview.grid(row=1, column=0, sticky="ew", padx=28, pady=(16, 0))

        # Filtros
        filters = ctk.CTkFrame(self, fg_color="transparent")
        filters.grid(row=2, column=0, sticky="ew", padx=28, pady=(14, 0))
        ctk.CTkLabel(filters, text="Filtrar:", font=F(12),
                     text_color=T.MUTED).pack(side="left", padx=(0, 8))

        combo_kw = dict(
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.CARD2, button_hover_color=T.BORDER_L,
            dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
            dropdown_hover_color=T.BORDER_L, corner_radius=8,
            width=150, state="readonly",
        )
        self._status_combo = ctk.CTkComboBox(
            filters, values=["Todas", "Pendentes", "Atrasadas", "Pagas"],
            command=lambda v: self._set_filter("status", v), **combo_kw)
        self._status_combo.set("Todas")
        self._status_combo.pack(side="left", padx=(0, 8))

        self._creditor_combo = ctk.CTkComboBox(
            filters, values=["Todos"],
            command=lambda v: self._set_filter("creditor", v), **combo_kw)
        self._creditor_combo.set("Todos")
        self._creditor_combo.pack(side="left", padx=(0, 8))

        self._month_combo = ctk.CTkComboBox(
            filters, values=["Todos"],
            command=lambda v: self._set_filter("month", v), **combo_kw)
        self._month_combo.set("Todos")
        self._month_combo.pack(side="left")

        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._scroll.grid(row=3, column=0, sticky="nsew", padx=28, pady=(14, 24))
        self._scroll.grid_columnconfigure(0, weight=1)

    def _set_filter(self, which: str, value: str) -> None:
        if which == "status":
            self._f_status = value
        elif which == "creditor":
            self._f_creditor = value
        else:
            self._f_month = value
        self._render_list()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()
        ctk.CTkLabel(self._scroll, text="Carregando dívidas…",
                     font=F(13), text_color=T.MUTED).pack(pady=40)

        def _fetch():
            try:
                debts    = db.get_debts()
                insts    = db.get_all_installments()
                overview = db.get_debt_overview()
                months   = db.get_months()
                # Renda de referência por mês futuro: renda do plano, se houver
                renda_map = {}
                for f in overview["future"]:
                    m = next((x for x in months
                              if x["year"] == f["year"] and x["month"] == f["month"]), None)
                    if m:
                        plan = db.get_plan(m["id"])
                        if plan and float(plan.get("income") or 0) > 0:
                            renda_map[(f["year"], f["month"])] = float(plan["income"])
            except Exception:
                debts, insts, overview, renda_map = [], [], None, {}
            self.after(0, lambda: self._apply(debts, insts, overview, renda_map))

        threading.Thread(target=_fetch, daemon=True).start()

    def _apply(self, debts, insts, overview, renda_map) -> None:
        self._debts = debts
        self._insts = insts
        self._renda_map = renda_map
        self._render_overview(overview)

        creditors = sorted({d["creditor"] for d in debts if d.get("creditor")})
        self._creditor_combo.configure(values=["Todos"] + creditors)
        months_opts = sorted({(i["due_year"], i["due_month"]) for i in insts})
        self._month_combo.configure(
            values=["Todos"] + [_month_label(y, m) for y, m in months_opts])

        self._render_list()

    # ------------------------------------------------------------------
    def _render_overview(self, ov) -> None:
        for w in self._overview.winfo_children():
            w.destroy()
        if not ov:
            return
        self._overview.grid_columnconfigure((0, 1, 2), weight=1)

        def _kpi(col, label, value, color):
            box = ctk.CTkFrame(self._overview, fg_color="transparent")
            box.grid(row=0, column=col, padx=20, pady=14, sticky="w")
            ctk.CTkLabel(box, text=label, font=F(10, "bold"),
                         text_color=T.MUTED, anchor="w").pack(anchor="w")
            ctk.CTkLabel(box, text=value, font=F(18, "bold"),
                         text_color=color, anchor="w").pack(anchor="w")

        _kpi(0, "TOTAL EM ABERTO", format_currency(ov["total_aberto"]), T.RED)
        n_atr = ov["n_atrasadas"]
        _kpi(1, "PARCELAS ATRASADAS", str(n_atr), T.RED if n_atr else T.GREEN)

        # Comprometimento dos próximos 6 meses
        fut = ctk.CTkFrame(self._overview, fg_color="transparent")
        fut.grid(row=0, column=2, padx=20, pady=14, sticky="w")
        ctk.CTkLabel(fut, text="PRÓXIMOS 6 MESES", font=F(10, "bold"),
                     text_color=T.MUTED, anchor="w").pack(anchor="w")
        line1 = ctk.CTkFrame(fut, fg_color="transparent")
        line1.pack(anchor="w")
        for f in ov["future"]:
            if f["total"] <= 0:
                continue
            renda = self._renda_map.get((f["year"], f["month"]), 0.0)
            pct   = f" ({f['total'] / renda * 100:.0f}%)" if renda > 0 else ""
            chip = ctk.CTkFrame(line1, fg_color=T.CARD2, corner_radius=6)
            chip.pack(side="left", padx=(0, 6), pady=(4, 0))
            ctk.CTkLabel(
                chip,
                text=f"{_month_label(f['year'], f['month'])}  "
                     f"{format_currency(f['total'])}{pct}",
                font=F(11), text_color=T.GOLD,
            ).pack(padx=8, pady=3)
        if all(f["total"] <= 0 for f in ov["future"]):
            ctk.CTkLabel(line1, text="Nenhuma parcela nos próximos meses 🎉",
                         font=F(12), text_color=T.GREEN).pack(anchor="w", pady=(4, 0))

    # ------------------------------------------------------------------
    def _render_list(self) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()

        st_map = {"Pendentes": "pendente", "Atrasadas": "atrasada", "Pagas": "paga"}
        want_status = st_map.get(self._f_status)

        shown = 0
        for debt in self._debts:
            if self._f_creditor != "Todos" and (debt.get("creditor") or "") != self._f_creditor:
                continue
            insts = [i for i in self._insts if i["debt_id"] == debt["id"]]
            visible = []
            for i in insts:
                if want_status and db.installment_status(i) != want_status:
                    continue
                if self._f_month != "Todos" and _month_label(i["due_year"], i["due_month"]) != self._f_month:
                    continue
                visible.append(i)
            if not visible:
                continue
            self._make_debt_card(debt, insts, visible)
            shown += 1

        if shown == 0:
            ctk.CTkLabel(
                self._scroll,
                text="Nenhuma dívida encontrada. Cadastre uma em “+ Nova dívida”."
                     if not self._debts else "Nenhuma dívida bate com os filtros.",
                font=F(13), text_color=T.MUTED,
            ).pack(pady=40)

    def _make_debt_card(self, debt: dict, all_insts: list, visible: list) -> None:
        card = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        card.pack(fill="x", pady=(0, 10))
        card.grid_columnconfigure(0, weight=1)

        n_total = len(all_insts)
        n_paid  = sum(1 for i in all_insts if i.get("paid_at"))

        hdr = ctk.CTkFrame(card, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=18, pady=(14, 4))
        hdr.grid_columnconfigure(0, weight=1)

        name_box = ctk.CTkFrame(hdr, fg_color="transparent")
        name_box.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(name_box, text=debt["description"], font=F(14, "bold"),
                     text_color=T.TEXT).pack(side="left")
        if debt.get("creditor"):
            ctk.CTkLabel(name_box, text=f"• {debt['creditor']}", font=F(12),
                         text_color=T.MUTED).pack(side="left", padx=(8, 0))
        badge = ctk.CTkFrame(name_box, fg_color=T.CARD2, corner_radius=6)
        badge.pack(side="left", padx=(8, 0))
        ctk.CTkLabel(badge, text=debt.get("category") or "Dívidas",
                     font=F(10, "bold"), text_color=T.MUTED).pack(padx=7, pady=1)

        rate_str = (f"{float(debt['interest_rate']):.2f}".replace(".", ",")
                    if debt.get("interest_rate") else "")
        info = (f"{format_currency(float(debt['total_amount']))}"
                + (f"  ·  {rate_str}% a.m." if rate_str else "")
                + (f"   •   {n_paid}/{n_total} pagas" if n_total > 1 else ""))
        ctk.CTkLabel(hdr, text=info, font=F(12, "bold"),
                     text_color=T.BLUE).grid(row=0, column=1, sticky="e", padx=(10, 0))

        actions = ctk.CTkFrame(hdr, fg_color="transparent")
        actions.grid(row=0, column=2, sticky="e", padx=(10, 0))
        ctk.CTkButton(actions, text="✎", width=28, height=26, corner_radius=6,
                      fg_color="transparent", hover_color=T.CARD2,
                      text_color=T.SUBTLE, font=F(11),
                      command=lambda d=debt: self._edit_debt(d)).pack(side="left", padx=2)
        ctk.CTkButton(actions, text="✕", width=28, height=26, corner_radius=6,
                      fg_color="transparent", hover_color=T.RED,
                      text_color=T.SUBTLE, font=F(11),
                      command=lambda d=debt: self._delete_debt(d)).pack(side="left", padx=2)

        if debt.get("notes"):
            ctk.CTkLabel(card, text=debt["notes"], font=F(11),
                         text_color=T.SUBTLE, anchor="w").grid(
                row=1, column=0, sticky="w", padx=18)

        rows_box = ctk.CTkFrame(card, fg_color="transparent")
        rows_box.grid(row=2, column=0, sticky="ew", padx=18, pady=(6, 14))
        rows_box.grid_columnconfigure(0, weight=1)

        for i in visible:
            self._make_inst_row(rows_box, i, debt, n_total)

    def _make_inst_row(self, parent, inst: dict, debt: dict, n_total: int) -> None:
        status = db.installment_status(inst)
        color  = getattr(T, _ST_COLOR[status])

        row = ctk.CTkFrame(parent, fg_color=T.CARD2, corner_radius=8)
        row.pack(fill="x", pady=2)
        row.grid_columnconfigure(1, weight=1)

        num = f"{inst['installment_number']}/{n_total}" if n_total > 1 else "à vista"
        ctk.CTkLabel(row, text=num, font=F(11, "bold"), text_color=T.SUBTLE,
                     width=54).grid(row=0, column=0, padx=(10, 4), pady=8)

        paid_mark = "✓ " if status == "paga" else ""
        ctk.CTkLabel(
            row,
            text=f"{paid_mark}{format_currency(float(inst['amount']))}   •   "
                 f"{month_name_from_num(inst['due_month'], inst['due_year'])}",
            font=F(12), text_color=T.MUTED if status == "paga" else T.TEXT,
            anchor="w",
        ).grid(row=0, column=1, sticky="w")

        chip = ctk.CTkFrame(row, fg_color="transparent")
        chip.grid(row=0, column=2, padx=6)
        ctk.CTkFrame(chip, width=8, height=8, corner_radius=4,
                     fg_color=color).pack(side="left", padx=(0, 5))
        ctk.CTkLabel(chip, text=status, font=F(11, "bold"),
                     text_color=color).pack(side="left")

        btns = ctk.CTkFrame(row, fg_color="transparent")
        btns.grid(row=0, column=3, padx=(4, 8))
        if status == "paga":
            ctk.CTkButton(btns, text="Desfazer", width=80, height=26, corner_radius=6,
                          fg_color="transparent", hover_color=T.CARD,
                          border_width=1, border_color=T.BORDER_L,
                          text_color=T.MUTED, font=F(11),
                          command=lambda i=inst: self._undo(i)).pack(side="left", padx=2)
        else:
            ctk.CTkButton(btns, text="Pagar", width=64, height=26, corner_radius=6,
                          fg_color=T.GREEN_DIM, hover_color=T.GREEN,
                          text_color=T.GREEN, font=F(11, "bold"),
                          command=lambda i=inst, d=debt, n=n_total:
                          self._pay(i, d, n)).pack(side="left", padx=2)
            ctk.CTkButton(btns, text="→ Mês", width=64, height=26, corner_radius=6,
                          fg_color="transparent", hover_color=T.CARD,
                          border_width=1, border_color=T.BORDER_L,
                          text_color=T.MUTED, font=F(11),
                          command=lambda i=inst: self._reschedule(i)).pack(side="left", padx=2)
            ctk.CTkButton(btns, text="✎", width=28, height=26, corner_radius=6,
                          fg_color="transparent", hover_color=T.CARD,
                          text_color=T.SUBTLE, font=F(11),
                          command=lambda i=inst: self._edit_amount(i)).pack(side="left", padx=2)
            if n_total > 1:
                ctk.CTkButton(btns, text="✕", width=28, height=26, corner_radius=6,
                              fg_color="transparent", hover_color=T.RED,
                              text_color=T.SUBTLE, font=F(11),
                              command=lambda i=inst: self._delete_installment(i)
                              ).pack(side="left", padx=2)

    # ------------------------------------------------------------------
    # Ações (todas: operação em thread → sync dos planos → refresh + aviso)
    # ------------------------------------------------------------------
    def _run(self, op, months_to_sync: set) -> None:
        """Executa a operação em thread, sincroniza planos e atualiza a UI."""
        def _work():
            err = None
            changed_plans = []
            try:
                op()
                changed_plans = self._sync_months(months_to_sync)
            except Exception as e:
                err = e
            self.after(0, lambda: self._after_op(err, changed_plans))
        threading.Thread(target=_work, daemon=True).start()

    @staticmethod
    def _sync_months(pairs: set) -> list:
        changed = []
        try:
            months = db.get_months()
        except Exception:
            return changed
        for (y, mo) in pairs:
            m = next((x for x in months if x["year"] == y and x["month"] == mo), None)
            if m and db.sync_debts_into_plan(m["id"]):
                changed.append(m["name"])
        return changed

    def _after_op(self, err, changed_plans: list) -> None:
        from ui.dialogs import show_error, show_info
        if err:
            show_error(self.winfo_toplevel(), "Erro", str(err)[:200])
            return
        self.refresh()
        if self._on_change:
            self._on_change()
        if changed_plans:
            show_info(self.winfo_toplevel(), "Plano atualizado",
                      "O planejamento foi atualizado com as dívidas em:\n"
                      + ", ".join(changed_plans))

    # ------------------------------------------------------------------
    def _new_debt(self) -> None:
        dlg = _DebtFormDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        r = dlg.result
        months = {(i["year"], i["month"]) for i in r["installments"]}
        self._run(lambda: db.create_debt(
            r["description"], r["creditor"], r["total"],
            r["category"], r["notes"], r["installments"],
            r.get("interest_rate")), months)

    def _edit_debt(self, debt: dict) -> None:
        dlg = _EditDebtDialog(self.winfo_toplevel(), debt)
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        r = dlg.result
        months = {(i["due_year"], i["due_month"]) for i in self._insts
                  if i["debt_id"] == debt["id"] and not i.get("paid_at")}
        self._run(lambda: db.update_debt(
            debt["id"], r["description"], r["creditor"],
            r["category"], r["notes"], r.get("interest_rate")), months)

    def _delete_debt(self, debt: dict) -> None:
        from ui.dialogs import ConfirmDialog
        insts = [i for i in self._insts if i["debt_id"] == debt["id"]]
        has_expenses = any(i.get("expense_id") for i in insts)
        months = {(i["due_year"], i["due_month"]) for i in insts}

        def do_delete():
            if has_expenses:
                ask = _AskExpenseDialog(self.winfo_toplevel())
                self.winfo_toplevel().wait_window(ask)
                if ask.choice is None:
                    return
                self._run(lambda: db.delete_debt(debt["id"], ask.choice), months)
            else:
                self._run(lambda: db.delete_debt(debt["id"], False), months)

        ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir dívida?",
            message=f'"{debt["description"]}" e todas as suas parcelas\n'
                    "serão excluídas. Esta ação é irreversível.",
            confirm_text="Excluir",
            on_confirm=do_delete,
            danger=True,
        )

    def _delete_installment(self, inst: dict) -> None:
        from ui.dialogs import ConfirmDialog
        months = {(inst["due_year"], inst["due_month"])}

        def do_delete():
            if inst.get("expense_id"):
                ask = _AskExpenseDialog(self.winfo_toplevel())
                self.winfo_toplevel().wait_window(ask)
                if ask.choice is None:
                    return
                self._run(lambda: db.delete_installment(inst, ask.choice), months)
            else:
                self._run(lambda: db.delete_installment(inst, False), months)

        ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir parcela?",
            message="Só esta parcela será excluída (o total da dívida\n"
                    "será recalculado). Para excluir tudo, use o ✕ da dívida.",
            confirm_text="Excluir parcela",
            on_confirm=do_delete,
            danger=True,
        )

    def _pay(self, inst: dict, debt: dict, n_total: int) -> None:
        dlg = _PayDialog(self.winfo_toplevel(), debt, inst, n_total)
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.confirmed:
            return
        months = {(inst["due_year"], inst["due_month"])}
        self._run(lambda: db.pay_installment(inst), months)

    def _undo(self, inst: dict) -> None:
        from ui.dialogs import ConfirmDialog
        months = {(inst["due_year"], inst["due_month"])}
        msg = ("O gasto lançado será removido junto.\nConfirmar?"
               if inst.get("expense_id") else "Confirmar?")
        ConfirmDialog(
            self.winfo_toplevel(),
            title="Desfazer pagamento?", message=msg,
            confirm_text="Desfazer",
            on_confirm=lambda: self._run(lambda: db.undo_payment(inst), months),
            danger=True,
        )

    def _reschedule(self, inst: dict) -> None:
        dlg = _MonthPickerDialog(self.winfo_toplevel(),
                                 inst["due_year"], inst["due_month"])
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        y, m = dlg.result
        months = {(inst["due_year"], inst["due_month"]), (y, m)}
        self._run(lambda: db.reschedule_installment(inst["id"], y, m), months)

    def _edit_amount(self, inst: dict) -> None:
        dlg = _AmountDialog(self.winfo_toplevel(), float(inst["amount"]))
        self.winfo_toplevel().wait_window(dlg)
        if dlg.amount is None:
            return
        months = {(inst["due_year"], inst["due_month"])}
        self._run(lambda: db.update_installment_amount(
            inst["id"], inst["debt_id"], dlg.amount), months)


# ──────────────────────────────────────────────────────────────────────
class _BaseDialog(ctk.CTkToplevel):
    def __init__(self, parent, title: str, w: int, h: int):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()

    def _entry(self, parent, placeholder: str = "", width=None) -> ctk.CTkEntry:
        kw = dict(fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
                  placeholder_text_color=T.SUBTLE, corner_radius=8,
                  placeholder_text=placeholder)
        if width:
            kw["width"] = width
        return ctk.CTkEntry(parent, **kw)

    def _combo(self, parent, values, width=None) -> ctk.CTkComboBox:
        kw = dict(values=values, fg_color=T.CARD2, border_color=T.BORDER_L,
                  text_color=T.TEXT, button_color=T.CARD2,
                  button_hover_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
                  dropdown_text_color=T.TEXT, dropdown_hover_color=T.BORDER_L,
                  corner_radius=8, state="readonly")
        if width:
            kw["width"] = width
        return ctk.CTkComboBox(parent, **kw)


class _DebtFormDialog(_BaseDialog):
    """Cadastro de dívida com preview editável das parcelas."""

    def __init__(self, parent):
        self.result: Optional[dict] = None
        self._preview_rows: list = []
        super().__init__(parent, "Nova Dívida", 560, 690)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure((0, 1), weight=1)
        now = datetime.now()

        def _lbl(text, row, col, colspan=1, pady=(10, 0)):
            ctk.CTkLabel(self, text=text, font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=row, column=col, columnspan=colspan,
                padx=24, pady=pady, sticky="w")

        ctk.CTkLabel(self, text="Nova Dívida", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, columnspan=2, pady=(18, 0))

        _lbl("DESCRIÇÃO *", 1, 0)
        self._desc = self._entry(self, "Ex: Empréstimo, fatura antiga, carnê…")
        self._desc.grid(row=2, column=0, columnspan=2, padx=24, sticky="ew")

        _lbl("CREDOR", 3, 0)
        _lbl("CATEGORIA", 3, 1)
        self._creditor = self._entry(self, "pessoa, loja, banco…")
        self._creditor.grid(row=4, column=0, padx=(24, 6), sticky="ew")
        self._category = self._combo(self, DEBT_CATEGORIES)
        self._category.set("Dívidas")
        self._category.grid(row=4, column=1, padx=(6, 24), sticky="ew")

        _lbl("VALOR TOTAL (R$) *", 5, 0)
        _lbl("PARCELAS", 5, 1)
        self._total = self._entry(self, "0,00")
        self._total.grid(row=6, column=0, padx=(24, 6), sticky="ew")
        self._n_parc = self._combo(self, [str(n) for n in range(1, 37)])
        self._n_parc.set("1")
        self._n_parc.grid(row=6, column=1, padx=(6, 24), sticky="ew")

        _lbl("TAXA DE JUROS MENSAL (% opcional)", 7, 0, colspan=2)
        self._rate = self._entry(self, "Ex: 1,5 — em branco = sem juros (Financiamento)")
        self._rate.grid(row=8, column=0, columnspan=2, padx=24, sticky="ew")

        _lbl("PRIMEIRO MÊS DE PAGAMENTO *", 9, 0, colspan=2)
        mrow = ctk.CTkFrame(self, fg_color="transparent")
        mrow.grid(row=10, column=0, columnspan=2, padx=24, sticky="ew")
        mrow.grid_columnconfigure((0, 1), weight=1)
        self._month = self._combo(mrow, MONTHS_PT)
        self._month.set(MONTHS_PT[now.month - 1])
        self._month.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        self._year = self._combo(mrow, [str(y) for y in range(2020, 2041)])
        self._year.set(str(now.year))
        self._year.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        _lbl("OBSERVAÇÕES", 11, 0, colspan=2)
        self._notes = self._entry(self)
        self._notes.grid(row=12, column=0, columnspan=2, padx=24, sticky="ew")

        ctk.CTkButton(
            self, text="↻  Gerar parcelas", command=self._gen_preview,
            height=32, corner_radius=8,
            fg_color=T.GREEN_DIM, hover_color=T.GREEN, text_color=T.GREEN,
        ).grid(row=13, column=0, columnspan=2, padx=24, pady=(12, 4), sticky="ew")

        self._preview = ctk.CTkScrollableFrame(
            self, fg_color=T.CARD2, corner_radius=10, height=150,
            scrollbar_button_color=T.BORDER_L,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._preview.grid(row=14, column=0, columnspan=2, padx=24, sticky="ew")
        self._preview.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self._preview,
                     text="Clique em “Gerar parcelas” para visualizar.",
                     font=F(11), text_color=T.SUBTLE).grid(row=0, column=0, pady=14)

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=15, column=0, columnspan=2, padx=24, pady=(6, 0), sticky="w")

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=16, column=0, columnspan=2, pady=(8, 16))
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Salvar dívida", width=130,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._save).pack(side="left", padx=6)

    def _gen_preview(self) -> None:
        total = _parse_amount(self._total.get())
        if total <= 0:
            self._err.configure(text="Informe o valor total antes de gerar as parcelas.")
            return
        self._err.configure(text="")
        n = int(self._n_parc.get())
        y = int(self._year.get())
        m = MONTHS_PT.index(self._month.get()) + 1
        rate = _parse_amount(self._rate.get()) if self._rate.get().strip() else 0.0

        if rate > 0:
            i = rate / 100
            pmt = total * i / (1 - (1 + i) ** -n)
            amounts = [round(pmt, 2)] * n
        else:
            base = round(total / n, 2)
            amounts = [base] * n
            amounts[-1] = round(total - base * (n - 1), 2)  # ajusta o arredondamento

        for w in self._preview.winfo_children():
            w.destroy()
        self._preview_rows = []
        for k in range(n):
            row = ctk.CTkFrame(self._preview, fg_color="transparent")
            row.grid(row=k, column=0, sticky="ew", pady=2)
            row.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(row, text=f"{k + 1}/{n}  •  {month_name_from_num(m, y)}",
                         font=F(11), text_color=T.TEXT, anchor="w").grid(
                row=0, column=0, padx=(8, 6), sticky="w")
            e = self._entry(row, width=110)
            e.insert(0, f"{amounts[k]:.2f}".replace(".", ","))
            e.grid(row=0, column=1, padx=(0, 8))
            self._preview_rows.append({"entry": e, "year": y, "month": m, "number": k + 1})
            m += 1
            if m > 12:
                m = 1
                y += 1

    def _save(self) -> None:
        desc  = self._desc.get().strip()
        total = _parse_amount(self._total.get())
        if not desc:
            self._err.configure(text="Preencha a descrição.")
            return
        if total <= 0:
            self._err.configure(text="Informe um valor total positivo.")
            return
        if not self._preview_rows:
            self._gen_preview()
            if not self._preview_rows:
                return
        installments = [{
            "number": r["number"],
            "amount": _parse_amount(r["entry"].get()),
            "year":   r["year"],
            "month":  r["month"],
        } for r in self._preview_rows]
        soma = sum(i["amount"] for i in installments)
        rate = _parse_amount(self._rate.get()) if self._rate.get().strip() else 0.0
        # Com juros, a soma das parcelas (Tabela Price) é maior que o
        # principal financiado de propósito — só valida a igualdade
        # exata quando não há juros (split simples do valor total).
        if rate <= 0 and abs(soma - total) > 0.01:
            self._err.configure(
                text=f"Soma das parcelas ({format_currency(soma)}) difere "
                     f"do total ({format_currency(total)}).")
            return
        self.result = {
            "description":  desc,
            "creditor":     self._creditor.get().strip(),
            "total":        soma,
            "interest_rate": rate if rate > 0 else None,
            "category":     self._category.get(),
            "notes":        self._notes.get().strip(),
            "installments": installments,
        }
        self.destroy()


class _EditDebtDialog(_BaseDialog):
    def __init__(self, parent, debt: dict):
        self.result: Optional[dict] = None
        self._debt = debt
        super().__init__(parent, "Editar Dívida", 460, 460)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        d = self._debt

        ctk.CTkLabel(self, text="Editar Dívida", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(18, 4))

        def _field(label, row):
            ctk.CTkLabel(self, text=label, font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=row, column=0, padx=28, pady=(8, 0), sticky="w")

        _field("DESCRIÇÃO *", 1)
        self._desc = self._entry(self)
        self._desc.grid(row=2, column=0, padx=28, sticky="ew")
        self._desc.insert(0, d.get("description") or "")

        _field("CREDOR", 3)
        self._creditor = self._entry(self)
        self._creditor.grid(row=4, column=0, padx=28, sticky="ew")
        self._creditor.insert(0, d.get("creditor") or "")

        _field("CATEGORIA", 5)
        self._category = self._combo(self, DEBT_CATEGORIES)
        self._category.set(d.get("category") or "Dívidas")
        self._category.grid(row=6, column=0, padx=28, sticky="ew")

        _field("OBSERVAÇÕES", 7)
        self._notes = self._entry(self)
        self._notes.grid(row=8, column=0, padx=28, sticky="ew")
        self._notes.insert(0, d.get("notes") or "")

        _field("TAXA DE JUROS MENSAL (% opcional)", 9)
        self._rate = self._entry(self, "Ex: 1,5 — em branco = sem juros")
        self._rate.grid(row=10, column=0, padx=28, sticky="ew")
        if d.get("interest_rate"):
            self._rate.insert(0, f"{float(d['interest_rate']):.2f}".replace(".", ","))

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=11, column=0, padx=28, pady=(8, 0), sticky="w")

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=12, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Salvar", width=110,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._save).pack(side="left", padx=6)

    def _save(self) -> None:
        desc = self._desc.get().strip()
        if not desc:
            self._err.configure(text="Preencha a descrição.")
            return
        rate = _parse_amount(self._rate.get()) if self._rate.get().strip() else 0.0
        self.result = {
            "description": desc,
            "creditor":    self._creditor.get().strip(),
            "category":    self._category.get(),
            "notes":       self._notes.get().strip(),
            "interest_rate": rate if rate > 0 else None,
        }
        self.destroy()


class _PayDialog(_BaseDialog):
    def __init__(self, parent, debt: dict, inst: dict, n_total: int):
        self.confirmed = False
        self._debt, self._inst, self._n = debt, inst, n_total
        super().__init__(parent, "Pagar parcela", 420, 210)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        d, i = self._debt, self._inst
        parc = f" (parcela {i['installment_number']}/{self._n})" if self._n > 1 else ""

        ctk.CTkLabel(self, text="Confirmar pagamento", font=F(15, "bold"),
                     text_color=T.GREEN).grid(row=0, column=0, pady=(22, 4))
        ctk.CTkLabel(
            self,
            text=f"{d['description']}{parc}\n"
                 f"{format_currency(float(i['amount']))} — "
                 f"{month_name_from_num(i['due_month'], i['due_year'])}",
            font=F(12), text_color=T.MUTED, justify="center",
        ).grid(row=1, column=0)
        ctk.CTkLabel(
            self, text="Só marca a parcela como paga — não lança gasto\nnem mexe no saldo.",
            font=F(10), text_color=T.SUBTLE, justify="center",
        ).grid(row=2, column=0, pady=(10, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=3, column=0, pady=16)
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Confirmar pagamento", width=160,
                      fg_color=T.GREEN, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        self.confirmed = True
        self.destroy()


class _MonthPickerDialog(_BaseDialog):
    def __init__(self, parent, cur_year: int, cur_month: int):
        self.result = None
        self._cy, self._cm = cur_year, cur_month
        super().__init__(parent, "Remanejar parcela", 380, 220)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Mover parcela para…", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(22, 12))

        row = ctk.CTkFrame(self, fg_color="transparent")
        row.grid(row=1, column=0, padx=28, sticky="ew")
        row.grid_columnconfigure((0, 1), weight=1)
        self._month = self._combo(row, MONTHS_PT)
        self._month.set(MONTHS_PT[self._cm - 1])
        self._month.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        self._year = self._combo(row, [str(y) for y in range(2020, 2041)])
        self._year.set(str(self._cy))
        self._year.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=2, column=0, pady=18)
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Remanejar", width=120,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._ok).pack(side="left", padx=6)

    def _ok(self) -> None:
        self.result = (int(self._year.get()),
                       MONTHS_PT.index(self._month.get()) + 1)
        self.destroy()


class _AmountDialog(_BaseDialog):
    def __init__(self, parent, current: float):
        self.amount: Optional[float] = None
        self._current = current
        super().__init__(parent, "Editar valor", 360, 210)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Novo valor da parcela", font=F(14, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(22, 2))
        ctk.CTkLabel(self, text="O total da dívida será recalculado.",
                     font=F(11), text_color=T.MUTED).grid(row=1, column=0)
        self._e = self._entry(self, "0,00", width=180)
        self._e.insert(0, f"{self._current:.2f}".replace(".", ","))
        self._e.grid(row=2, column=0, pady=(10, 0))
        self._e.bind("<Return>", lambda _: self._ok())
        self._e.focus()
        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=3, column=0)
        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=4, column=0, pady=12)
        ctk.CTkButton(btns, text="Cancelar", width=100,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Salvar", width=100,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._ok).pack(side="left", padx=6)

    def _ok(self) -> None:
        val = _parse_amount(self._e.get())
        if val <= 0:
            self._err.configure(text="Digite um valor positivo.")
            return
        self.amount = val
        self.destroy()


class _AskExpenseDialog(_BaseDialog):
    """Pergunta se os gastos lançados pelas parcelas também devem ser removidos."""

    def __init__(self, parent):
        self.choice: Optional[bool] = None   # None = cancelou
        super().__init__(parent, "Gastos vinculados", 420, 200)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Há gastos lançados por estas parcelas",
                     font=F(14, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(22, 4))
        ctk.CTkLabel(self, text="Deseja removê-los também dos lançamentos do mês?",
                     font=F(12), text_color=T.MUTED).grid(row=1, column=0)

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=2, column=0, pady=20)
        ctk.CTkButton(btns, text="Manter gastos", width=130,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.TEXT,
                      command=lambda: self._pick(False)).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Remover gastos", width=140,
                      fg_color=T.RED, hover_color=T.RED_HOVER,
                      text_color="#ffffff",
                      command=lambda: self._pick(True)).pack(side="left", padx=6)

    def _pick(self, choice: bool) -> None:
        self.choice = choice
        self.destroy()
