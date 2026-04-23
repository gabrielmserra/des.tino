"""
Credenciais do Supabase.
Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os valores do seu projeto.
Encontre em: painel Supabase > Settings > API
"""

SUPABASE_URL      = "https://wbnefvskqudjnmafpqnn.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibmVmdnNrcXVkam5tYWZwcW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTI1MTUsImV4cCI6MjA5MjQyODUxNX0._Msovj0x6RAwJhqb0mIDRx7NOWIJEvDs_tHHlP3UrkE"

import json
import os
from pathlib import Path
from typing import Optional

_client = None


def get_client():
    global _client
    if _client is None:
        if "COLE_" in SUPABASE_URL:
            raise RuntimeError(
                "Configure as credenciais em config.py\n"
                "Acesse: Settings > API no painel do Supabase"
            )
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _client


# ---------------------------------------------------------------------------
# Sessão persistente
# ---------------------------------------------------------------------------

def _session_file() -> Path:
    folder = Path(os.environ.get("APPDATA", Path.home())) / "FinancasApp"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / ".session"


def save_session(session) -> None:
    """Salva access_token + refresh_token no disco."""
    try:
        _session_file().write_text(json.dumps({
            "access_token":  session.access_token,
            "refresh_token": session.refresh_token,
        }))
    except Exception:
        pass


def restore_session() -> Optional[str]:
    """Tenta restaurar sessão salva. Retorna e-mail do usuário ou None."""
    try:
        path = _session_file()
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        client = get_client()
        resp = client.auth.set_session(data["access_token"], data["refresh_token"])
        if resp and resp.user:
            if resp.session:
                save_session(resp.session)
            return resp.user.email
    except Exception:
        clear_session()
    return None


def has_saved_session() -> bool:
    """Retorna True se existe um arquivo de sessão com conteúdo (sem validar o token)."""
    try:
        p = _session_file()
        return p.exists() and p.stat().st_size > 10
    except Exception:
        return False


def clear_session() -> None:
    """Remove sessão salva (chamado no logout)."""
    try:
        _session_file().unlink(missing_ok=True)
    except Exception:
        pass
