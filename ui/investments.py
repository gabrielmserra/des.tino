"""Aba de investimentos — hub dedicado, acima do seletor de meses."""
import customtkinter as ctk
import threading
from typing import Optional, Callable

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import INVESTMENT_CATEGORIES, format_currency, apply_app_icon


class InvestmentsTab(ctk.CTkScrollableFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(
            parent, fg_color=T.BG,
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._on_change      = on_change
        self._months: list   = []
        self._all_investments: list = []
        self._all_movements: list   = []
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        # ── Header ────────────────────────────────────────────────────
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text="Investimentos",
                     font=F(26, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w")
        ctk.CTkLabel(hdr, text="gerencie seus investimentos e movimentações",
                     font=F(12), text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, sticky="w", pady=(2, 0))

        # ── Formulário de criação ──────────────────────────────────────
        form = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                            border_width=1, border_color=T.BORDER)
        form.grid(row=1, column=0, sticky="ew", padx=28, pady=(20, 0))
        form.grid_columnconfigure((0, 1, 2, 3), weight=1)

        ctk.CTkLabel(form, text="Novo Investimento",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, columnspan=4, sticky="w", padx=20, pady=(16, 6))

        self._name_var   = ctk.StringVar()
        self._cat_var    = ctk.StringVar(value=INVESTMENT_CATEGORIES[0])
        self._amount_var = ctk.StringVar()
        self._month_var  = ctk.StringVar()
        self._note_var   = ctk.StringVar()

        for col, text in enumerate(["Nome", "Categoria", "Valor inicial (R$)", "Período"]):
            ctk.CTkLabel(form, text=text, font=F(11), text_color=T.MUTED, anchor="w").grid(
                row=1, column=col,
                padx=(20 if col == 0 else 6, 20 if col == 3 else 6),
                pady=(0, 2), sticky="w")

        ctk.CTkEntry(
            form, placeholder_text="Ex: Tesouro Selic 2029",
            textvariable=self._name_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
        ).grid(row=2, column=0, padx=(20, 6), pady=(0, 6), sticky="ew")

        ctk.CTkComboBox(
            form, values=INVESTMENT_CATEGORIES, variable=self._cat_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT,
        ).grid(row=2, column=1, padx=6, pady=(0, 6), sticky="ew")

        ctk.CTkEntry(
            form, placeholder_text="0,00",
            textvariable=self._amount_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
        ).grid(row=2, column=2, padx=6, pady=(0, 6), sticky="ew")

        self._month_combo = ctk.CTkComboBox(
            form, values=["—"], variable=self._month_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT,
        )
        self._month_combo.grid(row=2, column=3, padx=(6, 20), pady=(0, 6), sticky="ew")

        ctk.CTkLabel(form, text="Nota (opcional)", font=F(11),
                     text_color=T.MUTED, anchor="w").grid(
            row=3, column=0, columnspan=3, padx=(20, 6), pady=(4, 2), sticky="w")

        ctk.CTkEntry(
            form, placeholder_text="Ex: aporte mensal automático",
            textvariable=self._note_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
        ).grid(row=4, column=0, columnspan=3, padx=(20, 6), pady=(0, 6), sticky="ew")

        ctk.CTkButton(
            form, text="+ Criar Investimento",
            command=self._on_create,
            height=36, corner_radius=8,
            fg_color=T.VIOLET, hover_color=T.VIOLET,
            text_color="#ffffff", font=F(13, "bold"),
        ).grid(row=4, column=3, padx=(6, 20), pady=(0, 6), sticky="ew")

        self._form_error = ctk.CTkLabel(
            form, text="", font=F(12), text_color=T.RED)
        self._form_error.grid(row=5, column=0, columnspan=4,
                              padx=20, pady=(0, 12), sticky="w")

        # ── Filtro + contador ─────────────────────────────────────────
        count_row = ctk.CTkFrame(self, fg_color="transparent")
        count_row.grid(row=2, column=0, sticky="ew", padx=28, pady=(20, 0))

        self._filter_var = ctk.StringVar(value="Todos os períodos")
        self._filter_combo = ctk.CTkComboBox(
            count_row, values=["Todos os períodos"],
            variable=self._filter_var, width=200,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT,
            command=lambda _: self._render_list(),
        )
        self._filter_combo.pack(side="right")

        self._count_lbl = ctk.CTkLabel(
            count_row, text="", font=F(11), text_color=T.MUTED, anchor="w")
        self._count_lbl.pack(side="left")

        self._list_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._list_frame.grid(row=3, column=0, sticky="nsew", padx=28, pady=(8, 28))
        self._list_frame.grid_columnconfigure(0, weight=1)

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        def fetch():
            try:
                investments = db.get_investments()
                months      = db.get_months()
                movements   = db.get_all_investment_movements()
            except Exception:
                investments, months, movements = [], [], []
            self.after(0, lambda: self._apply(investments, months, movements))
        threading.Thread(target=fetch, daemon=True).start()

    def _apply(self, investments: list, months: list, all_movements: list) -> None:
        self._months          = months
        self._all_investments = investments
        self._all_movements   = all_movements

        month_names = [m["name"] for m in months]
        self._month_combo.configure(values=month_names or ["—"])
        if month_names and not self._month_var.get():
            self._month_var.set(month_names[0])

        self._filter_combo.configure(values=["Todos os períodos"] + month_names)
        self._render_list()

    def _render_list(self) -> None:
        from collections import defaultdict

        selected = self._filter_var.get()
        investments = self._all_investments

        if selected != "Todos os períodos":
            month = next((m for m in self._months if m["name"] == selected), None)
            if month:
                ids_in_month = {mv["investment_id"] for mv in self._all_movements
                                if mv["month_id"] == month["id"]}
                investments = [i for i in investments if i["id"] in ids_in_month]

        for w in self._list_frame.winfo_children():
            w.destroy()

        n     = len(investments)
        total = len(self._all_investments)
        if selected == "Todos os períodos":
            self._count_lbl.configure(
                text=f"{n} investimento{'s' if n != 1 else ''}" if n
                else "Nenhum investimento cadastrado.")
        else:
            self._count_lbl.configure(
                text=f"{n} de {total} investimento{'s' if total != 1 else ''} em {selected}")

        if not investments:
            msg = (f"Nenhum investimento em {selected}." if selected != "Todos os períodos"
                   else "Use o formulário acima para criar seu primeiro investimento.")
            ctk.CTkLabel(self._list_frame, text=msg,
                         font=F(12), text_color=T.MUTED, anchor="w").grid(
                row=0, column=0, sticky="w", pady=8)
            return

        mov_map: dict = defaultdict(list)
        for m in self._all_movements:
            mov_map[m["investment_id"]].append(m)

        for idx, inv in enumerate(investments):
            movs    = mov_map[inv["id"]]
            balance = _calc_balance(movs)
            card    = self._make_investment_card(inv, balance, movs, self._months)
            card.grid(row=idx, column=0, sticky="ew", pady=(0, 12))

    # ------------------------------------------------------------------
    def _make_investment_card(
        self, inv: dict, balance: float, movements: list, months: list,
    ) -> ctk.CTkFrame:
        card = ctk.CTkFrame(self._list_frame, fg_color=T.CARD,
                            corner_radius=14, border_width=1, border_color=T.BORDER)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkFrame(card, height=3, fg_color=T.VIOLET, corner_radius=2).grid(
            row=0, column=0, sticky="ew", padx=8, pady=(10, 0))

        # ── Nome + saldo ───────────────────────────────────────────────
        top = ctk.CTkFrame(card, fg_color="transparent")
        top.grid(row=1, column=0, sticky="ew", padx=20, pady=(10, 4))
        top.grid_columnconfigure(0, weight=1)

        name_row = ctk.CTkFrame(top, fg_color="transparent")
        name_row.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(name_row, text=inv["name"],
                     font=F(15, "bold"), text_color=T.TEXT).pack(side="left")
        ctk.CTkLabel(name_row, text=f"  {inv['category']}",
                     font=F(11), text_color=T.MUTED).pack(side="left")

        bal_color = T.VIOLET if balance >= 0 else T.RED
        ctk.CTkLabel(top, text=format_currency(balance),
                     font=F(18, "bold"), text_color=bal_color).grid(
            row=0, column=1, sticky="e")

        created = str(inv.get("created_at") or "")[:10]
        ctk.CTkLabel(top, text=f"Criado em {created}",
                     font=F(11), text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, sticky="w")
        n_mov = len(movements)
        ctk.CTkLabel(
            top,
            text=f"{n_mov} movimentaç{'ões' if n_mov != 1 else 'ão'}",
            font=F(11), text_color=T.MUTED, anchor="e",
        ).grid(row=1, column=1, sticky="e")

        # ── Botões ────────────────────────────────────────────────────
        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="w", padx=20, pady=(4, 12))

        ctk.CTkButton(
            actions, text="+ Aportar", width=100,
            fg_color=T.GREEN_DIM, hover_color=T.GREEN,
            text_color=T.GREEN, border_width=1, border_color=T.GREEN,
            font=F(12, "bold"), height=30, corner_radius=7,
            command=lambda i=inv: self._open_movement_dialog(i, "aporte"),
        ).pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            actions, text="− Sacar", width=90,
            fg_color=T.RED_DIM, hover_color=T.RED,
            text_color=T.RED, border_width=1, border_color=T.RED,
            font=F(12, "bold"), height=30, corner_radius=7,
            command=lambda i=inv: self._open_movement_dialog(i, "saque"),
        ).pack(side="left", padx=(0, 6))

        hist_btn = ctk.CTkButton(
            actions, text="↕ Histórico", width=105,
            fg_color="transparent", hover_color=T.CARD2,
            text_color=T.MUTED, border_width=1, border_color=T.BORDER_L,
            font=F(12), height=30, corner_radius=7,
        )
        hist_btn.pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            actions, text="Arquivar", width=80,
            fg_color="transparent", hover_color=T.RED,
            text_color=T.SUBTLE, border_width=1, border_color=T.BORDER_L,
            font=F(12), height=30, corner_radius=7,
            command=lambda i=inv["id"], n=inv["name"]: self._on_archive(i, n),
        ).pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            actions, text="🗑 Excluir", width=90,
            fg_color="transparent", hover_color=T.RED,
            text_color=T.RED, border_width=1, border_color=T.RED,
            font=F(12), height=30, corner_radius=7,
            command=lambda i=inv["id"], n=inv["name"]: self._on_delete(i, n),
        ).pack(side="left")

        # ── Histórico colapsável ───────────────────────────────────────
        hist_frame = ctk.CTkFrame(card, fg_color=T.CARD2, corner_radius=8)
        hist_frame.grid_columnconfigure((0, 1, 2, 3), weight=1)

        hist_btn.configure(
            command=lambda f=hist_frame, b=hist_btn, m=movements:
                self._toggle_history(f, b, m)
        )
        return card

    # ------------------------------------------------------------------
    def _toggle_history(
        self, frame: ctk.CTkFrame, btn: ctk.CTkButton, movements: list,
    ) -> None:
        if frame.winfo_manager():
            frame.grid_remove()
            btn.configure(text="↕ Histórico")
            return

        if not frame.winfo_children():
            _LABELS = {
                "aporte_inicial": "Aporte Inicial",
                "aporte":         "Aporte",
                "saque":          "Saque",
            }
            _COLORS = {
                "aporte_inicial": T.VIOLET,
                "aporte":         T.GREEN,
                "saque":          T.RED,
            }
            for c, h in enumerate(["Data", "Tipo", "Valor", "Nota"]):
                ctk.CTkLabel(frame, text=h, font=F(10, "bold"),
                             text_color=T.MUTED, anchor="w").grid(
                    row=0, column=c,
                    padx=(16 if c == 0 else 8, 8), pady=(8, 4), sticky="w")

            if not movements:
                ctk.CTkLabel(frame, text="Nenhuma movimentação registrada.",
                             font=F(11), text_color=T.MUTED).grid(
                    row=1, column=0, columnspan=4, padx=16, pady=(0, 8), sticky="w")
            else:
                for i, mov in enumerate(movements):
                    mtype  = mov["movement_type"]
                    color  = _COLORS.get(mtype, T.TEXT)
                    date   = str(mov.get("created_at") or "")[:10]
                    label  = _LABELS.get(mtype, mtype)
                    amt    = float(mov["amount"] or 0)
                    prefix = "−" if mtype == "saque" else "+"
                    note   = mov.get("note") or "—"
                    ctk.CTkLabel(frame, text=date, font=F(11),
                                 text_color=T.MUTED, anchor="w").grid(
                        row=i + 1, column=0, padx=(16, 8), pady=2, sticky="w")
                    ctk.CTkLabel(frame, text=label, font=F(11, "bold"),
                                 text_color=color, anchor="w").grid(
                        row=i + 1, column=1, padx=8, pady=2, sticky="w")
                    ctk.CTkLabel(
                        frame,
                        text=f"{prefix} {format_currency(amt)}",
                        font=F(11), text_color=color, anchor="w",
                    ).grid(row=i + 1, column=2, padx=8, pady=2, sticky="w")
                    ctk.CTkLabel(frame, text=note, font=F(11),
                                 text_color=T.MUTED, anchor="w").grid(
                        row=i + 1, column=3, padx=8, pady=2, sticky="w")

        frame.grid(row=3, column=0, sticky="ew", padx=12, pady=(0, 12))
        btn.configure(text="↑ Fechar")

    # ------------------------------------------------------------------
    def _on_create(self) -> None:
        name   = self._name_var.get().strip()
        cat    = self._cat_var.get()
        amt_s  = (self._amount_var.get().strip()
                  .replace(",", ".").replace("R$", "").strip())
        m_name = self._month_var.get()

        if not name:
            self._form_error.configure(text="  Informe o nome do investimento.")
            return
        try:
            amount = float(amt_s)
            if amount <= 0:
                raise ValueError
        except ValueError:
            self._form_error.configure(text="  Valor inválido.")
            return
        month = next((m for m in self._months if m["name"] == m_name), None)
        if not month:
            self._form_error.configure(text="  Selecione um período válido.")
            return

        self._form_error.configure(text="")
        try:
            db.create_investment(name, cat, month["id"], amount,
                                 self._note_var.get().strip())
        except Exception as e:
            self._form_error.configure(text=f"  Erro: {e}")
            return

        self._name_var.set("")
        self._amount_var.set("")
        self._note_var.set("")
        if self._on_change:
            self._on_change()
        self.refresh()

    # ------------------------------------------------------------------
    def _open_movement_dialog(self, inv: dict, movement_type: str) -> None:
        def on_success():
            if self._on_change:
                self._on_change()
            self.refresh()

        _MovementDialog(
            self.winfo_toplevel(),
            inv_name=inv["name"],
            investment_id=inv["id"],
            movement_type=movement_type,
            months=self._months,
            on_success=on_success,
        )

    # ------------------------------------------------------------------
    def _on_archive(self, inv_id: int, inv_name: str) -> None:
        def do_archive():
            db.archive_investment(inv_id)
            if self._on_change:
                self._on_change()
            self.refresh()

        _ConfirmDialog(
            self.winfo_toplevel(),
            title="Arquivar investimento?",
            message=f'"{inv_name}" sumirá da lista.\n'
                    "O saldo histórico continua sendo\ncontabilizado nos totais.",
            confirm_text="Arquivar",
            on_confirm=do_archive,
        )

    def _on_delete(self, inv_id: int, inv_name: str) -> None:
        def do_delete():
            db.delete_investment(inv_id)
            if self._on_change:
                self._on_change()
            self.refresh()

        _ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir permanentemente?",
            message=f'"{inv_name}" e todas as suas\n'
                    "movimentações serão apagadas.\n"
                    "Os valores somem dos totais do dashboard.",
            confirm_text="Excluir",
            on_confirm=do_delete,
        )


# ──────────────────────────────────────────────────────────────────────
def _calc_balance(movements: list) -> float:
    total = 0.0
    for m in movements:
        amt = float(m["amount"] or 0)
        if m["movement_type"] == "saque":
            total -= amt
        else:
            total += amt
    return total


class _MovementDialog(ctk.CTkToplevel):
    def __init__(
        self, parent, inv_name: str, investment_id: int,
        movement_type: str, months: list, on_success: Callable,
    ):
        super().__init__(parent)
        action = "Aportar em" if movement_type == "aporte" else "Sacar de"
        self.title(f"{action}: {inv_name}")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._investment_id  = investment_id
        self._movement_type  = movement_type
        self._months         = months
        self._on_success     = on_success
        apply_app_icon(self)
        self._build(inv_name, movement_type)
        _center_dialog(self, parent, 400, 320)
        self.lift()
        self.focus()

    def _build(self, inv_name: str, movement_type: str) -> None:
        self.grid_columnconfigure(0, weight=1)
        action = "Aportar em" if movement_type == "aporte" else "Sacar de"
        color  = T.GREEN if movement_type == "aporte" else T.RED

        ctk.CTkLabel(self, text=f"{action}: {inv_name}",
                     font=F(14, "bold"), text_color=color).grid(
            row=0, column=0, pady=(22, 12), padx=28)

        fields = ctk.CTkFrame(self, fg_color="transparent")
        fields.grid(row=1, column=0, padx=28, sticky="ew")
        fields.grid_columnconfigure(0, weight=1)

        month_names = [m["name"] for m in self._months]
        self._month_var = ctk.StringVar(value=month_names[0] if month_names else "")
        ctk.CTkLabel(fields, text="Período", font=F(11),
                     text_color=T.MUTED, anchor="w").grid(
            row=0, column=0, sticky="w", pady=(0, 2))
        ctk.CTkComboBox(
            fields, values=month_names or ["—"], variable=self._month_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT,
        ).grid(row=1, column=0, sticky="ew")

        self._amount_var = ctk.StringVar()
        ctk.CTkLabel(fields, text="Valor (R$)", font=F(11),
                     text_color=T.MUTED, anchor="w").grid(
            row=2, column=0, sticky="w", pady=(10, 2))
        amount_entry = ctk.CTkEntry(
            fields, placeholder_text="0,00",
            textvariable=self._amount_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
        )
        amount_entry.grid(row=3, column=0, sticky="ew")
        amount_entry.focus()

        self._note_var = ctk.StringVar()
        ctk.CTkLabel(fields, text="Nota (opcional)", font=F(11),
                     text_color=T.MUTED, anchor="w").grid(
            row=4, column=0, sticky="w", pady=(10, 2))
        ctk.CTkEntry(
            fields, textvariable=self._note_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
        ).grid(row=5, column=0, sticky="ew")

        self._error_lbl = ctk.CTkLabel(
            self, text="", font=F(11), text_color=T.RED)
        self._error_lbl.grid(row=2, column=0, pady=(6, 0), padx=28, sticky="w")

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=3, column=0, pady=14)
        ctk.CTkButton(
            btns, text="Cancelar", width=110,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, command=self.destroy,
        ).pack(side="left", padx=6)
        ctk.CTkButton(
            btns, text="Confirmar", width=130,
            fg_color=color, hover_color=color,
            text_color="#ffffff", font=F(13, "bold"),
            command=self._confirm,
        ).pack(side="left", padx=6)

    def _confirm(self) -> None:
        amt_s = (self._amount_var.get().strip()
                 .replace(",", ".").replace("R$", "").strip())
        try:
            amount = float(amt_s)
            if amount <= 0:
                raise ValueError
        except ValueError:
            self._error_lbl.configure(text="  Valor inválido.")
            return
        m_name = self._month_var.get()
        month  = next((m for m in self._months if m["name"] == m_name), None)
        if not month:
            self._error_lbl.configure(text="  Selecione um período.")
            return
        try:
            db.add_movement(
                self._investment_id, month["id"],
                self._movement_type, amount,
                self._note_var.get().strip(),
            )
        except Exception as e:
            self._error_lbl.configure(text=f"  Erro: {e}")
            return
        self._on_success()
        self.destroy()


class _ConfirmDialog(ctk.CTkToplevel):
    def __init__(
        self, parent, title: str, message: str,
        confirm_text: str = "Confirmar", on_confirm: Optional[Callable] = None,
    ):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._on_confirm = on_confirm
        apply_app_icon(self)
        self._build(title, message, confirm_text)
        _center_dialog(self, parent, 380, 210)
        self.lift()
        self.focus()

    def _build(self, title: str, message: str, confirm_text: str) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text=title,
                     font=F(15, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 6))
        ctk.CTkLabel(self, text=message, font=F(13), text_color=T.MUTED,
                     justify="center").grid(row=1, column=0, pady=(0, 8))
        self._error_lbl = ctk.CTkLabel(
            self, text="", font=F(11), text_color=T.RED)
        self._error_lbl.grid(row=2, column=0, pady=(0, 4), padx=28, sticky="w")
        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=3, column=0, pady=10)
        ctk.CTkButton(
            btns, text="Cancelar", width=110,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(13), command=self.destroy,
        ).pack(side="left", padx=6)
        ctk.CTkButton(
            btns, text=confirm_text, width=110,
            fg_color=T.RED, hover_color="#e05555",
            text_color="#ffffff", font=F(13, "bold"),
            command=self._confirm,
        ).pack(side="left", padx=6)

    def _confirm(self) -> None:
        if self._on_confirm:
            try:
                self._on_confirm()
            except Exception as e:
                self._error_lbl.configure(text=f"  Erro: {e}")
                return
        self.destroy()


def _center_dialog(dialog: ctk.CTkToplevel, parent, w: int, h: int) -> None:
    dialog.update_idletasks()
    px = parent.winfo_x() + (parent.winfo_width()  - w) // 2
    py = parent.winfo_y() + (parent.winfo_height() - h) // 2
    dialog.geometry(f"{w}x{h}+{px}+{py}")
