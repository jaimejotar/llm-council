"""CRUD for council configurations stored in data/councils.json."""

import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

_DATA_FILE = Path(__file__).parent.parent / "data" / "councils.json"

_DEFAULT_COUNCILS = [
    {
        "id": "exploracion_barata",
        "name": "Exploración Barata",
        "is_preset": True,
        "models": [
            "anthropic/claude-haiku-4.5",
            "openai/gpt-4.1-mini",
            "google/gemini-2.0-flash-001",
            "meta-llama/llama-4-maverick",
        ],
        "chairman": "google/gemini-2.0-flash-001",
        "created_at": "2026-05-08T00:00:00Z",
    },
    {
        "id": "consejo_premium",
        "name": "Consejo Premium",
        "is_preset": True,
        "models": [
            "anthropic/claude-sonnet-4.5",
            "google/gemini-2.5-pro-preview",
            "openai/gpt-4.1",
            "x-ai/grok-3",
        ],
        "chairman": "google/gemini-2.5-pro-preview",
        "created_at": "2026-05-08T00:00:00Z",
    },
]


def _validate(data: dict) -> None:
    """Raise ValueError if council data is invalid."""
    if not data.get("name", "").strip():
        raise ValueError("name is required")
    models = data.get("models", [])
    if not models:
        raise ValueError("models must contain at least one model")
    if data.get("chairman") not in models:
        raise ValueError("chairman must be one of the selected models")


def load_councils() -> list[dict]:
    if not _DATA_FILE.exists():
        return []
    try:
        with open(_DATA_FILE, encoding="utf-8") as f:
            payload = json.load(f)
        return payload.get("councils", [])
    except (json.JSONDecodeError, OSError):
        return []


def save_councils(councils: list[dict]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _DATA_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "councils": councils}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, _DATA_FILE)


def seed_defaults() -> None:
    """Populate councils.json with default presets if it is empty."""
    if not load_councils():
        save_councils(_DEFAULT_COUNCILS)


def get_council(council_id: str) -> dict | None:
    for c in load_councils():
        if c["id"] == council_id:
            return c
    return None


def create_council(data: dict) -> dict:
    _validate(data)
    councils = load_councils()
    council = {
        "id": secrets.token_hex(4),
        "name": data["name"].strip(),
        "is_preset": False,
        "models": data["models"],
        "chairman": data["chairman"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    councils.append(council)
    save_councils(councils)
    return council


def update_council(council_id: str, data: dict) -> dict:
    _validate(data)
    councils = load_councils()
    for i, c in enumerate(councils):
        if c["id"] == council_id:
            councils[i] = {
                **c,
                "name": data["name"].strip(),
                "models": data["models"],
                "chairman": data["chairman"],
            }
            save_councils(councils)
            return councils[i]
    raise KeyError(council_id)


def delete_council(council_id: str) -> bool:
    councils = load_councils()
    new_list = [c for c in councils if c["id"] != council_id]
    if len(new_list) == len(councils):
        return False
    save_councils(new_list)
    return True
