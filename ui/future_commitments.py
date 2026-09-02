"""Compromissos Futuros: quanto já está comprometido nos próximos meses —
soma de parcelas de cartão previstas + dívidas em aberto + contas fixas
pendentes. Só leitura (a ação de pagar/confirmar cada item continua nas
telas próprias — Dívidas, Contas Fixas, Lançamentos)."""
import threading

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import format_currency, month_name_from_num


class FutureCommitmentsTab(ctk.CTkFrame):
    def __init__(self, parent, on_change=None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._on_change = on_change
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._build()
        self.refresh()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        header = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(header, text="Resumo dos Compromissos", font=F(26, "bold"),
                     text_color=T.TEXT, anchor="w").grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(
            header,
            text="Tudo que já está comprometido pra frente: parcelas de cartão, "
                 "dívidas em aberto e contas fixas pendentes.",
            font=F(12), text_color=T.MUTED, anchor="w",
        ).grid(row=1, column=0, sticky="w", pady=(4, 0))

        self._scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._scroll.grid(row=1, column=0, sticky="nsew", padx=28, pady=(16, 24))
        self._scroll.grid_columnconfigure(0, weight=1)

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()
        ctk.CTkLabel(self._scroll, text="Carregando…",
                     font=F(13), text_color=T.MUTED).pack(pady=40)

        def _fetch():
            try:
                rows = db.get_future_commitments(6)
            except Exception:
                rows = []
            self.after(0, lambda: self._render(rows))

        threading.Thread(target=_fetch, daemon=True).start()

    def _render(self, rows: list) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()

        if not rows:
            ctk.CTkLabel(self._scroll, text="Não foi possível carregar os compromissos futuros.",
                         font=F(13), text_color=T.MUTED).pack(pady=40)
            return

        for r in rows:
            self._make_month_card(r)

    def _make_month_card(self, r: dict) -> None:
        card_total  = float(r.get("card_total") or 0)
        debt_total  = float(r.get("debt_total") or 0)
        bills_total = float(r.get("bills_total") or 0)
        grand_total = float(r.get("grand_total") or 0)
        month_name  = month_name_from_num(int(r["month"]), int(r["year"]))

        card = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        card.pack(fill="x", pady=(0, 10))
        card.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(card, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 10))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text=month_name, font=F(15, "bold"),
                     text_color=T.TEXT, anchor="w").grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(hdr, text=format_currency(grand_total), font=F(15, "bold"),
                     text_color=T.GOLD if grand_total > 0 else T.MUTED, anchor="e").grid(
            row=0, column=1, sticky="e")

        detail = ctk.CTkFrame(card, fg_color="transparent")
        detail.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 16))
        detail.grid_columnconfigure((0, 1, 2), weight=1)

        def _stat(col, emoji, label, value):
            box = ctk.CTkFrame(detail, fg_color="transparent")
            box.grid(row=0, column=col, sticky="w", padx=(0 if col == 0 else 12, 0))
            ctk.CTkLabel(box, text=f"{emoji} {label}", font=F(10, "bold"),
                         text_color=T.MUTED, anchor="w").pack(anchor="w")
            ctk.CTkLabel(box, text=format_currency(value), font=F(13, "bold"),
                         text_color=T.TEXT if value > 0 else T.SUBTLE, anchor="w").pack(anchor="w")

        _stat(0, "💳", "Cartão", card_total)
        _stat(1, "💸", "Dívidas", debt_total)
        _stat(2, "🧾", "Contas Fixas", bills_total)

        if grand_total == 0:
            ctk.CTkLabel(card, text="Nada comprometido ainda pra este mês.",
                         font=F(11), text_color=T.SUBTLE).grid(
                row=2, column=0, padx=20, pady=(0, 14), sticky="w")
