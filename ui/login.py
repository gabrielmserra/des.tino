"""Frame de login, cadastro e recuperação de senha.

Layout de dois painéis (marca à esquerda + formulário à direita),
espelhando o redesign feito na versão web (web/src/pages/Auth.css):
painel de marca com glow radial, título/parágrafo e (só no login) a
ilustração do "caminho"; formulário com campos estilo sublinhado.
"""
from __future__ import annotations
import tkinter as tk
from typing import Callable

import customtkinter as ctk
from PIL import Image, ImageTk

import ui.theme as T
from ui.theme import F
from utils.helpers import APP_VERSION


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _blend(hex_a: str, hex_b: str, t: float) -> str:
    """Mistura hex_a com hex_b (t=0 -> hex_a, t=1 -> hex_b)."""
    a, b = _hex_to_rgb(hex_a), _hex_to_rgb(hex_b)
    mixed = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return "#%02x%02x%02x" % mixed


class LoginFrame(ctk.CTkFrame):
    def __init__(self, parent, on_login: Callable[[str], None]):
        super().__init__(parent, fg_color=T.BG)
        self._on_login = on_login
        self._current_page = "login"
        self._glow_job = None
        self._glow_img_ref = None
        self._build_login()

    # ------------------------------------------------------------------
    def _clear(self) -> None:
        if self._glow_job:
            try:
                self.after_cancel(self._glow_job)
            except Exception:
                pass
            self._glow_job = None
        for w in self.winfo_children():
            w.destroy()

    def _add_theme_btn(self) -> None:
        btn = ctk.CTkButton(
            self, text="🎨", width=36, height=36,
            corner_radius=10, font=F(16),
            fg_color=T.CARD, hover_color=T.CARD2,
            border_width=1, border_color=T.BORDER,
            text_color=T.MUTED,
            command=self._open_theme_picker,
        )
        btn.place(relx=1.0, rely=1.0, anchor="se", x=-16, y=-16)

        ctk.CTkLabel(
            self, text=f"v{APP_VERSION}", font=F(10), text_color=T.SUBTLE,
        ).place(relx=0.0, rely=1.0, anchor="sw", x=16, y=-16)

    def _open_theme_picker(self) -> None:
        from ui.theme_picker import ThemePickerDialog
        def _on_select(_name):
            self.configure(fg_color=T.BG)
            if self._current_page == "login":
                self._build_login()
            elif self._current_page == "register":
                self._build_register()
            elif self._current_page == "forgot":
                self._build_forgot_password()
        ThemePickerDialog(self.winfo_toplevel(), _on_select)

    # ------------------------------------------------------------------
    # Painel de marca (esquerda): logo no topo, título+parágrafo no meio,
    # ilustração do caminho embaixo (só quando show_route=True).
    def _build_brand_panel(self, parent, title_lines, paragraph, show_route=False):
        panel = ctk.CTkFrame(parent, fg_color=T.SIDEBAR, corner_radius=0)

        bg_label = tk.Label(panel, bd=0, highlightthickness=0, bg=T.SIDEBAR)
        bg_label.place(relx=0, rely=0, relwidth=1, relheight=1)

        def _redraw_glow(_event=None):
            w, h = panel.winfo_width(), panel.winfo_height()
            if w < 2 or h < 2:
                return
            img = self._make_glow(w, h)
            self._glow_img_ref = ImageTk.PhotoImage(img)
            bg_label.configure(image=self._glow_img_ref)

        def _on_configure(_event):
            if self._glow_job:
                panel.after_cancel(self._glow_job)
            self._glow_job = panel.after(80, _redraw_glow)

        panel.bind("<Configure>", _on_configure)

        content = ctk.CTkFrame(panel, fg_color="transparent")
        content.place(relx=0, rely=0, relwidth=1, relheight=1)
        content.grid_rowconfigure(1, weight=1)
        content.grid_columnconfigure(0, weight=1)

        top = ctk.CTkFrame(content, fg_color="transparent")
        top.grid(row=0, column=0, sticky="new", padx=56, pady=(48, 0))
        name_row = ctk.CTkFrame(top, fg_color="transparent")
        name_row.pack(anchor="w")
        ctk.CTkLabel(name_row, text="des", font=F(19, "bold"), text_color=T.TEXT).pack(side="left")
        ctk.CTkLabel(name_row, text=".", font=F(19, "bold"), text_color=T.GREEN).pack(side="left")
        ctk.CTkLabel(name_row, text="tino", font=F(19), text_color=T.TEXT).pack(side="left")

        mid = ctk.CTkFrame(content, fg_color="transparent")
        mid.grid(row=1, column=0, sticky="nsew", padx=56)
        mid_inner = ctk.CTkFrame(mid, fg_color="transparent")
        mid_inner.place(relx=0, rely=0.5, anchor="w")
        for text, bold in title_lines:
            ctk.CTkLabel(
                mid_inner, text=text, font=F(28, "bold" if bold else "normal"),
                text_color=T.GREEN if bold else T.TEXT, anchor="w", justify="left",
            ).pack(anchor="w")
        ctk.CTkLabel(
            mid_inner, text=paragraph, font=F(13), text_color=T.MUTED,
            anchor="w", justify="left", wraplength=340,
        ).pack(anchor="w", pady=(16, 0))

        if show_route:
            route = tk.Canvas(content, width=280, height=70, bg=T.SIDEBAR, highlightthickness=0)
            route.grid(row=2, column=0, sticky="sw", padx=56, pady=(0, 48))
            self._draw_route(route)

        panel.after(30, _redraw_glow)
        return panel

    def _make_glow(self, w: int, h: int) -> Image.Image:
        base = Image.new("RGBA", (w, h), _hex_to_rgb(T.SIDEBAR) + (255,))
        for cx, cy, radius_ratio, color, alpha in (
            (0.2, 0.15, 0.65, T.GREEN, 65),
            (0.9, 0.9, 0.55, T.BORDER_L, 70),
        ):
            size = int(max(w, h) * radius_ratio)
            if size < 2:
                continue
            grad = Image.radial_gradient("L").resize((size, size), Image.BICUBIC)
            glow = Image.new("RGBA", (size, size), _hex_to_rgb(color) + (0,))
            glow.putalpha(grad.point(lambda p, a=alpha: int(p * a / 255)))
            base.alpha_composite(glow, (int(w * cx - size / 2), int(h * cy - size / 2)))
        return base

    def _draw_route(self, canvas: tk.Canvas) -> None:
        muted = _blend(T.GREEN, T.SIDEBAR, 0.6)
        pts = self._bezier_points((10, 50), (70, 15), (140, 35))
        pts += self._bezier_points((140, 35), (210, 55), (270, 20))[1:]
        canvas.create_line(*[c for p in pts for c in p], fill=muted, width=1, smooth=True)
        canvas.create_oval(6, 46, 14, 54, fill=muted, outline="")
        canvas.create_oval(133, 28, 147, 42, outline=muted, width=2)
        canvas.create_oval(136, 31, 144, 39, fill=T.GREEN, outline="")
        canvas.create_oval(266, 16, 274, 24, fill=T.GOLD, outline="")

    @staticmethod
    def _bezier_points(p0, p1, p2, steps: int = 16) -> list[tuple[float, float]]:
        pts = []
        for i in range(steps + 1):
            t = i / steps
            x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
            y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
            pts.append((x, y))
        return pts

    # ------------------------------------------------------------------
    # Campo estilo "sublinhado" (label + entry sem borda + barra que
    # acende na cor primária ao focar), igual ao .ld-field do site.
    def _field(self, parent, label_text: str, placeholder: str, secret: bool = False):
        wrap = ctk.CTkFrame(parent, fg_color="transparent")
        ctk.CTkLabel(wrap, text=label_text, font=F(10, "bold"), text_color=T.SUBTLE, anchor="w").pack(fill="x")
        entry = ctk.CTkEntry(
            wrap, placeholder_text=placeholder, show="•" if secret else "",
            fg_color=T.BG, border_width=0, corner_radius=0,
            text_color=T.TEXT, placeholder_text_color=T.SUBTLE, font=F(14),
        )
        entry.pack(fill="x", pady=(8, 0))
        bar = ctk.CTkFrame(wrap, height=1, fg_color=T.BORDER_L, corner_radius=0)
        bar.pack(fill="x")
        # CTkEntry delega o foco de teclado pro tkinter.Entry interno (_entry) —
        # bind direto na CTkEntry nunca recebe FocusIn/FocusOut.
        entry._entry.bind("<FocusIn>", lambda _e: bar.configure(fg_color=T.GREEN), add="+")
        entry._entry.bind("<FocusOut>", lambda _e: bar.configure(fg_color=T.BORDER_L), add="+")
        return wrap, entry

    def _divider(self, parent, text: str = "OU") -> None:
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x", pady=22)
        ctk.CTkFrame(row, height=1, fg_color=T.BORDER).pack(side="left", fill="x", expand=True)
        ctk.CTkLabel(row, text=text, font=F(10), text_color=T.SUBTLE).pack(side="left", padx=10)
        ctk.CTkFrame(row, height=1, fg_color=T.BORDER).pack(side="left", fill="x", expand=True)

    def _footer_link(self, parent, prefix: str, link_text: str, command: Callable[[], None]) -> None:
        row = ctk.CTkFrame(parent, fg_color="transparent")
        row.pack(fill="x")
        inner = ctk.CTkFrame(row, fg_color="transparent")
        inner.pack(anchor="center")
        ctk.CTkLabel(inner, text=prefix, font=F(13), text_color=T.MUTED).pack(side="left")
        link = ctk.CTkLabel(inner, text=link_text, font=F(13, "bold"), text_color=T.GREEN, cursor="hand2")
        link.pack(side="left", padx=(4, 0))
        link.bind("<Button-1>", lambda _e: command())

    def _back_link(self, parent, command: Callable[[], None]) -> None:
        link = ctk.CTkLabel(
            parent, text="← Voltar para login", font=F(13),
            text_color=T.MUTED, cursor="hand2",
        )
        link.pack(pady=(28, 0))
        link.bind("<Button-1>", lambda _e: command())

    def _primary_btn(self, parent, text: str, command: Callable[[], None]) -> ctk.CTkButton:
        return ctk.CTkButton(
            parent, text=text, command=command,
            height=46, corner_radius=8,
            fg_color=T.GREEN, hover_color=T.BLUE_HOVER,
            text_color="#ffffff", font=F(14, "bold"),
        )

    def _split_screen(self, brand_kwargs: dict):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=115)
        self.grid_columnconfigure(1, weight=100)

        brand = self._build_brand_panel(self, **brand_kwargs)
        brand.grid(row=0, column=0, sticky="nsew")

        form_side = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        form_side.grid(row=0, column=1, sticky="nsew")

        box = ctk.CTkFrame(form_side, fg_color="transparent", width=340)
        box.place(relx=0.5, rely=0.5, anchor="center")
        return box

    # ------------------------------------------------------------------
    def _build_login(self) -> None:
        self._clear()

        box = self._split_screen({
            "title_lines": [("Organize seu dinheiro", False), ("com destino certo.", True)],
            "paragraph": "Acompanhe entradas, saídas e investimentos em um só lugar, mês após mês.",
            "show_route": True,
        })

        ctk.CTkLabel(box, text="Entrar na conta", font=F(21, "bold"), text_color=T.TEXT, anchor="w").pack(fill="x")
        ctk.CTkLabel(box, text="Bem-vindo de volta", font=F(13), text_color=T.MUTED, anchor="w").pack(
            fill="x", pady=(4, 28))

        _, self._email = self._field(box, "E-MAIL", "seu@email.com")
        self._email.master.pack(fill="x", pady=(0, 22))

        _, self._password = self._field(box, "SENHA", "••••••••", secret=True)
        self._password.master.pack(fill="x")
        self._password.bind("<Return>", lambda _: self._login())

        self._login_error = ctk.CTkLabel(box, text="", font=F(12), text_color=T.RED, anchor="w")
        self._login_error.pack(fill="x", pady=(10, 0))

        self._primary_btn(box, "Entrar", self._login).pack(fill="x", pady=(14, 10))

        forgot = ctk.CTkLabel(box, text="Esqueci minha senha", font=F(13), text_color=T.MUTED, cursor="hand2")
        forgot.pack()
        forgot.bind("<Button-1>", lambda _e: self._build_forgot_password())

        self._divider(box)
        self._footer_link(box, "Ainda não tem conta?", "Criar conta", self._build_register)

        self._current_page = "login"
        self._add_theme_btn()
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

        box = self._split_screen({
            "title_lines": [("Comece a organizar", False), ("suas finanças hoje.", True)],
            "paragraph": "Crie sua conta gratuita e acompanhe entradas, saídas e investimentos em um só lugar.",
        })

        ctk.CTkLabel(box, text="Criar conta", font=F(21, "bold"), text_color=T.TEXT, anchor="w").pack(fill="x")
        ctk.CTkLabel(box, text="Comece a usar o des.tino gratuitamente", font=F(13), text_color=T.MUTED,
                     anchor="w").pack(fill="x", pady=(4, 28))

        _, self._reg_email = self._field(box, "E-MAIL", "seu@email.com")
        self._reg_email.master.pack(fill="x", pady=(0, 22))

        _, self._reg_pass = self._field(box, "SENHA", "mínimo 6 caracteres", secret=True)
        self._reg_pass.master.pack(fill="x", pady=(0, 22))

        _, self._reg_confirm = self._field(box, "CONFIRMAR SENHA", "repita a senha", secret=True)
        self._reg_confirm.master.pack(fill="x")
        self._reg_confirm.bind("<Return>", lambda _: self._criar_conta())

        self._reg_error = ctk.CTkLabel(box, text="", font=F(12), text_color=T.RED, anchor="w")
        self._reg_error.pack(fill="x", pady=(10, 0))

        self._primary_btn(box, "Criar Conta", self._criar_conta).pack(fill="x", pady=(14, 0))

        self._divider(box)
        self._footer_link(box, "Já tem conta?", "Entrar", self._build_login)

        self._current_page = "register"
        self._add_theme_btn()
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

        box = self._split_screen({
            "title_lines": [("Sem problemas,", False), ("vamos recuperar.", True)],
            "paragraph": "Digite seu e-mail cadastrado e enviaremos um link para você criar uma nova senha.",
        })

        ctk.CTkLabel(box, text="Esqueceu sua senha?", font=F(21, "bold"), text_color=T.TEXT, anchor="w").pack(fill="x")
        ctk.CTkLabel(
            box, text="Digite seu e-mail e enviaremos um link\npara criar uma nova senha.",
            font=F(13), text_color=T.MUTED, anchor="w", justify="left",
        ).pack(fill="x", pady=(4, 28))

        _, self._reset_email = self._field(box, "E-MAIL", "seu@email.com")
        self._reset_email.master.pack(fill="x")
        self._reset_email.bind("<Return>", lambda _: self._send_reset_email())

        self._reset_msg = ctk.CTkLabel(box, text="", font=F(12), text_color=T.RED, anchor="w")
        self._reset_msg.pack(fill="x", pady=(10, 0))

        self._primary_btn(box, "Enviar link de redefinição", self._send_reset_email).pack(fill="x", pady=(14, 0))

        self._back_link(box, self._build_login)

        self._current_page = "forgot"
        self._add_theme_btn()
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
