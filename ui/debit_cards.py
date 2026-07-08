"""Cartões de débito — barra de cards usada dentro de Saídas Variáveis.

Entidade simples (só nome/cor): débito não tem fatura/limite/vencimento —
a transação já debita o saldo na hora, igual a "Nenhuma origem".
"""
import threading
from typing import Callable, List

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import apply_app_icon, format_currency

DEBIT_COLORS = ["#6C8EFF", "#2EAF7D", "#E05252", "#9B72F5", "#F5A623", "#4ECDC4", "#FF6B9D", "#FFB347"]


def _all_debit_spendings(cards: list, month_id: int) -> dict:
    """Gasto do mês por cartão de débito (só gastos reais, não previstos)."""
    if not cards:
        return {}
    ids = {c["id"] for c in cards}
    totals = {cid: 0.0 for cid in ids}
    for tx in db.get_transactions(month_id):
        if tx["type"] != "saida_variavel" or tx.get("is_expectation"):
            continue
        did = tx.get("debit_card_id")
        if did in totals:
            totals[did] += float(tx["amount"] or 0)
    return totals


class DebitCardsBar(ctk.CTkFrame):
    """Faixa colapsável com cartões de débito, exibida no topo de Saídas Variáveis."""

    def __init__(self, parent, month_id: int, on_debit_changed: Callable[[List[dict]], None]):
        super().__init__(parent, fg_color="transparent")
        self.month_id         = month_id
        self.on_debit_changed = on_debit_changed
        self._cards: List[dict] = []
        self._expanded = False
        self.grid_columnconfigure(0, weight=1)
        self._build_header()
        self._chips_frame = ctk.CTkScrollableFrame(
            self, fg_color="transparent", height=140,
            orientation="horizontal",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self.refresh()

    # ------------------------------------------------------------------
    def _build_header(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_columnconfigure(1, weight=1)

        self._toggle_btn = ctk.CTkButton(
            hdr, text="▶  Cartões de Débito",
            font=F(12, "bold"), text_color=T.MUTED,
            fg_color="transparent", hover_color=T.CARD2,
            anchor="w", height=28, corner_radius=6,
            command=self._toggle,
        )
        self._toggle_btn.grid(row=0, column=0, sticky="w")

    def _toggle(self) -> None:
        self._expanded = not self._expanded
        if self._expanded:
            self._toggle_btn.configure(text="▼  Cartões de Débito", text_color=T.TEXT)
            self._chips_frame.grid(row=1, column=0, sticky="ew", pady=(8, 0))
        else:
            self._toggle_btn.configure(text="▶  Cartões de Débito", text_color=T.MUTED)
            self._chips_frame.grid_remove()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        def _fetch():
            try:
                cards = db.get_debit_cards()
            except Exception:
                cards = []
            self.after(0, lambda: self._render(cards))
        threading.Thread(target=_fetch, daemon=True).start()

    def _render(self, cards: List[dict]) -> None:
        self._cards = cards
        for w in self._chips_frame.winfo_children():
            w.destroy()

        if not cards:
            ctk.CTkLabel(
                self._chips_frame,
                text="Nenhum cartão de débito cadastrado.",
                font=F(12), text_color=T.MUTED,
            ).pack(pady=8, padx=8)
        else:
            spendings = _all_debit_spendings(cards, self.month_id)
            for c in cards:
                self._make_chip(c, spendings.get(c["id"], 0.0))

        self.on_debit_changed(cards)

    def _make_chip(self, card: dict, spent: float) -> None:
        color = card.get("color", "#6C8EFF")

        chip = ctk.CTkFrame(self._chips_frame, fg_color=T.CARD, corner_radius=10,
                            border_width=1, border_color=T.BORDER_L)
        chip.pack(side="left", padx=(0, 8), pady=4, fill="y")

        ctk.CTkFrame(chip, height=5, fg_color=color, corner_radius=3).pack(
            fill="x", padx=6, pady=(6, 0))

        body = ctk.CTkFrame(chip, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=10, pady=(6, 8))

        name_row = ctk.CTkFrame(body, fg_color="transparent")
        name_row.pack(fill="x", anchor="w")
        ctk.CTkLabel(name_row, text=card["name"], font=F(14, "bold"),
                     text_color=T.TEXT, anchor="w").pack(side="left")
        ctk.CTkButton(
            name_row, text="✏", width=28, height=24, corner_radius=6,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
            command=lambda c=card: self._edit_card(c),
        ).pack(side="right")

        ctk.CTkFrame(body, height=1, fg_color=T.BORDER).pack(fill="x", pady=(8, 6))

        ctk.CTkLabel(body, text="Gasto no mês", font=F(10), text_color=T.MUTED,
                     anchor="w").pack(anchor="w")
        ctk.CTkLabel(body, text=format_currency(spent), font=F(17, "bold"),
                     text_color=color, anchor="w", width=160).pack(anchor="w")

    # ------------------------------------------------------------------
    def _edit_card(self, card: dict) -> None:
        dlg = _DebitCardDialog(self.winfo_toplevel(), card)
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        if dlg.deleted:
            db.delete_debit_card(card["id"])
        else:
            r = dlg.result
            db.update_debit_card(card["id"], r["name"], r["color"])
        self.refresh()

    def get_cards(self) -> List[dict]:
        return list(self._cards)


# ---------------------------------------------------------------------------
class _DebitCardDialog(ctk.CTkToplevel):
    def __init__(self, parent, card: dict = None):
        super().__init__(parent)
        self.result  = None
        self.deleted = False
        self._card = card
        self._selected_color = card["color"] if card else DEBIT_COLORS[0]

        self.title("Editar Cartão de Débito" if card else "Novo Cartão de Débito")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self._build(card)
        self.after(100, self._center)

    def _center(self) -> None:
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"+{(sw - w) // 2}+{(sh - h) // 2}")

    def _build(self, card) -> None:
        ctk.CTkLabel(self, text="NOME", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(22, 4))
        self._name = ctk.CTkEntry(
            self, placeholder_text="Ex: Nubank Débito…",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8, width=320,
        )
        self._name.pack(fill="x", padx=24, pady=(0, 14))
        if card:
            self._name.insert(0, card["name"])

        ctk.CTkLabel(self, text="COR", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        color_row = ctk.CTkFrame(self, fg_color="transparent")
        color_row.pack(fill="x", padx=24, pady=(0, 16))
        self._color_btns: dict = {}
        for c in DEBIT_COLORS:
            btn = ctk.CTkButton(
                color_row, text="", width=30, height=30, corner_radius=15,
                fg_color=c, hover_color=c, border_width=3,
                border_color=c if c == self._selected_color else T.CARD2,
                command=lambda col=c: self._pick(col),
            )
            btn.pack(side="left", padx=4)
            self._color_btns[c] = btn

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED, anchor="w")
        self._err.pack(fill="x", padx=24)

        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.pack(fill="x", padx=24, pady=(8, 24))
        if card:
            ctk.CTkButton(
                btn_row, text="Excluir", height=34, corner_radius=8,
                fg_color="transparent", hover_color=T.RED,
                border_width=1, border_color=T.BORDER_L,
                text_color=T.RED, font=F(13),
                command=self._delete,
            ).pack(fill="x", pady=(0, 8))
        ctk.CTkButton(
            btn_row, text="Salvar" if card else "Criar Cartão",
            height=36, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
            command=self._save,
        ).pack(fill="x")

    def _pick(self, color: str) -> None:
        self._selected_color = color
        for c, btn in self._color_btns.items():
            btn.configure(border_color=c if c == self._selected_color else T.CARD2)

    def _save(self) -> None:
        name = self._name.get().strip()
        if not name:
            self._err.configure(text="  Preencha o nome.")
            return
        self.result = {"name": name, "color": self._selected_color}
        self.destroy()

    def _delete(self) -> None:
        self.result  = True
        self.deleted = True
        self.destroy()
