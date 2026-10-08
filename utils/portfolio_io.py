"""
Exportar/importar carteira (real ou fictícia) em JSON versionado.

Validação estrita: qualquer problema estrutural rejeita o arquivo
inteiro -- ao contrário do import de extrato bancário (parsers/), que
tolera linha malformada e segue em frente, aqui o arquivo é pequeno,
inteiramente autoral do usuário, e uma importação parcial seria
enganosa (mostraria uma alocação que não é nem a pretendida nem
nenhuma outra coisa coerente). Campos desconhecidos são ignorados, não
rejeitam -- só problemas de integridade de dado rejeitam o arquivo.

O arquivo nunca contém identificador pessoal (sem user_id, e-mail,
nome) -- pode ser compartilhado com qualquer pessoa.

Isolado da UI e do banco de propósito, mesmo espírito de
utils/plan_strategy.py.
"""
import json
from typing import List, Optional, Tuple, Union

from utils.asset_classes import ASSET_CLASSES

SCHEMA_VERSION = 1
SUPPORTED_SCHEMA_VERSIONS = {1}
KIND = "des.tino_portfolio"

MAX_IMPORT_FILE_BYTES = 1_000_000
MAX_IMPORT_ITEMS = 200
PCT_SUM_TOLERANCE = 0.01


def build_export_payload(name: str, items: List[dict], mode: str) -> dict:
    """items: [{"asset_class", "label", "value"}] -- value é em R$ no
    modo absoluto, fração 0-1 no modo percentual (mesma convenção de
    mock_portfolios.value_mode). Nunca inclui user_id/e-mail/nome."""
    key = "value" if mode == "absolute" else "pct"
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": KIND,
        "mode": mode,
        "portfolio_name": name,
        "items": [
            {"asset_class": it["asset_class"], "label": it.get("label"), key: it["value"]}
            for it in items
        ],
    }


def validate_import_payload(raw_text: str) -> Tuple[bool, Union[dict, str]]:
    """Retorna (True, dados) em caso de sucesso ou (False, mensagem_de_erro).

    dados: {"name": str, "mode": "absolute"|"percentage",
    "items": [{"asset_class", "label", "value"}]} -- value já
    normalizado (R$ no modo absoluto, fração 0-1 no percentual), pronto
    pra passar direto pra create_mock_portfolio_bulk.
    """
    if len(raw_text.encode("utf-8")) > MAX_IMPORT_FILE_BYTES:
        return False, "Arquivo muito grande (máximo 1 MB)."

    try:
        data = json.loads(raw_text)
    except Exception:
        return False, "Arquivo inválido: não é um JSON válido."

    if not isinstance(data, dict):
        return False, "Arquivo inválido: formato inesperado."

    if data.get("kind") != KIND:
        return False, "Este arquivo não é uma carteira do des.tino."

    if data.get("schema_version") not in SUPPORTED_SCHEMA_VERSIONS:
        return False, "Versão do arquivo não suportada."

    mode = data.get("mode")
    if mode not in ("absolute", "percentage"):
        return False, "Arquivo inválido: modo desconhecido."

    items_raw = data.get("items")
    if not isinstance(items_raw, list) or len(items_raw) == 0:
        return False, "Arquivo inválido: nenhum item encontrado."
    if len(items_raw) > MAX_IMPORT_ITEMS:
        return False, f"Arquivo inválido: muitos itens (máximo {MAX_IMPORT_ITEMS})."

    key = "value" if mode == "absolute" else "pct"
    items: List[dict] = []
    total_pct = 0.0
    for raw_item in items_raw:
        if not isinstance(raw_item, dict):
            return False, "Arquivo inválido: item malformado."

        asset_class = raw_item.get("asset_class")
        if asset_class not in ASSET_CLASSES:
            return False, f'Arquivo inválido: classe de ativo desconhecida ("{asset_class}").'

        raw_value = raw_item.get(key)
        is_number = isinstance(raw_value, (int, float)) and not isinstance(raw_value, bool)
        if not is_number or raw_value < 0:
            return False, "Arquivo inválido: valor inválido ou negativo."

        label = raw_item.get("label")
        if not isinstance(label, str) or not label.strip():
            label = None

        items.append({"asset_class": asset_class, "label": label, "value": float(raw_value)})
        if mode == "percentage":
            total_pct += float(raw_value)

    if mode == "percentage" and abs(total_pct - 1.0) > PCT_SUM_TOLERANCE:
        return False, f"Arquivo inválido: a soma dos percentuais é {total_pct * 100:.0f}%, deveria ser 100%."

    name = data.get("portfolio_name")
    if not isinstance(name, str) or not name.strip():
        name = "Carteira importada"

    return True, {"name": name.strip(), "mode": mode, "items": items}
