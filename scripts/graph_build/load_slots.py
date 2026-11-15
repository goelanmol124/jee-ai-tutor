"""Discover all slots_v2 final75 corpuses and load records."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from . import paths


@dataclass(frozen=True)
class SlotManifest:
    """One shift folder with verified final75 export."""

    slot_dir: Path
    slot_id: str  # folder name, e.g. 2026-04-02-shift-1
    records_path: Path
    record_count: int

    def fingerprint(self, records_blob: bytes) -> str:
        h = hashlib.sha256(records_blob)
        return h.hexdigest()


def discover_slot_manifests(
    slots_root: Path | None = None,
) -> list[SlotManifest]:
    root = slots_root or paths.SLOTS_V2_ROOT
    if not root.is_dir():
        return []
    manifests: list[SlotManifest] = []
    for p in sorted(root.iterdir()):
        if not p.is_dir():
            continue
        rf = p / "final75" / "final_75_records.json"
        if not rf.is_file():
            continue
        data = json.loads(rf.read_text(encoding="utf-8"))
        records = data.get("records") or []
        manifests.append(
            SlotManifest(
                slot_dir=p,
                slot_id=p.name,
                records_path=rf,
                record_count=len(records),
            )
        )
    return manifests


def write_inventory(output_path: Path | None = None) -> Path:
    """Write corpus inventory JSON for downstream batching."""
    out = output_path or (paths.GRAPH_RUNS / "inventory.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    manifests = discover_slot_manifests()
    rows = []
    total = 0
    for m in manifests:
        blob = m.records_path.read_bytes()
        rows.append(
            {
                "slot_id": m.slot_id,
                "records_path": str(m.records_path.relative_to(paths.REPO)),
                "record_count": m.record_count,
                "records_sha256": m.fingerprint(blob),
            }
        )
        total += m.record_count
    doc = {
        "slots_root": str(paths.SLOTS_V2_ROOT.relative_to(paths.REPO)),
        "slot_count": len(rows),
        "total_records": total,
        "slots": rows,
    }
    out.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


def load_records(slot_dir: Path) -> list[dict[str, Any]]:
    path = slot_dir / "final75" / "final_75_records.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data["records"])


def iter_all_items(
    slots_root: Path | None = None,
) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield (slot_id, item) for every record in every discovered slot."""
    for m in discover_slot_manifests(slots_root):
        for item in load_records(m.slot_dir):
            yield (m.slot_id, item)


def corpus_batch_slot_ids(limit_slots: int | None = None) -> list[str]:
    ids = [m.slot_id for m in discover_slot_manifests()]
    if limit_slots is not None:
        return ids[:limit_slots]
    return ids
