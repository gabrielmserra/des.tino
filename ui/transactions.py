"""Aba de lançamentos: formulário + tabela com badges de categoria."""
import tkinter as tk
import customtkinter as ctk
import threading
from datetime import datetime
from typing import Callable, List, Optional

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import CATEGORIES, EXPENSE_TYPES, format_currency, format_date_br, PAYMENT_METHODS

_PLACEHOLDER = {
    "entrada_fixa":     "Ex: Salário, Aluguel recebido…",
    "entrada_variavel": "Ex: Freela, Venda, Bônus…",
    "saida_fixa":       "Ex: Aluguel, Financiamento, Internet…",
    "saida_variavel":   "Ex: Mercado, Restaurante, Uber…",
}

_METHOD_LABELS = list(PAYMENT_METHODS.values())
_LABEL_TO_METHOD_KEY = {v: k for k, v in PAYMENT_METHODS.items()}


def _today_br() -> str:
    return datetime.now().strftime("%d/%m/%Y")


def _tx_display_desc(tx: dict) -> str:
    """Parcela de compra no cartão mostra '🧾 descrição (N/M)' em vez da
    descrição crua."""
    if tx.get("card_purchase_id") and tx.get("installment_number") and tx.get("installment_total"):
        return f"🧾 {tx['description']} ({tx['installment_number']}/{tx['installment_total']})"
    return tx["description"]


class TransactionsTab(ctk.CTkFrame):
    def __init__(self, parent, month_id: int, tx_type: str, on_change: Callable):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self.month_id  = month_id
        self.tx_type   = tx_type
        self.on_change = on_change
        self.is_expense      = tx_type in EXPENSE_TYPES
        self._is_var_expense = tx_type == "saida_variavel"

        self._editing_id: Optional[int] = None
        self._card_id_map:     dict = {}   # card name → card id
        self._card_info:       dict = {}   # card id   → {name, color}
        self._benefit_info:    dict = {}   # benefit id → {name, color, balance, type}
        self._benefits_list:   list = []   # benefícios ativos (com saldo)
        self._debit_info:      dict = {}   # debit card id → {name, color}
        self._debit_list:      list = []   # cartões de débito
        self._cards_list:      list = []
        self._row_widgets:     dict = {}   # tx_id     → {frame, labels, separator, tx}
        self._empty_lbl            = None
        self._initialized          = False
        self._expectation_active   = False
        self._expanded_list        = False
        self._q_expect_active      = False
        self._sort_order            = "recentes"   # "recentes" | "antigos" — por data real de pagamento

        if tx_type in ("entrada_fixa", "entrada_variavel"):
            self._style = {"color": T.GREEN, "dim": T.GREEN_DIM}
        elif tx_type in ("saida_fixa", "saida_variavel"):
            self._style = {"color": T.RED,   "dim": T.RED_DIM}
        else:
            self._style = {"color": T.BLUE,  "dim": T.BLUE_DIM}

        self.grid_columnconfigure(0, weight=1)

        if self._is_var_expense:
            self.grid_rowconfigure(3, weight=1)
            self._build_card_bar(row=0)
            self._build_benefits_bar(row=1)
            self._build_form(row=2)
            self._build_table(row=3)
            # Não há mais uma barra de cartões de débito (removida) — mas o
            # combo de "forma de pagamento" ainda precisa da lista, pro
            # seletor secundário quando o método é débito.
            self._load_debit_sources_async()
        else:
            self.grid_rowconfigure(1, weight=1)
            self._build_form(row=0)
            self._build_table(row=1)
            # Nas outras abas não há as barras de preset (cartão/VR-VA),
            # mas o combo de "forma de pagamento" precisa das mesmas listas
            # pra popular o seletor secundário (crédito/débito/VR-VA).
            self._load_payment_sources_async()
        # Não chama refresh() aqui — a aba carrega ao ser exibida pela primeira vez

    # ------------------------------------------------------------------
    def _load_payment_sources_async(self) -> None:
        def _fetch():
            cards    = db.get_cards()
            debits   = db.get_debit_cards()
            benefits = db.get_benefits()
            self.after(0, lambda: self._apply_payment_sources(cards, debits, benefits))
        threading.Thread(target=_fetch, daemon=True).start()

    def _apply_payment_sources(self, cards: List[dict], debits: List[dict], benefits: List[dict]) -> None:
        self._on_cards_changed(cards)
        self._on_debit_changed(debits)
        self._on_benefits_changed(benefits)

    def _load_debit_sources_async(self) -> None:
        def _fetch():
            debits = db.get_debit_cards()
            self.after(0, lambda: self._on_debit_changed(debits))
        threading.Thread(target=_fetch, daemon=True).start()

    # ------------------------------------------------------------------
    def _build_card_bar(self, row: int = 0) -> None:
        from ui.credit_cards import CardPresetsBar
        wrap = ctk.CTkFrame(
            self, fg_color=T.CARD, corner_radius=12,
            border_width=1, border_color=T.BORDER,
        )
        wrap.grid(row=row, column=0, sticky="ew", padx=28, pady=(20, 0))
        bar = CardPresetsBar(wrap, month_id=self.month_id, on_cards_changed=self._on_cards_changed,
                             on_purchase_created=self._on_purchase_created)
        bar.pack(fill="x", padx=16, pady=14)
        self._card_bar  = bar
        self._card_wrap = wrap

    def _build_benefits_bar(self, row: int = 1) -> None:
        from ui.benefits import BenefitsBar
        wrap = ctk.CTkFrame(
            self, fg_color=T.CARD, corner_radius=12,
            border_width=1, border_color=T.BORDER,
        )
        wrap.grid(row=row, column=0, sticky="ew", padx=28, pady=(10, 0))
        bar = BenefitsBar(wrap, on_benefits_changed=self._on_benefits_changed)
        bar.pack(fill="x", padx=16, pady=14)
        self._benefits_bar  = bar
        self._benefits_wrap = wrap

    def _on_cards_changed(self, cards: List[dict]) -> None:
        self._cards_list  = cards
        self._card_id_map = {c["name"]: c["id"] for c in cards}
        self._card_info   = {
            c["id"]: {"name": c["name"], "color": c.get("color", "#6C8EFF")}
            for c in cards
        }
        self._refresh_secondary_combo()
        if self._initialized:
            self.refresh()

    def _on_purchase_created(self) -> None:
        """Uma compra parcelada lançou a parcela do mês atual (gasto real)
        — refresca a lista pra mostrar na hora, e avisa o resto do app
        (Dashboard/Planejamento ficam desatualizados)."""
        self.refresh()
        self.on_change()

    def _on_benefits_changed(self, benefits: List[dict]) -> None:
        self._benefits_list = benefits
        self._benefit_info  = {
            b["id"]: {"name": b["name"], "color": b.get("color", "#2EAF7D"),
                      "balance": float(b.get("balance") or 0),
                      "type": b["benefit_type"]}
            for b in benefits
        }
        self._refresh_secondary_combo()
        if self._initialized:
            self.refresh()

    def _on_debit_changed(self, cards: List[dict]) -> None:
        self._debit_list = cards
        self._debit_info = {
            c["id"]: {"name": c["name"], "color": c.get("color", "#6C8EFF")}
            for c in cards
        }
        self._refresh_secondary_combo()
        if self._initialized:
            self.refresh()

    def _secondary_values_for(self, method_key: str) -> list:
        """Valores do combo secundário (cartão/débito/benefício específico)
        de acordo com a forma de pagamento escolhida."""
        if method_key == "credito":
            return [c["name"] for c in self._cards_list]
        if method_key == "debito":
            return [d["name"] for d in self._debit_list]
        if method_key == "vr_va":
            return [f"{b['name']} ({b['benefit_type']})" for b in self._benefits_list]
        return []

    def _refresh_secondary_combo(self) -> None:
        """Chamado quando a forma de pagamento muda ou quando as listas de
        cartões/débito/benefícios são (re)carregadas — atualiza os valores
        do combo secundário do formulário principal e da barra rápida."""
        if hasattr(self, "_secondary_combo"):
            key = self._method_key()
            values = self._secondary_values_for(key)
            self._secondary_combo.configure(values=values)
            if key in ("credito", "debito", "vr_va"):
                self._secondary_combo.grid()
                if self._secondary_var.get() not in values:
                    self._secondary_var.set(values[0] if values else "")
            else:
                self._secondary_var.set("")
                self._secondary_combo.grid_remove()
        if hasattr(self, "_q_secondary_combo"):
            qkey = _LABEL_TO_METHOD_KEY.get(self._q_method_var.get(), "")
            qvalues = self._secondary_values_for(qkey)
            self._q_secondary_combo.configure(values=qvalues)
            if self._q_secondary_var.get() not in qvalues:
                self._q_secondary_var.set(qvalues[0] if qvalues else "")

    def _method_key(self) -> str:
        return _LABEL_TO_METHOD_KEY.get(self._method_var.get(), "")

    def _on_method_change(self, _choice=None) -> None:
        self._refresh_secondary_combo()

    def _resolve_payment_from(self, method_key: str, secondary_label: str):
        """Converte (forma de pagamento, rótulo secundário) em (card_id, benefit_id, debit_card_id)."""
        card_id = benefit_id = debit_card_id = None
        if method_key == "credito":
            card_id = self._card_id_map.get(secondary_label)
        elif method_key == "debito":
            debit_card_id = next((d["id"] for d in self._debit_list if d["name"] == secondary_label), None)
        elif method_key == "vr_va":
            for b in self._benefits_list:
                if f"{b['name']} ({b['benefit_type']})" == secondary_label:
                    benefit_id = b["id"]
                    break
        return card_id, benefit_id, debit_card_id

    def _resolve_payment(self):
        """Lê os combos do formulário principal. Retorna (card_id, benefit_id,
        debit_card_id, payment_method) — payment_method é "" se nada selecionado."""
        key = self._method_key()
        card_id, benefit_id, debit_card_id = self._resolve_payment_from(key, self._secondary_var.get())
        return card_id, benefit_id, debit_card_id, key

    def _payment_prefill(self, tx: dict) -> tuple:
        """Retorna (rótulo do método, rótulo da origem específica) pra
        pré-preencher os combos ao editar. Lançamentos antigos sem
        payment_method explícito caem na mesma inferência de antes
        (benefício > cartão > débito > pix)."""
        method = tx.get("payment_method") or ""
        if method not in PAYMENT_METHODS:
            if tx.get("benefit_id"):
                method = "vr_va"
            elif tx.get("card_id"):
                method = "credito"
            elif tx.get("debit_card_id"):
                method = "debito"
            elif tx.get("payment_method") == "pix":
                method = "pix"
        method_label = PAYMENT_METHODS.get(method, "")
        secondary_label = ""
        if method == "credito" and tx.get("card_id"):
            info = self._card_info.get(tx["card_id"])
            secondary_label = info["name"] if info else ""
        elif method == "debito" and tx.get("debit_card_id"):
            info = self._debit_info.get(tx["debit_card_id"])
            secondary_label = info["name"] if info else ""
        elif method == "vr_va" and tx.get("benefit_id"):
            info = self._benefit_info.get(tx["benefit_id"])
            secondary_label = f"{info['name']} ({info['type']})" if info else ""
        return method_label, secondary_label

    def _payment_badge_info(self, tx: dict) -> tuple:
        """Retorna (rótulo, cor) do badge de forma de pagamento de uma linha
        da tabela — nome+cor da entidade específica quando crédito/débito/
        VR-VA, senão o rótulo genérico da forma de pagamento. Lançamentos
        antigos sem payment_method caem na mesma inferência de _payment_prefill."""
        method_label, _ = self._payment_prefill(tx)
        method = _LABEL_TO_METHOD_KEY.get(method_label, "")
        if method == "credito" and tx.get("card_id"):
            info = self._card_info.get(tx["card_id"])
            if info:
                return info["name"], info["color"]
        elif method == "debito" and tx.get("debit_card_id"):
            info = self._debit_info.get(tx["debit_card_id"])
            if info:
                return f"{info['name']} · débito", info["color"]
        elif method == "vr_va" and tx.get("benefit_id"):
            info = self._benefit_info.get(tx["benefit_id"])
            if info:
                return f"{info['name']} · {info['type']}", info["color"]
        if method:
            return PAYMENT_METHODS.get(method, method), T.VIOLET
        return "", T.MUTED

    # ------------------------------------------------------------------
    def _build_form(self, row: int = 0) -> None:
        form = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        form.grid(row=row, column=0, sticky="ew", padx=28, pady=(10, 0))
        form.grid_columnconfigure((0, 1, 2, 3), weight=1)
        self._form_frame = form

        self._form_title = ctk.CTkLabel(
            form, text="Novo Lançamento",
            font=F(13, "bold"), text_color=T.TEXT, anchor="w")
        self._form_title.grid(row=0, column=0, columnspan=3,
                              padx=18, pady=(8, 5), sticky="w")

        self._expect_btn = ctk.CTkButton(
            form, text="📋 Previsto",
            command=self._toggle_expectation,
            height=28, corner_radius=7,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
        )
        self._expect_btn.grid(row=0, column=3, padx=(6, 18), pady=(8, 5), sticky="e")

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

        # Forma de pagamento (obrigatória) + origem específica (opcional,
        # só quando é crédito/débito/VR-VA) + data de pagamento (opcional) —
        # presente em todas as abas.
        ctk.CTkLabel(form, text="FORMA DE PAGAMENTO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=3, column=0, padx=(18, 6), pady=(10, 2), sticky="w")
        ctk.CTkLabel(form, text="DATA DO PAGAMENTO (opcional)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=3, column=2, padx=6, pady=(10, 2), sticky="w")

        self._method_var = ctk.StringVar(value="")
        self._method_combo = ctk.CTkComboBox(
            form, values=_METHOD_LABELS, variable=self._method_var,
            command=self._on_method_change,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        )
        self._method_combo.grid(row=4, column=0, padx=(18, 6), pady=(0, 2), sticky="ew")

        self._secondary_var = ctk.StringVar(value="")
        self._secondary_combo = ctk.CTkComboBox(
            form, values=[], variable=self._secondary_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        )
        self._secondary_combo.grid(row=4, column=1, padx=6, pady=(0, 2), sticky="ew")
        self._secondary_combo.grid_remove()

        self._date_entry = ctk.CTkEntry(
            form, placeholder_text="dd/mm/aaaa",
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._date_entry.grid(row=4, column=2, padx=6, pady=(0, 2), sticky="ew")
        self._date_entry.insert(0, _today_br())

        self._error_lbl = ctk.CTkLabel(
            form, text="", font=F(11), text_color=T.RED, anchor="w")
        self._error_lbl.grid(row=5, column=0, columnspan=4,
                              padx=18, pady=(6, 12), sticky="w")

    # ------------------------------------------------------------------
    def _set_expectation(self, active: bool) -> None:
        if active == self._expectation_active:
            return
        self._expectation_active = active
        if active:
            self._expect_btn.configure(
                fg_color=T.GOLD_DIM, text_color=T.GOLD, border_color=T.GOLD)
            self._form_title.configure(text="Lançamento Previsto")
        else:
            self._expect_btn.configure(
                fg_color=T.CARD2, text_color=T.MUTED, border_color=T.BORDER_L)
            self._form_title.configure(
                text="✏  Editando lançamento" if self._editing_id else "Novo Lançamento")

    def _toggle_expectation(self) -> None:
        self._set_expectation(not self._expectation_active)

    # ------------------------------------------------------------------
    def _build_table(self, row: int = 1) -> None:
        wrapper = ctk.CTkFrame(self, fg_color="transparent")
        wrapper.grid(row=row, column=0, sticky="nsew", padx=28, pady=(14, 24))
        wrapper.grid_columnconfigure(0, weight=1)
        wrapper.grid_rowconfigure(3, weight=1)

        top = ctk.CTkFrame(wrapper, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        top.grid_columnconfigure(0, weight=1)

        self._count_lbl = ctk.CTkLabel(
            top, text="0 registros", font=F(13), text_color=T.MUTED, anchor="w")
        self._count_lbl.grid(row=0, column=0, sticky="w")

        self._sort_btn = ctk.CTkButton(
            top, text="↓  Mais recentes", command=self._toggle_sort_order,
            height=28, width=140, corner_radius=7,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
        )
        self._sort_btn.grid(row=0, column=1, sticky="e", padx=(0, 8))

        self._expand_btn = ctk.CTkButton(
            top, text="⤢  Expandir lista", command=self._toggle_list_expand,
            height=28, width=150, corner_radius=7,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
        )
        self._expand_btn.grid(row=0, column=2, sticky="e")

        self._build_filters_row(wrapper, row=1)
        self._build_quick_add(wrapper, row=2)   # escondido até expandir

        table = ctk.CTkFrame(wrapper, fg_color=T.CARD, corner_radius=12,
                             border_width=1, border_color=T.BORDER)
        table.grid(row=3, column=0, sticky="nsew")
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
        self._proj_total_lbl = ctk.CTkLabel(
            footer, text="", font=F(11), text_color=T.GOLD)
        # Packed/unpacked in refresh() when expectations exist

    # ------------------------------------------------------------------
    def _build_filters_row(self, parent, row: int) -> None:
        """Filtros de categoria e forma de pagamento — combináveis entre si
        e com a ordenação (não são excludentes)."""
        bar = ctk.CTkFrame(parent, fg_color="transparent")
        bar.grid(row=row, column=0, sticky="ew", pady=(0, 10))

        cat_values = ["Todas as categorias"] + (CATEGORIES if self.is_expense else ["Receita"])
        self._cat_filter_var = ctk.StringVar(value="Todas as categorias")
        ctk.CTkComboBox(
            bar, values=cat_values, variable=self._cat_filter_var,
            command=lambda _=None: self.refresh(),
            width=170, height=28, corner_radius=7,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.MUTED,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, font=F(11), state="readonly",
        ).pack(side="left", padx=(0, 8))

        method_values = ["Todas as formas"] + _METHOD_LABELS
        self._method_filter_var = ctk.StringVar(value="Todas as formas")
        ctk.CTkComboBox(
            bar, values=method_values, variable=self._method_filter_var,
            command=lambda _=None: self.refresh(),
            width=170, height=28, corner_radius=7,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.MUTED,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, font=F(11), state="readonly",
        ).pack(side="left", padx=(0, 8))

        self._clear_filters_btn = ctk.CTkButton(
            bar, text="✕ Limpar filtros", command=self._clear_filters,
            height=24, width=110, corner_radius=6,
            fg_color="transparent", hover_color=T.CARD2,
            text_color=T.MUTED, font=F(10),
        )
        # packed/esquecido em refresh() — só aparece quando algum filtro
        # está ativo (diferente do valor "Todas...")

    def _clear_filters(self) -> None:
        self._cat_filter_var.set("Todas as categorias")
        self._method_filter_var.set("Todas as formas")
        self.refresh()

    # ------------------------------------------------------------------
    def _build_quick_add(self, parent, row: int) -> None:
        """Barra compacta de adição, visível apenas com a lista expandida."""
        qa = ctk.CTkFrame(parent, fg_color=T.CARD, corner_radius=10,
                          border_width=1, border_color=T.BORDER)
        qa.grid(row=row, column=0, sticky="ew", pady=(0, 10))
        qa.grid_remove()
        self._qa_frame = qa

        inner = ctk.CTkFrame(qa, fg_color="transparent")
        inner.pack(fill="x", padx=12, pady=10)

        self._q_desc = ctk.CTkEntry(
            inner, placeholder_text=_PLACEHOLDER.get(self.tx_type, "Descrição…"),
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._q_desc.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self._q_desc.bind("<Return>", lambda _: self._q_amount.focus())

        self._q_amount = ctk.CTkEntry(
            inner, placeholder_text="0,00", width=110,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._q_amount.pack(side="left", padx=6)
        self._q_amount.bind("<Return>", lambda _: self._quick_add())

        if self.is_expense:
            self._q_cat_var = ctk.StringVar(value="Outros")
            ctk.CTkComboBox(
                inner, values=CATEGORIES, variable=self._q_cat_var, width=150,
                fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
                button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
                dropdown_text_color=T.TEXT, corner_radius=8,
            ).pack(side="left", padx=6)

        self._q_method_var = ctk.StringVar(value="")
        self._q_method_combo = ctk.CTkComboBox(
            inner, values=_METHOD_LABELS, variable=self._q_method_var,
            command=self._on_method_change, width=130,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        )
        self._q_method_combo.pack(side="left", padx=6)

        self._q_secondary_var = ctk.StringVar(value="")
        self._q_secondary_combo = ctk.CTkComboBox(
            inner, values=[], variable=self._q_secondary_var, width=150,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        )
        self._q_secondary_combo.pack(side="left", padx=6)

        self._q_date_entry = ctk.CTkEntry(
            inner, placeholder_text="dd/mm/aaaa", width=100,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._q_date_entry.pack(side="left", padx=6)
        self._q_date_entry.insert(0, _today_br())

        self._q_expect_btn = ctk.CTkButton(
            inner, text="📋 Previsto", command=self._toggle_q_expect,
            height=36, width=100, corner_radius=8,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
        )
        self._q_expect_btn.pack(side="left", padx=6)

        ctk.CTkButton(
            inner, text="+ Adicionar", command=self._quick_add,
            height=36, width=130, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).pack(side="left", padx=(6, 0))

        self._q_err = ctk.CTkLabel(qa, text="", font=F(11), text_color=T.RED, anchor="w")
        self._q_err.pack(fill="x", padx=14, pady=(0, 8))

    def _toggle_q_expect(self) -> None:
        self._q_expect_active = not self._q_expect_active
        if self._q_expect_active:
            self._q_expect_btn.configure(
                fg_color=T.GOLD_DIM, text_color=T.GOLD, border_color=T.GOLD)
        else:
            self._q_expect_btn.configure(
                fg_color=T.CARD2, text_color=T.MUTED, border_color=T.BORDER_L)

    def _quick_add(self) -> None:
        desc = self._q_desc.get().strip()
        if not desc:
            self._q_err.configure(text="⚠  Preencha a descrição.")
            self._q_desc.focus()
            return
        try:
            amount = float(self._q_amount.get().strip().replace(",", "."))
            if amount <= 0:
                raise ValueError
        except ValueError:
            self._q_err.configure(text="⚠  Digite um valor positivo (ex: 1500,00).")
            self._q_amount.focus()
            return

        category = self._q_cat_var.get() if self.is_expense else "Receita"

        payment_method = _LABEL_TO_METHOD_KEY.get(self._q_method_var.get(), "")
        if not payment_method:
            self._q_err.configure(text="⚠  Selecione a forma de pagamento.")
            return
        card_id, benefit_id, debit_card_id = self._resolve_payment_from(
            payment_method, self._q_secondary_var.get())

        date_raw = self._q_date_entry.get().strip()
        if not date_raw:
            self._q_err.configure(text="⚠  Informe a data do lançamento.")
            self._q_date_entry.focus()
            return
        try:
            payment_date = datetime.strptime(date_raw, "%d/%m/%Y").date()
        except ValueError:
            self._q_err.configure(text="⚠  Data inválida. Use o formato dd/mm/aaaa.")
            self._q_date_entry.focus()
            return

        # Previsto não debita o saldo (só ao confirmar) → não valida aqui
        if benefit_id is not None and not self._q_expect_active:
            info  = self._benefit_info.get(benefit_id, {})
            avail = float(info.get("balance", 0))
            if amount > avail + 1e-9:
                self._q_err.configure(
                    text=f"⚠  Saldo insuficiente em {info.get('name', 'benefício')}: "
                         f"disponível {format_currency(avail)}.")
                self._q_amount.focus()
                return

        self._q_err.configure(text="")
        db.add_transaction(self.month_id, self.tx_type, desc, amount, category,
                           card_id=card_id, benefit_id=benefit_id,
                           debit_card_id=debit_card_id, payment_method=payment_method,
                           payment_date=payment_date, is_expectation=self._q_expect_active)
        self._q_desc.delete(0, "end")
        self._q_amount.delete(0, "end")
        self._q_date_entry.delete(0, "end")
        self._q_date_entry.insert(0, _today_br())
        self._q_desc.focus()
        if hasattr(self, "_benefits_bar"):
            self._benefits_bar.refresh()
        self.refresh()
        self.on_change()

    # ------------------------------------------------------------------
    def _toggle_sort_order(self) -> None:
        self._sort_order = "antigos" if self._sort_order == "recentes" else "recentes"
        self._sort_btn.configure(
            text="↑  Mais antigos" if self._sort_order == "antigos" else "↓  Mais recentes")
        self.refresh()

    def _toggle_list_expand(self) -> None:
        """Recolhe formulário e barras de origem para a lista ocupar a tela toda.
        Uma barra de adição rápida aparece para ainda permitir novos lançamentos."""
        self._expanded_list = not self._expanded_list
        for attr in ("_card_wrap", "_benefits_wrap", "_form_frame"):
            w = getattr(self, attr, None)
            if w is None:
                continue
            if self._expanded_list:
                w.grid_remove()
            else:
                w.grid()
        if self._expanded_list:
            self._qa_frame.grid()
            self._q_desc.focus()
        else:
            self._qa_frame.grid_remove()
        self._expand_btn.configure(
            text="⤡  Recolher" if self._expanded_list else "⤢  Expandir lista")

    # ------------------------------------------------------------------
    def _submit(self) -> None:
        desc       = self._desc.get().strip()
        amount_raw = self._amount.get().strip().replace(",", ".")
        category   = self._cat_var.get() if self.is_expense else "Receita"

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

        payment_method = self._method_key()
        if not payment_method:
            self._show_error("Selecione a forma de pagamento.")
            return
        card_id, benefit_id, debit_card_id = self._resolve_payment_from(
            payment_method, self._secondary_var.get())

        date_raw = self._date_entry.get().strip()
        if not date_raw:
            self._show_error("Informe a data do lançamento.")
            self._date_entry.focus()
            return
        try:
            payment_date = datetime.strptime(date_raw, "%d/%m/%Y").date()
        except ValueError:
            self._show_error("Data inválida. Use o formato dd/mm/aaaa.")
            self._date_entry.focus()
            return

        # Saldo de VR/VA não pode ficar negativo — bloqueia (gastos reais, não previsões)
        if benefit_id is not None and not self._expectation_active:
            info  = self._benefit_info.get(benefit_id, {})
            avail = float(info.get("balance", 0))
            # Em edição sobre o MESMO benefício, o valor antigo volta ao saldo
            if self._editing_id is not None:
                old = self._row_widgets.get(self._editing_id, {}).get("tx", {})
                if old.get("benefit_id") == benefit_id and not old.get("is_expectation"):
                    avail += float(old.get("amount") or 0)
            if amount > avail + 1e-9:
                self._show_error(
                    f"Saldo insuficiente em {info.get('name', 'benefício')}: "
                    f"disponível {format_currency(avail)}. Reduza o valor ou troque a origem.")
                self._amount.focus()
                return

        self._hide_error()

        if self._editing_id is not None:
            db.update_transaction(
                self._editing_id, self.month_id, desc, amount, category,
                card_id=card_id, is_expectation=self._expectation_active,
                benefit_id=benefit_id, debit_card_id=debit_card_id,
                payment_method=payment_method, payment_date=payment_date)
            self._cancel_edit()
        else:
            db.add_transaction(
                self.month_id, self.tx_type, desc, amount, category,
                card_id=card_id, is_expectation=self._expectation_active,
                benefit_id=benefit_id, debit_card_id=debit_card_id,
                payment_method=payment_method, payment_date=payment_date)
            self._desc.delete(0, "end")
            self._amount.delete(0, "end")
            self._date_entry.delete(0, "end")
            self._date_entry.insert(0, _today_br())
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
        if self._expanded_list:        # garante que o formulário esteja visível
            self._toggle_list_expand()
        self._editing_id = tx["id"]
        self._set_expectation(bool(tx.get("is_expectation")))
        self._desc.delete(0, "end")
        self._desc.insert(0, tx["description"])
        self._amount.delete(0, "end")
        self._amount.insert(0, str(tx["amount"]))
        if self.is_expense:
            self._cat_var.set(tx["category"] or "Outros")
        method_label, secondary_label = self._payment_prefill(tx)
        self._method_var.set(method_label)
        self._refresh_secondary_combo()
        if secondary_label:
            self._secondary_var.set(secondary_label)
        self._date_entry.delete(0, "end")
        if tx.get("payment_date"):
            try:
                d = datetime.strptime(str(tx["payment_date"])[:10], "%Y-%m-%d")
                self._date_entry.insert(0, format_date_br(d))
            except ValueError:
                pass
        self._form_title.configure(text="✏  Editando lançamento")
        self._add_btn.configure(text="✓ Salvar")
        self._cancel_btn.grid(row=1, column=0, sticky="ew", pady=(4, 0))
        self._desc.focus()

    def _cancel_edit(self) -> None:
        self._editing_id = None
        self._set_expectation(False)
        self._desc.delete(0, "end")
        self._amount.delete(0, "end")
        if self.is_expense:
            self._cat_var.set("Outros")
        self._method_var.set("")
        self._refresh_secondary_combo()
        self._date_entry.delete(0, "end")
        self._date_entry.insert(0, _today_br())
        self._form_title.configure(text="Novo Lançamento")
        self._add_btn.configure(text="+ Adicionar")
        self._cancel_btn.grid_forget()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        txs = db.get_transactions(self.month_id, self.tx_type)

        # Filtros de categoria/forma de pagamento — combináveis entre si e
        # com a ordenação (aplicados juntos, não são excludentes).
        cat_filter = self._cat_filter_var.get() if hasattr(self, "_cat_filter_var") else "Todas as categorias"
        method_filter = self._method_filter_var.get() if hasattr(self, "_method_filter_var") else "Todas as formas"
        if cat_filter != "Todas as categorias":
            txs = [t for t in txs if (t.get("category") or "Outros") == cat_filter]
        if method_filter != "Todas as formas":
            method_key = _LABEL_TO_METHOD_KEY.get(method_filter)
            txs = [t for t in txs if t.get("payment_method") == method_key]
        if hasattr(self, "_clear_filters_btn"):
            active = cat_filter != "Todas as categorias" or method_filter != "Todas as formas"
            if active:
                self._clear_filters_btn.pack(side="left")
            else:
                self._clear_filters_btn.pack_forget()

        # Ordena pela data real do pagamento (payment_date, ou created_at se
        # não tiver) — não pela ordem de importação/criação no banco.
        reverse = self._sort_order == "recentes"
        txs = sorted(
            txs,
            key=lambda t: str(t.get("payment_date") or t.get("created_at") or ""),
            reverse=reverse,
        )
        color = self._style["color"]
        dim   = self._style["dim"]
        n     = len(txs)

        # Remove widgets de transações que foram deletadas
        new_id_set = {tx["id"] for tx in txs}
        for tx_id in list(self._row_widgets.keys()):
            if tx_id not in new_id_set:
                self._row_widgets[tx_id]["frame"].destroy()
                del self._row_widgets[tx_id]

        # Remove rows onde is_expectation mudou — precisam ser recriadas
        for tx in txs:
            if tx["id"] in self._row_widgets:
                w = self._row_widgets[tx["id"]]
                if bool(tx.get("is_expectation")) != w.get("is_expectation", False):
                    w["frame"].destroy()
                    del self._row_widgets[tx["id"]]

        real_n = sum(1 for tx in txs if not tx.get("is_expectation"))
        exp_n  = n - real_n
        if exp_n > 0:
            self._count_lbl.configure(
                text=f"{real_n} {'registro' if real_n == 1 else 'registros'}  +  {exp_n} previsto(s)")
        else:
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
            self._proj_total_lbl.pack_forget()
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

        real_total = 0.0
        proj_total = 0.0
        for i, tx in enumerate(txs):
            w      = self._row_widgets[tx["id"]]
            is_exp = bool(tx.get("is_expectation"))
            row_bg = T.CARD if i % 2 == 0 else T.CARD2

            text_col = T.SUBTLE if is_exp else T.TEXT
            amt_col  = T.SUBTLE if is_exp else color

            w["tx"] = tx
            w["frame"].configure(bg=row_bg)
            w["desc_cell"].configure(bg=row_bg)
            w["actions"].configure(bg=row_bg)
            w["desc_lbl"].configure(fg_color=row_bg, text=_tx_display_desc(tx), text_color=text_col)
            w["amount_lbl"].configure(fg_color=row_bg, text=format_currency(tx["amount"]), text_color=amt_col)
            w["cat_lbl"].configure(text=f" {tx['category'] or 'Outros'} ", text_color=amt_col)

            # Badge da forma de pagamento (+ data, se houver) — todas as abas
            if w["badge_lbl"] is not None:
                label, badge_color = self._payment_badge_info(tx)
                pay_date = tx.get("payment_date")
                if pay_date:
                    try:
                        d = datetime.strptime(str(pay_date)[:10], "%Y-%m-%d")
                        date_str = format_date_br(d)
                    except ValueError:
                        date_str = str(pay_date)
                    label = f"{label} · {date_str}" if label else date_str
                if label:
                    w["badge_lbl"].configure(text=f"  {label} ", text_color=badge_color)
                    w["badge_lbl"].pack(anchor="w", pady=(2, 0))
                else:
                    w["badge_lbl"].pack_forget()

            # Separador: aparece em todas as linhas exceto a última
            if i < n - 1:
                w["separator"].grid(row=1, column=0, columnspan=4, sticky="ew")
            else:
                w["separator"].grid_remove()

            w["frame"].pack(fill="x")
            if is_exp:
                proj_total += float(tx["amount"])
            else:
                real_total += float(tx["amount"])

        self._total_lbl.configure(text=format_currency(real_total))
        if proj_total > 0:
            self._proj_total_lbl.configure(text=f"  +  {format_currency(proj_total)} previsto")
            self._proj_total_lbl.pack(side="right", padx=(0, 8), pady=10)
        else:
            self._proj_total_lbl.pack_forget()
        self._initialized = True

    def _make_row(self, tx: dict, color: str, dim: str) -> dict:
        """Cria os widgets de uma linha e retorna referências para atualizações futuras.

        Usa tk.Frame em vez de CTkFrame para eliminar o Canvas interno por linha
        que causa o flickering visual durante o scroll do CTkScrollableFrame.
        """
        is_exp    = bool(tx.get("is_expectation"))
        text_col  = T.SUBTLE if is_exp else T.TEXT
        amt_col   = T.SUBTLE if is_exp else color

        row       = tk.Frame(self._list, bg=T.CARD, bd=0, highlightthickness=0)
        separator = tk.Frame(row, height=1, bg=T.BORDER, bd=0, highlightthickness=0)

        row.grid_columnconfigure(0, weight=3)
        row.grid_columnconfigure(1, weight=2)
        row.grid_columnconfigure(2, weight=1)

        desc_cell = tk.Frame(row, bg=T.CARD, bd=0, highlightthickness=0)
        desc_cell.grid(row=0, column=0, padx=20, pady=(20, 20), sticky="ew")

        # fg_color explícito (não "transparent") para não depender da detecção de pai tk.Frame
        desc_lbl = ctk.CTkLabel(
            desc_cell, text=_tx_display_desc(tx),
            font=F(17, "bold"), text_color=text_col, anchor="w", fg_color=T.CARD,
        )
        desc_lbl.pack(anchor="w")

        # Badge "Previsto" — só para transações previstas
        exp_badge = None
        if is_exp:
            exp_badge = ctk.CTkLabel(
                desc_cell, text=" Previsto ",
                font=F(10, "bold"), text_color=T.GOLD,
                fg_color=T.GOLD_DIM, corner_radius=4,
            )
            exp_badge.pack(anchor="w", pady=(2, 0))

        badge_lbl = ctk.CTkLabel(
            desc_cell, text="",
            font=F(10, "bold"), text_color=T.MUTED,
            fg_color=T.CARD2, corner_radius=4,
        )

        cat_lbl = ctk.CTkLabel(
            row, text=f" {tx['category'] or 'Outros'} ",
            font=F(13, "bold"), text_color=amt_col, fg_color=dim, corner_radius=6,
        )
        cat_lbl.grid(row=0, column=1, padx=10, pady=20, sticky="w")

        amount_lbl = ctk.CTkLabel(
            row, text=format_currency(tx["amount"]),
            font=F(18, "bold"), text_color=amt_col, anchor="w", fg_color=T.CARD,
        )
        amount_lbl.grid(row=0, column=2, padx=10, pady=20, sticky="w")

        actions = tk.Frame(row, bg=T.CARD, bd=0, highlightthickness=0)
        actions.grid(row=0, column=3, padx=(0, 12), pady=8)

        if is_exp:
            ctk.CTkButton(
                actions, text="✓", width=28, height=28,
                command=lambda tid=tx["id"]: self._open_confirm_dialog(self._row_widgets[tid]["tx"]),
                fg_color=T.GOLD_DIM, text_color=T.GOLD,
                hover_color=T.GOLD, corner_radius=6, font=F(13, "bold"),
            ).pack(side="left", padx=(0, 2))

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
            "frame":          row,
            "separator":      separator,
            "desc_cell":      desc_cell,
            "actions":        actions,
            "desc_lbl":       desc_lbl,
            "cat_lbl":        cat_lbl,
            "amount_lbl":     amount_lbl,
            "badge_lbl":      badge_lbl,
            "exp_badge":      exp_badge,
            "tx":             tx,
            "is_expectation": is_exp,
        }

    # ------------------------------------------------------------------
    def _delete(self, tid: int) -> None:
        if self._editing_id == tid:
            self._cancel_edit()
        db.delete_transaction(tid, self.month_id)
        if self._is_var_expense and hasattr(self, "_benefits_bar"):
            self._benefits_bar.refresh()   # estorno do saldo
        self.refresh()
        self.on_change()

    def _open_confirm_dialog(self, tx: dict) -> None:
        dlg = _ConfirmExpectationDialog(
            self.winfo_toplevel(), tx["description"], float(tx["amount"]))
        self.winfo_toplevel().wait_window(dlg)
        if dlg.confirmed:
            db.confirm_expectation(tx["id"], self.month_id, dlg.description, dlg.amount)
            self.refresh()
            self.on_change()


# ──────────────────────────────────────────────────────────────────────
class _ConfirmExpectationDialog(ctk.CTkToplevel):
    def __init__(self, parent, description: str, amount: float):
        super().__init__(parent)
        self.title("Confirmar lançamento")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self.confirmed   = False
        self.description = description
        self.amount      = amount
        self._build(description, amount)
        self._center(parent)
        self.lift()
        self.focus()
        self.after(100, self._set_icon)

    def _set_icon(self) -> None:
        try:
            import sys, os
            if getattr(sys, "frozen", False):
                path = os.path.join(sys._MEIPASS, "assets", "app.ico")
            else:
                path = os.path.join(os.path.dirname(__file__), "..", "assets", "app.ico")
            self.iconbitmap(os.path.abspath(path))
        except Exception:
            pass

    def _center(self, parent) -> None:
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width()  - 380) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 280) // 2
        self.geometry(f"380x280+{px}+{py}")

    def _build(self, description: str, amount: float) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Confirmar lançamento previsto",
                     font=F(14, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, pady=(24, 8), padx=24, sticky="w")

        ctk.CTkLabel(self, text="DESCRIÇÃO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, padx=24, sticky="w")
        self._desc_entry = ctk.CTkEntry(
            self, width=332,
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._desc_entry.insert(0, description)
        self._desc_entry.grid(row=2, column=0, padx=24, pady=(4, 0))
        self._desc_entry.bind("<Return>", lambda _: self._amount_entry.focus())

        ctk.CTkLabel(self, text="VALOR (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=3, column=0, padx=24, pady=(10, 0), sticky="w")
        self._amount_entry = ctk.CTkEntry(
            self, width=332, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        amt_str = f"{amount:.2f}".replace(".", ",")
        self._amount_entry.insert(0, amt_str)
        self._amount_entry.grid(row=4, column=0, padx=24, pady=(4, 0))
        self._amount_entry.bind("<Return>", lambda _: self._confirm())

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=5, column=0, pady=(6, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=6, column=0, pady=12)

        ctk.CTkButton(btns, text="Cancelar", width=100,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="✓ Confirmar", width=120,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        desc = self._desc_entry.get().strip()
        raw  = self._amount_entry.get().strip().replace(",", ".")
        if not desc:
            self._err.configure(text="Preencha a descrição.")
            return
        try:
            val = float(raw)
            if val <= 0:
                raise ValueError
        except ValueError:
            self._err.configure(text="Digite um valor positivo.")
            return
        self.description = desc
        self.amount      = val
        self.confirmed   = True
        self.destroy()
