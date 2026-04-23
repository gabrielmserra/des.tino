"""Design tokens — des.tino brand identity + theme system."""
import os, sys, ctypes, json
from pathlib import Path
import customtkinter as ctk

# ── Fixed semantic colors (all themes) ───────────────────────────────
RED    = "#E05252"
VIOLET = "#9B72F5"

# ── Hover fixo ────────────────────────────────────────────────────────
RED_HOVER = "#C94848"

# ── Temas disponíveis ─────────────────────────────────────────────────
THEMES: dict[str, dict] = {
    "Esmeralda": {
        "bg": "#0D1F1A", "sidebar": "#0A1A15", "card": "#112318", "card2": "#162D1E",
        "border": "#1A3D2A", "border_l": "#224D35",
        "text": "#E8F5F0", "muted": "#7AAF95", "subtle": "#4A7A62",
        "primary": "#2EAF7D", "primary_dim": "#0E2B1C",
        "accent":  "#F5A623", "accent_dim":  "#2A1E08",
        "primary_hover": "#249A6C",
        "red_dim": "#2B1414", "violet_dim": "#1C1535",
    },
    "Grafite": {
        "bg": "#111214", "sidebar": "#0D0E10", "card": "#18191C", "card2": "#1E2023",
        "border": "#2A2B2F", "border_l": "#323438",
        "text": "#F1F2F4", "muted": "#8A8D94", "subtle": "#5A5D63",
        "primary": "#6C8EFF", "primary_dim": "#1A1E35",
        "accent":  "#FFB347", "accent_dim":  "#2A200A",
        "primary_hover": "#5070E0",
        "red_dim": "#2A1414", "violet_dim": "#1E1530",
    },
    "Oceano": {
        "bg": "#0A0F1E", "sidebar": "#080D1A", "card": "#0E1628", "card2": "#121D33",
        "border": "#1A2A4A", "border_l": "#1E3055",
        "text": "#E8EEFF", "muted": "#6E8AB5", "subtle": "#3D5580",
        "primary": "#4A9EFF", "primary_dim": "#0E1E3A",
        "accent":  "#7FFFD4", "accent_dim":  "#0A2A25",
        "primary_hover": "#2E85E0",
        "red_dim": "#2A1010", "violet_dim": "#1A1030",
    },
    "Vinho": {
        "bg": "#120A18", "sidebar": "#0E0813", "card": "#1A0F22", "card2": "#20132A",
        "border": "#321A45", "border_l": "#3D2055",
        "text": "#F0E8FF", "muted": "#9070BB", "subtle": "#5E4080",
        "primary": "#B07FFF", "primary_dim": "#251540",
        "accent":  "#FF8FA3", "accent_dim":  "#301020",
        "primary_hover": "#9060E0",
        "red_dim": "#2A0F18", "violet_dim": "#200E35",
    },
    "Areia": {
        "bg": "#F5F3EE", "sidebar": "#EDE9E2", "card": "#FFFFFF", "card2": "#F0EDE8",
        "border": "#D8D3CA", "border_l": "#E4E0D8",
        "text": "#1A1814", "muted": "#6B6560", "subtle": "#9E9890",
        "primary": "#2EAF7D", "primary_dim": "#D0F0E4",
        "accent":  "#D4820A", "accent_dim":  "#F5E0B0",
        "primary_hover": "#249A6C",
        "red_dim": "#FFE0E0", "violet_dim": "#EAE0FF",
    },
    "Carvão": {
        "bg": "#080809", "sidebar": "#050506", "card": "#0F0F11", "card2": "#141416",
        "border": "#1E1E22", "border_l": "#252528",
        "text": "#EBEBEF", "muted": "#70707A", "subtle": "#48484F",
        "primary": "#FF6B6B", "primary_dim": "#2A1010",
        "accent":  "#FFD166", "accent_dim":  "#2A2008",
        "primary_hover": "#E05050",
        "red_dim": "#251010", "violet_dim": "#181025",
    },
}

# ── Variáveis mutáveis (atualizadas por apply_theme) ──────────────────
BG       = THEMES["Esmeralda"]["bg"]
SIDEBAR  = THEMES["Esmeralda"]["sidebar"]
CARD     = THEMES["Esmeralda"]["card"]
CARD2    = THEMES["Esmeralda"]["card2"]
BORDER   = THEMES["Esmeralda"]["border"]
BORDER_L = THEMES["Esmeralda"]["border_l"]
TEXT     = THEMES["Esmeralda"]["text"]
MUTED    = THEMES["Esmeralda"]["muted"]
SUBTLE   = THEMES["Esmeralda"]["subtle"]
GREEN    = THEMES["Esmeralda"]["primary"]
BLUE     = THEMES["Esmeralda"]["primary"]
GOLD     = THEMES["Esmeralda"]["accent"]
GREEN_DIM  = THEMES["Esmeralda"]["primary_dim"]
BLUE_DIM   = THEMES["Esmeralda"]["primary_dim"]
GOLD_DIM   = THEMES["Esmeralda"]["accent_dim"]
RED_DIM    = THEMES["Esmeralda"]["red_dim"]
VIOLET_DIM = THEMES["Esmeralda"]["violet_dim"]
BLUE_HOVER = THEMES["Esmeralda"]["primary_hover"]
CARD_HOVER = THEMES["Esmeralda"]["card2"]

_CURRENT_THEME = "Esmeralda"


def apply_theme(name: str) -> None:
    global BG, SIDEBAR, CARD, CARD2, BORDER, BORDER_L
    global TEXT, MUTED, SUBTLE
    global GREEN, BLUE, GOLD
    global GREEN_DIM, BLUE_DIM, GOLD_DIM, RED_DIM, VIOLET_DIM
    global BLUE_HOVER, CARD_HOVER, _CURRENT_THEME

    t = THEMES.get(name, THEMES["Esmeralda"])
    BG       = t["bg"];       SIDEBAR  = t["sidebar"]
    CARD     = t["card"];     CARD2    = t["card2"]
    BORDER   = t["border"];   BORDER_L = t["border_l"]
    TEXT     = t["text"];     MUTED    = t["muted"];    SUBTLE   = t["subtle"]
    GREEN    = t["primary"];  BLUE     = t["primary"];  GOLD     = t["accent"]
    GREEN_DIM  = t["primary_dim"];  BLUE_DIM   = t["primary_dim"]
    GOLD_DIM   = t["accent_dim"];   RED_DIM    = t["red_dim"]
    VIOLET_DIM = t["violet_dim"];   BLUE_HOVER = t["primary_hover"]
    CARD_HOVER = t["card2"]
    _CURRENT_THEME = name


def _settings_file() -> Path:
    folder = Path(os.environ.get("APPDATA", Path.home())) / "DestinoApp"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "settings.json"


def save_theme(name: str) -> None:
    try:
        p = _settings_file()
        data = {}
        try:
            data = json.loads(p.read_text())
        except Exception:
            pass
        data["destino_theme"] = name
        p.write_text(json.dumps(data))
    except Exception:
        pass


def load_saved_theme() -> str:
    try:
        data = json.loads(_settings_file().read_text())
        return data.get("destino_theme", "Esmeralda")
    except Exception:
        return "Esmeralda"


# ── Fonte: Plus Jakarta Sans ──────────────────────────────────────────
_FONT_LOADED = False
_FF = "Plus Jakarta Sans"


def _load_fonts() -> None:
    global _FONT_LOADED, _FF
    if _FONT_LOADED:
        return
    try:
        if getattr(sys, "frozen", False):
            base = os.path.join(sys._MEIPASS, "assets", "fonts")
        else:
            base = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
        base = os.path.abspath(base)
        FR_PRIVATE = 0x10
        gdi32 = ctypes.windll.gdi32
        loaded = 0
        for fname in os.listdir(base):
            if fname.lower().endswith(".ttf") and "PlusJakartaSans" in fname:
                result = gdi32.AddFontResourceExW(os.path.join(base, fname), FR_PRIVATE, None)
                loaded += result
        if loaded > 0:
            _FONT_LOADED = True
    except Exception:
        _FF = "Segoe UI"


_load_fonts()
apply_theme(load_saved_theme())


def F(size: int, weight: str = "normal") -> ctk.CTkFont:
    return ctk.CTkFont(family=_FF, size=size, weight=weight)
