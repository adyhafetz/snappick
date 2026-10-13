"""Privacy-safe deterministic split and source-dataset audit helpers."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path
from typing import Any, Iterable

from .contract import LABELS


def stable_split(records: Iterable[dict[str, Any]], seed: int = 42) -> dict[str, list[dict[str, Any]]]:
    """Split whole sessions deterministically to prevent near-duplicate leakage."""
    items = list(records)
    groups: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        session = str(item.get("session_id", "unrecorded"))
        duplicate_group = item.get("duplicate_group") or item.get("perceptual_hash")
        # A supplied duplicate/perceptual-hash group is kept intact even if a
        # capture tool accidentally emitted different session identifiers.
        key = f"duplicate:{duplicate_group}" if duplicate_group else f"session:{session}"
        groups.setdefault(key, []).append(item)
    sessions = list(groups)
    random.Random(seed).shuffle(sessions)
    n = len(sessions)
    val_end = max(1, int(n * 0.2)) if n else 0
    held_end = max(val_end, int(n * 0.3)) if n else 0
    return {
        "validation": [r for s in sessions[:val_end] for r in groups[s]],
        "held_out": [r for s in sessions[val_end:held_end] for r in groups[s]],
        "train": [r for s in sessions[held_end:] for r in groups[s]],
    }


def audit_records(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    items = list(records)
    counts = {label: 0 for label in LABELS}
    errors: list[str] = []
    sessions: set[str] = set()
    for record in items:
        sessions.add(str(record.get("session_id", "unrecorded")))
        for box in record.get("boxes", []):
            label = box.get("label")
            if label not in LABELS:
                errors.append(f"unknown label: {label!r}")
            else:
                counts[label] += 1
    return {"images": len(items), "sessions": len(sessions), "instances_by_class": counts, "errors": errors}


def manifest_hash(manifest: dict[str, Any]) -> str:
    payload = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
