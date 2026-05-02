"""Barra lateral esquerda."""
import customtkinter as ctk
from typing import Callable, List

import ui.theme as T
from ui.theme import F


class Sidebar(ctk.CTkFrame):
    def __init__(
        self,
        parent,
        on_select:       Callable,
        on_add:          Callable,
        on_delete:       Callable,
        on_rename:       Callable,
        on_theme:        Callable,
        on_logout:       Callable,
        on_investments:  Callable = None,
        user_email:      str = "",
    ):
        super().__init__(parent, width=270, corner_radius=0, fg_color=T.SIDEBAR)
        self.grid_propagate(False)
        self.grid_rowconfigure(3, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self.on_select      = on_select
        self.on_add         = on_add
        self.on_delete      = on_delete
        self.on_rename      = on_rename
        self.on_theme       = on_theme
        self.on_logout      = on_logout
        self.on_investments = on_investments or (lambda: None)
        self.user_email     = user_email

        self._active_id: int | None         = None
        self._buttons:   dict               = {}
        self._inv_btn:   ctk.CTkButton|None = None

        self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        # ── Header / Logo ─────────────────────────────────────────────
        header = ctk.CTkFrame(self, fg_color=T.SIDEBAR, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew")

        inner = ctk.CTkFrame(header, fg_color="transparent")
        inner.pack(fill="x", padx=16, pady=(20, 16))

        name_box = ctk.CTkFrame(inner, fg_color="transparent")
        name_box.pack(side="left")
        name_row = ctk.CTkFrame(name_box, fg_color="transparent")
        name_row.pack(anchor="w")
        ctk.CTkLabel(name_row, text="des",  font=F(18, "bold"), text_color=T.TEXT).pack(side="left")
        ctk.CTkLabel(name_row, text=".",    font=F(18, "bold"), text_color=T.GREEN).pack(side="left")
        ctk.CTkLabel(name_row, text="tino", font=F(18),         text_color=T.TEXT).pack(side="left")

        # Separador
        ctk.CTkFrame(self, height=1, fg_color=T.BORDER).grid(row=1, column=0, sticky="ew")

        # ── Navegação: Investimentos ───────────────────────────────────
        self._inv_btn = ctk.CTkButton(
            self, text="  📈  Investimentos",
            command=self.on_investments,
            height=36, corner_radius=8, anchor="w",
            fg_color="transparent", hover_color=T.CARD2,
            text_color=T.TEXT, font=F(12),
        )
        self._inv_btn.grid(row=2, column=0, sticky="ew", padx=12, pady=(8, 4))

        # ── Lista de períodos ──────────────────────────────────────────
        scroll_wrapper = ctk.CTkFrame(self, fg_color="transparent")
        scroll_wrapper.grid(row=3, column=0, sticky="nsew")
        scroll_wrapper.grid_rowconfigure(1, weight=1)
        scroll_wrapper.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            scroll_wrapper, text="PERÍODOS",
            font=F(10, "bold"), text_color=T.SUBTLE, anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=16, pady=(10, 6))

        self.months_scroll = ctk.CTkScrollableFrame(
            scroll_wrapper, fg_color="transparent",
            scrollbar_button_color=T.BORDER_L,
            scrollbar_button_hover_color=T.MUTED,
        )
        self.months_scroll.grid(row=1, column=0, sticky="nsew", padx=6)
        self.months_scroll.grid_columnconfigure(0, weight=1)

        # Separador
        ctk.CTkFrame(self, height=1, fg_color=T.BORDER).grid(row=4, column=0, sticky="ew")

        # ── Footer ────────────────────────────────────────────────────
        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.grid(row=5, column=0, sticky="ew", padx=10, pady=10)
        footer.grid_columnconfigure(0, weight=1)

        ctk.CTkButton(
            footer, text="+ Novo Período",
            command=self.on_add,
            height=38, corner_radius=9,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).grid(row=0, column=0, sticky="ew", pady=(0, 4))

        ctk.CTkButton(
            footer, text="🎨  Temas",
            command=self._open_theme_picker,
            height=30, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).grid(row=1, column=0, sticky="ew")

        # Separador
        ctk.CTkFrame(self, height=1, fg_color=T.BORDER).grid(row=6, column=0, sticky="ew")

        # ── Usuário logado ────────────────────────────────────────────
        user_bar = ctk.CTkFrame(self, fg_color="transparent")
        user_bar.grid(row=7, column=0, sticky="ew", padx=12, pady=(10, 14))
        user_bar.grid_columnconfigure(1, weight=1)

        initial = self.user_email[0].upper() if self.user_email else "?"
        avatar  = ctk.CTkFrame(user_bar, width=28, height=28, corner_radius=14,
                               fg_color=T.VIOLET)
        avatar.grid(row=0, column=0)
        avatar.grid_propagate(False)
        ctk.CTkLabel(avatar, text=initial, font=F(11, "bold"),
                     text_color="#fff").place(relx=0.5, rely=0.5, anchor="center")

        display = self.user_email
        if len(display) > 22:
            display = display[:19] + "…"
        ctk.CTkLabel(
            user_bar, text=display,
            font=F(11), text_color=T.MUTED, anchor="w",
        ).grid(row=0, column=1, sticky="w", padx=(8, 6))

        ctk.CTkButton(
            user_bar, text="Sair",
            command=self.on_logout,
            height=26, width=48, corner_radius=6,
            fg_color="transparent", hover_color=T.RED,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
        ).grid(row=0, column=2)

    # ------------------------------------------------------------------
    def _open_theme_picker(self) -> None:
        from ui.theme_picker import ThemePickerDialog
        ThemePickerDialog(self.winfo_toplevel(), on_select=self.on_theme)

    # ------------------------------------------------------------------
    def update_months(self, months) -> None:
        for widget in self.months_scroll.winfo_children():
            widget.destroy()
        self._buttons.clear()

        for m in months:
            is_active = (m["id"] == self._active_id)
            row_frame = ctk.CTkFrame(self.months_scroll, fg_color="transparent")
            row_frame.pack(fill="x", pady=1)
            row_frame.grid_columnconfigure(0, weight=1)

            btn = ctk.CTkButton(
                row_frame,
                text=f"  {m['name']}",
                command=lambda mid=m["id"], name=m["name"]: self.on_select(mid, name),
                height=36, corner_radius=8, anchor="w",
                fg_color=T.BLUE_DIM if is_active else "transparent",
                text_color=T.BLUE if is_active else T.TEXT,
                hover_color=T.CARD2,
                border_width=1 if is_active else 0,
                border_color=T.BORDER_L,
            )
            btn.grid(row=0, column=0, sticky="ew")

            if is_active:
                dot = ctk.CTkFrame(row_frame, width=8, height=8, corner_radius=4,
                                   fg_color=T.BLUE)
                dot.grid(row=0, column=1, padx=(2, 4))

            ctk.CTkButton(
                row_frame, text="✎",
                width=26, height=26,
                command=lambda mid=m["id"]: self.on_rename(mid),
                fg_color="transparent", text_color=T.SUBTLE,
                hover_color=T.CARD2, corner_radius=6, font=F(11),
            ).grid(row=0, column=2, padx=(2, 0))

            ctk.CTkButton(
                row_frame, text="✕",
                width=26, height=26,
                command=lambda mid=m["id"]: self.on_delete(mid),
                fg_color="transparent", text_color=T.SUBTLE,
                hover_color=T.RED, corner_radius=6, font=F(11),
            ).grid(row=0, column=3, padx=(2, 0))

            self._buttons[m["id"]] = btn

    def set_active_month(self, month_id: int) -> None:
        if self._active_id and self._active_id in self._buttons:
            self._buttons[self._active_id].configure(
                fg_color="transparent", text_color=T.TEXT, border_width=0)
        self._active_id = month_id
        if month_id in self._buttons:
            self._buttons[month_id].configure(
                fg_color=T.BLUE_DIM, text_color=T.BLUE, border_width=1)

    def clear_active_month(self) -> None:
        if self._active_id and self._active_id in self._buttons:
            self._buttons[self._active_id].configure(
                fg_color="transparent", text_color=T.TEXT, border_width=0)
        self._active_id = None

    def set_investments_active(self, active: bool) -> None:
        if self._inv_btn:
            if active:
                self._inv_btn.configure(
                    fg_color=T.VIOLET_DIM, text_color=T.VIOLET,
                    border_width=1, border_color=T.BORDER_L,
                )
            else:
                self._inv_btn.configure(
                    fg_color="transparent", text_color=T.TEXT, border_width=0,
                )
