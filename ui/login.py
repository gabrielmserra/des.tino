"""Frame de login e cadastro."""
from __future__ import annotations
from typing import Callable

import customtkinter as ctk
import ui.theme as T
from ui.theme import F
from utils.helpers import APP_NAME, APP_VERSION


class LoginFrame(ctk.CTkFrame):
    def __init__(self, parent, on_login: Callable[[str], None]):
        super().__init__(parent, fg_color=T.BG)
        self._on_login = on_login
        self._build_login()

    # ------------------------------------------------------------------
    def _clear(self) -> None:
        for w in self.winfo_children():
            w.destroy()

    # ------------------------------------------------------------------
    def _build_login(self) -> None:
        self._clear()

        outer = ctk.CTkFrame(self, fg_color="transparent")
        outer.place(relx=0.5, rely=0.5, anchor="center")

        # ── Logo ──────────────────────────────────────────────────────
        logo = ctk.CTkFrame(outer, fg_color="transparent")
        logo.pack(pady=(0, 32))

        icon_box = ctk.CTkFrame(logo, width=52, height=52, corner_radius=14,
                                fg_color=T.BLUE)
        icon_box.pack(pady=(0, 10))
        icon_box.pack_propagate(False)
        ctk.CTkLabel(icon_box, text="💳", font=F(22)).place(relx=0.5, rely=0.5, anchor="center")

        ctk.CTkLabel(logo, text=APP_NAME, font=F(24, "bold"), text_color=T.TEXT).pack()
        ctk.CTkLabel(
            logo,
            text=f"CONTROLE FINANCEIRO  ·  v{APP_VERSION}",
            font=F(11), text_color=T.MUTED,
        ).pack(pady=(3, 0))

        # ── Card ──────────────────────────────────────────────────────
        card = ctk.CTkFrame(outer, width=420, corner_radius=20, fg_color=T.CARD,
                            border_width=1, border_color=T.BORDER)
        card.pack()
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Entrar na conta", font=F(18, "bold"),
                     text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w", padx=32, pady=(32, 4))
        ctk.CTkLabel(card, text="Bem-vindo de volta", font=F(13),
                     text_color=T.MUTED, anchor="w").grid(
            row=1, column=0, sticky="w", padx=32, pady=(0, 24))

        ctk.CTkLabel(card, text="E-MAIL", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=2, column=0, sticky="w", padx=32)
        self._email = ctk.CTkEntry(
            card, placeholder_text="seu@email.com", width=356,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=10,
        )
        self._email.grid(row=3, column=0, padx=32, pady=(6, 0))

        ctk.CTkLabel(card, text="SENHA", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=4, column=0, sticky="w", padx=32, pady=(16, 0))
        self._password = ctk.CTkEntry(
            card, placeholder_text="••••••••", show="•", width=356,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=10,
        )
        self._password.grid(row=5, column=0, padx=32, pady=(6, 0))
        self._password.bind("<Return>", lambda _: self._login())

        self._login_error = ctk.CTkLabel(
            card, text="", font=F(12), text_color=T.RED, anchor="w")
        self._login_error.grid(row=6, column=0, padx=32, pady=(10, 0), sticky="w")

        ctk.CTkButton(
            card, text="Entrar", command=self._login,
            height=44, width=356, corner_radius=10,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(15, "bold"),
        ).grid(row=7, column=0, padx=32, pady=(4, 0))

        ctk.CTkButton(
            card, text="Esqueci minha senha",
            command=self._build_forgot_password,
            height=30, width=356, corner_radius=8,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=0, text_color=T.MUTED, font=F(13),
        ).grid(row=8, column=0, padx=32, pady=(8, 0))

        ctk.CTkButton(
            card, text="Criar nova conta →",
            command=self._build_register,
            height=42, width=356, corner_radius=10,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(14, "bold"),
        ).grid(row=9, column=0, padx=32, pady=(8, 32))

        self._email.focus()

    # ------------------------------------------------------------------
    def _login(self) -> None:
        from config import get_client

        email    = self._email.get().strip()
        password = self._password.get()

        if not email or not password:
            self._login_error.configure(text="  Preencha e-mail e senha.")
            return

        self._login_error.configure(text="  Entrando…", text_color=T.MUTED)
        self.update()

        try:
            resp = get_client().auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            from config import save_session
            if resp.session:
                save_session(resp.session)
            self._on_login(resp.user.email)
        except Exception as e:
            if _is_offline(e):
                self._login_error.configure(
                    text="  Sem conexão com a internet.", text_color=T.RED)
            else:
                self._login_error.configure(
                    text="  E-mail ou senha incorretos.", text_color=T.RED)

    # ------------------------------------------------------------------
    def _build_register(self) -> None:
        self._clear()

        outer = ctk.CTkFrame(self, fg_color="transparent")
        outer.place(relx=0.5, rely=0.5, anchor="center")

        logo = ctk.CTkFrame(outer, fg_color="transparent")
        logo.pack(pady=(0, 32))

        icon_box = ctk.CTkFrame(logo, width=52, height=52, corner_radius=14,
                                fg_color=T.BLUE)
        icon_box.pack(pady=(0, 10))
        icon_box.pack_propagate(False)
        ctk.CTkLabel(icon_box, text="💳", font=F(22)).place(relx=0.5, rely=0.5, anchor="center")

        ctk.CTkLabel(logo, text=APP_NAME, font=F(24, "bold"), text_color=T.TEXT).pack()
        ctk.CTkLabel(logo, text="CRIAR NOVA CONTA", font=F(11), text_color=T.MUTED).pack(pady=(3, 0))

        card = ctk.CTkFrame(outer, width=420, corner_radius=20, fg_color=T.CARD,
                            border_width=1, border_color=T.BORDER)
        card.pack()
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Nova conta", font=F(18, "bold"),
                     text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w", padx=32, pady=(32, 24))

        fields = [
            ("E-MAIL",          "seu@email.com",        False, "_reg_email"),
            ("SENHA",           "mínimo 6 caracteres",  True,  "_reg_pass"),
            ("CONFIRMAR SENHA", "repita a senha",        True,  "_reg_confirm"),
        ]
        for i, (lbl, ph, secret, attr) in enumerate(fields):
            row_offset = i * 3
            ctk.CTkLabel(card, text=lbl, font=F(11, "bold"),
                         text_color=T.MUTED, anchor="w").grid(
                row=1 + row_offset, column=0, sticky="w", padx=32,
                pady=(0 if i == 0 else 14, 0))
            entry = ctk.CTkEntry(
                card, placeholder_text=ph, width=356,
                show="•" if secret else "",
                fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
                placeholder_text_color=T.SUBTLE, corner_radius=10,
            )
            entry.grid(row=2 + row_offset, column=0, padx=32, pady=(6, 0))
            setattr(self, attr, entry)

        self._reg_confirm.bind("<Return>", lambda _: self._criar_conta())

        self._reg_error = ctk.CTkLabel(
            card, text="", font=F(12), text_color=T.RED, anchor="w")
        self._reg_error.grid(row=10, column=0, padx=32, pady=(10, 0), sticky="w")

        ctk.CTkButton(
            card, text="Criar Conta", command=self._criar_conta,
            height=44, width=356, corner_radius=10,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(15, "bold"),
        ).grid(row=11, column=0, padx=32, pady=(4, 0))

        ctk.CTkButton(
            card, text="← Voltar para login",
            command=self._build_login,
            height=42, width=356, corner_radius=10,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(14, "bold"),
        ).grid(row=12, column=0, padx=32, pady=(8, 32))

        self._reg_email.focus()

    # ------------------------------------------------------------------
    def _criar_conta(self) -> None:
        from config import get_client

        email   = self._reg_email.get().strip()
        passwd  = self._reg_pass.get()
        confirm = self._reg_confirm.get()

        if not email or not passwd:
            self._reg_error.configure(text="  Preencha todos os campos.")
            return
        if passwd != confirm:
            self._reg_error.configure(text="  As senhas não coincidem.")
            return
        if len(passwd) < 6:
            self._reg_error.configure(text="  A senha deve ter ao menos 6 caracteres.")
            return

        self._reg_error.configure(text="  Criando conta…", text_color=T.MUTED)
        self.update()

        try:
            resp = get_client().auth.sign_up({"email": email, "password": passwd})
            if resp.user:
                from config import save_session
                if resp.session:
                    save_session(resp.session)
                self._on_login(resp.user.email)
            else:
                self._reg_error.configure(
                    text="  Erro ao criar conta. Tente novamente.", text_color=T.RED)
        except Exception as e:
            if _is_offline(e):
                self._reg_error.configure(
                    text="  Sem conexão com a internet.", text_color=T.RED)
            elif "already registered" in str(e):
                self._reg_error.configure(
                    text="  Este e-mail já está cadastrado.", text_color=T.RED)
            else:
                self._reg_error.configure(
                    text=f"  Erro: {str(e)[:60]}", text_color=T.RED)

    # ------------------------------------------------------------------
    def _build_forgot_password(self) -> None:
        self._clear()

        outer = ctk.CTkFrame(self, fg_color="transparent")
        outer.place(relx=0.5, rely=0.5, anchor="center")

        logo = ctk.CTkFrame(outer, fg_color="transparent")
        logo.pack(pady=(0, 32))
        icon_box = ctk.CTkFrame(logo, width=52, height=52, corner_radius=14,
                                fg_color=T.BLUE)
        icon_box.pack(pady=(0, 10))
        icon_box.pack_propagate(False)
        ctk.CTkLabel(icon_box, text="💳", font=F(22)).place(relx=0.5, rely=0.5, anchor="center")
        ctk.CTkLabel(logo, text=APP_NAME, font=F(24, "bold"), text_color=T.TEXT).pack()
        ctk.CTkLabel(logo, text="REDEFINIÇÃO DE SENHA", font=F(11), text_color=T.MUTED).pack(pady=(3, 0))

        card = ctk.CTkFrame(outer, width=420, corner_radius=20, fg_color=T.CARD,
                            border_width=1, border_color=T.BORDER)
        card.pack()
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(card, text="Esqueceu sua senha?", font=F(18, "bold"),
                     text_color=T.TEXT, anchor="w").grid(
            row=0, column=0, sticky="w", padx=32, pady=(32, 6))
        ctk.CTkLabel(
            card,
            text="Digite seu e-mail e enviaremos um link\npara criar uma nova senha.",
            font=F(13), text_color=T.MUTED, anchor="w", justify="left",
        ).grid(row=1, column=0, sticky="w", padx=32, pady=(0, 20))

        ctk.CTkLabel(card, text="E-MAIL", font=F(11, "bold"),
                     text_color=T.MUTED, anchor="w").grid(
            row=2, column=0, sticky="w", padx=32)
        self._reset_email = ctk.CTkEntry(
            card, placeholder_text="seu@email.com", width=356,
            fg_color=T.CARD2, border_color=T.BORDER_L, text_color=T.TEXT,
            placeholder_text_color=T.SUBTLE, corner_radius=10,
        )
        self._reset_email.grid(row=3, column=0, padx=32, pady=(6, 0))
        self._reset_email.bind("<Return>", lambda _: self._send_reset_email())

        self._reset_msg = ctk.CTkLabel(
            card, text="", font=F(12), text_color=T.RED, anchor="w")
        self._reset_msg.grid(row=4, column=0, padx=32, pady=(10, 0), sticky="w")

        ctk.CTkButton(
            card, text="Enviar link de redefinição",
            command=self._send_reset_email,
            height=44, width=356, corner_radius=10,
            fg_color=T.BLUE, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(15, "bold"),
        ).grid(row=5, column=0, padx=32, pady=(4, 0))

        ctk.CTkButton(
            card, text="← Voltar para login",
            command=self._build_login,
            height=42, width=356, corner_radius=10,
            fg_color="transparent", hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER_L,
            text_color=T.TEXT, font=F(14, "bold"),
        ).grid(row=6, column=0, padx=32, pady=(8, 32))

        self._reset_email.focus()

    # ------------------------------------------------------------------
    def _send_reset_email(self) -> None:
        from config import get_client

        email = self._reset_email.get().strip()
        if not email:
            self._reset_msg.configure(text="  Digite seu e-mail.", text_color=T.RED)
            return

        self._reset_msg.configure(text="  Enviando…", text_color=T.MUTED)
        self.update()

        try:
            get_client().auth.reset_password_email(email)
            self._reset_msg.configure(
                text="  Link enviado! Verifique seu e-mail.", text_color=T.GREEN)
        except Exception as e:
            if _is_offline(e):
                self._reset_msg.configure(
                    text="  Sem conexão com a internet.", text_color=T.RED)
            else:
                self._reset_msg.configure(
                    text=f"  Erro: {str(e)[:60]}", text_color=T.RED)


def _is_offline(e: Exception) -> bool:
    msg = str(e).lower()
    return any(k in msg for k in (
        "connect", "network", "timeout", "unreachable",
        "name or service not known", "failed to establish",
        "remotedisconnected", "connectionerror", "no route",
    ))
