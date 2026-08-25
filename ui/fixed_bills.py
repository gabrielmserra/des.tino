"""Contas Fixas: internet, luz, água, aluguel, condomínio — contas que se
repetem todo mês, cada uma com dia de vencimento e um checklist
pago/pendente. Diferente de Dívidas/Metas: marcar como paga CRIA um
lançamento real (Saída Fixa) e mexe no saldo — ver database.py."""
import threading
from datetime import datetime
from typing import Callable, Optional

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from ui.debts import _BaseDialog, _parse_amount
from utils.helpers import format_currency, CATEGORIES, PAYMENT_METHODS

_METHOD_LABELS = list(PAYMENT_METHODS.values())
_LABEL_TO_METHOD_KEY = {v: k for k, v in PAYMENT_METHODS.items()}
_METHOD_KEY_TO_LABEL = PAYMENT_METHODS


class FixedBillsTab(ctk.CTkFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._on_change = on_change
        self._month: Optional[dict] = None
        self._bills: list = []
        self._insts: list = []

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        header = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(header, text="Contas Fixas", font=F(26, "bold"),
                     text_color=T.TEXT, anchor="w").grid(row=0, column=0, sticky="w")
        ctk.CTkButton(
            header, text="+ Nova conta fixa", command=self._new_bill,
            height=38, width=170, corner_radius=9,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).grid(row=0, column=1, sticky="e")

        self._month_lbl = ctk.CTkLabel(self, text="", font=F(13, "bold"),
                                       text_color=T.MUTED, anchor="w")
        self._month_lbl.grid(row=1, column=0, sticky="w", padx=28, pady=(10, 0))

        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._scroll.grid(row=2, column=0, sticky="nsew", padx=28, pady=(14, 24))
        self._scroll.grid_columnconfigure(0, weight=1)

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()
        ctk.CTkLabel(self._scroll, text="Carregando contas fixas…",
                     font=F(13), text_color=T.MUTED).pack(pady=40)

        def _fetch():
            try:
                today = datetime.now()
                month = db._ensure_month(today.year, today.month)
                db.ensure_fixed_bill_instances(month["id"])
                bills = db.get_fixed_bills()
                insts = db.get_fixed_bill_instances()
            except Exception:
                month, bills, insts = None, [], []
            self.after(0, lambda: self._apply(month, bills, insts))

        threading.Thread(target=_fetch, daemon=True).start()

    def _apply(self, month, bills, insts) -> None:
        self._month = month
        self._bills = bills
        self._insts = insts
        if month:
            self._month_lbl.configure(text=f"Mês corrente: {month['name']}")
        self._render_list()

    # ------------------------------------------------------------------
    def _render_list(self) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()

        if not self._month:
            ctk.CTkLabel(self._scroll, text="Erro ao carregar o mês atual.",
                         font=F(13), text_color=T.RED).pack(pady=40)
            return

        active_bills = [b for b in self._bills if b.get("active", True)]
        if not active_bills:
            ctk.CTkLabel(
                self._scroll,
                text="Nenhuma conta fixa cadastrada. Cadastre uma em "
                     "“+ Nova conta fixa”.",
                font=F(13), text_color=T.MUTED,
            ).pack(pady=40)
            return

        for bill in active_bills:
            inst = next((i for i in self._insts
                        if i["bill_id"] == bill["id"]
                        and i["month_id"] == self._month["id"]), None)
            self._make_bill_card(bill, inst)

    def _make_bill_card(self, bill: dict, inst: Optional[dict]) -> None:
        card = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        card.pack(fill="x", pady=(0, 10))
        card.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(card, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 4))
        hdr.grid_columnconfigure(0, weight=1)

        name_box = ctk.CTkFrame(hdr, fg_color="transparent")
        name_box.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(name_box, text=bill["name"], font=F(14, "bold"),
                     text_color=T.TEXT).pack(side="left")
        badge = ctk.CTkFrame(name_box, fg_color=T.CARD2, corner_radius=6)
        badge.pack(side="left", padx=(8, 0))
        ctk.CTkLabel(badge, text=f"vence dia {bill['due_day']}  ·  {bill.get('category') or 'Moradia'}",
                     font=F(10, "bold"), text_color=T.MUTED).pack(padx=7, pady=1)

        actions = ctk.CTkFrame(hdr, fg_color="transparent")
        actions.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(actions, text="✎", width=28, height=26, corner_radius=6,
                      fg_color="transparent", hover_color=T.CARD2,
                      text_color=T.MUTED, font=F(13),
                      command=lambda b=bill: self._edit_bill(b)).pack(side="left", padx=2)
        ctk.CTkButton(actions, text="✕", width=28, height=26, corner_radius=6,
                      fg_color="transparent", hover_color=T.RED,
                      text_color=T.SUBTLE, font=F(13),
                      command=lambda b=bill: self._delete_bill(b)).pack(side="left", padx=2)

        amount = float(inst["amount"]) if inst else float(bill["expected_amount"])
        status_row = ctk.CTkFrame(card, fg_color="transparent")
        status_row.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 14))
        status_row.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(status_row, text=format_currency(amount), font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, sticky="w")

        if inst and inst.get("paid_at"):
            paid_dt = datetime.fromisoformat(str(inst["paid_at"])[:19])
            ctk.CTkLabel(status_row, text=f"✓ Paga em {paid_dt.strftime('%d/%m')}",
                         font=F(12, "bold"), text_color=T.GREEN).grid(
                row=0, column=1, padx=(10, 10))
            ctk.CTkButton(status_row, text="Desfazer", width=100, height=30,
                          corner_radius=8, fg_color=T.CARD2, hover_color=T.BORDER_L,
                          border_width=1, border_color=T.BORDER_L,
                          text_color=T.MUTED, font=F(12),
                          command=lambda i=inst: self._undo(i)).grid(row=0, column=2)
        else:
            ctk.CTkLabel(status_row, text="Pendente", font=F(12, "bold"),
                         text_color=T.GOLD).grid(row=0, column=1, padx=(10, 10))
            ctk.CTkButton(status_row, text="Pagar", width=100, height=30,
                          corner_radius=8, fg_color=T.GREEN_DIM, hover_color=T.GREEN,
                          text_color=T.GREEN, font=F(12, "bold"),
                          command=lambda b=bill, i=inst: self._pay(b, i)).grid(row=0, column=2)

    # ------------------------------------------------------------------
    def _run(self, op) -> None:
        def _work():
            err = None
            try:
                op()
            except Exception as e:
                err = e
            self.after(0, lambda: self._after_op(err))
        threading.Thread(target=_work, daemon=True).start()

    def _after_op(self, err) -> None:
        from ui.dialogs import show_error
        if err:
            show_error(self.winfo_toplevel(), "Erro", str(err)[:200])
            return
        self.refresh()
        if self._on_change:
            self._on_change()

    # ------------------------------------------------------------------
    def _new_bill(self) -> None:
        dlg = _FixedBillFormDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        r = dlg.result
        self._run(lambda: db.create_fixed_bill(
            r["name"], r["amount"], r["due_day"], r["category"], r["payment_method"]))

    def _edit_bill(self, bill: dict) -> None:
        dlg = _FixedBillFormDialog(self.winfo_toplevel(), bill)
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        r = dlg.result
        self._run(lambda: db.update_fixed_bill(
            bill["id"], r["name"], r["amount"], r["due_day"],
            r["category"], r["payment_method"], True))

    def _delete_bill(self, bill: dict) -> None:
        from ui.dialogs import ConfirmDialog
        ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir conta fixa?",
            message=f'"{bill["name"]}" será excluída de vez (lançamentos '
                    "já pagos não são apagados).",
            confirm_text="Excluir",
            on_confirm=lambda: self._run(lambda: db.delete_fixed_bill(bill["id"])),
            danger=True,
        )

    def _pay(self, bill: dict, inst: dict) -> None:
        dlg = _PayBillDialog(self.winfo_toplevel(), bill, inst)
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.confirmed:
            return
        month_id = self._month["id"]
        new_amount = dlg.new_amount

        def op():
            if new_amount is not None and abs(new_amount - float(inst["amount"])) > 0.001:
                db.update_fixed_bill_instance_amount(inst["id"], new_amount)
            db.pay_fixed_bill_instance(inst["id"], month_id, dlg.payment_method)

        self._run(op)

    def _undo(self, inst: dict) -> None:
        from ui.dialogs import ConfirmDialog
        month_id = self._month["id"]
        ConfirmDialog(
            self.winfo_toplevel(),
            title="Desfazer pagamento?",
            message="O lançamento (Saída Fixa) criado será removido junto.\nConfirmar?",
            confirm_text="Desfazer",
            on_confirm=lambda: self._run(
                lambda: db.undo_fixed_bill_payment(inst["id"], month_id)),
            danger=True,
        )


# ──────────────────────────────────────────────────────────────────────
class _FixedBillFormDialog(_BaseDialog):
    def __init__(self, parent, bill: Optional[dict] = None):
        self.result: Optional[dict] = None
        self._bill = bill
        title = "Editar Conta Fixa" if bill else "Nova Conta Fixa"
        super().__init__(parent, title, 460, 500)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        b = self._bill or {}

        ctk.CTkLabel(self, text=self.title(), font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(18, 4))

        def _field(label, row):
            ctk.CTkLabel(self, text=label, font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=row, column=0, padx=28, pady=(8, 0), sticky="w")

        _field("NOME *", 1)
        self._name = self._entry(self, "Ex: Internet, Luz, Aluguel…")
        self._name.grid(row=2, column=0, padx=28, sticky="ew")
        if b.get("name"):
            self._name.insert(0, b["name"])

        _field("VALOR ESPERADO (R$) *", 3)
        self._amount = self._entry(self, "0,00")
        self._amount.grid(row=4, column=0, padx=28, sticky="ew")
        if b.get("expected_amount"):
            self._amount.insert(0, f"{float(b['expected_amount']):.2f}".replace(".", ","))

        _field("DIA DE VENCIMENTO *", 5)
        self._due_day = self._combo(self, [str(d) for d in range(1, 32)])
        self._due_day.set(str(b.get("due_day") or 1))
        self._due_day.grid(row=6, column=0, padx=28, sticky="ew")

        _field("CATEGORIA", 7)
        self._category = self._combo(self, CATEGORIES)
        self._category.set(b.get("category") or "Moradia")
        self._category.grid(row=8, column=0, padx=28, sticky="ew")

        _field("FORMA DE PAGAMENTO PADRÃO", 9)
        self._method = self._combo(self, _METHOD_LABELS)
        self._method.set(_METHOD_KEY_TO_LABEL.get(b.get("payment_method"), _METHOD_LABELS[0]))
        self._method.grid(row=10, column=0, padx=28, sticky="ew")

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
        name = self._name.get().strip()
        amount = _parse_amount(self._amount.get())
        if not name:
            self._err.configure(text="Preencha o nome.")
            return
        if amount <= 0:
            self._err.configure(text="Informe um valor esperado positivo.")
            return
        self.result = {
            "name": name,
            "amount": amount,
            "due_day": int(self._due_day.get()),
            "category": self._category.get(),
            "payment_method": _LABEL_TO_METHOD_KEY.get(self._method.get()),
        }
        self.destroy()


class _PayBillDialog(_BaseDialog):
    def __init__(self, parent, bill: dict, inst: dict):
        self.confirmed = False
        self.new_amount: Optional[float] = None
        self.payment_method: Optional[str] = None
        self._bill, self._inst = bill, inst
        super().__init__(parent, "Pagar conta", 420, 280)
        self._build()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Confirmar pagamento", font=F(15, "bold"),
                     text_color=T.GREEN).grid(row=0, column=0, pady=(22, 4))
        ctk.CTkLabel(self, text=self._bill["name"], font=F(13),
                     text_color=T.TEXT).grid(row=1, column=0, pady=(0, 12))

        ctk.CTkLabel(self, text="VALOR (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=2, column=0, padx=28, sticky="w")
        self._amount = self._entry(self)
        self._amount.grid(row=3, column=0, padx=28, sticky="ew")
        self._amount.insert(0, f"{float(self._inst['amount']):.2f}".replace(".", ","))

        ctk.CTkLabel(self, text="FORMA DE PAGAMENTO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=4, column=0, padx=28, pady=(10, 0), sticky="w")
        self._method = self._combo(self, _METHOD_LABELS)
        self._method.set(_METHOD_KEY_TO_LABEL.get(self._bill.get("payment_method"), _METHOD_LABELS[0]))
        self._method.grid(row=5, column=0, padx=28, sticky="ew")

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=6, column=0, padx=28, pady=(8, 0), sticky="w")

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=7, column=0, pady=16)
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Confirmar", width=120,
                      fg_color=T.GREEN_DIM, hover_color=T.GREEN,
                      text_color=T.GREEN, command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        amount = _parse_amount(self._amount.get())
        if amount <= 0:
            self._err.configure(text="Informe um valor positivo.")
            return
        self.new_amount = amount
        self.payment_method = _LABEL_TO_METHOD_KEY.get(self._method.get())
        self.confirmed = True
        self.destroy()
