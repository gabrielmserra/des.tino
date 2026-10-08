"""Aviso legal reutilizável nas telas de perfil de investidor, alocação
e carteiras fictícias."""
import customtkinter as ctk
import ui.theme as T
from ui.theme import F

DISCLAIMER_TEXT = (
    "Conteúdo educativo e informativo, não é recomendação de "
    "investimento e não substitui a orientação de um profissional "
    "certificado."
)


def make_disclaimer(parent) -> ctk.CTkFrame:
    """Cria o aviso (o chamador decide onde posicionar com .pack/.grid)."""
    box = ctk.CTkFrame(parent, fg_color=T.CARD2, corner_radius=10,
                        border_width=1, border_color=T.BORDER)
    ctk.CTkLabel(
        box, text=f"ℹ️  {DISCLAIMER_TEXT}",
        font=F(11), text_color=T.MUTED, justify="left", wraplength=640,
    ).pack(anchor="w", padx=14, pady=10)
    return box
