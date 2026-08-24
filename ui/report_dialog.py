"""Modal para gerar o Relatório Financeiro Completo (PDF) de um período
escolhido pelo usuário."""
from tkinter import filedialog

import customtkinter as ctk
import ui.theme as T
from ui.theme import F

import database as db


class ReportDialog(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Relatório Financeiro")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)

        self._months = sorted(db.get_months(), key=lambda m: (m["year"], m["month"]))
        self._names = [m["name"] for m in self._months]

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
        w, h = 420, 320
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Relatório Financeiro Completo",
                     font=F(16, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 4))
        ctk.CTkLabel(
            self,
            text="Gera um PDF com resumo, evolução de saldo, gastos por\ncategoria e forma de pagamento e todos os lançamentos\ndo período escolhido.",
            font=F(11), text_color=T.MUTED, justify="center",
        ).grid(row=1, column=0, pady=(0, 16))

        if not self._names:
            ctk.CTkLabel(self, text="Nenhum mês cadastrado ainda.",
                         font=F(12), text_color=T.MUTED).grid(row=2, column=0, pady=20)
            return

        default_from = self._names[max(0, len(self._names) - 6)]
        default_to = self._names[-1]

        row = ctk.CTkFrame(self, fg_color="transparent")
        row.grid(row=2, column=0, pady=(0, 6))
        ctk.CTkLabel(row, text="De", font=F(12, "bold"), text_color=T.TEXT).pack(side="left", padx=(0, 8))
        self._from_var = ctk.StringVar(value=default_from)
        ctk.CTkOptionMenu(
            row, values=self._names, variable=self._from_var,
            width=170, height=32, corner_radius=8,
            fg_color=T.CARD2, button_color=T.BORDER_L,
            button_hover_color=T.MUTED, text_color=T.TEXT,
            dropdown_fg_color=T.CARD2, font=F(12),
        ).pack(side="left")

        row2 = ctk.CTkFrame(self, fg_color="transparent")
        row2.grid(row=3, column=0, pady=(6, 6))
        ctk.CTkLabel(row2, text="Até", font=F(12, "bold"), text_color=T.TEXT).pack(side="left", padx=(0, 4))
        self._to_var = ctk.StringVar(value=default_to)
        ctk.CTkOptionMenu(
            row2, values=self._names, variable=self._to_var,
            width=170, height=32, corner_radius=8,
            fg_color=T.CARD2, button_color=T.BORDER_L,
            button_hover_color=T.MUTED, text_color=T.TEXT,
            dropdown_fg_color=T.CARD2, font=F(12),
        ).pack(side="left")

        self._status_lbl = ctk.CTkLabel(self, text="", font=F(11), text_color=T.MUTED,
                                        wraplength=360, justify="center")
        self._status_lbl.grid(row=4, column=0, pady=(10, 0))

        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.grid(row=5, column=0, pady=(20, 24))

        ctk.CTkButton(
            btn_row, text="Baixar PDF", command=self._generate,
            height=36, width=140, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            btn_row, text="Fechar", command=self.destroy,
            height=36, width=100, corner_radius=8,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(13),
        ).pack(side="left")

    def _generate(self) -> None:
        i0 = self._names.index(self._from_var.get())
        i1 = self._names.index(self._to_var.get())
        if i0 > i1:
            i0, i1 = i1, i0
        selected = self._months[i0:i1 + 1]

        filename = f"relatorio_destino_{selected[0]['name']}_a_{selected[-1]['name']}.pdf".replace(" ", "_")
        path = filedialog.asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF", "*.pdf"), ("Todos os arquivos", "*.*")],
            initialfile=filename,
            title="Salvar relatório",
        )
        if not path:
            return

        self._status_lbl.configure(text="Gerando relatório…", text_color=T.MUTED)
        self.update_idletasks()
        try:
            import report
            report.generate_account_report_pdf(selected, path)
            self._status_lbl.configure(text=f"✓ Relatório salvo em:\n{path}", text_color=T.GREEN)
        except Exception as e:
            self._status_lbl.configure(text=f"Erro ao gerar: {str(e)[:100]}", text_color=T.RED)
