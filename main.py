"""
Ponto de entrada do aplicativo Finanças Pessoais.
Execute:  python main.py
"""

import sys
import os

if getattr(sys, "frozen", False):
    os.chdir(sys._MEIPASS)

import customtkinter as ctk
from utils.helpers import APP_NAME, APP_VERSION
import ui.theme as _theme  # loads Plus Jakarta Sans via AddFontResourceEx before any CTkFont

# Bug do CTk 5.2.2 + PyInstaller: CTkButton.destroy() falha com AttributeError
# em _font quando o widget foi destruído pelo pai sem passar pelo __init__ completo.
def _patch_ctk():
    import tkinter
    _orig = ctk.CTkButton.destroy
    def _safe(self):
        if hasattr(self, '_font'):
            _orig(self)
        else:
            tkinter.BaseWidget.destroy(self)
    ctk.CTkButton.destroy = _safe
_patch_ctk()


class MainWindow(ctk.CTk):
    """Janela raiz única. Alterna entre a tela de login e o app principal."""

    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self._current = None
        self.resizable(True, True)
        self.minsize(1050, 640)
        self._center(1340, 800)
        self.protocol("WM_DELETE_WINDOW", self._quit)
        self._set_icon()
        self._show_login()

    def _set_icon(self) -> None:
        try:
            if getattr(sys, "frozen", False):
                icon_path = os.path.join(sys._MEIPASS, "assets", "app.ico")
            else:
                icon_path = os.path.join(os.path.dirname(__file__), "assets", "app.ico")
            self.iconbitmap(icon_path)
        except Exception:
            pass

    # ------------------------------------------------------------------
    def _clear(self) -> None:
        if self._current:
            self._current.destroy()
            self._current = None

    def _center(self, w: int, h: int) -> None:
        self.update_idletasks()
        x = (self.winfo_screenwidth()  - w) // 2
        y = (self.winfo_screenheight() - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")

    # ------------------------------------------------------------------
    def _show_login(self) -> None:
        """Ponto de entrada: exibe splash se há sessão salva, senão vai direto ao login."""
        from config import has_saved_session
        if has_saved_session():
            self._show_splash()
        else:
            self._show_login_form()
        self._prewarm_imports()

    def _prewarm_imports(self) -> None:
        """Pre-imports heavy modules in the background while login/splash is visible."""
        import threading
        def _warm():
            try:
                import database  # noqa: F401  triggers supabase import
                import matplotlib
                matplotlib.use("TkAgg")
                import matplotlib.pyplot  # noqa: F401
                from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg  # noqa: F401
                from matplotlib.figure import Figure  # noqa: F401
            except Exception:
                pass
        threading.Thread(target=_warm, daemon=True).start()

    def _show_splash(self) -> None:
        self._clear()
        self.title(APP_NAME)

        from ui.splash import SplashFrame
        splash = SplashFrame(self)
        splash.pack(fill="both", expand=True)
        self._current = splash

        import threading
        from config import restore_session

        def _try_restore():
            email = restore_session()
            if email:
                # Mostra boas-vindas no splash, depois transita para o app
                self.after(0, lambda: splash.show_welcome(
                    email,
                    on_done=lambda: self._on_login(email),
                ))
            else:
                # Sessão expirada/inválida — vai para o login normalmente
                self.after(0, self._show_login_form)

        threading.Thread(target=_try_restore, daemon=True).start()

    def _show_login_form(self) -> None:
        self._clear()
        self.title(f"{APP_NAME} — Entrar")
        from ui.login import LoginFrame
        self._current = LoginFrame(self, on_login=self._on_login)
        self._current.pack(fill="both", expand=True)

    def _on_login(self, user_email: str) -> None:
        self.after(50, lambda: self._do_transition(user_email))

    def _do_transition(self, user_email: str) -> None:
        self._clear()
        self.title(f"{APP_NAME}  —  v{APP_VERSION}")

        from ui.app import FinanceApp
        self._current = FinanceApp(self, user_email=user_email, on_logout=self._on_logout)
        self._current.pack(fill="both", expand=True)
        self.update()

    def _on_logout(self) -> None:
        self._show_login_form()

    def _quit(self) -> None:
        os._exit(0)


def main() -> None:
    app = MainWindow()
    app.mainloop()
    os._exit(0)


if __name__ == "__main__":
    main()
