"""Dialogs reutilizáveis no estilo visual do app."""
import customtkinter as ctk
from typing import Optional, Callable

import ui.theme as T
from ui.theme import F
from utils.helpers import apply_app_icon


def _center(dialog: ctk.CTkToplevel, parent, w: int, h: int) -> None:
    dialog.update_idletasks()
    px = parent.winfo_x() + (parent.winfo_width()  - w) // 2
    py = parent.winfo_y() + (parent.winfo_height() - h) // 2
    dialog.geometry(f"{w}x{h}+{px}+{py}")


def show_error(parent, title: str, message: str) -> None:
    _ErrorDialog(parent, title, message)


def show_info(parent, title: str, message: str) -> None:
    _InfoDialog(parent, title, message)


class _ErrorDialog(ctk.CTkToplevel):
    def __init__(self, parent, title: str, message: str):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self._build(title, message)
        _center(self, parent, 400, 210)
        self.lift()
        self.focus()

    def _build(self, title: str, message: str) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text=title, font=F(15, "bold"),
                     text_color=T.RED).grid(row=0, column=0, pady=(24, 8))
        ctk.CTkLabel(self, text=message, font=F(12), text_color=T.MUTED,
                     justify="center", wraplength=360).grid(
            row=1, column=0, padx=20, pady=(0, 16))
        ctk.CTkButton(
            self, text="OK", width=110,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(13),
            command=self.destroy,
        ).grid(row=2, column=0, pady=(0, 24))


class _InfoDialog(ctk.CTkToplevel):
    def __init__(self, parent, title: str, message: str):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self._build(title, message)
        _center(self, parent, 400, 210)
        self.lift()
        self.focus()

    def _build(self, title: str, message: str) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text=title, font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(24, 8))
        ctk.CTkLabel(self, text=message, font=F(12), text_color=T.MUTED,
                     justify="center", wraplength=360).grid(
            row=1, column=0, padx=20, pady=(0, 16))
        ctk.CTkButton(
            self, text="OK", width=110,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
            command=self.destroy,
        ).grid(row=2, column=0, pady=(0, 24))


class ConfirmDialog(ctk.CTkToplevel):
    def __init__(
        self, parent, title: str, message: str,
        confirm_text: str = "Confirmar",
        on_confirm: Optional[Callable] = None,
        danger: bool = True,
    ):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._on_confirm = on_confirm
        apply_app_icon(self)
        self._build(title, message, confirm_text, danger)
        _center(self, parent, 380, 210)
        self.lift()
        self.focus()

    def _build(self, title: str, message: str, confirm_text: str, danger: bool) -> None:
        color = T.RED if danger else T.BLUE
        hover = "#e05555" if danger else T.BLUE_HOVER
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text=title, font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(24, 6))
        ctk.CTkLabel(self, text=message, font=F(13), text_color=T.MUTED,
                     justify="center").grid(row=1, column=0, pady=(0, 8))
        self._error_lbl = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
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
            fg_color=color, hover_color=hover,
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
