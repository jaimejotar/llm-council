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
            "openai/gpt-5.4-mini",
            "google/gemini-2.5-flash",
            "meta-llama/llama-4-maverick",
        ],
        "chairman": "anthropic/claude-sonnet-4.6",
        "created_at": "2026-05-29T00:00:00Z",
    },
    {
        "id": "consejo_premium",
        "name": "Consejo Premium",
        "is_preset": True,
        "models": [
            "anthropic/claude-opus-4.8",
            "google/gemini-3.1-pro-preview",
            "openai/gpt-5.5",
            "x-ai/grok-4.3",
        ],
        "chairman": "anthropic/claude-opus-4.8",
        "created_at": "2026-05-29T00:00:00Z",
    },
]

# Fingerprints of past default configurations.  An on-disk preset that matches
# one of these byte-for-byte (same id + models + chairman) is assumed to be an
# untouched legacy default and is safe to re-seed during startup migration.
# Each entry is keyed by the council id so unrelated presets can never collide.
_LEGACY_FINGERPRINTS: dict[str, list[dict]] = {
    "exploracion_barata": [
        {
            "models": [
                "anthropic/claude-haiku-4.5",
                "openai/gpt-4.1-mini",
                "google/gemini-2.0-flash-001",
                "meta-llama/llama-4-maverick",
            ],
            "chairman": "google/gemini-2.0-flash-001",
        },
    ],
    "consejo_premium": [
        {
            "models": [
                "anthropic/claude-sonnet-4.5",
                "google/gemini-2.5-pro-preview",
                "openai/gpt-4.1",
                "x-ai/grok-3",
            ],
            "chairman": "google/gemini-2.5-pro-preview",
        },
    ],
}


def _validate(data: dict) -> None:
    """Raise ValueError if council data is invalid."""
    if not data.get("name", "").strip():
        raise ValueError("name is required")
    models = data.get("models", [])
    if not models:
        raise ValueError("models must contain at least one model")
    if data.get("chairman") not in models:
        raise ValueError("chairman must be one of the selected models")


def _catalog_id_set() -> set[str]:
    """Set of model ids known to the local catalog (used to flag invalid_models)."""
    try:
        from . import models_catalog  # local import to avoid circular at module load
        return {m["id"] for m in models_catalog.get_catalog()}
    except Exception:
        return set()


def _annotate_invalid_models(councils: list[dict]) -> list[dict]:
    """Return councils with an `invalid_models` field (ids not present in the catalog)."""
    catalog = _catalog_id_set()
    if not catalog:
        # Catalog unavailable: don't annotate (avoid false positives).
        return councils
    out: list[dict] = []
    for c in councils:
        missing = [m for m in c.get("models", []) if m not in catalog]
        chair = c.get("chairman")
        if chair and chair not in catalog and chair not in missing:
            missing.append(chair)
        out.append({**c, "invalid_models": missing})
    return out


def _read_raw_councils() -> list[dict]:
    """Read councils from disk without any annotations."""
    if not _DATA_FILE.exists():
        return []
    try:
        with open(_DATA_FILE, encoding="utf-8") as f:
            payload = json.load(f)
        return payload.get("councils", [])
    except (json.JSONDecodeError, OSError):
        return []


def load_councils() -> list[dict]:
    """Load councils from disk, annotated with `invalid_models`."""
    return _annotate_invalid_models(_read_raw_councils())


def save_councils(councils: list[dict]) -> None:
    _DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Strip computed-at-read fields before persisting.
    cleaned = [{k: v for k, v in c.items() if k != "invalid_models"} for c in councils]
    tmp = _DATA_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "councils": cleaned}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, _DATA_FILE)


def seed_defaults() -> None:
    """Populate councils.json with default presets if it is empty."""
    if not _read_raw_councils():
        save_councils(_DEFAULT_COUNCILS)


def migrate_legacy_presets() -> list[str]:
    """Replace untouched legacy presets in data/councils.json with current defaults.

    A persisted preset is considered "legacy untouched" when its id matches a known
    preset id AND its (models, chairman) tuple matches an entry in _LEGACY_FINGERPRINTS.
    Custom councils and user-edited presets are never modified.

    Returns the list of preset ids that were re-seeded.
    """
    on_disk = _read_raw_councils()
    if not on_disk:
        # Nothing to migrate; let seed_defaults() handle first-run case.
        return []

    defaults_by_id = {c["id"]: c for c in _DEFAULT_COUNCILS}
    migrated: list[str] = []
    updated_list: list[dict] = []

    for council in on_disk:
        cid = council.get("id")
        legacy_options = _LEGACY_FINGERPRINTS.get(cid)
        replacement = defaults_by_id.get(cid)

        if (
            replacement
            and legacy_options
            and any(
                council.get("models") == fp["models"]
                and council.get("chairman") == fp["chairman"]
                for fp in legacy_options
            )
        ):
            # Preserve original created_at if the user has one we want to keep? We
            # explicitly bump it so a fresh "last-updated" date appears in UIs.
            updated_list.append({**replacement})
            migrated.append(cid)
        else:
            updated_list.append(council)

    if migrated:
        save_councils(updated_list)
    return migrated


def get_council(council_id: str) -> dict | None:
    for c in load_councils():
        if c["id"] == council_id:
            return c
    return None


def create_council(data: dict) -> dict:
    _validate(data)
    councils = _read_raw_councils()
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
    # Annotate the just-created council on the way out.
    return _annotate_invalid_models([council])[0]


def update_council(council_id: str, data: dict) -> dict:
    _validate(data)
    councils = _read_raw_councils()
    for i, c in enumerate(councils):
        if c["id"] == council_id:
            councils[i] = {
                **c,
                "name": data["name"].strip(),
                "models": data["models"],
                "chairman": data["chairman"],
                # Editing a preset means the user has diverged from the default
                # fingerprint; drop the is_preset flag so future migrations skip it.
                "is_preset": False,
            }
            save_councils(councils)
            return _annotate_invalid_models([councils[i]])[0]
    raise KeyError(council_id)


def delete_council(council_id: str) -> bool:
    councils = _read_raw_councils()
    new_list = [c for c in councils if c["id"] != council_id]
    if len(new_list) == len(councils):
        return False
    save_councils(new_list)
    return True
