"""Aba de Metas: criar metas de poupança (livres ou com recorrência mensal) e acompanhar progresso."""
import customtkinter as ctk
from datetime import datetime
from typing import Callable, Optional

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import format_currency, apply_app_icon, MONTHS_PT, month_name_from_num

_ST_COLOR = {"pendente": "GOLD", "atrasada": "RED", "paga": "MUTED"}


def _parse_amount(raw: str) -> float:
    raw = raw.strip().replace(".", "").replace(",", ".") if raw.count(",") else raw.strip().replace(",", ".")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


def _installment_sort_key(inst: dict) -> tuple:
    return (inst["due_year"], inst["due_month"], inst.get("due_day") or 0, inst["installment_number"])


def _installment_status(inst: dict) -> str:
    from datetime import date
    if inst.get("contributed_at"):
        return "paga"
    today = date.today()
    due_day = inst.get("due_day")
    if due_day:
        if date(inst["due_year"], inst["due_month"], due_day) < today:
            return "atrasada"
    elif (inst["due_year"], inst["due_month"]) < (today.year, today.month):
        return "atrasada"
    return "pendente"


def _installment_label(inst: dict) -> str:
    due_day = inst.get("due_day")
    if due_day:
        return f"{due_day:02d}/{inst['due_month']:02d}/{inst['due_year']}"
    return month_name_from_num(inst["due_month"], inst["due_year"])


class GoalsTab(ctk.CTkFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(parent, fg_color=T.BG, corner_radius=0)
        self._on_change = on_change
        self._insts: list = []
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
        ).grid(row=2, column=2, padx=(6, 6), pady=(4, 0), sticky="ew")

        ctk.CTkButton(
            form, text="↻  Meta com cronograma (mensal ou personalizado)", command=self._new_recurring_goal,
            height=32, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
        ).grid(row=3, column=0, columnspan=3, padx=18, pady=(10, 4), sticky="ew")

        self._error_lbl = ctk.CTkLabel(
            form, text="", font=F(11), text_color=T.RED, anchor="w")
        self._error_lbl.grid(row=4, column=0, columnspan=3,
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
        if self._on_change:
            self._on_change()

    def _new_recurring_goal(self) -> None:
        dlg = _RecurringGoalDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        r = dlg.result
        try:
            if r["schedule_type"] == "custom":
                db.create_custom_goal(r["name"], r["target_amount"], r["installments"])
            else:
                db.create_recurring_goal(r["name"], r["target_amount"],
                                         r["monthly_amount"], r["installments"])
            self.refresh()
            if self._on_change:
                self._on_change()
        except Exception as e:
            from ui.dialogs import show_error
            show_error(self.winfo_toplevel(), "Erro ao criar meta", str(e))

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
                insts = db.get_all_goal_installments()
            except Exception:
                goals, insts = [], []
            self.after(0, lambda: self._apply_goals(goals, insts))

        threading.Thread(target=_fetch, daemon=True).start()

    def _apply_goals(self, goals: list, insts: list) -> None:
        self._insts = insts
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
            goal_insts = [i for i in insts if i["goal_id"] == goal["id"]]
            self._make_goal_card(goal, goal_insts)

    def _make_goal_card(self, goal: dict, insts: list) -> None:
        target = goal.get("target_amount")
        target = float(target) if target is not None else None
        saved  = float(goal["saved_amount"] or 0)
        pct    = min(1.0, saved / target) if target and target > 0 else 0.0
        done   = target is not None and pct >= 1.0

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

        if target is not None:
            status = "Concluída!" if done else f"{pct * 100:.1f}%"
            ctk.CTkLabel(hdr, text=status,
                         font=F(14, "bold"), text_color=color, anchor="e").grid(
                row=0, column=1, sticky="e", padx=(10, 0))

        if target is not None:
            info_text = f"{format_currency(saved)}  de  {format_currency(target)}"
        else:
            info_text = f"{format_currency(saved)}  guardados até agora"
        ctk.CTkLabel(
            card, text=info_text, font=F(12), text_color=T.MUTED, anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=20, pady=(0, 10))

        if target is not None:
            bar_bg = ctk.CTkFrame(card, height=10, fg_color=T.CARD2, corner_radius=5)
            bar_bg.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 14))
            bar_bg.grid_propagate(False)
            ctk.CTkFrame(bar_bg, height=10, fg_color=color, corner_radius=5).place(
                x=0, y=0, relheight=1, relwidth=pct)

        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.grid(row=3, column=0, sticky="ew", padx=20, pady=(0, 14))

        is_recurring = bool(goal.get("monthly_amount"))
        is_custom    = goal.get("schedule_type") == "custom"

        if not is_recurring and not is_custom:
            ctk.CTkButton(
                actions, text="+ Aportar",
                command=lambda gid=goal["id"], gname=goal["name"]: self._add_contribution(gid, gname),
                height=32, corner_radius=8,
                fg_color=dim_color, hover_color=color,
                text_color=color,
            ).pack(side="left", padx=(0, 8))

            ctk.CTkButton(
                actions, text="− Sacar",
                command=lambda gid=goal["id"], gname=goal["name"]: self._withdraw_goal(gid, gname),
                height=32, corner_radius=8,
                fg_color=T.RED_DIM, hover_color=T.RED,
                text_color=T.RED, border_width=1, border_color=T.RED,
            ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            actions, text="✎ Editar",
            command=lambda g=goal: self._edit_goal(g),
            height=32, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED,
        ).pack(side="left", padx=(0, 8))

        ctk.CTkButton(
            actions, text="Excluir",
            command=lambda gid=goal["id"]: self._delete_goal(gid),
            height=32, corner_radius=8,
            fg_color="transparent", hover_color=T.RED,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED,
        ).pack(side="left")

        if is_recurring or is_custom:
            if is_custom and target is not None:
                scheduled = sum(float(i["amount"]) for i in insts)
                ctk.CTkLabel(
                    card,
                    text=f"Cronograma: {format_currency(scheduled)}  de  {format_currency(target)}  planejados",
                    font=F(11), text_color=T.MUTED, anchor="w",
                ).grid(row=4, column=0, sticky="w", padx=20, pady=(0, 6))

            rows_box = ctk.CTkFrame(card, fg_color="transparent")
            rows_box.grid(row=5, column=0, sticky="ew", padx=20, pady=(0, 14))
            rows_box.grid_columnconfigure(0, weight=1)
            for i in sorted(insts, key=_installment_sort_key):
                self._make_inst_row(rows_box, i)

            if is_custom:
                ctk.CTkButton(
                    card, text="+  Adicionar parcela",
                    command=lambda g=goal, ins=insts: self._add_custom_installment(g, ins),
                    height=28, corner_radius=7,
                    fg_color="transparent", hover_color=T.CARD2,
                    border_width=1, border_color=T.BORDER_L,
                    text_color=T.MUTED, font=F(11),
                ).grid(row=6, column=0, padx=20, pady=(0, 14), sticky="ew")
            else:
                ctk.CTkButton(
                    card, text="↻  Gerar mais meses",
                    command=lambda g=goal, ins=insts: self._generate_more(g, ins),
                    height=28, corner_radius=7,
                    fg_color="transparent", hover_color=T.CARD2,
                    border_width=1, border_color=T.BORDER_L,
                    text_color=T.MUTED, font=F(11),
                ).grid(row=6, column=0, padx=20, pady=(0, 14), sticky="ew")

    def _make_inst_row(self, parent, inst: dict) -> None:
        status = _installment_status(inst)
        color  = getattr(T, _ST_COLOR[status])

        row = ctk.CTkFrame(parent, fg_color=T.CARD2, corner_radius=8)
        row.pack(fill="x", pady=2)
        row.grid_columnconfigure(1, weight=1)

        paid_mark = "✓ " if status == "paga" else ""
        ctk.CTkLabel(
            row,
            text=f"{paid_mark}{format_currency(float(inst['amount']))}   •   "
                 f"{_installment_label(inst)}",
            font=F(12), text_color=T.MUTED if status == "paga" else T.TEXT,
            anchor="w",
        ).grid(row=0, column=1, sticky="w", padx=(10, 0))

        chip = ctk.CTkFrame(row, fg_color="transparent")
        chip.grid(row=0, column=2, padx=6)
        ctk.CTkFrame(chip, width=8, height=8, corner_radius=4,
                     fg_color=color).pack(side="left", padx=(0, 5))
        ctk.CTkLabel(chip, text=status, font=F(11, "bold"),
                     text_color=color).pack(side="left")

        btns = ctk.CTkFrame(row, fg_color="transparent")
        btns.grid(row=0, column=3, padx=(4, 8))
        if status == "paga":
            ctk.CTkButton(btns, text="Desfazer", width=80, height=26, corner_radius=6,
                          fg_color="transparent", hover_color=T.CARD,
                          border_width=1, border_color=T.BORDER_L,
                          text_color=T.MUTED, font=F(11),
                          command=lambda i=inst: self._undo_contribution(i)).pack(side="left", padx=2)
        else:
            ctk.CTkButton(btns, text="Guardado", width=76, height=26, corner_radius=6,
                          fg_color=T.GREEN_DIM, hover_color=T.GREEN,
                          text_color=T.GREEN, font=F(11, "bold"),
                          command=lambda i=inst: self._contribute(i)).pack(side="left", padx=2)
            ctk.CTkButton(btns, text="✎", width=28, height=26, corner_radius=6,
                          fg_color="transparent", hover_color=T.CARD,
                          text_color=T.SUBTLE, font=F(11),
                          command=lambda i=inst: self._edit_installment_amount(i)).pack(side="left", padx=2)
            ctk.CTkButton(btns, text="✕", width=28, height=26, corner_radius=6,
                          fg_color="transparent", hover_color=T.RED,
                          text_color=T.SUBTLE, font=F(11),
                          command=lambda i=inst: self._delete_installment(i)).pack(side="left", padx=2)

    # ------------------------------------------------------------------
    def _run(self, op) -> None:
        import threading
        def _work():
            err = None
            try:
                op()
            except Exception as e:
                err = e
            self.after(0, lambda: self._after_op(err))
        threading.Thread(target=_work, daemon=True).start()

    def _after_op(self, err) -> None:
        from ui.dialogs import show_error
        if err:
            show_error(self.winfo_toplevel(), "Erro", str(err)[:200])
            return
        self.refresh()
        if self._on_change:
            self._on_change()

    def _contribute(self, inst: dict) -> None:
        self._run(lambda: db.contribute_goal_installment(inst))

    def _undo_contribution(self, inst: dict) -> None:
        self._run(lambda: db.undo_goal_installment_contribution(inst))

    def _edit_installment_amount(self, inst: dict) -> None:
        dlg = _EditAmountDialog(self.winfo_toplevel(), float(inst["amount"]))
        self.winfo_toplevel().wait_window(dlg)
        if dlg.amount is not None:
            self._run(lambda: db.update_goal_installment_amount(inst, dlg.amount))

    def _delete_installment(self, inst: dict) -> None:
        from ui.dialogs import ConfirmDialog
        ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir mês?",
            message="Só este mês do cronograma será excluído.",
            confirm_text="Excluir",
            on_confirm=lambda: self._run(lambda: db.delete_goal_installment(inst)),
            danger=True,
        )

    def _generate_more(self, goal: dict, insts: list) -> None:
        dlg = _GenerateMoreDialog(self.winfo_toplevel(), goal, insts)
        self.winfo_toplevel().wait_window(dlg)
        if dlg.installments is not None:
            self._run(lambda: db.add_goal_installments(goal["id"], dlg.installments))

    def _add_custom_installment(self, goal: dict, insts: list) -> None:
        dlg = _AddCustomInstallmentDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dlg)
        if dlg.result is None:
            return
        next_number = (max((i["installment_number"] for i in insts), default=0) + 1)
        row = {**dlg.result, "number": next_number}
        self._run(lambda: db.add_goal_installments(goal["id"], [row]))

    # ------------------------------------------------------------------
    def _add_contribution(self, goal_id: int, goal_name: str) -> None:
        dlg = _ContributionDialog(self.winfo_toplevel(), goal_name, mode="aporte")
        self.winfo_toplevel().wait_window(dlg)
        if dlg.amount is not None:
            try:
                db.add_goal_contribution(goal_id, dlg.amount)
                self.refresh()
                if self._on_change:
                    self._on_change()
            except Exception as e:
                from ui.dialogs import show_error
                show_error(self.winfo_toplevel(), "Erro ao aportar", str(e))

    def _withdraw_goal(self, goal_id: int, goal_name: str) -> None:
        dlg = _ContributionDialog(self.winfo_toplevel(), goal_name, mode="saque")
        self.winfo_toplevel().wait_window(dlg)
        if dlg.amount is not None:
            try:
                db.add_goal_contribution(goal_id, -dlg.amount)
                self.refresh()
                if self._on_change:
                    self._on_change()
            except Exception as e:
                from ui.dialogs import show_error
                show_error(self.winfo_toplevel(), "Erro ao sacar", str(e))

    def _edit_goal(self, goal: dict) -> None:
        dlg = _EditGoalDialog(self.winfo_toplevel(), goal)
        self.winfo_toplevel().wait_window(dlg)
        if dlg.result:
            try:
                db.update_goal(goal["id"], dlg.result["name"], dlg.result["target_amount"])
                self.refresh()
                if self._on_change:
                    self._on_change()
            except Exception as e:
                from ui.dialogs import show_error
                show_error(self.winfo_toplevel(), "Erro ao editar", str(e))

    def _delete_goal(self, goal_id: int) -> None:
        from ui.dialogs import ConfirmDialog, show_error

        def do_delete():
            try:
                db.delete_goal(goal_id)
                self.refresh()
                if self._on_change:
                    self._on_change()
            except Exception as e:
                show_error(self.winfo_toplevel(), "Erro ao excluir", str(e))

        ConfirmDialog(
            self.winfo_toplevel(),
            title="Excluir meta?",
            message="Esta ação é irreversível. Confirmar?",
            confirm_text="Excluir",
            on_confirm=do_delete,
            danger=True,
        )


# ──────────────────────────────────────────────────────────────────────
class _ContributionDialog(ctk.CTkToplevel):
    def __init__(self, parent, goal_name: str, mode: str = "aporte"):
        super().__init__(parent)
        self._mode = mode
        self.title("Aportar" if mode == "aporte" else "Sacar")
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
        is_saque = self._mode == "saque"
        action   = "Sacar de" if is_saque else "Aportar em"
        color    = T.RED if is_saque else T.BLUE
        hover    = T.RED_HOVER if is_saque else T.BLUE_HOVER

        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text=f"{action}: {goal_name}",
                     font=F(14, "bold"), text_color=color).grid(
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
                      fg_color=color, hover_color=hover,
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


# ──────────────────────────────────────────────────────────────────────
class _EditGoalDialog(ctk.CTkToplevel):
    def __init__(self, parent, goal: dict):
        super().__init__(parent)
        self.title("Editar Meta")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        self.result: Optional[dict] = None
        self._build(goal)
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
        px = parent.winfo_x() + (parent.winfo_width()  - 380) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 270) // 2
        self.geometry(f"380x270+{px}+{py}")

    def _build(self, goal: dict) -> None:
        self.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self, text="Editar Meta",
                     font=F(14, "bold"), text_color=T.TEXT).grid(
            row=0, column=0, pady=(22, 4))

        ctk.CTkLabel(self, text="NOME DA META", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=1, column=0, padx=28, sticky="w")
        self._name_entry = ctk.CTkEntry(
            self, width=320,
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._name_entry.grid(row=2, column=0, pady=(2, 0), padx=28)
        self._name_entry.insert(0, goal.get("name", ""))
        self._name_entry.bind("<Return>", lambda _: self._target_entry.focus())

        ctk.CTkLabel(self, text="VALOR ALVO (R$) — opcional", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=3, column=0, padx=28, pady=(10, 0), sticky="w")
        self._target_entry = ctk.CTkEntry(
            self, width=320, placeholder_text="Deixe em branco pra sem alvo definido",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._target_entry.grid(row=4, column=0, pady=(2, 0), padx=28)
        if goal.get("target_amount") is not None:
            self._target_entry.insert(0, str(float(goal["target_amount"])).rstrip("0").rstrip("."))
        self._target_entry.bind("<Return>", lambda _: self._confirm())

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=5, column=0, pady=(6, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=6, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Salvar", width=110,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        name = self._name_entry.get().strip()
        if not name:
            self._err.configure(text="Preencha o nome da meta.")
            return
        raw = self._target_entry.get().strip().replace(",", ".")
        target = None
        if raw:
            try:
                target = float(raw)
                if target <= 0:
                    raise ValueError
            except ValueError:
                self._err.configure(text="Digite um valor alvo positivo, ou deixe em branco.")
                return
        self.result = {"name": name, "target_amount": target}
        self.destroy()


# ──────────────────────────────────────────────────────────────────────
class _RecurringGoalDialog(ctk.CTkToplevel):
    """Cadastro de meta com cronograma — Mensal (valor fixo, 1 parcela por
    mês) ou Personalizado (parcelas com qualquer dia e qualquer valor).
    Valor alvo é opcional nos dois modos (deixe em branco pra sem fim)."""

    def __init__(self, parent):
        super().__init__(parent)
        self.title("Nova Meta com Cronograma")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self.result: Optional[dict] = None
        self._mode = "monthly"
        self._preview_rows: list = []
        self._custom_rows: list = []
        self._custom_row_counter = 0
        self._build()
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width()  - 560) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 660) // 2
        self.geometry(f"560x660+{px}+{py}")
        self.lift(); self.focus()

    def _entry(self, parent, placeholder: str = "", width=None) -> ctk.CTkEntry:
        kw = dict(fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
                  placeholder_text_color=T.SUBTLE, corner_radius=8,
                  placeholder_text=placeholder)
        if width:
            kw["width"] = width
        return ctk.CTkEntry(parent, **kw)

    def _combo(self, parent, values, width=None) -> ctk.CTkComboBox:
        kw = dict(values=values, fg_color=T.CARD2, border_color=T.BORDER_L,
                  text_color=T.TEXT, button_color=T.CARD2,
                  button_hover_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
                  dropdown_text_color=T.TEXT, dropdown_hover_color=T.BORDER_L,
                  corner_radius=8, state="readonly")
        if width:
            kw["width"] = width
        return ctk.CTkComboBox(parent, **kw)

    def _build(self) -> None:
        self.grid_columnconfigure((0, 1), weight=1)

        def _lbl(parent, text, row, col, colspan=1, pady=(10, 0)):
            ctk.CTkLabel(parent, text=text, font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=row, column=col, columnspan=colspan,
                padx=24, pady=pady, sticky="w")

        ctk.CTkLabel(self, text="Nova Meta", font=F(15, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, columnspan=2, pady=(18, 0))

        toggle = ctk.CTkFrame(self, fg_color="transparent")
        toggle.grid(row=1, column=0, columnspan=2, padx=24, pady=(12, 0), sticky="ew")
        toggle.grid_columnconfigure((0, 1), weight=1)
        self._btn_monthly = ctk.CTkButton(
            toggle, text="Mensal", height=32, corner_radius=8,
            command=lambda: self._set_mode("monthly"))
        self._btn_monthly.grid(row=0, column=0, padx=(0, 4), sticky="ew")
        self._btn_custom = ctk.CTkButton(
            toggle, text="Personalizado", height=32, corner_radius=8,
            command=lambda: self._set_mode("custom"))
        self._btn_custom.grid(row=0, column=1, padx=(4, 0), sticky="ew")

        _lbl(self, "NOME DA META *", 2, 0, colspan=2)
        self._name = self._entry(self, "Ex: Viagem, Reserva de emergência…")
        self._name.grid(row=3, column=0, columnspan=2, padx=24, sticky="ew")

        _lbl(self, "VALOR ALVO (R$) — opcional", 4, 0, colspan=2)
        self._target = self._entry(self, "Deixe em branco pra sem alvo definido")
        self._target.grid(row=5, column=0, columnspan=2, padx=24, sticky="ew")

        self._schedule_container = ctk.CTkFrame(self, fg_color="transparent")
        self._schedule_container.grid(row=6, column=0, columnspan=2, sticky="ew")
        self._schedule_container.grid_columnconfigure(0, weight=1)

        self._build_monthly_section(_lbl)
        self._build_custom_section(_lbl)
        self._set_mode("monthly")

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=7, column=0, columnspan=2, padx=24, pady=(6, 0), sticky="w")

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=8, column=0, columnspan=2, pady=(8, 16))
        ctk.CTkButton(btns, text="Cancelar", width=110,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Salvar meta", width=130,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._save).pack(side="left", padx=6)

    def _set_mode(self, mode: str) -> None:
        self._mode = mode
        if mode == "monthly":
            self._custom_frame.grid_remove()
            self._monthly_frame.grid(row=0, column=0, sticky="ew")
            self._btn_monthly.configure(fg_color=T.BLUE, text_color="#ffffff", hover_color=T.BLUE_HOVER)
            self._btn_custom.configure(fg_color=T.CARD2, text_color=T.MUTED, hover_color=T.BORDER_L)
        else:
            self._monthly_frame.grid_remove()
            self._custom_frame.grid(row=0, column=0, sticky="ew")
            self._btn_custom.configure(fg_color=T.BLUE, text_color="#ffffff", hover_color=T.BLUE_HOVER)
            self._btn_monthly.configure(fg_color=T.CARD2, text_color=T.MUTED, hover_color=T.BORDER_L)
        self._err.configure(text="")

    # ── Modo Mensal (comportamento existente, inalterado) ───────────────
    def _build_monthly_section(self, _lbl) -> None:
        now = datetime.now()
        f = self._monthly_frame = ctk.CTkFrame(self._schedule_container, fg_color="transparent")
        f.grid_columnconfigure((0, 1), weight=1)

        _lbl(f, "VALOR MENSAL (R$) *", 0, 0)
        _lbl(f, "MESES A GERAR AGORA", 0, 1)
        self._monthly = self._entry(f, "0,00")
        self._monthly.grid(row=1, column=0, padx=(24, 6), sticky="ew")
        self._n_parc = self._combo(f, [str(n) for n in range(1, 37)])
        self._n_parc.set("12")
        self._n_parc.grid(row=1, column=1, padx=(6, 24), sticky="ew")

        _lbl(f, "PRIMEIRO MÊS *", 2, 0, colspan=2)
        mrow = ctk.CTkFrame(f, fg_color="transparent")
        mrow.grid(row=3, column=0, columnspan=2, padx=24, sticky="ew")
        mrow.grid_columnconfigure((0, 1), weight=1)
        self._month = self._combo(mrow, MONTHS_PT)
        self._month.set(MONTHS_PT[now.month - 1])
        self._month.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        self._year = self._combo(mrow, [str(y) for y in range(2020, 2041)])
        self._year.set(str(now.year))
        self._year.grid(row=0, column=1, padx=(6, 0), sticky="ew")

        ctk.CTkButton(
            f, text="↻  Gerar parcelas", command=self._gen_preview,
            height=32, corner_radius=8,
            fg_color=T.GREEN_DIM, hover_color=T.GREEN, text_color=T.GREEN,
        ).grid(row=4, column=0, columnspan=2, padx=24, pady=(12, 4), sticky="ew")

        self._preview = ctk.CTkScrollableFrame(
            f, fg_color=T.CARD2, corner_radius=10, height=150,
            scrollbar_button_color=T.BORDER_L,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._preview.grid(row=5, column=0, columnspan=2, padx=24, sticky="ew")
        self._preview.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self._preview,
                     text="Clique em “Gerar parcelas” para visualizar.",
                     font=F(11), text_color=T.SUBTLE).grid(row=0, column=0, pady=14)

    def _gen_preview(self) -> None:
        monthly = _parse_amount(self._monthly.get())
        if monthly <= 0:
            self._err.configure(text="Informe o valor mensal antes de gerar as parcelas.")
            return
        self._err.configure(text="")
        n = int(self._n_parc.get())
        y = int(self._year.get())
        m = MONTHS_PT.index(self._month.get()) + 1

        for w in self._preview.winfo_children():
            w.destroy()
        self._preview_rows = []
        for k in range(n):
            row = ctk.CTkFrame(self._preview, fg_color="transparent")
            row.grid(row=k, column=0, sticky="ew", pady=2)
            row.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(row, text=f"{k + 1}/{n}  •  {month_name_from_num(m, y)}",
                         font=F(11), text_color=T.TEXT, anchor="w").grid(
                row=0, column=0, padx=(8, 6), sticky="w")
            e = self._entry(row, width=110)
            e.insert(0, f"{monthly:.2f}".replace(".", ","))
            e.grid(row=0, column=1, padx=(0, 8))
            self._preview_rows.append({"entry": e, "year": y, "month": m, "number": k + 1})
            m += 1
            if m > 12:
                m = 1
                y += 1

    # ── Modo Personalizado (novo) ────────────────────────────────────────
    def _build_custom_section(self, _lbl) -> None:
        f = self._custom_frame = ctk.CTkFrame(self._schedule_container, fg_color="transparent")
        f.grid_columnconfigure(0, weight=1)

        _lbl(f, "PARCELAS (QUALQUER DIA, QUALQUER VALOR)", 0, 0)
        self._custom_list = ctk.CTkScrollableFrame(
            f, fg_color=T.CARD2, corner_radius=10, height=220,
            scrollbar_button_color=T.BORDER_L,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._custom_list.grid(row=1, column=0, padx=24, pady=(4, 0), sticky="ew")
        self._custom_list.grid_columnconfigure(0, weight=1)

        ctk.CTkButton(
            f, text="+  Adicionar parcela", command=self._add_custom_row,
            height=32, corner_radius=8,
            fg_color=T.GREEN_DIM, hover_color=T.GREEN, text_color=T.GREEN,
        ).grid(row=2, column=0, padx=24, pady=(8, 4), sticky="ew")

        self._add_custom_row()

    def _add_custom_row(self) -> None:
        now = datetime.now()
        row_idx = self._custom_row_counter
        self._custom_row_counter += 1

        row = ctk.CTkFrame(self._custom_list, fg_color="transparent")
        row.grid(row=row_idx, column=0, sticky="ew", pady=2)

        day = self._combo(row, [str(d) for d in range(1, 32)], width=55)
        day.set(str(now.day))
        day.pack(side="left", padx=(4, 2))
        month = self._combo(row, MONTHS_PT, width=95)
        month.set(MONTHS_PT[now.month - 1])
        month.pack(side="left", padx=2)
        year = self._combo(row, [str(y) for y in range(2020, 2041)], width=68)
        year.set(str(now.year))
        year.pack(side="left", padx=2)
        amount = self._entry(row, "0,00", width=90)
        amount.pack(side="left", padx=(2, 4))

        entry = {"frame": row, "day": day, "month": month, "year": year, "amount": amount}
        ctk.CTkButton(
            row, text="✕", width=26, height=26, corner_radius=6,
            fg_color="transparent", hover_color=T.RED, text_color=T.SUBTLE, font=F(11),
            command=lambda: self._remove_custom_row(entry),
        ).pack(side="left", padx=(2, 4))

        self._custom_rows.append(entry)

    def _remove_custom_row(self, entry: dict) -> None:
        if len(self._custom_rows) <= 1:
            return
        entry["frame"].destroy()
        self._custom_rows.remove(entry)

    # ── Salvar ───────────────────────────────────────────────────────────
    def _save(self) -> None:
        name = self._name.get().strip()
        if not name:
            self._err.configure(text="Preencha o nome da meta.")
            return

        target_raw = self._target.get().strip()
        target = _parse_amount(target_raw) if target_raw else None
        if target is not None and target <= 0:
            target = None

        if self._mode == "monthly":
            monthly = _parse_amount(self._monthly.get())
            if monthly <= 0:
                self._err.configure(text="Informe um valor mensal positivo.")
                return
            if not self._preview_rows:
                self._gen_preview()
                if not self._preview_rows:
                    return
            installments = [{
                "number": r["number"],
                "amount": _parse_amount(r["entry"].get()),
                "year":   r["year"],
                "month":  r["month"],
            } for r in self._preview_rows]
            self.result = {
                "schedule_type": "monthly", "name": name, "target_amount": target,
                "monthly_amount": monthly, "installments": installments,
            }
        else:
            installments = []
            for i, r in enumerate(self._custom_rows, start=1):
                amount = _parse_amount(r["amount"].get())
                if amount <= 0:
                    self._err.configure(text="Todas as parcelas precisam de um valor positivo.")
                    return
                installments.append({
                    "number": i, "amount": amount,
                    "day":    int(r["day"].get()),
                    "month":  MONTHS_PT.index(r["month"].get()) + 1,
                    "year":   int(r["year"].get()),
                })
            if not installments:
                self._err.configure(text="Adicione ao menos uma parcela.")
                return
            self.result = {
                "schedule_type": "custom", "name": name, "target_amount": target,
                "monthly_amount": None, "installments": installments,
            }
        self.destroy()


# ──────────────────────────────────────────────────────────────────────
class _GenerateMoreDialog(ctk.CTkToplevel):
    """Gera mais N meses pra uma meta recorrente, continuando a partir do
    último mês já cadastrado."""

    def __init__(self, parent, goal: dict, insts: list):
        super().__init__(parent)
        self.title("Gerar mais meses")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self.installments: Optional[list] = None
        self._goal, self._insts = goal, insts
        self._build()
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width()  - 340) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 220) // 2
        self.geometry(f"340x220+{px}+{py}")
        self.lift(); self.focus()

    def _build(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text=f"Gerar mais meses\n{self._goal['name']}",
                     font=F(14, "bold"), text_color=T.TEXT, justify="center").grid(
            row=0, column=0, pady=(22, 8))

        ctk.CTkLabel(self, text="QUANTOS MESES", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=1, column=0)
        self._n = ctk.CTkComboBox(
            self, values=[str(n) for n in range(1, 25)],
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.CARD2, button_hover_color=T.BORDER_L,
            dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
            corner_radius=8, state="readonly", width=140,
        )
        self._n.set("12")
        self._n.grid(row=2, column=0, pady=(4, 0))

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=3, column=0, pady=(8, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=4, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", width=100,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Gerar", width=110,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        if not self._insts:
            self._err.configure(text="Meta sem parcela existente pra continuar.")
            return
        monthly = float(self._goal.get("monthly_amount") or 0)
        last = max(self._insts, key=lambda i: (i["due_year"], i["due_month"], i["installment_number"]))
        y, m = last["due_year"], last["due_month"]
        next_number = max(i["installment_number"] for i in self._insts) + 1
        n = int(self._n.get())

        rows = []
        for k in range(n):
            m += 1
            if m > 12:
                m = 1
                y += 1
            rows.append({"number": next_number + k, "amount": monthly, "year": y, "month": m})
        self.installments = rows
        self.destroy()


# ──────────────────────────────────────────────────────────────────────
class _AddCustomInstallmentDialog(ctk.CTkToplevel):
    """Adiciona uma parcela avulsa a uma meta de cronograma personalizado
    — qualquer dia, qualquer valor."""

    def __init__(self, parent):
        super().__init__(parent)
        self.title("Adicionar parcela")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self.result: Optional[dict] = None
        self._build()
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width()  - 340) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 320) // 2
        self.geometry(f"340x320+{px}+{py}")
        self.lift(); self.focus()

    def _build(self) -> None:
        now = datetime.now()
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Adicionar parcela", font=F(14, "bold"),
                     text_color=T.TEXT).grid(row=0, column=0, pady=(22, 8))

        ctk.CTkLabel(self, text="DATA", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=1, column=0)
        drow = ctk.CTkFrame(self, fg_color="transparent")
        drow.grid(row=2, column=0, pady=(4, 0))
        self._day = ctk.CTkComboBox(
            drow, values=[str(d) for d in range(1, 32)], width=70,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.CARD2, button_hover_color=T.BORDER_L,
            dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
            corner_radius=8, state="readonly",
        )
        self._day.set(str(now.day))
        self._day.pack(side="left", padx=(0, 4))
        self._month = ctk.CTkComboBox(
            drow, values=MONTHS_PT, width=130,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.CARD2, button_hover_color=T.BORDER_L,
            dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
            corner_radius=8, state="readonly",
        )
        self._month.set(MONTHS_PT[now.month - 1])
        self._month.pack(side="left", padx=4)
        self._year = ctk.CTkComboBox(
            drow, values=[str(y) for y in range(2020, 2041)], width=90,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.CARD2, button_hover_color=T.BORDER_L,
            dropdown_fg_color=T.CARD2, dropdown_text_color=T.TEXT,
            corner_radius=8, state="readonly",
        )
        self._year.set(str(now.year))
        self._year.pack(side="left", padx=(4, 0))

        ctk.CTkLabel(self, text="VALOR (R$)", font=F(11, "bold"),
                     text_color=T.MUTED).grid(row=3, column=0, pady=(14, 0))
        self._amount = ctk.CTkEntry(
            self, width=180, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._amount.grid(row=4, column=0, pady=(4, 0))
        self._amount.bind("<Return>", lambda _: self._confirm())

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=5, column=0, pady=(8, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=6, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", width=100,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Adicionar", width=110,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        amount = _parse_amount(self._amount.get())
        if amount <= 0:
            self._err.configure(text="Digite um valor positivo.")
            return
        self.result = {
            "amount": amount,
            "day":    int(self._day.get()),
            "month":  MONTHS_PT.index(self._month.get()) + 1,
            "year":   int(self._year.get()),
        }
        self.destroy()


# ──────────────────────────────────────────────────────────────────────
class _EditAmountDialog(ctk.CTkToplevel):
    def __init__(self, parent, current: float):
        super().__init__(parent)
        self.title("Editar valor")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self.amount: Optional[float] = None
        self._build(current)
        self.update_idletasks()
        px = parent.winfo_x() + (parent.winfo_width()  - 300) // 2
        py = parent.winfo_y() + (parent.winfo_height() - 190) // 2
        self.geometry(f"300x190+{px}+{py}")
        self.lift(); self.focus()

    def _build(self, current: float) -> None:
        self.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self, text="Editar valor do mês",
                     font=F(14, "bold"), text_color=T.TEXT).grid(row=0, column=0, pady=(22, 8))

        self._entry = ctk.CTkEntry(
            self, width=180,
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._entry.insert(0, f"{current:.2f}".replace(".", ","))
        self._entry.grid(row=1, column=0)
        self._entry.bind("<Return>", lambda _: self._confirm())

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED)
        self._err.grid(row=2, column=0, pady=(6, 0))

        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.grid(row=3, column=0, pady=14)
        ctk.CTkButton(btns, text="Cancelar", width=100,
                      fg_color=T.CARD2, hover_color=T.BORDER_L,
                      border_width=1, border_color=T.BORDER_L,
                      text_color=T.MUTED, command=self.destroy).pack(side="left", padx=6)
        ctk.CTkButton(btns, text="Salvar", width=100,
                      fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
                      text_color="#ffffff", command=self._confirm).pack(side="left", padx=6)

    def _confirm(self) -> None:
        val = _parse_amount(self._entry.get())
        if val <= 0:
            self._err.configure(text="Digite um valor positivo.")
            return
        self.amount = val
        self.destroy()
