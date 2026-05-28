"""Catalog of OpenRouter models with pricing data for cost estimation.

Prices are per 1M tokens (input/output) in USD.
Last updated: 2026-05-08. Update manually when OpenRouter prices change.
"""

# Assumed tokens for a typical query cost estimate:
# 1500 input tokens (prompt + context) + 500 output tokens per model
_TYPICAL_INPUT_TOKENS = 1500
_TYPICAL_OUTPUT_TOKENS = 500

CATALOG: list[dict] = [
    # --- Anthropic ---
    {
        "id": "anthropic/claude-haiku-4.5",
        "name": "Claude Haiku 4.5",
        "provider": "Anthropic",
        "input_price_per_1m": 0.80,
        "output_price_per_1m": 4.00,
        "context_window": 200000,
        "tier": "cheap",
    },
    {
        "id": "anthropic/claude-sonnet-4.5",
        "name": "Claude Sonnet 4.5",
        "provider": "Anthropic",
        "input_price_per_1m": 3.00,
        "output_price_per_1m": 15.00,
        "context_window": 200000,
        "tier": "mid",
    },
    {
        "id": "anthropic/claude-opus-4.7",
        "name": "Claude Opus 4.7",
        "provider": "Anthropic",
        "input_price_per_1m": 15.00,
        "output_price_per_1m": 75.00,
        "context_window": 200000,
        "tier": "premium",
    },
    # --- OpenAI ---
    {
        "id": "openai/gpt-4.1-mini",
        "name": "GPT-4.1 Mini",
        "provider": "OpenAI",
        "input_price_per_1m": 0.40,
        "output_price_per_1m": 1.60,
        "context_window": 1047576,
        "tier": "cheap",
    },
    {
        "id": "openai/gpt-4.1",
        "name": "GPT-4.1",
        "provider": "OpenAI",
        "input_price_per_1m": 2.00,
        "output_price_per_1m": 8.00,
        "context_window": 1047576,
        "tier": "mid",
    },
    {
        "id": "openai/gpt-5.1",
        "name": "GPT-5.1",
        "provider": "OpenAI",
        "input_price_per_1m": 2.00,
        "output_price_per_1m": 8.00,
        "context_window": 1047576,
        "tier": "mid",
    },
    {
        "id": "openai/gpt-4.1-nano",
        "name": "GPT-4.1 Nano",
        "provider": "OpenAI",
        "input_price_per_1m": 0.10,
        "output_price_per_1m": 0.40,
        "context_window": 1047576,
        "tier": "cheap",
    },
    # --- Google ---
    {
        "id": "google/gemini-2.0-flash-001",
        "name": "Gemini 2.0 Flash",
        "provider": "Google",
        "input_price_per_1m": 0.10,
        "output_price_per_1m": 0.40,
        "context_window": 1048576,
        "tier": "cheap",
    },
    {
        "id": "google/gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "Google",
        "input_price_per_1m": 0.15,
        "output_price_per_1m": 0.60,
        "context_window": 1048576,
        "tier": "cheap",
    },
    {
        "id": "google/gemini-2.5-pro-preview",
        "name": "Gemini 2.5 Pro",
        "provider": "Google",
        "input_price_per_1m": 1.25,
        "output_price_per_1m": 10.00,
        "context_window": 1048576,
        "tier": "premium",
    },
    {
        "id": "google/gemini-3.1-pro-preview",
        "name": "Gemini 3.1 Pro",
        "provider": "Google",
        "input_price_per_1m": 2.50,
        "output_price_per_1m": 15.00,
        "context_window": 1048576,
        "tier": "premium",
    },
    # --- xAI ---
    {
        "id": "x-ai/grok-3",
        "name": "Grok 3",
        "provider": "xAI",
        "input_price_per_1m": 3.00,
        "output_price_per_1m": 15.00,
        "context_window": 131072,
        "tier": "premium",
    },
    {
        "id": "x-ai/grok-3-mini",
        "name": "Grok 3 Mini",
        "provider": "xAI",
        "input_price_per_1m": 0.30,
        "output_price_per_1m": 0.50,
        "context_window": 131072,
        "tier": "cheap",
    },
    {
        "id": "x-ai/grok-4",
        "name": "Grok 4",
        "provider": "xAI",
        "input_price_per_1m": 3.00,
        "output_price_per_1m": 15.00,
        "context_window": 256000,
        "tier": "premium",
    },
    # --- Meta ---
    {
        "id": "meta-llama/llama-4-maverick",
        "name": "Llama 4 Maverick",
        "provider": "Meta",
        "input_price_per_1m": 0.18,
        "output_price_per_1m": 0.54,
        "context_window": 1048576,
        "tier": "cheap",
    },
    {
        "id": "meta-llama/llama-4-scout",
        "name": "Llama 4 Scout",
        "provider": "Meta",
        "input_price_per_1m": 0.08,
        "output_price_per_1m": 0.30,
        "context_window": 512000,
        "tier": "cheap",
    },
    # --- Mistral ---
    {
        "id": "mistralai/mistral-small-3.2-24b-instruct",
        "name": "Mistral Small 3.2",
        "provider": "Mistral",
        "input_price_per_1m": 0.10,
        "output_price_per_1m": 0.30,
        "context_window": 128000,
        "tier": "cheap",
    },
    {
        "id": "mistralai/mistral-large-2411",
        "name": "Mistral Large",
        "provider": "Mistral",
        "input_price_per_1m": 2.00,
        "output_price_per_1m": 6.00,
        "context_window": 128000,
        "tier": "mid",
    },
    # --- DeepSeek ---
    {
        "id": "deepseek/deepseek-chat-v3-0324",
        "name": "DeepSeek V3",
        "provider": "DeepSeek",
        "input_price_per_1m": 0.27,
        "output_price_per_1m": 1.10,
        "context_window": 163840,
        "tier": "cheap",
    },
    {
        "id": "deepseek/deepseek-r1",
        "name": "DeepSeek R1",
        "provider": "DeepSeek",
        "input_price_per_1m": 0.55,
        "output_price_per_1m": 2.19,
        "context_window": 163840,
        "tier": "mid",
    },
]

# Index for O(1) lookup by model id
_CATALOG_INDEX: dict[str, dict] = {m["id"]: m for m in CATALOG}


def get_catalog() -> list[dict]:
    return CATALOG


def get_model(model_id: str) -> dict | None:
    return _CATALOG_INDEX.get(model_id)


def estimate_query_cost(model_ids: list[str]) -> dict:
    """Estimate cost for one full council query (all members + chairman synthesizes).

    Chairman is assumed to be one of the model_ids, so it's already counted.
    Each model processes the full prompt (input) and produces a response (output).
    """
    total_input_cost = 0.0
    total_output_cost = 0.0
    known_models = 0

    for model_id in model_ids:
        model = _CATALOG_INDEX.get(model_id)
        if model is None:
            continue
        known_models += 1
        total_input_cost += model["input_price_per_1m"] * _TYPICAL_INPUT_TOKENS / 1_000_000
        total_output_cost += model["output_price_per_1m"] * _TYPICAL_OUTPUT_TOKENS / 1_000_000

    # Weighted average price per 1M tokens across members
    if known_models > 0:
        avg_input_per_1m = sum(
            _CATALOG_INDEX[m]["input_price_per_1m"]
            for m in model_ids
            if m in _CATALOG_INDEX
        ) / known_models
        avg_output_per_1m = sum(
            _CATALOG_INDEX[m]["output_price_per_1m"]
            for m in model_ids
            if m in _CATALOG_INDEX
        ) / known_models
    else:
        avg_input_per_1m = 0.0
        avg_output_per_1m = 0.0

    return {
        "per_query_usd": round(total_input_cost + total_output_cost, 6),
        "avg_input_per_1m_usd": round(avg_input_per_1m, 4),
        "avg_output_per_1m_usd": round(avg_output_per_1m, 4),
        "known_models": known_models,
        "total_models": len(model_ids),
    }
