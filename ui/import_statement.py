"""Importação de extrato/fatura bancária (Banco Inter — OFX, CSV, PDF)."""
import threading
import difflib
from datetime import date
from tkinter import filedialog
from typing import Callable, List, Optional

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import CATEGORIES, PAYMENT_METHODS, format_currency, format_date_br
from parsers.base import NormalizedRow
from parsers.registry import detect_parser

_METHOD_LABELS = list(PAYMENT_METHODS.values())
_LABEL_TO_METHOD_KEY = {v: k for k, v in PAYMENT_METHODS.items()}


class _Candidate:
    """Uma linha candidata na tela de revisão, com o estado dos widgets."""
    def __init__(self, row: NormalizedRow):
        self.row = row
        self.include_var: Optional[ctk.BooleanVar] = None
        self.desc_var:    Optional[ctk.StringVar]  = None
        self.cat_var:     Optional[ctk.StringVar]  = None
        self.method_var:  Optional[ctk.StringVar]  = None
        self.month_id:    Optional[int] = None
        self.month_name:  str = ""
        self.dup_label:   str = ""


class ImportTab(ctk.CTkFrame):
    def __init__(self, parent, on_change: Callable, on_months_changed: Callable = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self.on_change          = on_change
        self.on_months_changed  = on_months_changed or (lambda: None)
        self._candidates: List[_Candidate] = []
        self._busy = False
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        header.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(header, text="Importar Extrato",
                     font=F(26, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w")
        ctk.CTkLabel(header, text="Banco Inter — arquivos .ofx, .csv ou .pdf do extrato da conta corrente",
                     font=F(12), text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, sticky="w", pady=(2, 0))

        pick = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                            border_width=1, border_color=T.BORDER)
        pick.grid(row=1, column=0, sticky="ew", padx=28, pady=(16, 0))
        pick_inner = ctk.CTkFrame(pick, fg_color="transparent")
        pick_inner.pack(fill="x", padx=20, pady=16)
        ctk.CTkButton(
            pick_inner, text="📄  Escolher arquivo", command=self._pick_file,
            height=38, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
        ).pack(side="left")
        self._file_lbl = ctk.CTkLabel(
            pick_inner, text="Nenhum arquivo selecionado.",
            font=F(12), text_color=T.MUTED, anchor="w")
        self._file_lbl.pack(side="left", padx=(12, 0))

        self._status_lbl = ctk.CTkLabel(
            self, text="", font=F(12), text_color=T.RED, anchor="w")
        self._status_lbl.grid(row=1, column=0, sticky="sw", padx=28, pady=(0, 0))

        # ── Tabela de revisão ────────────────────────────────────────
        table_wrap = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                                  border_width=1, border_color=T.BORDER)
        table_wrap.grid(row=2, column=0, sticky="nsew", padx=28, pady=(16, 0))
        table_wrap.grid_columnconfigure(0, weight=1)
        table_wrap.grid_rowconfigure(1, weight=1)

        top = ctk.CTkFrame(table_wrap, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 6))
        top.grid_columnconfigure(0, weight=1)
        self._count_lbl = ctk.CTkLabel(
            top, text="Selecione um arquivo para começar.",
            font=F(13, "bold"), text_color=T.TEXT, anchor="w")
        self._count_lbl.grid(row=0, column=0, sticky="w")
        self._confirm_btn = ctk.CTkButton(
            top, text="Confirmar importação", command=self._confirm,
            height=34, corner_radius=8,
            fg_color=T.GREEN, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(12, "bold"), state="disabled",
        )
        self._confirm_btn.grid(row=0, column=1, sticky="e")

        self._rows_list = ctk.CTkScrollableFrame(
            table_wrap, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._rows_list.grid(row=1, column=0, sticky="nsew", padx=8, pady=(0, 14))
        self._rows_list.grid_columnconfigure(0, weight=1)

    # ------------------------------------------------------------------
    def _pick_file(self) -> None:
        path = filedialog.askopenfilename(
            title="Selecionar extrato",
            filetypes=[
                ("Extrato bancário", "*.ofx *.csv *.pdf"),
                ("Todos os arquivos", "*.*"),
            ],
        )
        if not path:
            return
        filename = path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        self._file_lbl.configure(text=filename)
        self._status_lbl.configure(text="")
        self._set_busy(True)

        def _work():
            try:
                with open(path, "rb") as f:
                    data = f.read()
                parser = detect_parser(data, filename)
                if parser is None:
                    self.after(0, lambda: self._show_error(
                        "Formato não reconhecido. Verifique se é um extrato do Banco Inter (.ofx, .csv ou .pdf)."))
                    return
                rows = parser.parse(data)
                if not rows:
                    self.after(0, lambda: self._show_error(
                        "Nenhum lançamento encontrado nesse arquivo."))
                    return
                self.after(0, lambda: self._load_candidates(rows))
            except Exception as e:
                msg = str(e)[:200]
                self.after(0, lambda: self._show_error(f"Erro ao ler o arquivo: {msg}"))
            finally:
                self.after(0, lambda: self._set_busy(False))

        threading.Thread(target=_work, daemon=True).start()

    def _set_busy(self, busy: bool) -> None:
        self._busy = busy

    def _show_error(self, msg: str) -> None:
        self._status_lbl.configure(text=f"⚠  {msg}")

    # ------------------------------------------------------------------
    def _load_candidates(self, rows: List[NormalizedRow]) -> None:
        # Agrupa por (ano, mês) e garante que cada mês exista.
        existing_months = {m["name"]: m for m in db.get_months()}
        needed = sorted({(r.date.year, r.date.month) for r in rows})
        created_any = False
        for year, month in needed:
            from utils.helpers import month_name_from_num
            name = month_name_from_num(month, year)
            if name not in existing_months:
                m = db._ensure_month(year, month)
                existing_months[name] = m
                created_any = True
        if created_any and self.on_months_changed:
            self.on_months_changed()

        # Cache de transações existentes por mês, pra detecção de duplicata.
        tx_cache: dict = {}

        self._candidates = []
        for r in rows:
            from utils.helpers import month_name_from_num
            name  = month_name_from_num(r.date.month, r.date.year)
            month = existing_months.get(name)
            cand  = _Candidate(r)
            cand.month_id   = month["id"] if month else None
            cand.month_name = name

            if cand.month_id is not None:
                if cand.month_id not in tx_cache:
                    tx_cache[cand.month_id] = db.get_transactions(cand.month_id)
                cand.dup_label = _find_duplicate(r, tx_cache[cand.month_id])

            self._candidates.append(cand)

        self._render_candidates()

    def _render_candidates(self) -> None:
        for w in self._rows_list.winfo_children():
            w.destroy()

        for cand in self._candidates:
            self._make_row(cand)

        self._update_count()
        self._confirm_btn.configure(state="normal" if self._candidates else "disabled")

    def _make_row(self, cand: _Candidate) -> None:
        r = cand.row
        default_include = not (r.is_investment_like or cand.dup_label)

        row = ctk.CTkFrame(self._rows_list, fg_color=T.CARD2, corner_radius=10)
        row.pack(fill="x", pady=(0, 6), padx=6)
        row.grid_columnconfigure(1, weight=1)

        cand.include_var = ctk.BooleanVar(value=default_include)
        ctk.CTkCheckBox(
            row, text="", variable=cand.include_var, width=20,
            command=self._update_count,
        ).grid(row=0, column=0, rowspan=2, padx=(10, 6), pady=10)

        cand.desc_var = ctk.StringVar(value=r.description)
        ctk.CTkEntry(
            row, textvariable=cand.desc_var,
            fg_color=T.CARD, border_color=T.BORDER_L, text_color=T.TEXT, corner_radius=6,
        ).grid(row=0, column=1, sticky="ew", padx=(0, 8), pady=(10, 2))

        info_bits = [format_date_br(r.date), cand.month_name,
                     ("+ " if r.direction == "entrada" else "− ") + format_currency(r.amount)]
        if cand.dup_label:
            info_bits.append(f"⚠ possível duplicata: {cand.dup_label}")
        if r.is_investment_like:
            info_bits.append("💡 parece ser investimento (aporte/resgate)")
        info_color = T.GOLD if (cand.dup_label or r.is_investment_like) else T.MUTED
        ctk.CTkLabel(
            row, text="  •  ".join(info_bits), font=F(11), text_color=info_color, anchor="w",
        ).grid(row=1, column=1, sticky="ew", padx=(0, 8), pady=(0, 8))

        cand.cat_var = ctk.StringVar(value=r.suggested_category)
        ctk.CTkComboBox(
            row, values=sorted(set(CATEGORIES + ["Investimentos"])), variable=cand.cat_var,
            width=150, fg_color=T.CARD, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD, dropdown_text_color=T.TEXT,
            corner_radius=6,
        ).grid(row=0, column=2, rowspan=2, padx=(0, 6), pady=10)

        cand.method_var = ctk.StringVar(value=PAYMENT_METHODS.get(r.suggested_payment_method, "Outro"))
        ctk.CTkComboBox(
            row, values=_METHOD_LABELS, variable=cand.method_var,
            width=130, fg_color=T.CARD, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD, dropdown_text_color=T.TEXT,
            corner_radius=6,
        ).grid(row=0, column=3, rowspan=2, padx=(0, 10), pady=10)

    def _update_count(self) -> None:
        n_total = len(self._candidates)
        n_sel   = sum(1 for c in self._candidates if c.include_var and c.include_var.get())
        self._count_lbl.configure(text=f"{n_sel} de {n_total} selecionado(s)")
        self._confirm_btn.configure(
            text=f"Confirmar importação ({n_sel})",
            state="normal" if n_sel > 0 else "disabled",
        )

    # ------------------------------------------------------------------
    def _confirm(self) -> None:
        if self._busy:
            return
        selected = [c for c in self._candidates if c.include_var and c.include_var.get()]
        if not selected:
            return

        rows_payload = []
        for c in selected:
            if c.month_id is None:
                continue
            method_key = _LABEL_TO_METHOD_KEY.get(c.method_var.get(), "outro")
            tx_type = "entrada_variavel" if c.row.direction == "entrada" else "saida_variavel"
            rows_payload.append({
                "month_id":       c.month_id,
                "type":           tx_type,
                "description":    c.desc_var.get().strip() or c.row.description,
                "amount":         c.row.amount,
                "category":       c.cat_var.get() or "Outros",
                "payment_method": method_key,
                "payment_date":   c.row.date,
            })

        self._confirm_btn.configure(state="disabled", text="Importando…")

        def _work():
            try:
                db.import_transactions_bulk(rows_payload)
                self.after(0, self._on_import_done)
            except Exception as e:
                msg = str(e)[:200]
                self.after(0, lambda: self._show_error(f"Erro ao importar: {msg}"))
                self.after(0, lambda: self._confirm_btn.configure(state="normal"))

        threading.Thread(target=_work, daemon=True).start()

    def _on_import_done(self) -> None:
        n = len([c for c in self._candidates if c.include_var and c.include_var.get()])
        self._candidates = []
        for w in self._rows_list.winfo_children():
            w.destroy()
        self._count_lbl.configure(text=f"✓ {n} lançamento(s) importado(s) com sucesso.")
        self._confirm_btn.configure(state="disabled", text="Confirmar importação")
        self._file_lbl.configure(text="Nenhum arquivo selecionado.")
        if self.on_change:
            self.on_change()


def _find_duplicate(row: NormalizedRow, existing: List[dict]) -> str:
    """Retorna uma descrição curta da transação existente que parece ser a
    mesma (mesmo valor, data a até 1 dia de diferença), ou "" se não achar."""
    for tx in existing:
        if abs(float(tx.get("amount") or 0) - row.amount) > 0.01:
            continue
        tx_date_raw = tx.get("payment_date") or tx.get("created_at")
        if not tx_date_raw:
            continue
        try:
            tx_date = date.fromisoformat(str(tx_date_raw)[:10])
        except ValueError:
            continue
        if abs((tx_date - row.date).days) > 1:
            continue
        ratio = difflib.SequenceMatcher(
            None, tx.get("description", "").lower(), row.description.lower()).ratio()
        confidence = "alta" if ratio >= 0.6 else "baixa"
        return f'"{tx.get("description", "")}" ({format_currency(float(tx["amount"]))}, confiança {confidence})'
    return ""
