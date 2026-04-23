"""Frame principal da aplicação: sidebar + área de conteúdo + diálogos modais."""
from __future__ import annotations
from typing import Callable
import customtkinter as ctk
from datetime import datetime
import threading

import database as db
import ui.theme as T
from ui.theme import F
from ui.sidebar      import Sidebar
from ui.main_content import MainContent
from utils.helpers   import MONTHS_PT, APP_NAME, APP_VERSION


class FinanceApp(ctk.CTkFrame):
    def __init__(self, parent, user_email: str = "", on_logout: Callable = None):
        super().__init__(parent, corner_radius=0, fg_color=T.BG)
        self.user_email  = user_email
        self._on_logout  = on_logout

        self._current_id:   int | None = None
        self._main_content: MainContent | None = None
        self._placeholder:  ctk.CTkFrame | None = None

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build()
        self._load_months()

    # ------------------------------------------------------------------
    def _build(self) -> None:
        self._sidebar = Sidebar(
            self,
            on_select = self._select_month,
            on_add    = self._add_month,
            on_delete = self._delete_month,
            on_theme  = self._on_theme_change,
            on_logout = self._logout,
            user_email = self.user_email,
        )
        self._sidebar.grid(row=0, column=0, sticky="nsew")

        self._placeholder = self._make_placeholder()
        self._placeholder.grid(row=0, column=1, sticky="nsew")

    def _make_placeholder(self) -> ctk.CTkFrame:
        frame = ctk.CTkFrame(self, fg_color=T.BG)
        frame.grid_rowconfigure(0, weight=1)
        frame.grid_columnconfigure(0, weight=1)
        box = ctk.CTkFrame(frame, fg_color="transparent")
        box.grid(row=0, column=0)
        ctk.CTkLabel(box, text=APP_NAME,
                     font=F(28, "bold"), text_color=T.TEXT).pack(pady=(0, 8))
        ctk.CTkLabel(
            box,
            text="Selecione um período na barra lateral\nou crie um novo para começar.",
            font=F(14), text_color=T.MUTED, justify="center",
        ).pack()
        return frame

    # ------------------------------------------------------------------
    def _load_months(self) -> None:
        def fetch():
            try:
                months = db.get_months()
                self.after(0, lambda: self._apply_months(months))
            except Exception:
                pass
        threading.Thread(target=fetch, daemon=True).start()

    def _apply_months(self, months: list) -> None:
        self._sidebar.update_months(months)

        # Re-select after theme rebuild if we have a pending id
        if hasattr(self, "_pending_theme_id") and self._pending_theme_id is not None:
            for m in months:
                if m["id"] == self._pending_theme_id:
                    self._select_month(m["id"], m["name"])
                    break
            self._pending_theme_id = None
            return

        now  = datetime.now()
        name = f"{MONTHS_PT[now.month - 1]} {now.year}"
        for m in months:
            if m["name"] == name:
                self._select_month(m["id"], m["name"])
                return

    # ------------------------------------------------------------------
    def _select_month(self, month_id: int, month_name: str) -> None:
        self._current_id = month_id
        self._sidebar.set_active_month(month_id)

        if db.is_cached(month_id):
            self._render_month(month_id, month_name)
        else:
            def fetch():
                try:
                    db.get_transactions(month_id)
                except Exception:
                    pass
                self.after(0, lambda: self._render_month(month_id, month_name))
            threading.Thread(target=fetch, daemon=True).start()

    def _render_month(self, month_id: int, month_name: str) -> None:
        if self._placeholder:
            self._placeholder.grid_forget()
            try:
                self._placeholder.destroy()
            except Exception:
                pass
            self._placeholder = None

        if self._main_content:
            self._main_content.grid_forget()
            try:
                self._main_content.destroy()
            except Exception:
                pass

        try:
            self._main_content = MainContent(self, month_id, month_name)
            self._main_content.grid(row=0, column=1, sticky="nsew")
        except Exception:
            import traceback
            from tkinter import messagebox
            messagebox.showerror("Erro ao abrir mês", traceback.format_exc())

    # ------------------------------------------------------------------
    def _add_month(self) -> None:
        from tkinter import messagebox
        try:
            existing_names = {m["name"] for m in db.get_months()}
        except Exception:
            existing_names = set()
        dlg = _AddMonthDialog(self.winfo_toplevel(), existing_names)
        self.winfo_toplevel().wait_window(dlg)
        if dlg.result:
            name, year, month_num = dlg.result
            try:
                db.create_month(name, year, month_num)
                months = db.get_months()
                self._after_add_month(name, months)
            except Exception as e:
                messagebox.showerror("Erro ao criar período", str(e))

    def _after_add_month(self, name: str, months: list) -> None:
        self._sidebar.update_months(months)
        for m in months:
            if m["name"] == name:
                self._select_month(m["id"], m["name"])
                break

    # ------------------------------------------------------------------
    def _delete_month(self, month_id: int) -> None:
        dlg = _ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir período?",
            message="Todos os lançamentos deste período serão\npermanentemente excluídos.",
        )
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.confirmed:
            return

        db.delete_month(month_id)

        if self._current_id == month_id:
            self._current_id = None
            if self._main_content:
                self._main_content.grid_forget()
                self._main_content.destroy()
                self._main_content = None
            self._placeholder = self._make_placeholder()
            self._placeholder.grid(row=0, column=1, sticky="nsew")

        self._sidebar.update_months(db.get_months())

    # ------------------------------------------------------------------
    def _on_theme_change(self, theme_name: str) -> None:
        """Recria toda a UI com o novo tema."""
        self.after(30, lambda: self._rebuild_ui())

    def _rebuild_ui(self) -> None:
        saved_id = self._current_id

        # Destroy old widgets
        try:
            self._sidebar.destroy()
        except Exception:
            pass
        if self._main_content:
            try:
                self._main_content.destroy()
            except Exception:
                pass
            self._main_content = None
        if self._placeholder:
            try:
                self._placeholder.destroy()
            except Exception:
                pass
            self._placeholder = None

        # Update own background
        self.configure(fg_color=T.BG)

        # Rebuild
        self._current_id = None
        self._pending_theme_id = saved_id
        self._build()
        self._load_months()

    # ------------------------------------------------------------------
    def _logout(self) -> None:
        from config import get_client, clear_session
        try:
            get_client().auth.sign_out()
        except Exception:
            pass
        clear_session()
        db.clear_cache()
        self.destroy()
        if self._on_logout:
            self._on_logout()


# ──────────────────────────────────────────────────────────────────────
def _center_on_parent(dialog: ctk.CTkToplevel, parent, w: int, h: int) -> None:
    dialog.update_idletasks()
    px = parent.winfo_x() + (parent.winfo_width()  - w) // 2
    py = parent.winfo_y() + (parent.winfo_height() - h) // 2
    dialog.geometry(f"{w}x{h}+{px}+{py}")


class _AddMonthDialog(ctk.CTkToplevel):
    def __init__(self, parent, existing_names: set = None):
        super().__init__(parent)
        self.title("Novo Período")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self.result = None
        self._existing = existing_names or set()
        self._build()
        _center_on_parent(self, parent, 380, 240)
        self.lift()
        self.focus()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        now = datetime.now()

        ctk.CTkLabel(self, text="Selecione o Mês e o Ano",
                     font=F(15, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 14))

        row = ctk.CTkFrame(self, fg_color="transparent")
        row.grid(row=1, column=0, padx=28, sticky="ew")
        row.grid_columnconfigure((0, 1), weight=1)

        self._month_var = ctk.StringVar(value=MONTHS_PT[now.month - 1])
        ctk.CTkComboBox(
            row, values=MONTHS_PT, variable=self._month_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        ).grid(row=0, column=0, padx=(0, 6), sticky="ew")

        years = [str(y) for y in range(2020, 2041)]
        self._year_var = ctk.StringVar(value=str(now.year))
        ctk.CTkComboBox(
            row, values=years, variable=self._year_var,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8,
        ).grid(row=0, column=1, padx=(6, 0), sticky="ew")

        self._error_lbl = ctk.CTkLabel(self, text="", font=F(12), text_color=T.RED)
        self._error_lbl.grid(row=2, column=0, pady=(10, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=3, column=0, pady=16)

        ctk.CTkButton(
            btns, text="Cancelar", width=110,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, command=self.destroy,
        ).pack(side="left", padx=6)

        ctk.CTkButton(
            btns, text="Criar Período", width=130,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", command=self._create,
        ).pack(side="left", padx=6)

    def _create(self) -> None:
        month_name = self._month_var.get()
        year       = int(self._year_var.get())
        month_num  = MONTHS_PT.index(month_name) + 1
        full_name  = f"{month_name} {year}"
        if full_name in self._existing:
            self._error_lbl.configure(text=f"  {full_name} já existe.")
            return
        self.result = (full_name, year, month_num)
        self.destroy()


class _ConfirmDialog(ctk.CTkToplevel):
    def __init__(self, parent, title: str, message: str):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self.confirmed = False
        self._build(title, message)
        _center_on_parent(self, parent, 380, 180)
        self.lift()
        self.focus()

    def _build(self, title: str, message: str) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text=title, font=F(15, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 6))
        ctk.CTkLabel(self, text=message, font=F(13), text_color=T.MUTED,
                     justify="center").grid(row=1, column=0, pady=(0, 12))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=2, column=0, pady=10)

        ctk.CTkButton(
            btns, text="Cancelar", width=110,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(13), command=self.destroy,
        ).pack(side="left", padx=6)

        ctk.CTkButton(
            btns, text="Excluir", width=110,
            fg_color=T.RED, hover_color="#e05555",
            text_color="#ffffff", font=F(13, "bold"), command=self._confirm,
        ).pack(side="left", padx=6)

    def _confirm(self) -> None:
        self.confirmed = True
        self.destroy()
