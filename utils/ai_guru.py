"""Integração com a API do Claude para o Guru Financeiro."""
import os
import json
from typing import Callable

from utils.helpers import format_currency

_MODEL   = "claude-sonnet-4-6"
_API_URL = "https://api.anthropic.com/v1/messages"

_SYSTEM_BASE = """Você é o Guru Financeiro do app des.tino, um consultor financeiro brasileiro consultivo e empático.

## Perfil
- Fala em português brasileiro, de forma clara e acessível
- Orienta e faz perguntas para entender o contexto antes de dar recomendações
- Não dá receitas genéricas — personaliza com base nos dados financeiros do usuário
- É direto e objetivo: máximo 3 parágrafos por resposta, use marcadores quando listar itens

## Contexto do Mercado Financeiro Brasileiro
- **Selic/CDI**: taxa básica de juros, benchmark para renda fixa (CDB, LCI, LCA)
- **IPCA**: inflação oficial. Tesouro IPCA+ protege o poder de compra no longo prazo
- **Tesouro Direto**: títulos do governo federal — Selic (liquidez diária, baixo risco), IPCA+ (proteção inflação, marcação a mercado), Prefixado (taxa travada, risco de marcação)
- **LCI/LCA**: isentos de IR para pessoa física, garantidos pelo FGC até R$ 250.000/IF
- **CDB**: tributado pelo IR regressivo (22,5% até 180 dias → 15% acima de 720 dias), garantido pelo FGC
- **FGC**: cobre até R$ 250.000 por CPF por instituição financeira
- **PGBL**: dedução no IR (declaração completa), tributação no resgate sobre valor total — ideal para quem deduz
- **VGBL**: sem dedução, tributação só sobre rendimentos — melhor para declaração simplificada
- **Regra 50/30/20**: 50% necessidades, 30% desejos, 20% poupança/investimentos
- **Reserva de emergência**: ideal 6 meses de despesas mensais em ativos de alta liquidez

## Dados Financeiros do Usuário (mês atual)
{user_context}

## Formato das Respostas
- Máximo 3 parágrafos ou listas com bullet points
- Use **negrito** para valores e termos-chave
- Se a pergunta for vaga, faça UMA pergunta de clarificação antes de responder
- Ao citar produtos, mencione os prós e contras relevantes para o perfil do usuário

## Disclaimer
Suas orientações são educativas e informativas. Para decisões de grande porte (valores acima de R$ 50.000, previdência, financiamento), recomende consultor financeiro certificado (CFP®)."""


def _build_user_context(s: dict) -> str:
    entradas  = s.get("total_entradas", 0)
    saidas    = s.get("total_saidas", 0)
    saldo     = s.get("saldo", 0)
    inv_mes   = s.get("total_investimentos", 0)
    inv_pct   = (inv_mes / entradas * 100) if entradas > 0 else 0
    gasto_pct = (saidas / entradas * 100) if entradas > 0 else 0

    lines = [
        f"- Entradas do mês: {format_currency(entradas)}",
        f"- Saídas do mês: {format_currency(saidas)} ({gasto_pct:.1f}% da renda)",
        f"- Investido neste mês: {format_currency(inv_mes)} ({inv_pct:.1f}% da renda)",
        f"- Saldo líquido do mês: {format_currency(saldo)}",
    ]
    if s.get("has_expectations"):
        n    = int(s.get("n_expectations", 0))
        proj = s.get("saldo_projetado", 0)
        lines.append(
            f"- Saldo projetado (com {n} lançamento(s) previsto(s)): {format_currency(proj)}"
        )
    return "\n".join(lines)


def call_guru(
    question: str,
    context: dict,
    on_token: Callable[[str], None],
    on_done: Callable[[], None],
    on_error: Callable[[str], None],
) -> None:
    """Chama a API do Claude com streaming. Deve rodar em thread separada."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        on_error(
            "ANTHROPIC_API_KEY não configurada.\n"
            "Defina a variável de ambiente com sua chave da Anthropic para usar o Guru com IA."
        )
        return

    try:
        import httpx
    except ImportError:
        on_error("Biblioteca httpx não encontrada. Execute: pip install httpx")
        return

    system_prompt = _SYSTEM_BASE.format(user_context=_build_user_context(context))
    payload = {
        "model":      _MODEL,
        "max_tokens": 1024,
        "system":     system_prompt,
        "messages":   [{"role": "user", "content": question}],
        "stream":     True,
    }
    headers = {
        "x-api-key":        api_key,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
    }

    try:
        with httpx.stream(
            "POST", _API_URL,
            json=payload, headers=headers, timeout=60.0,
        ) as resp:
            if resp.status_code == 401:
                on_error("Chave de API inválida. Verifique ANTHROPIC_API_KEY.")
                return
            if resp.status_code == 429:
                on_error("Muitas requisições. Aguarde alguns segundos e tente novamente.")
                return
            if resp.status_code != 200:
                on_error(f"Erro na API ({resp.status_code}). Tente novamente.")
                return

            for line in resp.iter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    if chunk.get("type") == "content_block_delta":
                        text = chunk.get("delta", {}).get("text", "")
                        if text:
                            on_token(text)
                except Exception:
                    pass

        on_done()

    except Exception as exc:
        name = type(exc).__name__
        msg  = str(exc).lower()
        if "timeout" in name.lower() or "timeout" in msg:
            on_error("Tempo esgotado. Verifique sua conexão e tente novamente.")
        elif "connect" in name.lower() or "connect" in msg:
            on_error("Sem conexão com a internet. Verifique sua rede.")
        else:
            on_error(f"Erro inesperado: {str(exc)[:80]}")
