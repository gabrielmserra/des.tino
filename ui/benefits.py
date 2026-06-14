"""Benefícios VR/VA — barra de cards usada dentro de Saídas Variáveis."""
import threading
from typing import Callable, List

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from utils.helpers import apply_app_icon, format_currency

BENEFIT_COLORS = ["#2EAF7D", "#F5A623", "#4ECDC4", "#6C8EFF", "#FF6B9D", "#9B72F5"]


def _parse_amount(raw: str) -> float:
    raw = raw.strip().replace(".", "").replace(",", ".") if raw.count(",") else raw.strip().replace(",", ".")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


class BenefitsBar(ctk.CTkFrame):
    """Faixa colapsável com benefícios VR/VA, exibida no topo de Saídas Variáveis."""

    def __init__(self, parent, on_benefits_changed: Callable[[List[dict]], None]):
        super().__init__(parent, fg_color="transparent")
        self.on_benefits_changed = on_benefits_changed
        self._benefits: List[dict] = []
        self._expanded = False
        self.grid_columnconfigure(0, weight=1)
        self._build_header()
        self._chips_frame = ctk.CTkScrollableFrame(
            self, fg_color="transparent", height=170,
            orientation="horizontal",
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self.refresh()

    # ------------------------------------------------------------------
    def _build_header(self) -> None:
        hdr = ctk.CTkFrame(self, fg_color="transparent")
        hdr.grid(row=0, column=0, sticky="ew")
        hdr.grid_columnconfigure(1, weight=1)

        self._toggle_btn = ctk.CTkButton(
            hdr, text="▶  Vale Refeição / Alimentação",
            font=F(12, "bold"), text_color=T.MUTED,
            fg_color="transparent", hover_color=T.CARD2,
            anchor="w", height=28, corner_radius=6,
            command=self._toggle,
        )
        self._toggle_btn.grid(row=0, column=0, sticky="w")

        ctk.CTkButton(
            hdr, text="+ VR/VA", width=100, height=26, corner_radius=7,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(11),
            command=self._add_benefit,
        ).grid(row=0, column=2, sticky="e")

    def _toggle(self) -> None:
        self._expanded = not self._expanded
        if self._expanded:
            self._toggle_btn.configure(text="▼  Vale Refeição / Alimentação", text_color=T.TEXT)
            self._chips_frame.grid(row=1, column=0, sticky="ew", pady=(8, 0))
        else:
            self._toggle_btn.configure(text="▶  Vale Refeição / Alimentação", text_color=T.MUTED)
            self._chips_frame.grid_remove()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        def _fetch():
            try:
                benefits = db.get_benefits()
            except Exception:
                benefits = []
            self.after(0, lambda: self._render(benefits))
        threading.Thread(target=_fetch, daemon=True).start()

    def _render(self, benefits: List[dict]) -> None:
        self._benefits = benefits
        for w in self._chips_frame.winfo_children():
            w.destroy()

        if not benefits:
            ctk.CTkLabel(
                self._chips_frame,
                text="Nenhum benefício. Clique em '+ VR/VA' para adicionar.",
                font=F(12), text_color=T.MUTED,
            ).pack(pady=8, padx=8)
        else:
            for b in benefits:
                self._make_chip(b)

        self.on_benefits_changed(benefits)

    def _make_chip(self, benefit: dict) -> None:
        color   = benefit.get("color", "#2EAF7D")
        balance = float(benefit.get("balance") or 0)
        days    = db.days_until_renewal(benefit)
        recharge = float(benefit.get("recharge_amount") or 0)
        mode    = benefit.get("recharge_mode") or "acumula"

        chip = ctk.CTkFrame(self._chips_frame, fg_color=T.CARD, corner_radius=10,
                            border_width=1, border_color=T.BORDER_L)
        chip.pack(side="left", padx=(0, 8), pady=4, fill="y")

        ctk.CTkFrame(chip, height=5, fg_color=color, corner_radius=3).pack(
            fill="x", padx=6, pady=(6, 0))

        body = ctk.CTkFrame(chip, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=10, pady=(6, 8))

        # Nome + tipo (badge) + editar
        name_row = ctk.CTkFrame(body, fg_color="transparent")
        name_row.pack(fill="x", anchor="w")
        ctk.CTkLabel(name_row, text=benefit["name"], font=F(14, "bold"),
                     text_color=T.TEXT, anchor="w").pack(side="left")
        ctk.CTkButton(
            name_row, text="✏", width=28, height=24, corner_radius=6,
            fg_color=T.CARD2, hover_color=T.BORDER_L,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(11),
            command=lambda b=benefit: self._edit_benefit(b),
        ).pack(side="right")

        badge = ctk.CTkFrame(body, fg_color=color, corner_radius=5)
        badge.pack(anchor="w", pady=(4, 0))
        ctk.CTkLabel(badge, text=benefit["benefit_type"], font=F(10, "bold"),
                     text_color="#ffffff").pack(padx=8, pady=1)

        ctk.CTkFrame(body, height=1, fg_color=T.BORDER).pack(fill="x", pady=(8, 6))

        ctk.CTkLabel(body, text="Saldo disponível", font=F(10), text_color=T.MUTED,
                     anchor="w").pack(anchor="w")
        ctk.CTkLabel(body, text=format_currency(balance), font=F(17, "bold"),
                     text_color=color, anchor="w", width=180).pack(anchor="w")

        ctk.CTkLabel(body, text=f"Renova em {days}d", font=F(11),
                     text_color=T.GOLD if days <= 3 else T.MUTED,
                     anchor="w", width=180).pack(anchor="w", pady=(4, 0))
        modo_txt = "acumula" if mode == "acumula" else "zera"
        ctk.CTkLabel(body,
                     text=f"Recarga: {format_currency(recharge)} ({modo_txt})",
                     font=F(10), text_color=T.MUTED,
                     anchor="w", width=180).pack(anchor="w", pady=(1, 0))

    # ------------------------------------------------------------------
    def _add_benefit(self) -> None:
        dlg = _BenefitDialog(self.winfo_toplevel())
        self.winfo_toplevel().wait_window(dlg)
        if dlg.result:
            r = dlg.result
            db.create_benefit(r["name"], r["type"], r["balance"], r["renewal_day"],
                              r["recharge_amount"], r["recharge_mode"], r["color"])
            self.refresh()

    def _edit_benefit(self, benefit: dict) -> None:
        dlg = _BenefitDialog(self.winfo_toplevel(), benefit)
        self.winfo_toplevel().wait_window(dlg)
        if not dlg.result:
            return
        if dlg.deleted:
            db.archive_benefit(benefit["id"])
        else:
            r = dlg.result
            db.update_benefit(benefit["id"], r["name"], r["type"], r["renewal_day"],
                              r["recharge_amount"], r["recharge_mode"], r["color"])
            if r.get("balance_override") is not None:
                db.set_benefit_balance(benefit["id"], r["balance_override"])
        self.refresh()

    def get_benefits(self) -> List[dict]:
        return list(self._benefits)


# ---------------------------------------------------------------------------
class _BenefitDialog(ctk.CTkToplevel):
    def __init__(self, parent, benefit: dict = None):
        super().__init__(parent)
        self.result = None
        self.deleted = False
        self._benefit = benefit
        self._selected_color = benefit["color"] if benefit else BENEFIT_COLORS[0]

        self.title("Editar Benefício" if benefit else "Novo VR / VA")
        self.resizable(False, False)
        self.grab_set()
        self.configure(fg_color=T.CARD)
        apply_app_icon(self)
        self._build(benefit)
        self.after(100, self._center)

    def _center(self) -> None:
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f"+{(sw - w) // 2}+{(sh - h) // 2}")

    def _build(self, benefit) -> None:
        p = {"padx": 24, "pady": (0, 10)}

        ctk.CTkLabel(self, text="NOME", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(22, 4))
        self._name = ctk.CTkEntry(
            self, placeholder_text="Ex: VR Caju, VA Alelo…",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8, width=340,
        )
        self._name.pack(fill="x", **p)
        if benefit:
            self._name.insert(0, benefit["name"])

        # Tipo + saldo
        row1 = ctk.CTkFrame(self, fg_color="transparent")
        row1.pack(fill="x", padx=24, pady=(0, 10))
        row1.grid_columnconfigure((0, 1), weight=1)

        col_t = ctk.CTkFrame(row1, fg_color="transparent")
        col_t.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        ctk.CTkLabel(col_t, text="TIPO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", pady=(0, 4))
        self._type = ctk.CTkComboBox(
            col_t, values=["VR", "VA"],
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8, state="readonly",
        )
        self._type.set(benefit["benefit_type"] if benefit else "VR")
        self._type.pack(fill="x")

        col_b = ctk.CTkFrame(row1, fg_color="transparent")
        col_b.grid(row=0, column=1, padx=(6, 0), sticky="ew")
        bal_label = "SALDO ATUAL (R$)" if not benefit else "AJUSTAR SALDO (R$)"
        ctk.CTkLabel(col_b, text=bal_label, font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", pady=(0, 4))
        self._balance = ctk.CTkEntry(
            col_b, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._balance.pack(fill="x")
        if benefit:
            self._balance.insert(0, f"{float(benefit['balance']):.2f}".replace(".", ","))

        # Dia de renovação + valor recarga
        row2 = ctk.CTkFrame(self, fg_color="transparent")
        row2.pack(fill="x", padx=24, pady=(0, 10))
        row2.grid_columnconfigure((0, 1), weight=1)

        col_d = ctk.CTkFrame(row2, fg_color="transparent")
        col_d.grid(row=0, column=0, padx=(0, 6), sticky="ew")
        ctk.CTkLabel(col_d, text="DIA DE RENOVAÇÃO", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", pady=(0, 4))
        self._day = ctk.CTkComboBox(
            col_d, values=[str(i) for i in range(1, 32)],
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8, state="readonly",
        )
        self._day.set(str(benefit["renewal_day"]) if benefit else "1")
        self._day.pack(fill="x")

        col_r = ctk.CTkFrame(row2, fg_color="transparent")
        col_r.grid(row=0, column=1, padx=(6, 0), sticky="ew")
        ctk.CTkLabel(col_r, text="VALOR DA RECARGA (R$)", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", pady=(0, 4))
        self._recharge = ctk.CTkEntry(
            col_r, placeholder_text="0,00",
            fg_color=T.CARD2, border_color=T.BORDER_L,
            text_color=T.TEXT, corner_radius=8,
        )
        self._recharge.pack(fill="x")
        if benefit:
            self._recharge.insert(0, f"{float(benefit['recharge_amount']):.2f}".replace(".", ","))

        # Modo de recarga
        ctk.CTkLabel(self, text="COMPORTAMENTO DA RECARGA", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        self._mode = ctk.CTkComboBox(
            self, values=["acumula (soma ao saldo)", "zera (substitui o saldo)"],
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            button_color=T.BORDER_L, dropdown_fg_color=T.CARD2,
            dropdown_text_color=T.TEXT, corner_radius=8, state="readonly", width=340,
        )
        cur_mode = (benefit.get("recharge_mode") if benefit else "acumula") or "acumula"
        self._mode.set("acumula (soma ao saldo)" if cur_mode == "acumula"
                       else "zera (substitui o saldo)")
        self._mode.pack(fill="x", **p)

        # Cor
        ctk.CTkLabel(self, text="COR", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").pack(fill="x", padx=24, pady=(0, 4))
        color_row = ctk.CTkFrame(self, fg_color="transparent")
        color_row.pack(fill="x", padx=24, pady=(0, 16))
        self._color_btns: dict = {}
        for c in BENEFIT_COLORS:
            btn = ctk.CTkButton(
                color_row, text="", width=30, height=30, corner_radius=15,
                fg_color=c, hover_color=c, border_width=3,
                border_color=c if c == self._selected_color else T.CARD2,
                command=lambda col=c: self._pick(col),
            )
            btn.pack(side="left", padx=4)
            self._color_btns[c] = btn

        self._err = ctk.CTkLabel(self, text="", font=F(11), text_color=T.RED, anchor="w")
        self._err.pack(fill="x", padx=24)

        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.pack(fill="x", padx=24, pady=(8, 24))
        if benefit:
            ctk.CTkButton(
                btn_row, text="Excluir (arquivar)", height=34, corner_radius=8,
                fg_color="transparent", hover_color=T.RED,
                border_width=1, border_color=T.BORDER_L,
                text_color=T.RED, font=F(13),
                command=self._delete,
            ).pack(fill="x", pady=(0, 8))
        ctk.CTkButton(
            btn_row, text="Salvar" if benefit else "Criar Benefício",
            height=36, corner_radius=8,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(13, "bold"),
            command=self._save,
        ).pack(fill="x")

    def _pick(self, color: str) -> None:
        self._selected_color = color
        for c, btn in self._color_btns.items():
            btn.configure(border_color=c if c == self._selected_color else T.CARD2)

    def _save(self) -> None:
        name = self._name.get().strip()
        if not name:
            self._err.configure(text="  Preencha o nome.")
            return
        try:
            day = int(self._day.get())
        except ValueError:
            self._err.configure(text="  Dia de renovação inválido.")
            return
        recharge = _parse_amount(self._recharge.get())
        mode = "acumula" if self._mode.get().startswith("acumula") else "zera"
        result = {
            "name":            name,
            "type":            self._type.get(),
            "renewal_day":     day,
            "recharge_amount": recharge,
            "recharge_mode":   mode,
            "color":           self._selected_color,
        }
        if self._benefit is None:
            result["balance"] = _parse_amount(self._balance.get())
        else:
            # Em edição, o campo de saldo é um override opcional
            result["balance_override"] = _parse_amount(self._balance.get())
        self.result = result
        self.destroy()

    def _delete(self) -> None:
        self.result = True
        self.deleted = True
        self.destroy()
