"""Modal de seleção de tema."""
import customtkinter as ctk
import ui.theme as T
from ui.theme import F, THEMES


class ThemePickerDialog(ctk.CTkToplevel):
    def __init__(self, parent, on_select):
        super().__init__(parent)
        self.title("Temas")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._on_select = on_select
        self._build()
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
        w, h = 440, 430
        px = parent.winfo_x() + (parent.winfo_width()  - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Escolher Tema",
                     font=F(16, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 4))
        ctk.CTkLabel(self, text="A escolha é salva automaticamente",
                     font=F(12), text_color=T.MUTED).grid(
            row=1, column=0, pady=(0, 18))

        grid = ctk.CTkFrame(self, fg_color="transparent")
        grid.grid(row=2, column=0, padx=28)
        for col in range(3):
            grid.grid_columnconfigure(col, weight=1)

        for i, name in enumerate(THEMES):
            self._make_chip(grid, name, row=i // 3, col=i % 3)

        ctk.CTkButton(
            self, text="Fechar", command=self.destroy,
            height=36, width=120, corner_radius=8,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(13),
        ).grid(row=3, column=0, pady=(18, 24))

    def _make_chip(self, parent, name: str, row: int, col: int) -> None:
        active  = (name == T._CURRENT_THEME)
        td      = THEMES[name]
        primary = td["primary"]
        bg_clr  = td["bg"]

        def _select(e=None, n=name):
            from ui.theme import apply_theme, save_theme
            apply_theme(n)
            save_theme(n)
            cb = self._on_select
            self.grab_release()
            self.destroy()
            cb(n)

        chip = ctk.CTkFrame(
            parent, corner_radius=12,
            fg_color=T.CARD2 if active else T.CARD,
            border_width=2 if active else 1,
            border_color=primary if active else T.BORDER,
        )
        chip.grid(row=row, column=col, padx=7, pady=6, ipadx=12, ipady=10)
        chip.bind("<Button-1>", _select)

        # Círculo: fundo = cor de bg do tema, borda e ponto = primary
        circle = ctk.CTkFrame(
            chip, width=44, height=44, corner_radius=22,
            fg_color=bg_clr, border_width=2, border_color=primary,
        )
        circle.pack(pady=(10, 4))
        circle.pack_propagate(False)
        circle.bind("<Button-1>", _select)

        dot = ctk.CTkFrame(
            circle, width=18, height=18, corner_radius=9, fg_color=primary)
        dot.place(relx=0.5, rely=0.5, anchor="center")
        dot.bind("<Button-1>", _select)

        label = ctk.CTkLabel(
            chip, text=name,
            font=F(11, "bold") if active else F(11),
            text_color=primary if active else T.MUTED,
        )
        label.pack(pady=(0, 10))
        label.bind("<Button-1>", _select)
