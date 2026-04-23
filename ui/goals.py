"""Aba de Metas: criar metas de poupança e acompanhar progresso."""
import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import format_currency


class GoalsTab(ctk.CTkFrame):
    def __init__(self, parent):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self._build_form()
        self._build_list()

    # ------------------------------------------------------------------
    def _build_form(self) -> None:
        form = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        form.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 0))
        form.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(form, text="Nova Meta de Poupança",
                     font=F(13, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, columnspan=3, padx=18, pady=(14, 8), sticky="w")

        ctk.CTkLabel(form, text="NOME DA META", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, padx=(18, 6), sticky="w")
        ctk.CTkLabel(form, text="VALOR ALVO (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=1, padx=6, sticky="w")

        self._name_entry = ctk.CTkEntry(
            form, placeholder_text="Ex: Reserva de emergência, Viagem…",
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._name_entry.grid(row=2, column=0, padx=(18, 6), pady=(4, 0), sticky="ew")
        self._name_entry.bind("<Return>", lambda _: self._target_entry.focus())

        self._target_entry = ctk.CTkEntry(
            form, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=8,
        )
        self._target_entry.grid(row=2, column=1, padx=6, pady=(4, 0), sticky="ew")
        self._target_entry.bind("<Return>", lambda _: self._create_goal())

        ctk.CTkButton(
            form, text="+ Criar Meta", command=self._create_goal,
            height=36, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff",
        ).grid(row=2, column=2, padx=(6, 18), pady=(4, 0), sticky="ew")

        self._error_lbl = ctk.CTkLabel(
            form, text="", font=F(11), text_color=T.RED, anchor="w")
        self._error_lbl.grid(row=3, column=0, columnspan=3,
                             padx=18, pady=(6, 12), sticky="w")

    def _build_list(self) -> None:
        wrapper = ctk.CTkFrame(self, fg_color="transparent")
        wrapper.grid(row=1, column=0, sticky="nsew", padx=28, pady=(14, 24))
        wrapper.grid_columnconfigure(0, weight=1)
        wrapper.grid_rowconfigure(1, weight=1)

        self._count_lbl = ctk.CTkLabel(
            wrapper, text="0 metas", font=F(13), text_color=T.MUTED, anchor="w")
        self._count_lbl.grid(row=0, column=0, sticky="w", pady=(0, 10))

        self._scroll = ctk.CTkScrollableFrame(
            wrapper, fg_color="transparent",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._scroll.grid(row=1, column=0, sticky="nsew")
        self._scroll.grid_columnconfigure(0, weight=1)

    # ------------------------------------------------------------------
    def _create_goal(self) -> None:
        name = self._name_entry.get().strip()
        raw  = self._target_entry.get().strip().replace(",", ".")
        if not name:
            self._error_lbl.configure(text="  Preencha o nome da meta.")
            return
        try:
            target = float(raw)
            if target <= 0:
                raise ValueError
        except ValueError:
            self._error_lbl.configure(text="  Digite um valor alvo positivo.")
            return
        self._error_lbl.configure(text="")
        try:
            db.create_goal(name, target)
        except Exception as e:
            self._error_lbl.configure(text=f"  Erro: {str(e)[:60]}")
            return
        self._name_entry.delete(0, "end")
        self._target_entry.delete(0, "end")
        self.refresh()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        import threading
        for w in self._scroll.winfo_children():
            w.destroy()
        ctk.CTkLabel(self._scroll, text="Carregando metas…",
                     font=F(13), text_color=T.MUTED).pack(pady=40)

        def _fetch():
            try:
                goals = db.get_goals()
            except Exception:
                goals = []
            self.after(0, lambda: self._apply_goals(goals))

        threading.Thread(target=_fetch, daemon=True).start()

    def _apply_goals(self, goals: list) -> None:
        for w in self._scroll.winfo_children():
            w.destroy()

        n = len(goals)
        self._count_lbl.configure(text=f"{n} {'meta' if n == 1 else 'metas'}")

        if not goals:
            ctk.CTkLabel(
                self._scroll,
                text="Nenhuma meta criada. Adicione uma acima ↑",
                font=F(13), text_color=T.MUTED,
            ).pack(pady=40)
            return

        for goal in goals:
            self._make_goal_card(goal)

    def _make_goal_card(self, goal: dict) -> None:
        target = float(goal["target_amount"] or 0)
        saved  = float(goal["saved_amount"]  or 0)
        pct    = min(1.0, saved / target) if target > 0 else 0.0
        done   = pct >= 1.0

        color     = T.GREEN if done else T.BLUE
        dim_color = T.GREEN_DIM if done else T.BLUE_DIM

        card = ctk.CTkFrame(self._scroll, fg_color=T.CARD, corner_radius=12,
                            border_width=1, border_color=T.BORDER)
        card.pack(fill="x", pady=(0, 10))
        card.grid_columnconfigure(0, weight=1)

        hdr = ctk.CTkFrame(card, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 4))
        hdr.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(hdr, text=goal["name"],
                     font=F(15, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w")

        status = "Concluída!" if done else f"{pct * 100:.1f}%"
        ctk.CTkLabel(hdr, text=status,
                     font=F(14, "bold"), text_color=color, anchor="e").grid(
            row=0, column=1, sticky="e", padx=(10, 0))

        ctk.CTkLabel(
            card,
            text=f"{format_currency(saved)}  de  {format_currency(target)}",
            font=F(12), text_color=T.MUTED, anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=20, pady=(0, 10))

        bar_bg = ctk.CTkFrame(card, height=10, fg_color=T.CARD2, corner_radius=5)
        bar_bg.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 14))
        bar_bg.grid_propagate(False)
        bar_bg.update_idletasks()
        ctk.CTkFrame(bar_bg, height=10, fg_color=color, corner_radius=5).place(
            x=0, y=0, relheight=1, relwidth=pct)

        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=3, column=0, sticky="ew", padx=20, pady=(0, 14))

        ctk.CTkButton(
            actions, text="+ Aportar",
            command=lambda gid=goal["id"], gname=goal["name"]: self._add_contribution(gid, gname),
            height=32, corner_radius=8,
            fg_color=dim_color, hover_color=color,
            text_color=color,
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            actions, text="Excluir",
            command=lambda gid=goal["id"]: self._delete_goal(gid),
            height=32, corner_radius=8,
            fg_color="transparent", hover_color=T.RED,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED,
        ).pack(side="left")

    # ------------------------------------------------------------------
    def _add_contribution(self, goal_id: int, goal_name: str) -> None:
        dlg = _ContributionDialog(self.winfo_toplevel(), goal_name)
        self.winfo_toplevel().wait_window(dlg)
        if dlg.amount is not None:
            try:
                db.add_goal_contribution(goal_id, dlg.amount)
                self.refresh()
            except Exception as e:
                from tkinter import messagebox
                messagebox.showerror("Erro", str(e))

    def _delete_goal(self, goal_id: int) -> None:
        from tkinter import messagebox
        if not messagebox.askyesno("Excluir meta?", "Esta ação é irreversível. Confirmar?"):
            return
        try:
            db.delete_goal(goal_id)
            self.refresh()
        except Exception as e:
            messagebox.showerror("Erro", str(e))


# ──────────────────────────────────────────────────────────────────────
class _ContributionDialog(ctk.CTkToplevel):
    def __init__(self, parent, goal_name: str):
        super().__init__(parent)
        self.title("Aportar")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self.amount = None
        self._build(goal_name)
        self._center(parent)
        self.lift(); self.focus()
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
        px = parent.winfo_x() + (parent.winfo_width()  - 360) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 220) // 2
        self.geometry(f"360x220+{px}+{py}")

    def _build(self, goal_name: str) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text=f"Aportar em: {goal_name}",
                     font=F(14, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(24, 4))
        ctk.CTkLabel(self, text="VALOR (R$)", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=1, column=0)

        self._entry = ctk.CTkEntry(
            self, placeholder_text="0,00", width=200,
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._entry.grid(row=2, column=0, pady=(4, 0))
        self._entry.bind("<Return>", lambda _: self._confirm())
        self._entry.focus()

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=3, column=0, pady=(6, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=4, column=0, pady=12)

        ctk.CTkButton(btns, text="Cancelar", width=100,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)

        ctk.CTkButton(btns, text="Confirmar", width=110,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        raw = self._entry.get().strip().replace(",", ".")
        try:
            val = float(raw)
            if val <= 0:
                raise ValueError
        except ValueError:
            self._err.configure(text="Digite um valor positivo.")
            return
        self.amount = val
        self.destroy()
