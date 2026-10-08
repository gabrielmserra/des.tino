"""Sub-aba "Perfil de Investidor" dentro do hub de Investimentos:
questionário, resultado e histórico de tentativas."""
import threading
from typing import Callable, Optional

import customtkinter as ctk

import database as db
import ui.theme as T
from ui.theme import F
from ui.disclaimer import make_disclaimer
from ui.dialogs import ConfirmDialog
from utils.investor_profile_quiz import QUESTIONS, PROFILE_EXPLANATIONS, score_answers


class InvestorProfileTab(ctk.CTkScrollableFrame):
    def __init__(self, parent, on_change: Optional[Callable] = None):
        super().__init__(
            parent, fg_color=T.BG,
            scrollbar_button_color=T.BORDER,
            scrollbar_button_hover_color=T.MUTED,
        )
        self._on_change = on_change
        self._history: list = []
        self._quiz_mode = False
        self._answer_vars: dict = {}
        self.grid_columnconfigure(0, weight=1)
        self.refresh()

    # ------------------------------------------------------------------
    def refresh(self) -> None:
        self._quiz_mode = False
        for w in self.winfo_children():
            w.destroy()
        ctk.CTkLabel(self, text="Carregando…", font=F(13), text_color=T.MUTED).grid(
            row=0, column=0, pady=40)

        def fetch():
            try:
                history = db.get_investor_profile_history()
            except Exception:
                history = []
            self.after(0, lambda: self._apply(history))

        threading.Thread(target=fetch, daemon=True).start()

    def _apply(self, history: list) -> None:
        self._history = history
        for w in self.winfo_children():
            w.destroy()
        if not history:
            self._render_intro()
        else:
            self._render_result(history[0])

    # ==================================================================
    # Estado 1 — sem nenhuma tentativa ainda
    # ==================================================================
    def _render_intro(self) -> None:
        box = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                           border_width=1, border_color=T.BORDER)
        box.grid(row=0, column=0, sticky="ew", padx=28, pady=(30, 0))
        ctk.CTkLabel(box, text="🧭", font=F(34)).pack(pady=(36, 6))
        ctk.CTkLabel(box, text="Descubra seu perfil de investidor",
                     font=F(17, "bold"), text_color=T.TEXT).pack()
        ctk.CTkLabel(
            box,
            text="Responda algumas perguntas sobre seus objetivos e tolerância a\n"
                 "risco para ver uma comparação entre sua carteira e o alvo\n"
                 "sugerido pro seu perfil.",
            font=F(12), text_color=T.MUTED, justify="center",
        ).pack(pady=(6, 18))
        ctk.CTkButton(
            box, text="⚡  Fazer teste de perfil", command=self._start_quiz,
            height=42, width=240, corner_radius=10,
            fg_color=T.VIOLET, hover_color=T.VIOLET,
            text_color="#ffffff", font=F(13, "bold"),
        ).pack(pady=(0, 36))

    def _confirm_retake(self) -> None:
        ConfirmDialog(
            self.winfo_toplevel(),
            title="Refazer o teste?",
            message="Suas respostas atuais continuam no histórico -- isso\n"
                    "só adiciona uma nova tentativa, com um perfil novo.",
            confirm_text="Refazer",
            danger=False,
            on_confirm=self._start_quiz,
        )

    # ==================================================================
    # Estado 2 — questionário
    # ==================================================================
    def _start_quiz(self) -> None:
        self._quiz_mode = True
        for w in self.winfo_children():
            w.destroy()
        self._answer_vars = {}

        ctk.CTkLabel(self, text="Questionário de perfil de investidor",
                     font=F(18, "bold"), text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w", padx=28, pady=(24, 4))
        ctk.CTkLabel(self, text="Responda todas as perguntas pra ver o resultado.",
                     font=F(12), text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, sticky="w", padx=28, pady=(0, 16))

        for i, q in enumerate(QUESTIONS):
            card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=12,
                               border_width=1, border_color=T.BORDER)
            card.grid(row=2 + i, column=0, sticky="ew", padx=28, pady=(0, 10))
            card.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(card, text=f"{i + 1}. {q['text']}", font=F(13, "bold"),
                         text_color=T.TEXT, anchor="w", justify="left",
                         wraplength=640).grid(row=0, column=0, sticky="w",
                                              padx=18, pady=(14, 6))
            var = ctk.StringVar(value="")
            self._answer_vars[q["id"]] = var
            for j, opt in enumerate(q["options"]):
                ctk.CTkRadioButton(
                    card, text=opt["label"], variable=var, value=opt["value"],
                    font=F(12), text_color=T.MUTED, fg_color=T.VIOLET,
                    hover_color=T.VIOLET, command=self._update_submit_state,
                ).grid(row=1 + j, column=0, sticky="w", padx=26, pady=(0, 6))
            ctk.CTkFrame(card, height=4, fg_color="transparent").grid(
                row=1 + len(q["options"]), column=0)

        self._error_lbl = ctk.CTkLabel(self, text="", font=F(12), text_color=T.RED)
        self._error_lbl.grid(row=2 + len(QUESTIONS), column=0, padx=28, pady=(4, 0))

        self._submit_btn = ctk.CTkButton(
            self, text="Ver resultado", command=self._submit_quiz,
            height=42, corner_radius=10, state="disabled",
            fg_color=T.VIOLET, hover_color=T.VIOLET,
            text_color="#ffffff", font=F(13, "bold"),
        )
        self._submit_btn.grid(row=3 + len(QUESTIONS), column=0, pady=(14, 28))

    def _update_submit_state(self) -> None:
        answered = all(v.get() for v in self._answer_vars.values())
        self._submit_btn.configure(state="normal" if answered else "disabled")

    def _submit_quiz(self) -> None:
        answers = {qid: var.get() for qid, var in self._answer_vars.items()}
        if not all(answers.values()):
            self._error_lbl.configure(text="Responda todas as perguntas.")
            return
        score, profile = score_answers(answers)
        self._submit_btn.configure(state="disabled", text="Salvando…")

        def _save():
            try:
                db.save_investor_profile_result(score, profile, answers)
            except Exception as e:
                self.after(0, lambda: self._error_lbl.configure(text=f"Erro ao salvar: {e}"))
                return
            self.after(0, self.refresh)
            if self._on_change:
                self.after(0, self._on_change)

        threading.Thread(target=_save, daemon=True).start()

    # ==================================================================
    # Estado 3 — resultado + histórico
    # ==================================================================
    def _render_result(self, latest: dict) -> None:
        profile = latest["profile"]
        score   = latest["score"]

        card = ctk.CTkFrame(self, fg_color=T.CARD, corner_radius=14,
                            border_width=1, border_color=T.BORDER)
        card.grid(row=0, column=0, sticky="ew", padx=28, pady=(24, 0))
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="SEU PERFIL", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=0, column=0, sticky="w", padx=20, pady=(18, 0))
        ctk.CTkLabel(card, text=profile, font=F(24, "bold"),
                     text_color=T.VIOLET, anchor="w").grid(
            row=1, column=0, sticky="w", padx=20)
        ctk.CTkLabel(card, text=f"Pontuação: {score:.0f}/100", font=F(11),
                     text_color=T.SUBTLE, anchor="w").grid(
            row=2, column=0, sticky="w", padx=20, pady=(2, 10))
        ctk.CTkLabel(
            card, text=PROFILE_EXPLANATIONS.get(profile, ""),
            font=F(12), text_color=T.TEXT, justify="left", wraplength=640, anchor="w",
        ).grid(row=3, column=0, sticky="w", padx=20, pady=(0, 16))

        ctk.CTkButton(
            self, text="🔄  Refazer teste", command=self._confirm_retake,
            height=36, width=160, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.MUTED, font=F(12),
        ).grid(row=1, column=0, sticky="w", padx=28, pady=(10, 0))

        disc = make_disclaimer(self)
        disc.grid(row=2, column=0, sticky="ew", padx=28, pady=(14, 0))

        if len(self._history) > 1:
            ctk.CTkLabel(self, text="Histórico", font=F(14, "bold"),
                         text_color=T.TEXT, anchor="w").grid(
                row=3, column=0, sticky="w", padx=28, pady=(20, 6))
            hist_box = ctk.CTkFrame(self, fg_color="transparent")
            hist_box.grid(row=4, column=0, sticky="ew", padx=28, pady=(0, 28))
            hist_box.grid_columnconfigure(0, weight=1)
            for i, item in enumerate(self._history):
                row = ctk.CTkFrame(hist_box, fg_color=T.CARD, corner_radius=10,
                                   border_width=1, border_color=T.BORDER)
                row.grid(row=i, column=0, sticky="ew", pady=(0, 6))
                row.grid_columnconfigure(1, weight=1)
                date_str = str(item.get("created_at") or "")[:10]
                ctk.CTkLabel(row, text=date_str, font=F(11), text_color=T.SUBTLE).grid(
                    row=0, column=0, padx=(14, 10), pady=10, sticky="w")
                ctk.CTkLabel(row, text=item["profile"], font=F(12, "bold"),
                             text_color=T.TEXT).grid(row=0, column=1, sticky="w")
                ctk.CTkLabel(row, text=f"{item['score']:.0f}/100", font=F(11),
                             text_color=T.MUTED).grid(row=0, column=2, padx=14, sticky="e")
        else:
            ctk.CTkFrame(self, height=20, fg_color="transparent").grid(row=3, column=0)
