"""Sub-aba "Alocação" dentro do hub de Investimentos: comparação entre
a carteira real e o alvo do perfil, diagnóstico e edição das metas."""
import threading
from typing import Callable, Optional

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from ui.disclaimer import make_disclaimer
from ui.portfolio_export_ui import export_portfolio
from utils.asset_classes import ASSET_CLASSES, ASSET_CLASS_LABELS, NAO_CLASSIFICADO
from utils.allocation_strategy import aggregate_by_class, compare_allocation, diagnose
from utils.helpers import format_currency, apply_app_icon

_TONE_COLORS = {
    "red":   (T.RED, T.RED_DIM),
    "gold":  (T.GOLD, T.GOLD_DIM),
    "green": (T.GREEN, T.GREEN_DIM),
    "blue":  (T.VIOLET, T.VIOLET_DIM),
}

_STATUS_COLOR = {"dentro": T.GREEN, "acima": T.GOLD, "abaixo": T.RED}
_STATUS_LABEL = {"dentro": "Dentro da meta", "acima": "Acima", "abaixo": "Abaixo"}

_CLASS_LABELS_WITH_UNCLASSIFIED = {**ASSET_CLASS_LABELS, NAO_CLASSIFICADO: "Não classificado"}


class InvestmentAllocationTab(ctk.CTkScrollableFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(
            parent, fg_color=T.BG,
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._on_change = on_change
        self._profile: Optional[str] = None
        self.grid_columnconfigure(0, weight=1)
        self.refresh()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        for w in self.winfo_children():
            w.destroy()
        ctk.CTkLabel(self, text="Carregando…", font=F(13), text_color=T.MUTED).grid(
            row=0, column=0, pady=40)

        def fetch():
            try:
                history = db.get_investor_profile_history()
                profile = history[0]["profile"] if history else None
                investments = db.get_investments()
                movements = db.get_all_investment_movements()
                months = db.get_months()
                monthly_expenses = 0.0
                if months:
                    summary = db.get_month_summary(months[0]["id"])
                    monthly_expenses = float(summary.get("total_saidas") or 0.0)
                targets = db.get_target_allocations(profile) if profile else []
            except Exception:
                profile, investments, movements, monthly_expenses, targets = None, [], [], 0.0, []
            self.after(0, lambda: self._apply(profile, investments, movements, monthly_expenses, targets))

        threading.Thread(target=fetch, daemon=True).start()

    def _apply(self, profile, investments, movements, monthly_expenses, targets) -> None:
        self._profile = profile
        self._investments = investments
        self._movements = movements
        self._monthly_expenses = monthly_expenses
        for w in self.winfo_children():
            w.destroy()

        if not profile:
            box = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                               border_width=1, border_color=T.BORDER)
            box.grid(row=0, column=0, sticky="ew", padx=28, pady=(30, 0))
            ctk.CTkLabel(box, text="📊", font=F(34)).pack(pady=(36, 6))
            ctk.CTkLabel(box, text="Faça o teste de perfil primeiro",
                         font=F(16, "bold"), text_color=T.TEXT).pack()
            ctk.CTkLabel(
                box,
                text="A comparação de alocação usa o alvo do seu perfil de\n"
                     "investidor -- abra a aba \"Perfil de Investidor\" ao lado\n"
                     "pra responder o questionário.",
                font=F(12), text_color=T.MUTED, justify="center",
            ).pack(pady=(6, 36))
            return

        target_by_class = {t["asset_class"]: t for t in targets}
        actual_by_class = aggregate_by_class(investments, movements)
        self._comparisons = compare_allocation(actual_by_class, target_by_class)
        tips = diagnose(self._comparisons, investments, movements, monthly_expenses)

        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text=f"Alocação — perfil {profile}",
                     font=F(18, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w")
        hdr_btns = ctk.CTkFrame(hdr, fg_color="transparent")
        hdr_btns.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(
            hdr_btns, text="↓  Exportar", command=self._export,
            height=32, width=110, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).pack(side="left", padx=(0, 6))
        ctk.CTkButton(
            hdr_btns, text="✎  Editar metas", command=self._open_edit_targets,
            height=32, width=140, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).pack(side="left")

        table = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                             border_width=1, border_color=T.BORDER)
        table.grid(row=1, column=0, sticky="ew", padx=28, pady=(14, 0))
        for col, w in enumerate([3, 2, 1, 1, 1, 2]):
            table.grid_columnconfigure(col, weight=w)

        headers = ["Classe", "Valor atual", "Atual", "Alvo", "Desvio", "Status"]
        for col, text in enumerate(headers):
            ctk.CTkLabel(table, text=text, font=F(11, "bold"), text_color=T.MUTED,
                         anchor="w").grid(row=0, column=col, sticky="w",
                                          padx=(16 if col == 0 else 6, 6), pady=(14, 6))

        if not self._comparisons:
            ctk.CTkLabel(table, text="Nenhum investimento com saldo ainda.",
                         font=F(12), text_color=T.MUTED).grid(
                row=1, column=0, columnspan=6, padx=16, pady=(0, 16), sticky="w")
        else:
            for i, c in enumerate(self._comparisons, start=1):
                label = _CLASS_LABELS_WITH_UNCLASSIFIED.get(c["asset_class"], c["asset_class"])
                status_color = _STATUS_COLOR[c["status"]]
                ctk.CTkLabel(table, text=label, font=F(12), text_color=T.TEXT, anchor="w").grid(
                    row=i, column=0, sticky="w", padx=(16, 6), pady=4)
                ctk.CTkLabel(table, text=format_currency(c["actual_value"]), font=F(12),
                             text_color=T.TEXT, anchor="w").grid(row=i, column=1, sticky="w", padx=6)
                ctk.CTkLabel(table, text=f"{c['actual_pct'] * 100:.0f}%", font=F(12),
                             text_color=T.TEXT, anchor="w").grid(row=i, column=2, sticky="w", padx=6)
                ctk.CTkLabel(table, text=f"{c['target_pct'] * 100:.0f}%", font=F(12),
                             text_color=T.MUTED, anchor="w").grid(row=i, column=3, sticky="w", padx=6)
                dev = c["deviation_pct"] * 100
                ctk.CTkLabel(table, text=f"{'+' if dev >= 0 else ''}{dev:.0f}pp", font=F(12),
                             text_color=status_color, anchor="w").grid(row=i, column=4, sticky="w", padx=6)
                ctk.CTkLabel(table, text=_STATUS_LABEL[c["status"]], font=F(12, "bold"),
                             text_color=status_color, anchor="w").grid(
                    row=i, column=5, sticky="w", padx=(6, 16), pady=(4, 4 if i < len(self._comparisons) else 16))

        # ── Diagnóstico ──────────────────────────────────────────────
        ctk.CTkLabel(self, text="Diagnóstico", font=F(14, "bold"), text_color=T.TEXT,
                     anchor="w").grid(row=2, column=0, sticky="w", padx=28, pady=(20, 6))
        tips_box = ctk.CTkFrame(self, fg_color="transparent")
        tips_box.grid(row=3, column=0, sticky="ew", padx=28)
        tips_box.grid_columnconfigure(0, weight=1)
        for i, (icon, title, body, tone) in enumerate(tips):
            color, dim = _TONE_COLORS.get(tone, (T.MUTED, T.CARD2))
            card = ctk.CTkFrame(tips_box, fg_color=dim, corner_radius=10)
            card.grid(row=i, column=0, sticky="ew", pady=(0, 8))
            card.grid_columnconfigure(0, weight=1)
            hdr_row = ctk.CTkFrame(card, fg_color="transparent")
            hdr_row.grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 2))
            ctk.CTkLabel(hdr_row, text=icon, font=F(14), text_color=color).pack(side="left")
            ctk.CTkLabel(hdr_row, text=title, font=F(12, "bold"), text_color=color,
                         anchor="w").pack(side="left", padx=(6, 0))
            ctk.CTkLabel(card, text=body, font=F(11), text_color=T.MUTED, anchor="w",
                         justify="left", wraplength=640).grid(
                row=1, column=0, sticky="ew", padx=14, pady=(0, 10))

        disc = make_disclaimer(self)
        disc.grid(row=4, column=0, sticky="ew", padx=28, pady=(14, 28))

    # ------------------------------------------------------------------
    def _open_edit_targets(self) -> None:
        if not self._profile:
            return
        _EditTargetsDialog(self.winfo_toplevel(), self._profile, on_saved=self.refresh)

    def _export(self) -> None:
        if not self._comparisons:
            return

        def get_items(mode: str) -> list:
            # "Não classificado" não é uma classe de ativo de verdade --
            # fica de fora pra não gerar um arquivo que a própria
            # validação de import rejeitaria depois.
            exportable = [c for c in self._comparisons if c["asset_class"] != NAO_CLASSIFICADO]
            if mode == "absolute":
                return [{"asset_class": c["asset_class"], "label": None, "value": c["actual_value"]}
                       for c in exportable]
            classified_total = sum(c["actual_value"] for c in exportable)
            return [{
                "asset_class": c["asset_class"], "label": None,
                "value": (c["actual_value"] / classified_total) if classified_total > 0 else 0.0,
            } for c in exportable]

        export_portfolio(self.winfo_toplevel(), "Carteira atual", get_items)


class _EditTargetsDialog(ctk.CTkToplevel):
    def __init__(self, parent, profile: str, on_saved: Callable):
        super().__init__(parent)
        self.title("Editar metas de alocação")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._profile = profile
        self._on_saved = on_saved
        self._entries: dict = {}
        apply_app_icon(self)
        self._build()
        self._load()
        w, h = 480, 560
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text=f"Metas — perfil {self._profile}",
                     font=F(15, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(20, 2), padx=24)
        ctk.CTkLabel(self, text="% alvo e tolerância por classe de ativo (a soma dos\n"
                                "alvos idealmente fecha 100%).",
                     font=F(11), text_color=T.MUTED, justify="center").grid(
            row=1, column=0, padx=24, pady=(0, 10))

        scroll = ctk.CTkScrollableFrame(self, fg_color="transparent", height=340)
        scroll.grid(row=2, column=0, sticky="nsew", padx=24)
        scroll.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        header = ctk.CTkFrame(scroll, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 4))
        ctk.CTkLabel(header, text="Classe", font=F(10, "bold"), text_color=T.SUBTLE,
                     width=170, anchor="w").pack(side="left")
        ctk.CTkLabel(header, text="Alvo %", font=F(10, "bold"), text_color=T.SUBTLE,
                     width=70, anchor="w").pack(side="left", padx=4)
        ctk.CTkLabel(header, text="Toler. %", font=F(10, "bold"), text_color=T.SUBTLE,
                     width=70, anchor="w").pack(side="left")

        for i, cls in enumerate(ASSET_CLASSES):
            row = ctk.CTkFrame(scroll, fg_color="transparent")
            row.grid(row=1 + i, column=0, sticky="ew", pady=3)
            ctk.CTkLabel(row, text=ASSET_CLASS_LABELS[cls], font=F(12), text_color=T.TEXT,
                         width=170, anchor="w").pack(side="left")
            target_entry = ctk.CTkEntry(row, width=70, fg_color=T.CARD2,
                                        border_color=T.BORDER_L, text_color=T.TEXT)
            target_entry.pack(side="left", padx=4)
            tol_entry = ctk.CTkEntry(row, width=70, fg_color=T.CARD2,
                                     border_color=T.BORDER_L, text_color=T.TEXT)
            tol_entry.pack(side="left")
            self._entries[cls] = (target_entry, tol_entry)

        self._error_lbl = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._error_lbl.grid(row=3, column=0, pady=(8, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=4, column=0, pady=16)
        ctk.CTkButton(
            btns, text="Restaurar padrão", command=self._reset,
            height=34, width=130, corner_radius=8, fg_color="transparent",
            hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).pack(side="left", padx=4)
        ctk.CTkButton(
            btns, text="Cancelar", command=self.destroy,
            height=34, width=100, corner_radius=8, fg_color=T.CARD2,
            hover_color=T.BORDER_L, border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).pack(side="left", padx=4)
        ctk.CTkButton(
            btns, text="Salvar", command=self._save,
            height=34, width=100, corner_radius=8, fg_color=T.VIOLET,
            hover_color=T.VIOLET, text_color="#ffffff", font=F(12, "bold"),
        ).pack(side="left", padx=4)

    def _fill(self, rows: list) -> None:
        by_class = {r["asset_class"]: r for r in rows}
        for cls, (target_entry, tol_entry) in self._entries.items():
            r = by_class.get(cls, {"target_pct": 0.0, "tolerance_pct": 0.0})
            target_entry.delete(0, "end")
            target_entry.insert(0, f"{float(r['target_pct']) * 100:.0f}")
            tol_entry.delete(0, "end")
            tol_entry.insert(0, f"{float(r['tolerance_pct']) * 100:.0f}")

    def _load(self) -> None:
        def fetch():
            try:
                rows = db.get_target_allocations(self._profile)
            except Exception:
                rows = []
            self.after(0, lambda: self._fill(rows))
        threading.Thread(target=fetch, daemon=True).start()

    def _reset(self) -> None:
        def do_reset():
            try:
                rows = db.reset_target_allocations(self._profile)
            except Exception as e:
                self.after(0, lambda: self._error_lbl.configure(text=f"Erro: {e}"))
                return
            self.after(0, lambda: self._fill(rows))
        threading.Thread(target=do_reset, daemon=True).start()

    def _save(self) -> None:
        parsed = {}
        for cls, (target_entry, tol_entry) in self._entries.items():
            try:
                target_pct = max(0.0, float(target_entry.get().replace(",", ".") or 0)) / 100
                tol_pct = max(0.0, float(tol_entry.get().replace(",", ".") or 0)) / 100
            except ValueError:
                self._error_lbl.configure(text="Valores inválidos -- use só números.")
                return
            parsed[cls] = (target_pct, tol_pct)

        def do_save():
            try:
                for cls, (target_pct, tol_pct) in parsed.items():
                    db.save_target_allocation(self._profile, cls, target_pct, tol_pct)
            except Exception as e:
                self.after(0, lambda: self._error_lbl.configure(text=f"Erro ao salvar: {e}"))
                return
            self.after(0, self._finish)

        threading.Thread(target=do_save, daemon=True).start()

    def _finish(self) -> None:
        self._on_saved()
        self.destroy()
