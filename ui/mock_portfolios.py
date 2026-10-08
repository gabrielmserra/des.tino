"""Sub-aba "Carteiras Fictícias" dentro do hub de Investimentos:
simulação sem nenhum efeito em saldo/lançamentos reais."""
import threading
from typing import Callable, List, Optional

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from ui.disclaimer import make_disclaimer
from ui.dialogs import ConfirmDialog, show_error
from ui.portfolio_export_ui import export_portfolio, import_portfolio
from utils.asset_classes import ASSET_CLASSES, ASSET_CLASS_LABELS, NAO_CLASSIFICADO
from utils.allocation_strategy import aggregate_by_class, aggregate_mock_by_class, compare_allocation, diagnose
from utils.helpers import format_currency, apply_app_icon

_TONE_COLORS = {
    "red":   (T.RED, T.RED_DIM),
    "gold":  (T.GOLD, T.GOLD_DIM),
    "green": (T.GREEN, T.GREEN_DIM),
    "blue":  (T.VIOLET, T.VIOLET_DIM),
}
_SOURCE_LABEL = {
    "scratch": "Do zero", "copy_real": "Cópia da carteira real",
    "copy_target": "Cópia da meta do perfil", "import": "Importada",
}
_CLASS_LABELS_WITH_UNCLASSIFIED = {**ASSET_CLASS_LABELS, NAO_CLASSIFICADO: "Não classificado"}


def _parse_amount(raw: str) -> float:
    raw = (raw or "").strip().replace(".", "").replace(",", ".") if "," in (raw or "") \
        else (raw or "").strip().replace(",", ".")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


class MockPortfoliosTab(ctk.CTkScrollableFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(
            parent, fg_color=T.BG,
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._on_change = on_change
        self._portfolios: list = []
        self._investments: list = []
        self._movements: list = []
        self._profile: Optional[str] = None
        self._targets: list = []
        self._selected_id: Optional[int] = None
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
                portfolios = db.get_mock_portfolios()
                investments = db.get_investments()
                movements = db.get_all_investment_movements()
                history = db.get_investor_profile_history()
                profile = history[0]["profile"] if history else None
                targets = db.get_target_allocations(profile) if profile else []
            except Exception:
                portfolios, investments, movements, profile, targets = [], [], [], None, []
            self.after(0, lambda: self._apply(portfolios, investments, movements, profile, targets))

        threading.Thread(target=fetch, daemon=True).start()

    def _apply(self, portfolios, investments, movements, profile, targets) -> None:
        self._portfolios = portfolios
        self._investments = investments
        self._movements = movements
        self._profile = profile
        self._targets = targets
        for w in self.winfo_children():
            w.destroy()
        if self._selected_id and any(p["id"] == self._selected_id for p in portfolios):
            self._render_comparison(self._selected_id)
        else:
            self._selected_id = None
            self._render_list()

    # ==================================================================
    # Lista
    # ==================================================================
    def _render_list(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        hdr.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(hdr, text="Carteiras Fictícias", font=F(18, "bold"),
                     text_color=T.TEXT, anchor="w").grid(row=0, column=0, sticky="w")
        hdr_btns = ctk.CTkFrame(hdr, fg_color="transparent")
        hdr_btns.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(
            hdr_btns, text="↑ Importar", command=self._import,
            height=34, width=110, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).pack(side="left", padx=(0, 6))
        ctk.CTkButton(
            hdr_btns, text="+ Nova carteira", command=self._open_create_menu,
            height=34, width=150, corner_radius=8,
            fg_color=T.VIOLET, hover_color=T.VIOLET,
            text_color="#ffffff", font=F(12, "bold"),
        ).pack(side="left")
        ctk.CTkLabel(
            self, text="Simule uma carteira sem afetar nada do app de verdade -- nenhum saldo,\n"
                       "lançamento ou total real é alterado.",
            font=F(11), text_color=T.MUTED, justify="left", anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=28, pady=(4, 16))

        if not self._portfolios:
            box = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                               border_width=1, border_color=T.BORDER)
            box.grid(row=2, column=0, sticky="ew", padx=28)
            ctk.CTkLabel(box, text="Nenhuma carteira fictícia ainda.",
                         font=F(13), text_color=T.MUTED).pack(pady=30)
            return

        list_box = ctk.CTkFrame(self, fg_color="transparent")
        list_box.grid(row=2, column=0, sticky="ew", padx=28, pady=(0, 28))
        list_box.grid_columnconfigure(0, weight=1)
        for i, p in enumerate(self._portfolios):
            row = ctk.CTkFrame(list_box, fg_color=T.CARD, corner_radius=12,
                               border_width=1, border_color=T.BORDER)
            row.grid(row=i, column=0, sticky="ew", pady=(0, 8))
            row.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(row, text=p["name"], font=F(14, "bold"), text_color=T.TEXT,
                         anchor="w").grid(row=0, column=0, sticky="w", padx=16, pady=(14, 0))
            ctk.CTkLabel(row, text=_SOURCE_LABEL.get(p["source"], p["source"]),
                         font=F(11), text_color=T.MUTED, anchor="w").grid(
                row=1, column=0, sticky="w", padx=16, pady=(0, 12))
            btns = ctk.CTkFrame(row, fg_color="transparent")
            btns.grid(row=0, column=1, rowspan=2, padx=16, pady=10, sticky="e")
            ctk.CTkButton(
                btns, text="Comparar", command=lambda pid=p["id"]: self._show_comparison(pid),
                height=30, width=90, corner_radius=7, fg_color=T.VIOLET,
                hover_color=T.VIOLET, text_color="#ffffff", font=F(11, "bold"),
            ).pack(side="left", padx=3)
            ctk.CTkButton(
                btns, text="✎", command=lambda p=p: self._rename(p),
                height=30, width=34, corner_radius=7, fg_color="transparent",
                hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
                text_color=T.MUTED, font=F(12),
            ).pack(side="left", padx=3)
            ctk.CTkButton(
                btns, text="🗑", command=lambda p=p: self._delete(p),
                height=30, width=34, corner_radius=7, fg_color="transparent",
                hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
                text_color=T.RED, font=F(12),
            ).pack(side="left", padx=3)

    def _show_comparison(self, portfolio_id: int) -> None:
        self._selected_id = portfolio_id
        self._render_comparison(portfolio_id)

    def _rename(self, p: dict) -> None:
        _RenameDialog(self.winfo_toplevel(), p, on_saved=self.refresh)

    def _delete(self, p: dict) -> None:
        def do_delete():
            db.delete_mock_portfolio(p["id"])
        ConfirmDialog(
            self.winfo_toplevel(), title="Excluir carteira fictícia?",
            message=f'"{p["name"]}" e todos os seus itens serão apagados.',
            confirm_text="Excluir",
            on_confirm=lambda: (do_delete(), self.after(0, self.refresh)),
        )

    def _open_create_menu(self) -> None:
        _CreateMenuDialog(
            self.winfo_toplevel(),
            has_investments=bool(self._investments),
            has_profile=bool(self._profile),
            on_scratch=lambda: self._open_create_dialog("scratch"),
            on_copy_real=lambda: self._open_create_dialog("copy_real"),
            on_copy_target=lambda: self._open_create_dialog("copy_target"),
        )

    def _open_create_dialog(self, mode: str) -> None:
        prefill: List[dict] = []
        if mode == "copy_real":
            by_class = aggregate_by_class(self._investments, self._movements)
            prefill = [{"asset_class": c, "value": v} for c, v in by_class.items()]
        _CreatePortfolioDialog(
            self.winfo_toplevel(), mode=mode, prefill_items=prefill,
            targets=self._targets, on_saved=self._on_portfolio_created,
        )

    def _on_portfolio_created(self) -> None:
        self.refresh()
        if self._on_change:
            self._on_change()

    def _import(self) -> None:
        def on_confirm(name: str, mode: str, items: list) -> None:
            def do_save():
                try:
                    db.create_mock_portfolio_bulk(name, "import", mode, items)
                except Exception as e:
                    self.after(0, lambda: show_error(self.winfo_toplevel(), "Erro ao importar", str(e)))
                    return
                self.after(0, self._on_portfolio_created)
            threading.Thread(target=do_save, daemon=True).start()

        import_portfolio(self.winfo_toplevel(), on_confirm=on_confirm)

    # ==================================================================
    # Comparação
    # ==================================================================
    def _render_comparison(self, portfolio_id: int) -> None:
        for w in self.winfo_children():
            w.destroy()

        portfolio = next((p for p in self._portfolios if p["id"] == portfolio_id), None)
        if not portfolio:
            self._selected_id = None
            self._render_list()
            return

        ctk.CTkButton(
            self, text="←  Voltar", command=self._back_to_list,
            height=30, width=100, corner_radius=8, fg_color="transparent",
            hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).grid(row=0, column=0, sticky="w", padx=28, pady=(24, 0))

        ctk.CTkLabel(self, text="Carregando…", font=F(13), text_color=T.MUTED).grid(
            row=1, column=0, pady=30)

        def fetch():
            try:
                items = db.get_mock_portfolio_items(portfolio_id)
            except Exception:
                items = []
            self.after(0, lambda: self._apply_comparison(portfolio, items))

        threading.Thread(target=fetch, daemon=True).start()

    def _back_to_list(self) -> None:
        self._selected_id = None
        for w in self.winfo_children():
            w.destroy()
        self._render_list()

    def _export_current(self) -> None:
        items = getattr(self, "_current_items", None) or []
        portfolio = getattr(self, "_current_portfolio", None)
        if not items or not portfolio:
            return

        def get_items(mode: str) -> list:
            if mode == "absolute":
                return [{"asset_class": it["asset_class"], "label": it.get("label"),
                        "value": float(it["value"] or 0)} for it in items]
            total = sum(float(it["value"] or 0) for it in items)
            return [{
                "asset_class": it["asset_class"], "label": it.get("label"),
                "value": (float(it["value"] or 0) / total) if total > 0 else 0.0,
            } for it in items]

        export_portfolio(self.winfo_toplevel(), portfolio["name"], get_items)

    def _apply_comparison(self, portfolio: dict, items: list) -> None:
        for w in self.winfo_children():
            w.destroy()
        self._current_portfolio = portfolio
        self._current_items = items

        top_row = ctk.CTkFrame(self, fg_color="transparent")
        top_row.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        top_row.grid_columnconfigure(1, weight=1)
        ctk.CTkButton(
            top_row, text="←  Voltar", command=self._back_to_list,
            height=30, width=100, corner_radius=8, fg_color="transparent",
            hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).grid(row=0, column=0, sticky="w")
        ctk.CTkButton(
            top_row, text="↓  Exportar", command=self._export_current,
            height=30, width=110, corner_radius=8, fg_color="transparent",
            hover_color=T.CARD2, border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).grid(row=0, column=1, sticky="e")

        ctk.CTkLabel(self, text=portfolio["name"], font=F(18, "bold"),
                     text_color=T.TEXT, anchor="w").grid(
            row=1, column=0, sticky="w", padx=28, pady=(10, 0))

        real_by_class = aggregate_by_class(self._investments, self._movements)
        mock_by_class = aggregate_mock_by_class(items)
        target_by_class = {t["asset_class"]: t for t in self._targets} if self._profile else {}

        classes_seen = set(real_by_class) | set(mock_by_class) | set(target_by_class)
        ordered = [c for c in ASSET_CLASSES if c in classes_seen]
        if NAO_CLASSIFICADO in classes_seen:
            ordered.append(NAO_CLASSIFICADO)

        real_total = sum(real_by_class.values()) or 0.0
        mock_total = sum(mock_by_class.values()) or 0.0

        table = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                             border_width=1, border_color=T.BORDER)
        table.grid(row=2, column=0, sticky="ew", padx=28, pady=(14, 0))
        for col, w in enumerate([3, 2, 2, 1]):
            table.grid_columnconfigure(col, weight=w)
        headers = ["Classe", "Real", "Fictícia", "Alvo"]
        for col, text in enumerate(headers):
            ctk.CTkLabel(table, text=text, font=F(11, "bold"), text_color=T.MUTED,
                         anchor="w").grid(row=0, column=col, sticky="w",
                                          padx=(16 if col == 0 else 6, 6), pady=(14, 6))
        if not ordered:
            ctk.CTkLabel(table, text="Nada pra comparar ainda.", font=F(12),
                         text_color=T.MUTED).grid(row=1, column=0, columnspan=4,
                                                  padx=16, pady=(0, 16), sticky="w")
        else:
            for i, cls in enumerate(ordered, start=1):
                label = _CLASS_LABELS_WITH_UNCLASSIFIED.get(cls, cls)
                real_pct = (real_by_class.get(cls, 0.0) / real_total * 100) if real_total > 0 else 0.0
                mock_pct = (mock_by_class.get(cls, 0.0) / mock_total * 100) if mock_total > 0 else 0.0
                t = target_by_class.get(cls)
                target_txt = f"{float(t['target_pct']) * 100:.0f}%" if t else "—"
                pad_bottom = 4 if i < len(ordered) else 16
                ctk.CTkLabel(table, text=label, font=F(12), text_color=T.TEXT, anchor="w").grid(
                    row=i, column=0, sticky="w", padx=(16, 6), pady=(4, pad_bottom))
                ctk.CTkLabel(table, text=f"{real_pct:.0f}%", font=F(12), text_color=T.TEXT,
                             anchor="w").grid(row=i, column=1, sticky="w", padx=6, pady=(4, pad_bottom))
                ctk.CTkLabel(table, text=f"{mock_pct:.0f}%", font=F(12), text_color=T.VIOLET,
                             anchor="w").grid(row=i, column=2, sticky="w", padx=6, pady=(4, pad_bottom))
                ctk.CTkLabel(table, text=target_txt, font=F(12), text_color=T.MUTED,
                             anchor="w").grid(row=i, column=3, sticky="w", padx=(6, 16), pady=(4, pad_bottom))

        if self._profile and target_by_class:
            ctk.CTkLabel(self, text=f"Diagnóstico da carteira fictícia (vs. meta {self._profile})",
                         font=F(14, "bold"), text_color=T.TEXT, anchor="w").grid(
                row=3, column=0, sticky="w", padx=28, pady=(20, 6))
            mock_comparisons = compare_allocation(mock_by_class, target_by_class)
            tips = diagnose(mock_comparisons, [], [], 0.0)
            tips_box = ctk.CTkFrame(self, fg_color="transparent")
            tips_box.grid(row=4, column=0, sticky="ew", padx=28)
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
            disc_row = 5
        else:
            disc_row = 3

        disc = make_disclaimer(self)
        disc.grid(row=disc_row, column=0, sticky="ew", padx=28, pady=(14, 28))


# ──────────────────────────────────────────────────────────────────────
class _CreateMenuDialog(ctk.CTkToplevel):
    """Escolha de como começar a nova carteira fictícia."""
    def __init__(self, parent, has_investments: bool, has_profile: bool,
                on_scratch: Callable, on_copy_real: Callable, on_copy_target: Callable):
        super().__init__(parent)
        self.title("Nova carteira fictícia")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)

        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Como quer começar?", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(22, 14), padx=28)

        def _choose(fn):
            self.destroy()
            fn()

        ctk.CTkButton(
            self, text="Do zero", command=lambda: _choose(on_scratch),
            height=40, corner_radius=8, fg_color=T.VIOLET, hover_color=T.VIOLET,
            text_color="#ffffff", font=F(13, "bold"),
        ).grid(row=1, column=0, padx=28, pady=4, sticky="ew")

        real_btn = ctk.CTkButton(
            self, text="Copiar carteira real", command=lambda: _choose(on_copy_real),
            height=40, corner_radius=8, fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L, text_color=T.TEXT, font=F(13),
            state="normal" if has_investments else "disabled",
        )
        real_btn.grid(row=2, column=0, padx=28, pady=4, sticky="ew")

        target_btn = ctk.CTkButton(
            self, text="Partir da meta do perfil", command=lambda: _choose(on_copy_target),
            height=40, corner_radius=8, fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L, text_color=T.TEXT, font=F(13),
            state="normal" if has_profile else "disabled",
        )
        target_btn.grid(row=3, column=0, padx=28, pady=(4, 20), sticky="ew")

        w, h = 360, 250
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()


class _RenameDialog(ctk.CTkToplevel):
    def __init__(self, parent, portfolio: dict, on_saved: Callable):
        super().__init__(parent)
        self.title("Renomear carteira")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._portfolio = portfolio
        self._on_saved = on_saved
        apply_app_icon(self)

        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Renomear carteira", font=F(14, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(20, 10), padx=24)
        self._name_var = ctk.StringVar(value=portfolio["name"])
        ctk.CTkEntry(self, textvariable=self._name_var, fg_color=T.CARD2,
                     border_color=T.BORDER_L, text_color=T.TEXT).grid(
            row=1, column=0, padx=24, sticky="ew")
        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=2, column=0, pady=16)
        ctk.CTkButton(btns, text="Cancelar", command=self.destroy, width=100,
                     fg_color=T.CARD2, hover_color=T.BORDER_L, border_width=1,
                     border_color=T.BORDER_L, text_color=T.MUTED).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="Salvar", command=self._save, width=100,
                     fg_color=T.VIOLET, hover_color=T.VIOLET,
                     text_color="#ffffff", font=F(12, "bold")).pack(side="left", padx=4)

        w, h = 360, 170
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()

    def _save(self) -> None:
        name = self._name_var.get().strip()
        if not name:
            return
        db.rename_mock_portfolio(self._portfolio["id"], name)
        self._on_saved()
        self.destroy()


class _CreatePortfolioDialog(ctk.CTkToplevel):
    """mode: 'scratch' | 'copy_real' | 'copy_target'."""
    def __init__(self, parent, mode: str, prefill_items: List[dict],
                targets: list, on_saved: Callable):
        super().__init__(parent)
        self.title("Nova carteira fictícia")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self._mode = mode
        self._targets = {t["asset_class"]: float(t["target_pct"]) for t in targets}
        self._on_saved = on_saved
        self._rows: List[Optional[dict]] = []
        apply_app_icon(self)
        self._build(prefill_items)
        w, h = 460, 560
        px = parent.winfo_x() + (parent.winfo_width() - w) // 2
        py = parent.winfo_y() + (parent.winfo_height() - h) // 2
        self.geometry(f"{w}x{h}+{px}+{py}")
        self.lift()
        self.focus()

    def _build(self, prefill_items: List[dict]) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        ctk.CTkLabel(self, text="Nova carteira fictícia", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(20, 10), padx=24)

        self._name_var = ctk.StringVar()
        ctk.CTkEntry(self, textvariable=self._name_var, placeholder_text="Nome da carteira",
                     fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT).grid(
            row=1, column=0, padx=24, sticky="ew")

        if self._mode == "copy_target":
            total_row = ctk.CTkFrame(self, fg_color="transparent")
            total_row.grid(row=2, column=0, padx=24, pady=(10, 0), sticky="ew")
            ctk.CTkLabel(total_row, text="Valor total hipotético (R$)", font=F(11),
                         text_color=T.MUTED, anchor="w").pack(anchor="w")
            self._total_var = ctk.StringVar()
            total_entry = ctk.CTkEntry(total_row, textvariable=self._total_var,
                                       placeholder_text="0,00", fg_color=T.CARD2,
                                       border_color=T.BORDER_L, text_color=T.TEXT)
            total_entry.pack(fill="x", pady=(2, 0))
            total_entry.bind("<KeyRelease>", lambda _: self._apply_target_total())
            ctk.CTkLabel(
                total_row,
                text="Digite um valor total acima -- os campos de cada classe abaixo\n"
                     "são preenchidos sozinhos de acordo com a meta do seu perfil.\n"
                     "Pode ajustar cada um na mão depois.",
                font=F(10), text_color=T.SUBTLE, justify="left", anchor="w",
            ).pack(anchor="w", pady=(6, 0))
        elif self._mode == "scratch":
            ctk.CTkLabel(
                self,
                text="Monte sua carteira hipotética: pra cada item, escolha a classe\n"
                     "de ativo e digite o valor em reais. Use \"+ Adicionar item\" pra\n"
                     "incluir quantos quiser.",
                font=F(10), text_color=T.SUBTLE, justify="left", anchor="w",
            ).grid(row=2, column=0, padx=24, pady=(8, 0), sticky="w")

        scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        scroll.grid(row=3, column=0, sticky="nsew", padx=24, pady=(12, 0))
        scroll.grid_columnconfigure(0, weight=1)
        self._rows_frame = scroll

        if self._mode == "copy_real":
            for it in prefill_items:
                self._add_row(it["asset_class"], it["value"])
        if not prefill_items and self._mode != "copy_target":
            self._add_row()
        if self._mode == "copy_target":
            for cls in ASSET_CLASSES:
                self._add_row(cls, 0.0)

        ctk.CTkButton(
            self, text="+ Adicionar item", command=lambda: self._add_row(),
            height=30, corner_radius=8, fg_color=T.GREEN_DIM, hover_color=T.GREEN,
            text_color=T.GREEN, font=F(11, "bold"),
        ).grid(row=4, column=0, padx=24, pady=(8, 4), sticky="w")

        self._error_lbl = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._error_lbl.grid(row=5, column=0, padx=24, pady=(2, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=6, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", command=self.destroy, width=110,
                     fg_color=T.CARD2, hover_color=T.BORDER_L, border_width=1,
                     border_color=T.BORDER_L, text_color=T.MUTED).pack(side="left", padx=4)
        ctk.CTkButton(btns, text="Salvar", command=self._save, width=110,
                     fg_color=T.VIOLET, hover_color=T.VIOLET,
                     text_color="#ffffff", font=F(12, "bold")).pack(side="left", padx=4)

    def _add_row(self, asset_class: Optional[str] = None, value: float = 0.0) -> None:
        idx = len(self._rows)
        row = ctk.CTkFrame(self._rows_frame, fg_color="transparent")
        row.pack(fill="x", pady=3)

        cls_var = ctk.StringVar(value=ASSET_CLASS_LABELS.get(asset_class, ASSET_CLASS_LABELS[ASSET_CLASSES[0]]))
        combo = ctk.CTkComboBox(
            row, values=[ASSET_CLASS_LABELS[c] for c in ASSET_CLASSES], variable=cls_var,
            width=190, fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
        )
        combo.pack(side="left", padx=(0, 6))

        value_entry = ctk.CTkEntry(row, width=110, placeholder_text="0,00",
                                   fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT)
        if value:
            value_entry.insert(0, f"{value:.2f}".replace(".", ","))
        value_entry.pack(side="left", padx=(0, 6))

        ctk.CTkButton(
            row, text="✕", width=30, height=28, corner_radius=6,
            fg_color="transparent", hover_color=T.RED, text_color=T.SUBTLE,
            command=lambda i=idx: self._remove_row(i),
        ).pack(side="left")

        self._rows.append({"frame": row, "class_var": cls_var, "value_entry": value_entry})

    def _remove_row(self, idx: int) -> None:
        entry = self._rows[idx]
        if entry is None:
            return
        entry["frame"].destroy()
        self._rows[idx] = None

    def _apply_target_total(self) -> None:
        total = _parse_amount(self._total_var.get())
        label_to_class = {ASSET_CLASS_LABELS[c]: c for c in ASSET_CLASSES}
        for r in self._rows:
            if r is None:
                continue
            cls = label_to_class.get(r["class_var"].get())
            pct = self._targets.get(cls, 0.0)
            r["value_entry"].delete(0, "end")
            r["value_entry"].insert(0, f"{total * pct:.2f}".replace(".", ","))

    def _save(self) -> None:
        name = self._name_var.get().strip()
        if not name:
            self._error_lbl.configure(text="Informe um nome.")
            return
        label_to_class = {ASSET_CLASS_LABELS[c]: c for c in ASSET_CLASSES}
        items = []
        for r in self._rows:
            if r is None:
                continue
            cls = label_to_class.get(r["class_var"].get())
            value = _parse_amount(r["value_entry"].get())
            if cls and value > 0:
                items.append({"asset_class": cls, "label": None, "value": value})
        if not items:
            self._error_lbl.configure(text="Adicione pelo menos um item com valor.")
            return

        def do_save():
            try:
                db.create_mock_portfolio_bulk(name, self._mode, "absolute", items)
            except Exception as e:
                self.after(0, lambda: self._error_lbl.configure(text=f"Erro: {e}"))
                return
            self.after(0, self._finish)
        threading.Thread(target=do_save, daemon=True).start()

    def _finish(self) -> None:
        self._on_saved()
        self.destroy()
