"""Presets de cartão de crédito — barra usada dentro de Saídas Variáveis."""
import threading
import calendar
from datetime import date
from typing import Callable, List

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import apply_app_icon

CARD_COLORS = [
    "#6C8EFF", "#2EAF7D", "#E05252", "#9B72F5",
    "#F5A623", "#4ECDC4", "#FF6B9D", "#FFB347",
]


def _days_until(target_day: int) -> int:
    today = date.today()
    if today.day <= target_day:
        return target_day - today.day
    if today.month == 12:
        nxt = date(today.year + 1, 1, min(target_day, 31))
    else:
        max_day = calendar.monthrange(today.year, today.month + 1)[1]
        nxt = date(today.year, today.month + 1, min(target_day, max_day))
    return (nxt - today).days


def _best_buy_day(closing_day: int) -> int:
    return (closing_day % 28) + 1


def _cycle_start(closing_day: int) -> date:
    """Data de início do ciclo atual de faturamento."""
    today = date.today()
    if today.day >= closing_day:
        try:
            return date(today.year, today.month, closing_day)
        except ValueError:
            return date(today.year, today.month, 1)
    # Ciclo começou no mês passado
    if today.month == 1:
        y, m = today.year - 1, 12
    else:
        y, m = today.year, today.month - 1
    max_day = calendar.monthrange(y, m)[1]
    return date(y, m, min(closing_day, max_day))


def _card_spending(card_id: int, month_id: int, closing_day: int) -> float:
    """Soma dos gastos deste cartão desde o início do ciclo atual."""
    start = _cycle_start(closing_day)
    txs   = db.get_transactions(month_id)
    total = 0.0
    for tx in txs:
        if tx.get("card_id") != card_id or tx["type"] != "saida_variavel":
            continue
        raw = str(tx.get("created_at") or "")[:10]
        try:
            tx_date = date.fromisoformat(raw)
            if tx_date >= start:
                total += float(tx["amount"])
        except ValueError:
            total += float(tx["amount"])
    return total


class CardPresetsBar(ctk.CTkFrame):
    """Faixa colapsável com cartões preset, exibida no topo de Saídas Variáveis."""

    def __init__(self, parent, month_id: int, on_cards_changed: Callable[[List[dict]], None]):
        super().__init__(parent, fg_color="transparent")
        self.month_id         = month_id
        self.on_cards_changed = on_cards_changed
        self._cards: List[dict] = []
        self._expanded          = False   # começa recolhido
        self.grid_columnconfigure(0, weight=1)
        self._build_header()
        self._chips_frame = ctk.CTkScrollableFrame(
            self, fg_color="transparent", height=190,
            orientation="horizontal",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        # Não faz grid ainda — só aparece quando expandido
        self.refresh()

    # ------------------------------------------------------------------
    def _build_header(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_columnconfigure(1, weight=1)

        self._toggle_btn = ctk.CTkButton(
            hdr, text="▶  Cartões de Crédito",
            font=F(12, "bold"), text_color=T.MUTED,
            fg_color="transparent", hover_color=T.CARD2,
            anchor="w", height=28, corner_radius=6,
            command=self._toggle,
        )
        self._toggle_btn.grid(row=0, column=0, sticky="w")

        ctk.CTkButton(
            hdr, text="+ Cartão", width=100, height=26, corner_radius=7,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(11),
            command=self._add_card,
        ).grid(row=0, column=2, sticky="e")

    def _toggle(self) -> None:
        self._expanded = not self._expanded
        if self._expanded:
            self._toggle_btn.configure(text="▼  Cartões de Crédito", text_color=T.TEXT)
            self._chips_frame.grid(row=1, column=0, sticky="ew", pady=(8, 0))
        else:
            self._toggle_btn.configure(text="▶  Cartões de Crédito", text_color=T.MUTED)
            self._chips_frame.grid_remove()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        def _fetch():
            cards = db.get_cards()
            self.after(0, lambda: self._render(cards))
        threading.Thread(target=_fetch, daemon=True).start()

    def _render(self, cards: List[dict]) -> None:
        self._cards = cards
        for w in self._chips_frame.winfo_children():
            w.destroy()

        if not cards:
            ctk.CTkLabel(
                self._chips_frame,
                text="Nenhum cartão. Clique em '+ Cartão' para adicionar.",
                font=F(12), text_color=T.MUTED,
            ).pack(pady=8, padx=8)
        else:
            for card in cards:
                self._make_chip(card)

        self.on_cards_changed(cards)

    def _make_chip(self, card: dict) -> None:
        from utils.helpers import format_currency
        color      = card.get("color", "#6C8EFF")
        closing    = card.get("closing_day", 1)
        due        = card.get("due_day", 10)
        limit      = float(card.get("limit") or 0)
        best       = _best_buy_day(closing)
        days_cls   = _days_until(closing)
        spent      = _card_spending(card["id"], self.month_id, closing)
        avail      = max(0.0, limit - spent) if limit > 0 else None
        cycle_open = date.today().day < closing

        chip = ctk.CTkFrame(self._chips_frame, fg_color=T.CARD, corner_radius=10,
                            border_width=1, border_color=T.BORDER_L)
        chip.pack(side="left", padx=(0, 8), pady=4, fill="y")

        # Barra colorida no topo
        ctk.CTkFrame(chip, height=5, fg_color=color, corner_radius=3).pack(
            fill="x", padx=6, pady=(6, 0))

        body = ctk.CTkFrame(chip, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=10, pady=(6, 4))

        # Nome
        ctk.CTkLabel(body, text=card["name"], font=F(14, "bold"),
                     text_color=T.TEXT, anchor="w", width=180).pack(anchor="w")

        # Status fatura
        if cycle_open:
            sub     = f"Fatura aberta  •  Fecha em {days_cls}d"
            sub_col = T.MUTED
        else:
            sub     = "Fatura fechada  •  Nova fatura"
            sub_col = T.GREEN
        ctk.CTkLabel(body, text=sub, font=F(11), text_color=sub_col,
                     anchor="w", width=180).pack(anchor="w", pady=(2, 0))

        # Melhor dia + vencimento
        ctk.CTkLabel(body, text=f"Melhor dia: {best}  •  Vence dia {due}",
                     font=F(10), text_color=T.MUTED,
                     anchor="w", width=180).pack(anchor="w", pady=(1, 0))

        # Separador
        ctk.CTkFrame(body, height=1, fg_color=T.BORDER).pack(fill="x", pady=(6, 5))

        # Valor gasto
        ctk.CTkLabel(body, text="Gasto no ciclo", font=F(10), text_color=T.MUTED,
                     anchor="w").pack(anchor="w")
        ctk.CTkLabel(body, text=format_currency(spent), font=F(15, "bold"),
                     text_color=color, anchor="w", width=180).pack(anchor="w")

        # Disponível
        if avail is not None:
            ctk.CTkLabel(body, text=f"Disponível: {format_currency(avail)}",
                         font=F(11), text_color=T.MUTED,
                         anchor="w", width=180).pack(anchor="w", pady=(1, 0))

        # Barra de progresso
        if limit > 0:
            pct    = min(spent / limit, 1.0)
            bar_bg = ctk.CTkFrame(body, height=5, fg_color=T.BORDER,
                                  corner_radius=3, width=180)
            bar_bg.pack(anchor="w", pady=(4, 0))
            bar_bg.pack_propagate(False)
            if pct > 0:
                fill_col = T.RED if pct > 0.85 else color
                ctk.CTkFrame(bar_bg, height=5, width=max(4, int(180 * pct)),
                             fg_color=fill_col, corner_radius=3).place(x=0, y=0)

        # Botão editar
        ctk.CTkButton(
            body, text="✏  Editar", height=26, corner_radius=6,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
            command=lambda c=card: self._edit_card(c),
        ).pack(fill="x", pady=(6, 0))

    # ------------------------------------------------------------------
    def _add_card(self) -> None:
        dlg = _CardDialog(self)
        self.wait_window(dlg)
        if dlg.result:
            name, limit, due_day, closing_day, color = dlg.result
            db.create_card(name, limit, due_day, closing_day, color)
            self.refresh()

    def _edit_card(self, card: dict) -> None:
        dlg = _CardDialog(self, card)
        self.wait_window(dlg)
        if dlg.result:
            if dlg.deleted:
                db.delete_card(card["id"])
            else:
                name, limit, due_day, closing_day, color = dlg.result
                db.update_card(card["id"], name, limit, due_day, closing_day, color)
            self.refresh()

    def get_cards(self) -> List[dict]:
        return list(self._cards)


# ---------------------------------------------------------------------------

class _CardDialog(ctk.CTkToplevel):
    def __init__(self, parent, card: dict = None):
        super().__init__(parent)
        self.result  = None
        self.deleted = False
        self._selected_color = card["color"] if card else CARD_COLORS[0]

        self.title("Editar Cartão" if card else "Novo Cartão")
        self.resizable(False, False)
        self.grab_set()
        apply_app_icon(self)
        self._build(card)
        self.after(100, self._center)

    def _center(self) -> None:
        self.update_idletasks()
        w  = self.winfo_width()
        h  = self.winfo_height()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        self.geometry(f"+{(sw - w) // 2}+{(sh - h) // 2}")

    def _build(self, card) -> None:
        p = {"padx": 24, "pady": (0, 12)}

        ctk.CTkLabel(self, text="NOME DO CARTÃO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(24, 4))
        self._name = ctk.CTkEntry(
            self, placeholder_text="Ex: Nubank, Itaú Gold…",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._name.pack(fill="x", **p)
        if card:
            self._name.insert(0, card["name"])

        ctk.CTkLabel(self, text="LIMITE (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        self._limit = ctk.CTkEntry(
            self, placeholder_text="Ex: 5000,00  (deixe 0 para sem limite)",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._limit.pack(fill="x", **p)
        if card and float(card.get("limit") or 0) > 0:
            self._limit.insert(0, str(float(card["limit"])))

        ctk.CTkLabel(self, text="DIA DE FECHAMENTO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        self._closing = ctk.CTkComboBox(
            self, values=[str(i) for i in range(1, 32)],
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        )
        self._closing.set(str(card["closing_day"]) if card else "10")
        self._closing.pack(fill="x", **p)

        ctk.CTkLabel(self, text="DIA DE VENCIMENTO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        self._due = ctk.CTkComboBox(
            self, values=[str(i) for i in range(1, 32)],
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        )
        self._due.set(str(card["due_day"]) if card else "17")
        self._due.pack(fill="x", **p)

        ctk.CTkLabel(self, text="COR", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        color_row = ctk.CTkFrame(self, fg_color="transparent")
        color_row.pack(fill="x", padx=24, pady=(0, 20))
        self._color_btns: dict = {}
        for c in CARD_COLORS:
            btn = ctk.CTkButton(
                color_row, text="", width=32, height=32, corner_radius=16,
                fg_color=c, hover_color=c, border_width=3,
                border_color=c if c == self._selected_color else T.CARD2,
                command=lambda col=c: self._pick(col),
            )
            btn.pack(side="left", padx=4)
            self._color_btns[c] = btn

        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.pack(fill="x", padx=24, pady=(0, 24))

        if card:
            ctk.CTkButton(
                btn_row, text="Excluir Cartão", height=34, corner_radius=8,
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
            return
        try:
            closing_day = int(self._closing.get())
            due_day     = int(self._due.get())
            limit_raw   = self._limit.get().strip().replace(",", ".")
            limit       = float(limit_raw) if limit_raw else 0.0
        except ValueError:
            return
        self.result = (name, limit, due_day, closing_day, self._selected_color)
        self.destroy()

    def _delete(self) -> None:
        self.result  = True
        self.deleted = True
        self.destroy()
