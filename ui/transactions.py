"""Aba de lançamentos: formulário + tabela com badges de categoria."""
import tkinter as tk
import customtkinter as ctk
from typing import Callable, List, Optional

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import CATEGORIES, EXPENSE_TYPES, format_currency

_PLACEHOLDER = {
    "entrada_fixa":     "Ex: Salário, Aluguel recebido…",
    "entrada_variavel": "Ex: Freela, Venda, Bônus…",
    "saida_fixa":       "Ex: Aluguel, Financiamento, Internet…",
    "saida_variavel":   "Ex: Mercado, Restaurante, Uber…",
}


class TransactionsTab(ctk.CTkFrame):
    def __init__(self, parent, month_id: int, tx_type: str, on_change: Callable):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self.month_id  = month_id
        self.tx_type   = tx_type
        self.on_change = on_change
        self.is_expense      = tx_type in EXPENSE_TYPES
        self._is_var_expense = tx_type == "saida_variavel"

        self._editing_id: Optional[int] = None
        self._card_id_map: dict = {}   # card name → card id
        self._card_info:   dict = {}   # card id   → {name, color}
        self._row_widgets: dict = {}   # tx_id     → {frame, labels, separator, tx}
        self._empty_lbl          = None
        self._initialized        = False

        if tx_type in ("entrada_fixa", "entrada_variavel"):
            self._style = {"color": T.GREEN, "dim": T.GREEN_DIM}
        elif tx_type in ("saida_fixa", "saida_variavel"):
            self._style = {"color": T.RED,   "dim": T.RED_DIM}
        else:
            self._style = {"color": T.BLUE,  "dim": T.BLUE_DIM}

        self.grid_columnconfigure(0, weight=1)

        if self._is_var_expense:
            self.grid_rowconfigure(2, weight=1)
            self._build_card_bar()   # row 0
            self._build_form(row=1)
            self._build_table(row=2)
        else:
            self.grid_rowconfigure(1, weight=1)
            self._build_form(row=0)
            self._build_table(row=1)
        # Não chama refresh() aqui — a aba carrega ao ser exibida pela primeira vez

    # ------------------------------------------------------------------
    def _build_card_bar(self) -> None:
        from ui.credit_cards import CardPresetsBar
        wrap = ctk.CTkFrame(
            self, fg_color=T.CARD, corner_radius=12,
            border_width=1, border_color=T.BORDER,
        )
        wrap.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        bar = CardPresetsBar(wrap, month_id=self.month_id, on_cards_changed=self._on_cards_changed)
        bar.pack(fill="x", padx=16, pady=14)
        self._card_bar = bar

    def _on_cards_changed(self, cards: List[dict]) -> None:
        self._card_id_map = {c["name"]: c["id"] for c in cards}
        self._card_info   = {
            c["id"]: {"name": c["name"], "color": c.get("color", "#6C8EFF")}
            for c in cards
        }
        names = ["Nenhum"] + [c["name"] for c in cards]
        if hasattr(self, "_card_combo"):
            self._card_combo.configure(values=names)
        # Só atualiza a lista se já foi inicializada — evita double-refresh na primeira carga
        if self._initialized:
            self.refresh()

    # ------------------------------------------------------------------
    def _build_form(self, row: int = 0) -> None:
        form = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        form.grid(row=row, column=0, sticky="ew", padx=28, pady=(10, 0))
        form.grid_columnconfigure((0, 1, 2, 3), weight=1)

        self._form_title = ctk.CTkLabel(
            form, text="Novo Lançamento",
            font=F(13, "bold"), text_color=T.TEXT, anchor="w")
        self._form_title.grid(row=0, column=0, columnspan=4,
                              padx=18, pady=(8, 5), sticky="w")

        # Labels row
        ctk.CTkLabel(form, text="DESCRIÇÃO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, padx=(18, 6), sticky="w")
        ctk.CTkLabel(form, text="VALOR (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=1, padx=6, sticky="w")
        ctk.CTkLabel(form, text="CATEGORIA", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=2, padx=6, sticky="w")

        # Inputs row
        self._desc = ctk.CTkEntry(
            form, placeholder_text=_PLACEHOLDER.get(self.tx_type, "Descrição…"),
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._desc.grid(row=2, column=0, padx=(18, 6), pady=(4, 0), sticky="ew")
        self._desc.bind("<Return>", lambda _: self._amount.focus())

        self._amount = ctk.CTkEntry(
            form, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._amount.grid(row=2, column=1, padx=6, pady=(4, 0), sticky="ew")
        self._amount.bind("<Return>", lambda _: self._submit())

        self._cat_var = ctk.StringVar(value="Outros")
        if self.is_expense:
            _values = CATEGORIES
        else:
            _values = ["Receita"]

        self._cat_combo = ctk.CTkComboBox(
            form, values=_values, variable=self._cat_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
            state="normal" if self.is_expense else "disabled",
        )
        self._cat_combo.grid(row=2, column=2, padx=6, pady=(4, 0), sticky="ew")

        ctk.CTkLabel(form, text="").grid(row=1, column=3)
        btn_wrap = ctk.CTkFrame(form, fg_color="transparent")
        btn_wrap.grid(row=2, column=3, padx=(6, 18), pady=(4, 0), sticky="ew")
        btn_wrap.grid_columnconfigure(0, weight=1)

        self._add_btn = ctk.CTkButton(
            btn_wrap, text="+ Adicionar", command=self._submit,
            height=36, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        )
        self._add_btn.grid(row=0, column=0, sticky="ew")

        self._cancel_btn = ctk.CTkButton(
            btn_wrap, text="Cancelar", command=self._cancel_edit,
            height=36, corner_radius=8,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        )

        # Card selector — saida_variavel only
        _err_row = 3
        if self._is_var_expense:
            ctk.CTkLabel(form, text="CARTÃO (opcional)", font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=3, column=0, padx=(18, 6), pady=(10, 2), sticky="w")
            self._card_combo_var = ctk.StringVar(value="Nenhum")
            self._card_combo = ctk.CTkComboBox(
                form, values=["Nenhum"],
                variable=self._card_combo_var,
                fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
                button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
                dropdown_text_color=T.TEXT, corner_radius=8, width=240,
            )
            self._card_combo.grid(row=3, column=1, columnspan=2,
                                  padx=6, pady=(10, 2), sticky="w")
            _err_row = 4

        self._error_lbl = ctk.CTkLabel(
            form, text="", font=F(11), text_color=T.RED, anchor="w")
        self._error_lbl.grid(row=_err_row, column=0, columnspan=4,
                              padx=18, pady=(6, 12), sticky="w")

    # ------------------------------------------------------------------
    def _build_table(self, row: int = 1) -> None:
        wrapper = ctk.CTkFrame(self, fg_color="transparent")
        wrapper.grid(row=row, column=0, sticky="nsew", padx=28, pady=(14, 24))
        wrapper.grid_columnconfigure(0, weight=1)
        wrapper.grid_rowconfigure(1, weight=1)

        top = ctk.CTkFrame(wrapper, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        top.grid_columnconfigure(0, weight=1)

        self._count_lbl = ctk.CTkLabel(
            top, text="0 registros", font=F(13), text_color=T.MUTED, anchor="w")
        self._count_lbl.grid(row=0, column=0, sticky="w")

        table = ctk.CTkFrame(wrapper, fg_color=T.CARD, corner_radius=12,
                             border_width=1, border_color=T.BORDER)
        table.grid(row=1, column=0, sticky="nsew")
        table.grid_columnconfigure(0, weight=1)
        table.grid_rowconfigure(1, weight=1)

        hdr = ctk.CTkFrame(table, fg_color=T.CARD2, corner_radius=0)
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_columnconfigure(0, weight=3)
        hdr.grid_columnconfigure(1, weight=2)
        hdr.grid_columnconfigure(2, weight=1)
        hdr.grid_columnconfigure(3, minsize=80)

        for col, txt in enumerate(["DESCRIÇÃO", "CATEGORIA", "VALOR", ""]):
            ctk.CTkLabel(hdr, text=txt, font=F(11, "bold"),
                         text_color=T.SUBTLE, anchor="w").grid(
                row=0, column=col, padx=16, pady=10, sticky="w")

        self._list = ctk.CTkScrollableFrame(
            table, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._list.grid(row=1, column=0, sticky="nsew")
        self._list.grid_columnconfigure(0, weight=1)

        footer = ctk.CTkFrame(table, fg_color=T.CARD2, corner_radius=0)
        footer.grid(row=2, column=0, sticky="ew")

        ctk.CTkLabel(footer, text="TOTAL", font=F(11, "bold"),
                     text_color=T.SUBTLE).pack(side="left", padx=16, pady=10)
        self._total_lbl = ctk.CTkLabel(
            footer, text="R$ 0,00",
            font=F(14, "bold"), text_color=self._style["color"])
        self._total_lbl.pack(side="right", padx=16, pady=10)

    # ------------------------------------------------------------------
    def _submit(self) -> None:
        desc       = self._desc.get().strip()
        amount_raw = self._amount.get().strip().replace(",", ".")
        category   = self._cat_var.get() if (self.is_expense or self.is_investment) else "Receita"

        if not desc:
            self._show_error("Preencha a descrição.")
            self._desc.focus()
            return
        try:
            amount = float(amount_raw)
            if amount <= 0:
                raise ValueError
        except ValueError:
            self._show_error("Digite um valor positivo (ex: 1500,00).")
            self._amount.focus()
            return

        card_id: Optional[int] = None
        if self._is_var_expense and hasattr(self, "_card_combo"):
            card_id = self._card_id_map.get(self._card_combo.get())

        self._hide_error()

        if self._editing_id is not None:
            db.update_transaction(
                self._editing_id, self.month_id, desc, amount, category, card_id=card_id)
            self._cancel_edit()
        else:
            db.add_transaction(
                self.month_id, self.tx_type, desc, amount, category, card_id=card_id)
            self._desc.delete(0, "end")
            self._amount.delete(0, "end")
            self._desc.focus()

        self.refresh()
        self.on_change()

    def _show_error(self, msg: str) -> None:
        self._error_lbl.configure(text=f"  ⚠  {msg}")
        self.after(4000, self._hide_error)

    def _hide_error(self) -> None:
        self._error_lbl.configure(text="")

    # ------------------------------------------------------------------
    def _start_edit(self, tx: dict) -> None:
        self._editing_id = tx["id"]
        self._desc.delete(0, "end")
        self._desc.insert(0, tx["description"])
        self._amount.delete(0, "end")
        self._amount.insert(0, str(tx["amount"]))
        if self.is_expense:
            self._cat_var.set(tx["category"] or "Outros")
        if self._is_var_expense and hasattr(self, "_card_combo"):
            card_id   = tx.get("card_id")
            card_name = self._card_info.get(card_id, {}).get("name", "Nenhum") if card_id else "Nenhum"
            self._card_combo.set(card_name)
        self._form_title.configure(text="✏  Editando lançamento")
        self._add_btn.configure(text="✓ Salvar")
        self._cancel_btn.grid(row=1, column=0, sticky="ew", pady=(4, 0))
        self._desc.focus()

    def _cancel_edit(self) -> None:
        self._editing_id = None
        self._desc.delete(0, "end")
        self._amount.delete(0, "end")
        if self.is_expense:
            self._cat_var.set("Outros")
        if self._is_var_expense and hasattr(self, "_card_combo"):
            self._card_combo.set("Nenhum")
        self._form_title.configure(text="Novo Lançamento")
        self._add_btn.configure(text="+ Adicionar")
        self._cancel_btn.grid_forget()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        txs   = db.get_transactions(self.month_id, self.tx_type)
        color = self._style["color"]
        dim   = self._style["dim"]
        total = 0.0
        n     = len(txs)

        # Remove widgets de transações que foram deletadas
        new_id_set = {tx["id"] for tx in txs}
        for tx_id in list(self._row_widgets.keys()):
            if tx_id not in new_id_set:
                self._row_widgets[tx_id]["frame"].destroy()
                del self._row_widgets[tx_id]

        self._count_lbl.configure(text=f"{n} {'registro' if n == 1 else 'registros'}")

        if not txs:
            if self._empty_lbl is None:
                self._empty_lbl = ctk.CTkLabel(
                    self._list,
                    text="Nenhum lançamento. Adicione um acima ↑",
                    font=F(13), text_color=T.MUTED,
                )
                self._empty_lbl.pack(pady=40)
            self._total_lbl.configure(text=format_currency(0.0))
            self._initialized = True
            return

        # Remove o label de lista vazia se existir
        if self._empty_lbl is not None:
            self._empty_lbl.destroy()
            self._empty_lbl = None

        # Cria widgets só para transações novas (que ainda não têm linha)
        for tx in txs:
            if tx["id"] not in self._row_widgets:
                self._row_widgets[tx["id"]] = self._make_row(tx, color, dim)

        # Reordena: desvincula todos do pack e reinsere na ordem correta
        for w in self._row_widgets.values():
            w["frame"].pack_forget()

        for i, tx in enumerate(txs):
            w      = self._row_widgets[tx["id"]]
            row_bg = T.CARD if i % 2 == 0 else T.CARD2

            w["tx"] = tx  # mantém dados frescos para o botão de edição
            w["frame"].configure(bg=row_bg)
            w["desc_cell"].configure(bg=row_bg)
            w["actions"].configure(bg=row_bg)
            w["desc_lbl"].configure(fg_color=row_bg)
            w["amount_lbl"].configure(fg_color=row_bg)
            w["desc_lbl"].configure(text=tx["description"])
            w["cat_lbl"].configure(text=f" {tx['category'] or 'Outros'} ")
            w["amount_lbl"].configure(text=format_currency(tx["amount"]))

            # Badge do cartão (só na aba saida_variavel)
            if self._is_var_expense and w["badge_lbl"] is not None:
                info = self._card_info.get(tx.get("card_id"))
                if info:
                    w["badge_lbl"].configure(text=f"  {info['name']} ", text_color=info["color"])
                    w["badge_lbl"].pack(anchor="w", pady=(2, 0))
                else:
                    w["badge_lbl"].pack_forget()

            # Separador: aparece em todas as linhas exceto a última
            if i < n - 1:
                w["separator"].grid(row=1, column=0, columnspan=4, sticky="ew")
            else:
                w["separator"].grid_remove()

            w["frame"].pack(fill="x")
            total += float(tx["amount"])

        self._total_lbl.configure(text=format_currency(total))
        self._initialized = True

    def _make_row(self, tx: dict, color: str, dim: str) -> dict:
        """Cria os widgets de uma linha e retorna referências para atualizações futuras.

        Usa tk.Frame em vez de CTkFrame para eliminar o Canvas interno por linha
        que causa o flickering visual durante o scroll do CTkScrollableFrame.
        """
        row       = tk.Frame(self._list, bg=T.CARD, bd=0, highlightthickness=0)
        separator = tk.Frame(row, height=1, bg=T.BORDER, bd=0, highlightthickness=0)

        row.grid_columnconfigure(0, weight=3)
        row.grid_columnconfigure(1, weight=2)
        row.grid_columnconfigure(2, weight=1)

        desc_cell = tk.Frame(row, bg=T.CARD, bd=0, highlightthickness=0)
        desc_cell.grid(row=0, column=0, padx=20, pady=(20, 20), sticky="ew")

        # fg_color explícito (não "transparent") para não depender da detecção de pai tk.Frame
        desc_lbl = ctk.CTkLabel(
            desc_cell, text=tx["description"],
            font=F(17, "bold"), text_color=T.TEXT, anchor="w", fg_color=T.CARD,
        )
        desc_lbl.pack(anchor="w")

        badge_lbl = None
        if self._is_var_expense:
            badge_lbl = ctk.CTkLabel(
                desc_cell, text="",
                font=F(10, "bold"), text_color=T.MUTED,
                fg_color=T.CARD2, corner_radius=4,
            )

        cat_lbl = ctk.CTkLabel(
            row, text=f" {tx['category'] or 'Outros'} ",
            font=F(13, "bold"), text_color=color, fg_color=dim, corner_radius=6,
        )
        cat_lbl.grid(row=0, column=1, padx=10, pady=20, sticky="w")

        amount_lbl = ctk.CTkLabel(
            row, text=format_currency(tx["amount"]),
            font=F(18, "bold"), text_color=color, anchor="w", fg_color=T.CARD,
        )
        amount_lbl.grid(row=0, column=2, padx=10, pady=20, sticky="w")

        actions = tk.Frame(row, bg=T.CARD, bd=0, highlightthickness=0)
        actions.grid(row=0, column=3, padx=(0, 12), pady=8)

        ctk.CTkButton(
            actions, text="✏", width=28, height=28,
            command=lambda tid=tx["id"]: self._start_edit(self._row_widgets[tid]["tx"]),
            fg_color="transparent", text_color=T.MUTED,
            hover_color=T.CARD2, corner_radius=6, font=F(12),
        ).pack(side="left", padx=(0, 2))

        ctk.CTkButton(
            actions, text="✕", width=28, height=28,
            command=lambda tid=tx["id"]: self._delete(tid),
            fg_color="transparent", text_color=T.MUTED,
            hover_color=T.RED, corner_radius=6, font=F(12),
        ).pack(side="left")

        return {
            "frame":      row,
            "separator":  separator,
            "desc_cell":  desc_cell,
            "actions":    actions,
            "desc_lbl":   desc_lbl,
            "cat_lbl":    cat_lbl,
            "amount_lbl": amount_lbl,
            "badge_lbl":  badge_lbl,
            "tx":         tx,
        }

    # ------------------------------------------------------------------
    def _delete(self, tid: int) -> None:
        if self._editing_id == tid:
            self._cancel_edit()
        db.delete_transaction(tid, self.month_id)
        self.refresh()
        self.on_change()
