"""Validate that every model id referenced by the project still exists on OpenRouter.

Usage:
    uv run python scripts/check_models.py              # human-readable report, exit 1 if any MISSING
    uv run python scripts/check_models.py --json       # JSON report
    uv run python scripts/check_models.py --suggest    # include suggested replacements
    uv run python scripts/check_models.py --regen-catalog  # overwrite backend/models_catalog.py

Sources scanned:
    - backend/config.py (COUNCIL_MODELS, CHAIRMAN_MODEL)
    - backend/councils.py (_DEFAULT_COUNCILS)
    - backend/models_catalog.py (CATALOG)
    - data/councils.json (persisted councils, if present)

Status values:
    OK        - id is live on OpenRouter
    MISSING   - id is not on OpenRouter (live calls will 404)
    STALE     - id is live but a newer model from the same provider exists (>180 days gap)
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
STALE_DAYS = 180


# ---------- fetch ----------

def fetch_openrouter_models() -> dict[str, dict]:
    """Return {model_id: model_dict} from OpenRouter's public model list."""
    req = urllib.request.Request(
        OPENROUTER_URL,
        headers={"Accept": "application/json", "User-Agent": "llm-council-check/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return {m["id"]: m for m in payload.get("data", [])}


# ---------- collect referenced ids ----------

def _load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def collect_referenced_ids() -> dict[str, list[tuple[str, str]]]:
    """Return {model_id: [(source, context), ...]} for every id the project references."""
    refs: dict[str, list[tuple[str, str]]] = {}

    def add(model_id: str, source: str, context: str) -> None:
        refs.setdefault(model_id, []).append((source, context))

    # backend/config.py
    config_path = ROOT / "backend" / "config.py"
    if config_path.exists():
        cfg = _load_module(config_path, "_check_cfg")
        for m in getattr(cfg, "COUNCIL_MODELS", []):
            add(m, "config.py", "COUNCIL_MODELS")
        chair = getattr(cfg, "CHAIRMAN_MODEL", None)
        if chair:
            add(chair, "config.py", "CHAIRMAN_MODEL")

    # backend/councils.py defaults
    councils_path = ROOT / "backend" / "councils.py"
    if councils_path.exists():
        cmod = _load_module(councils_path, "_check_councils")
        for council in getattr(cmod, "_DEFAULT_COUNCILS", []):
            for m in council.get("models", []):
                add(m, "councils.py", f"_DEFAULT_COUNCILS[{council['id']}].models")
            chair = council.get("chairman")
            if chair:
                add(chair, "councils.py", f"_DEFAULT_COUNCILS[{council['id']}].chairman")

    # backend/models_catalog.py
    catalog_path = ROOT / "backend" / "models_catalog.py"
    if catalog_path.exists():
        cat = _load_module(catalog_path, "_check_catalog")
        for entry in getattr(cat, "CATALOG", []):
            add(entry["id"], "models_catalog.py", "CATALOG")

    # data/councils.json (persisted state)
    persisted = ROOT / "data" / "councils.json"
    if persisted.exists():
        try:
            payload = json.loads(persisted.read_text(encoding="utf-8"))
            for council in payload.get("councils", []):
                for m in council.get("models", []):
                    add(m, "data/councils.json", f"{council['id']}.models")
                chair = council.get("chairman")
                if chair:
                    add(chair, "data/councils.json", f"{council['id']}.chairman")
        except (json.JSONDecodeError, OSError):
            pass

    return refs


# ---------- analyse ----------

def _provider_prefix(model_id: str) -> str:
    return model_id.split("/", 1)[0] if "/" in model_id else model_id


def suggest_successor(model_id: str, live: dict[str, dict]) -> str | None:
    """Pick the most recent live model from the same provider as a hint."""
    provider = _provider_prefix(model_id)
    candidates = [m for mid, m in live.items() if mid.startswith(f"{provider}/")]
    if not candidates:
        return None
    candidates.sort(key=lambda m: m.get("created", 0), reverse=True)
    return candidates[0]["id"]


def analyse(refs: dict[str, list[tuple[str, str]]], live: dict[str, dict]) -> list[dict]:
    """Return a list of {id, status, sources, created_at, successor?} rows."""
    now_ts = datetime.now(tz=timezone.utc).timestamp()
    rows: list[dict] = []
    for model_id, sources in sorted(refs.items()):
        live_entry = live.get(model_id)
        row: dict = {
            "id": model_id,
            "sources": [{"source": s, "context": c} for s, c in sources],
        }
        if live_entry is None:
            row["status"] = "MISSING"
            row["successor"] = suggest_successor(model_id, live)
        else:
            created = live_entry.get("created", 0)
            row["created_at"] = (
                datetime.fromtimestamp(created, tz=timezone.utc).strftime("%Y-%m-%d")
                if created
                else None
            )
            age_days = (now_ts - created) / 86400 if created else 0
            successor = suggest_successor(model_id, live)
            if (
                successor
                and successor != model_id
                and live.get(successor, {}).get("created", 0)
                - live_entry.get("created", 0)
                > STALE_DAYS * 86400
            ):
                row["status"] = "STALE"
                row["successor"] = successor
                row["age_days"] = round(age_days)
            else:
                row["status"] = "OK"
        rows.append(row)
    return rows


# ---------- catalog regeneration ----------

def _infer_tier(output_per_1m: float) -> str:
    if output_per_1m < 2:
        return "cheap"
    if output_per_1m < 10:
        return "mid"
    return "premium"


def _provider_label(prefix: str) -> str:
    return {
        "anthropic": "Anthropic",
        "openai": "OpenAI",
        "google": "Google",
        "x-ai": "xAI",
        "meta-llama": "Meta",
        "mistralai": "Mistral",
        "deepseek": "DeepSeek",
        "qwen": "Qwen",
    }.get(prefix, prefix.capitalize())


CATALOG_INCLUDE_PREFIXES = (
    "anthropic/",
    "openai/",
    "google/",
    "x-ai/",
    "meta-llama/",
    "mistralai/",
    "deepseek/",
    "qwen/",
)


def regenerate_catalog(live: dict[str, dict]) -> str:
    """Build a fresh backend/models_catalog.py content string from the live API."""
    rows: list[dict] = []
    for mid, m in live.items():
        if not mid.startswith(CATALOG_INCLUDE_PREFIXES):
            continue
        pricing = m.get("pricing") or {}
        try:
            input_per_tok = float(pricing.get("prompt", 0) or 0)
            output_per_tok = float(pricing.get("completion", 0) or 0)
        except (TypeError, ValueError):
            continue
        if input_per_tok <= 0 and output_per_tok <= 0:
            continue
        input_per_1m = round(input_per_tok * 1_000_000, 4)
        output_per_1m = round(output_per_tok * 1_000_000, 4)
        rows.append(
            {
                "id": mid,
                "name": m.get("name") or mid.split("/", 1)[-1],
                "provider": _provider_label(_provider_prefix(mid)),
                "input_price_per_1m": input_per_1m,
                "output_price_per_1m": output_per_1m,
                "context_window": int(m.get("context_length") or 0),
                "tier": _infer_tier(output_per_1m),
            }
        )
    # Stable sort: provider, then output_price desc (premium first), then id
    rows.sort(key=lambda r: (r["provider"], -r["output_price_per_1m"], r["id"]))

    today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    header = f'''"""Catalog of OpenRouter models with pricing data for cost estimation.

Prices are per 1M tokens (input/output) in USD.
AUTO-GENERATED from OpenRouter on {today} by scripts/check_models.py --regen-catalog.
Re-run that script to refresh. Manual edits will be overwritten.
"""

# Assumed tokens for a typical query cost estimate:
# 1500 input tokens (prompt + context) + 500 output tokens per model
_TYPICAL_INPUT_TOKENS = 1500
_TYPICAL_OUTPUT_TOKENS = 500

CATALOG: list[dict] = [
'''
    lines = [header]
    current_provider = None
    for r in rows:
        if r["provider"] != current_provider:
            lines.append(f'    # --- {r["provider"]} ---\n')
            current_provider = r["provider"]
        lines.append(
            "    {\n"
            f'        "id": "{r["id"]}",\n'
            f'        "name": "{r["name"]}",\n'
            f'        "provider": "{r["provider"]}",\n'
            f'        "input_price_per_1m": {r["input_price_per_1m"]},\n'
            f'        "output_price_per_1m": {r["output_price_per_1m"]},\n'
            f'        "context_window": {r["context_window"]},\n'
            f'        "tier": "{r["tier"]}",\n'
            "    },\n"
        )
    footer = '''']

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
'''
    # The CATALOG list is closed at the start of `footer` with `]`. Drop the leading
    # quote marker used to keep this triple-quoted block syntactically clean.
    lines.append(footer.lstrip("'"))
    return "".join(lines)


# ---------- output ----------

STATUS_ICON = {"OK": "OK ", "MISSING": "!! ", "STALE": "~~ "}


def print_human(rows: list[dict], show_suggestions: bool) -> None:
    width = max((len(r["id"]) for r in rows), default=30)
    missing = [r for r in rows if r["status"] == "MISSING"]
    stale = [r for r in rows if r["status"] == "STALE"]
    ok = [r for r in rows if r["status"] == "OK"]

    print(f"Scanned {len(rows)} unique model ids.\n")
    if missing:
        print(f"MISSING ({len(missing)}) - will 404 on call:")
        for r in missing:
            line = f"  {r['id']:<{width}}"
            if show_suggestions and r.get("successor"):
                line += f"  -> suggest: {r['successor']}"
            print(line)
            for s in r["sources"]:
                print(f"      from: {s['source']}:{s['context']}")
        print()
    if stale:
        print(f"STALE ({len(stale)}) - live but newer sibling exists:")
        for r in stale:
            tail = f" (age ~{r.get('age_days', '?')}d)"
            line = f"  {r['id']:<{width}}{tail}"
            if show_suggestions and r.get("successor"):
                line += f"  -> newer: {r['successor']}"
            print(line)
        print()
    print(f"OK ({len(ok)})")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", action="store_true", help="emit JSON report")
    ap.add_argument("--suggest", action="store_true", help="include suggested replacements")
    ap.add_argument("--regen-catalog", action="store_true",
                    help="overwrite backend/models_catalog.py with fresh data from OpenRouter")
    args = ap.parse_args()

    try:
        live = fetch_openrouter_models()
    except Exception as exc:
        print(f"ERROR fetching OpenRouter: {exc}", file=sys.stderr)
        return 2

    if args.regen_catalog:
        content = regenerate_catalog(live)
        target = ROOT / "backend" / "models_catalog.py"
        target.write_text(content, encoding="utf-8")
        marker = '"id":'
        print(f"wrote {target} ({len(content)} bytes, {content.count(marker)} entries)")
        # also still run the check
    refs = collect_referenced_ids()
    rows = analyse(refs, live)

    if args.json:
        print(json.dumps({"checked_at": datetime.now(tz=timezone.utc).isoformat(),
                          "rows": rows}, indent=2, ensure_ascii=False))
    else:
        print_human(rows, show_suggestions=args.suggest or args.regen_catalog)

    has_missing = any(r["status"] == "MISSING" for r in rows)
    return 1 if has_missing else 0


if __name__ == "__main__":
    sys.exit(main())
