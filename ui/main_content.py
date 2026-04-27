"""Área principal: header + tabs customizadas + conteúdo."""
import customtkinter as ctk
from tkinter import filedialog, messagebox
from datetime import date

import database as db
import ui.theme as T
from ui.theme import F
from ui.dashboard    import Dashboard
from ui.transactions import TransactionsTab
from ui.goals        import GoalsTab
from utils.helpers   import TRANSACTION_TYPES, MONTHS_PT

_TABS = [("dashboard", "Dashboard")] + list(TRANSACTION_TYPES.items()) + [("metas", "Metas")]


class MainContent(ctk.CTkFrame):
    def __init__(self, parent, month_id: int, month_name: str):
        super().__init__(parent, corner_radius=0, fg_color=T.BG)
        self.month_id   = month_id
        self.month_name = month_name

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        self._active_tab = "dashboard"
        self._tab_btns: dict = {}
        self._frames:   dict = {}
        self._stale_tabs: set = set()
        self._uninitialized_tabs: set = set()

        self._build()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        # ── Header ────────────────────────────────────────────────────
        header = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        header.grid_columnconfigure(0, weight=1)

        title_box = ctk.CTkFrame(header, fg_color="transparent")
        title_box.grid(row=0, column=0, sticky="w")

        self._title_lbl = ctk.CTkLabel(
            title_box, text=self.month_name,
            font=F(26, "bold"), text_color=T.TEXT, anchor="w",
        )
        self._title_lbl.pack(anchor="w")
        today = date.today()
        date_str = f"Hoje, {today.day} de {MONTHS_PT[today.month - 1].lower()} de {today.year}"
        ctk.CTkLabel(
            title_box, text=date_str,
            font=F(12), text_color=T.MUTED, anchor="w",
        ).pack(anchor="w", pady=(2, 0))

        ctk.CTkButton(
            header, text="↓  Exportar CSV",
            command=self._export_csv,
            height=36, width=150, corner_radius=9,
            fg_color=T.CARD, hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(13, "bold"),
        ).grid(row=0, column=1, sticky="e")

        # ── Tab bar (scrollável horizontalmente) ──────────────────────
        tab_bar = ctk.CTkScrollableFrame(
            self,
            fg_color=T.CARD,
            border_width=1, border_color=T.BORDER, corner_radius=10,
            orientation="horizontal",
            height=50,
            scrollbar_button_color=T.BORDER_L,
            scrollbar_button_hover_color=T.MUTED,
        )
        tab_bar.grid(row=1, column=0, sticky="ew", padx=28, pady=(20, 0))

        for tab_id, label in _TABS:
            btn = ctk.CTkButton(
                tab_bar,
                text=label,
                command=lambda t=tab_id: self._switch_tab(t),
                height=34, corner_radius=7,
                fg_color="transparent", hover_color=T.CARD2,
                text_color=T.MUTED, font=F(13),
                border_width=0,
            )
            btn.pack(side="left", padx=4, pady=4)
            self._tab_btns[tab_id] = btn

        # ── Conteúdo das tabs ─────────────────────────────────────────
        content = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        content.grid(row=2, column=0, sticky="nsew")
        content.grid_rowconfigure(0, weight=1)
        content.grid_columnconfigure(0, weight=1)

        dash = Dashboard(content, self.month_id)
        dash.grid(row=0, column=0, sticky="nsew")
        self._frames["dashboard"] = dash

        for tx_type, label in TRANSACTION_TYPES.items():
            frame = TransactionsTab(
                content, self.month_id, tx_type,
                on_change=self._refresh_dashboard,
            )
            frame.grid(row=0, column=0, sticky="nsew")
            self._frames[tx_type] = frame

        goals_frame = GoalsTab(content)
        goals_frame.grid(row=0, column=0, sticky="nsew")
        self._frames["metas"] = goals_frame

        # Marca abas de transação como não inicializadas — carregam no primeiro clique
        self._uninitialized_tabs = set(TRANSACTION_TYPES.keys())

        self._switch_tab("dashboard")

    # ------------------------------------------------------------------
    def _switch_tab(self, tab_id: str) -> None:
        for f in self._frames.values():
            f.grid_remove()
        self._frames[tab_id].grid()

        needs_refresh = (tab_id == "metas"
                         or tab_id in self._stale_tabs
                         or tab_id in self._uninitialized_tabs)
        if needs_refresh:
            frame = self._frames[tab_id]
            if hasattr(frame, "refresh"):
                frame.refresh()
            self._stale_tabs.discard(tab_id)
            self._uninitialized_tabs.discard(tab_id)

        for t, btn in self._tab_btns.items():
            if t == tab_id:
                btn.configure(
                    fg_color=T.BLUE, text_color="#ffffff",
                    font=F(13, "bold"), hover_color=T.BLUE,
                )
            else:
                btn.configure(
                    fg_color="transparent", text_color=T.MUTED,
                    font=F(13), hover_color=T.CARD2,
                )
        self._active_tab = tab_id

    # ------------------------------------------------------------------
    def switch_month(self, month_id: int, month_name: str) -> None:
        self.month_id   = month_id
        self.month_name = month_name
        self._title_lbl.configure(text=month_name)
        for frame in self._frames.values():
            if hasattr(frame, "month_id"):
                frame.month_id = month_id
        # Refresh só a aba ativa; as demais atualizam quando o usuário navegar até elas
        self._stale_tabs = {t for t in self._frames if t != self._active_tab}
        active = self._frames.get(self._active_tab)
        if active and hasattr(active, "refresh"):
            active.refresh()

    # ------------------------------------------------------------------
    def _refresh_dashboard(self) -> None:
        self._frames["dashboard"].refresh()

    def _export_csv(self) -> None:
        filename = self.month_name.replace(" ", "_") + ".csv"
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV (Excel)", "*.csv"), ("Todos os arquivos", "*.*")],
            initialfile=filename,
            title="Exportar lançamentos",
        )
        if not path:
            return
        content = db.export_month_csv(self.month_id)
        try:
            with open(path, "w", encoding="utf-8-sig") as f:
                f.write(content)
            messagebox.showinfo("Exportado", f"Arquivo salvo em:\n{path}")
        except OSError as e:
            messagebox.showerror("Erro ao exportar", str(e))
