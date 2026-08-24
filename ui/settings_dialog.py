"""Modal de Configurações do usuário."""
import customtkinter as ctk
import ui.theme as T
from ui.theme import F

import database as db


class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Configurações")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._current_day = 1
        self._build()
        self._center(parent)
        self.lift()
        self.focus()
        self.after(100, self._set_icon)
        self.after(50, self._load)

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
        w, h = 420, 380
        px = parent.winfo_x() + (parent.winfo_width()  - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Configurações",
                     font=F(16, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 4))

        ctk.CTkLabel(
            self,
            text="Dia de corte da importação de extrato",
            font=F(12, "bold"), text_color=T.TEXT,
        ).grid(row=1, column=0, pady=(14, 2))
        ctk.CTkLabel(
            self,
            text="Lançamentos a partir desse dia do mês contam pro mês\nseguinte — use o dia em que você recebe o salário.\n\"1\" = sem deslocamento (mês calendário normal).",
            font=F(11), text_color=T.MUTED, justify="center",
        ).grid(row=2, column=0, pady=(0, 14))

        self._day_var = ctk.StringVar(value="1")
        self._day_menu = ctk.CTkOptionMenu(
            self, values=[str(d) for d in range(1, 32)],
            variable=self._day_var,
            width=100, height=34, corner_radius=8,
            fg_color=T.CARD2, button_color=T.BORDER_L,
            button_hover_color=T.MUTED, text_color=T.TEXT,
            dropdown_fg_color=T.CARD2, font=F(13),
        )
        self._day_menu.grid(row=3, column=0, pady=(0, 6))

        self._status_lbl = ctk.CTkLabel(self, text="", font=F(11), text_color=T.MUTED)
        self._status_lbl.grid(row=4, column=0, pady=(4, 0))

        sep = ctk.CTkFrame(self, fg_color=T.BORDER, height=1)
        sep.grid(row=5, column=0, sticky="ew", padx=24, pady=(16, 12))

        ctk.CTkButton(
            self, text="📄 Baixar Relatório Completo", command=self._open_report,
            height=36, width=240, corner_radius=8,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(12, "bold"),
        ).grid(row=6, column=0, pady=(0, 4))

        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.grid(row=7, column=0, pady=(20, 24))

        ctk.CTkButton(
            btn_row, text="Salvar", command=self._save,
            height=36, width=110, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            btn_row, text="Fechar", command=self.destroy,
            height=36, width=110, corner_radius=8,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(13),
        ).pack(side="left")

    def _load(self) -> None:
        try:
            day = db.get_import_cutoff_day()
        except Exception:
            day = 1
        self._current_day = day
        self._day_var.set(str(day))

    def _open_report(self) -> None:
        from ui.report_dialog import ReportDialog
        ReportDialog(self)

    def _save(self) -> None:
        day = int(self._day_var.get())
        try:
            db.save_import_cutoff_day(day)
            self._current_day = day
            self._status_lbl.configure(text="✓ Salvo", text_color=T.GREEN)
        except Exception as e:
            self._status_lbl.configure(text=f"Erro ao salvar: {str(e)[:60]}", text_color=T.RED)
