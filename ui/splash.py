"""Tela de splash/transição para auto-login."""
import customtkinter as ctk
import ui.theme as T
from ui.theme import F


class SplashFrame(ctk.CTkFrame):
    def __init__(self, parent):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        container = ctk.CTkFrame(self, fg_color="transparent")
        container.grid(row=0, column=0)

        # ── Logo des.tino ─────────────────────────────────────────────
        logo_row = ctk.CTkFrame(container, fg_color="transparent")
        logo_row.pack(pady=(0, 40))

        ctk.CTkLabel(logo_row, text="des",  font=F(42, "bold"), text_color=T.TEXT).pack(side="left")
        ctk.CTkLabel(logo_row, text=".",    font=F(42, "bold"), text_color=T.GREEN).pack(side="left")
        ctk.CTkLabel(logo_row, text="tino", font=F(42),         text_color=T.TEXT).pack(side="left")

        # ── Barra de progresso ────────────────────────────────────────
        self._bar = ctk.CTkProgressBar(
            container,
            mode="indeterminate",
            width=240, height=4,
            corner_radius=2,
            fg_color=T.CARD2,
            progress_color=T.GREEN,
        )
        self._bar.pack(pady=(0, 20))
        self._bar.start()

        # ── Mensagem de status ────────────────────────────────────────
        self._status_lbl = ctk.CTkLabel(
            container,
            text="Verificando sessão…",
            font=F(13), text_color=T.MUTED,
        )
        self._status_lbl.pack()

    # ------------------------------------------------------------------
    def show_welcome(self, email: str, on_done) -> None:
        """Troca para a mensagem de boas-vindas e dispara on_done após 1,6 s."""
        self._bar.stop()
        self._bar.configure(mode="determinate")
        self._bar.set(1.0)

        # Exibe apenas a primeira parte do e-mail se for muito longo
        display = email if len(email) <= 32 else email[:29] + "…"
        self._status_lbl.configure(
            text=f"Bem-vindo, {display}  ✓",
            text_color=T.GREEN,
            font=F(14, "bold"),
        )

        self.after(1600, on_done)
