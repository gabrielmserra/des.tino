"""UI compartilhada de exportar/importar carteira (JSON), usada tanto
pela aba Alocação (exporta a carteira real) quanto por Carteiras
Fictícias (exporta/importa carteiras fictícias). Fluxo de import nunca
grava nada até o usuário confirmar a prévia."""
import json
from tkinter import filedialog
from typing import Callable, List, Optional

import customtkinter as ctk

import ui.theme as T
from ui.theme import F
from ui.dialogs import show_info, show_error
from utils.helpers import format_currency, apply_app_icon
from utils.asset_classes import ASSET_CLASS_LABELS
from utils.portfolio_io import build_export_payload, validate_import_payload


class _ExportModeDialog(ctk.CTkToplevel):
    def __init__(self, parent, on_choose: Callable[[str], None]):
        super().__init__(parent)
        self.title("Exportar carteira")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Exportar carteira", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(20, 4), padx=24)
        ctk.CTkLabel(
            self, text="Com valores reais (R$) ou só os percentuais por\n"
                       "classe, pra compartilhar sem revelar o patrimônio.",
            font=F(11), text_color=T.MUTED, justify="center",
        ).grid(row=1, column=0, pady=(0, 14), padx=24)

        def _choose(mode):
            self.destroy()
            on_choose(mode)

        ctk.CTkButton(
            self, text="Com valores em R$", command=lambda: _choose("absolute"),
            height=38, corner_radius=8, fg_color=T.VIOLET, hover_color=T.VIOLET,
            text_color="#ffffff", font=F(12, "bold"),
        ).grid(row=2, column=0, padx=24, pady=4, sticky="ew")
        ctk.CTkButton(
            self, text="Só percentuais", command=lambda: _choose("percentage"),
            height=38, corner_radius=8, fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L, text_color=T.TEXT, font=F(12),
        ).grid(row=3, column=0, padx=24, pady=(4, 20), sticky="ew")

        w, h = 340, 210
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()


def export_portfolio(parent, default_name: str, get_items_for_mode: Callable[[str], List[dict]]) -> None:
    """Abre o seletor de modo (absoluto/percentual), monta o payload com
    build_export_payload e salva em arquivo .json via filedialog.
    get_items_for_mode(mode) -> [{"asset_class","label","value"}] (value
    já em R$ pro modo absoluto, fração 0-1 pro percentual)."""
    def _on_choose(mode: str):
        items = get_items_for_mode(mode)
        if not items:
            show_error(parent, "Nada pra exportar", "Essa carteira não tem itens com valor.")
            return
        payload = build_export_payload(default_name, items, mode)
        filename = (default_name.strip() or "carteira").replace(" ", "_").lower() + ".json"
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("Todos os arquivos", "*.*")],
            initialfile=filename,
            title="Exportar carteira",
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            show_info(parent, "Exportado", f"Arquivo salvo em:\n{path}")
        except Exception as e:
            show_error(parent, "Erro ao exportar", str(e))

    _ExportModeDialog(parent, on_choose=_on_choose)


def import_portfolio(parent, on_confirm: Callable[[str, str, list], None]) -> None:
    """Abre seletor de arquivo .json, valida com validate_import_payload
    (rejeita o arquivo inteiro em qualquer problema) e mostra uma
    prévia -- só chama on_confirm(name, mode, items) se o usuário
    confirmar. Nada é gravado antes disso."""
    path = filedialog.askopenfilename(
        filetypes=[("JSON", "*.json"), ("Todos os arquivos", "*.*")],
        title="Importar carteira",
    )
    if not path:
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_text = f.read()
    except Exception as e:
        show_error(parent, "Erro ao ler arquivo", str(e))
        return

    ok, result = validate_import_payload(raw_text)
    if not ok:
        show_error(parent, "Arquivo inválido", str(result))
        return

    _ImportPreviewDialog(parent, parsed=result, on_confirm=on_confirm)


class _ImportPreviewDialog(ctk.CTkToplevel):
    def __init__(self, parent, parsed: dict, on_confirm: Callable[[str, str, list], None]):
        super().__init__(parent)
        self.title("Importar carteira")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._parsed = parsed
        self._on_confirm = on_confirm
        apply_app_icon(self)
        self._build()
        w, h = 440, 520
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        ctk.CTkLabel(self, text="Importar carteira", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(20, 2), padx=24)
        ctk.CTkLabel(
            self, text="Isso cria uma carteira fictícia nova -- não altera\nnenhum dado real.",
            font=F(11), text_color=T.MUTED, justify="center",
        ).grid(row=1, column=0, pady=(0, 10), padx=24)

        self._name_var = ctk.StringVar(value=self._parsed["name"])
        ctk.CTkEntry(self, textvariable=self._name_var, fg_color=T.CARD2,
                     border_color=T.BORDER_L, text_color=T.TEXT).grid(
            row=2, column=0, padx=24, sticky="ew")

        scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        scroll.grid(row=3, column=0, sticky="nsew", padx=24, pady=(10, 0))
        scroll.grid_columnconfigure(0, weight=1)

        mode = self._parsed["mode"]
        for i, it in enumerate(self._parsed["items"]):
            row = ctk.CTkFrame(scroll, fg_color=T.CARD2, corner_radius=8)
            row.grid(row=i, column=0, sticky="ew", pady=3)
            row.grid_columnconfigure(0, weight=1)
            label = ASSET_CLASS_LABELS.get(it["asset_class"], it["asset_class"])
            ctk.CTkLabel(row, text=label, font=F(12), text_color=T.TEXT, anchor="w").grid(
                row=0, column=0, sticky="w", padx=12, pady=8)
            value_txt = (format_currency(it["value"]) if mode == "absolute"
                        else f"{it['value'] * 100:.0f}%")
            ctk.CTkLabel(row, text=value_txt, font=F(12, "bold"), text_color=T.TEXT).grid(
                row=0, column=1, sticky="e", padx=12)

        self._error_lbl = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._error_lbl.grid(row=4, column=0, pady=(6, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=5, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", command=self.destroy, width=120,
                     fg_color=T.CARD2, hover_color=T.BORDER_L, border_width=1,
                     border_color=T.BORDER_L, text_color=T.MUTED).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="Confirmar importação", command=self._confirm, width=170,
                     fg_color=T.VIOLET, hover_color=T.VIOLET,
                     text_color="#ffffff", font=F(12, "bold")).pack(side="left", padx=4)

    def _confirm(self) -> None:
        name = self._name_var.get().strip()
        if not name:
            self._error_lbl.configure(text="Informe um nome.")
            return
        self._on_confirm(name, self._parsed["mode"], self._parsed["items"])
        self.destroy()
