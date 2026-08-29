"""Compromissos: tela unificada de Dívidas, Metas e Contas Fixas — as três
compartilham a mesma estrutura (lista + parcelas/instâncias com status
pago/pendente + diálogos de pagar/editar/excluir), então em vez de três
telas separadas na sidebar, viram três abas de uma só."""
from typing import Callable, Optional

import customtkinter as ctk

import ui.theme as T
from ui.theme import F
from ui.debts import DebtsTab
from ui.goals import GoalsTab
from ui.fixed_bills import FixedBillsTab

_SUBTABS = [
    ("dividas", "Dívidas", DebtsTab),
    ("metas", "Metas", GoalsTab),
    ("contas_fixas", "Contas Fixas", FixedBillsTab),
]


class CommitmentsTab(ctk.CTkFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._on_change = on_change or (lambda: None)
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self._active_tab = "dividas"
        self._tab_btns: dict = {}
        self._frames: dict = {}
        self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        tab_bar = ctk.CTkFrame(self, fg_color=T.CARD, border_width=1,
                                border_color=T.BORDER, corner_radius=10, height=48)
        tab_bar.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        tab_bar.grid_propagate(False)
        tab_bar.grid_rowconfigure(0, weight=1)
        for i in range(len(_SUBTABS)):
            tab_bar.grid_columnconfigure(i, weight=1)

        for i, (tab_id, label, _cls) in enumerate(_SUBTABS):
            btn = ctk.CTkButton(
                tab_bar, text=label,
                command=lambda t=tab_id: self._switch_tab(t),
                height=34, corner_radius=7, fg_color="transparent",
                hover_color=T.CARD2, text_color=T.MUTED, font=F(12),
            )
            btn.grid(row=0, column=i, sticky="ew", padx=3, pady=6)
            self._tab_btns[tab_id] = btn

        self._content = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        self._content.grid(row=1, column=0, sticky="nsew")
        self._content.grid_rowconfigure(0, weight=1)
        self._content.grid_columnconfigure(0, weight=1)

        self._switch_tab("dividas")

    # ------------------------------------------------------------------
    def _switch_tab(self, tab_id: str) -> None:
        for frame in self._frames.values():
            frame.grid_remove()

        if tab_id not in self._frames:
            cls = next(c for t, _, c in _SUBTABS if t == tab_id)
            frame = cls(self._content, on_change=self._on_change)
            frame.grid(row=0, column=0, sticky="nsew")
            self._frames[tab_id] = frame
        else:
            self._frames[tab_id].grid()
            self._frames[tab_id].refresh()

        for t, btn in self._tab_btns.items():
            active = t == tab_id
            btn.configure(
                fg_color=T.BLUE if active else "transparent",
                text_color="#ffffff" if active else T.MUTED,
                font=F(12, "bold" if active else "normal"),
                hover_color=T.BLUE if active else T.CARD2,
            )
        self._active_tab = tab_id

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        frame = self._frames.get(self._active_tab)
        if frame is not None:
            frame.refresh()
