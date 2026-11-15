"""Stable identifiers and cache fingerprints."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def question_id(slot_id: str, final_slot_id: str) -> str:
    return _sha(f"v1|{slot_id}|{final_slot_id}")[:24]


def method_id(question_id_: str, method_index: int, method_name: str) -> str:
    return f"meth_{_sha(f'{question_id_}|{method_index}|{method_name}')[:16]}"


def step_id(question_id_: str, method_id_: str, step_number: int) -> str:
    return f"step_{_sha(f'{question_id_}|{method_id_}|{step_number}')[:16]}"


def mention_id(question_id_: str, concept_name: str) -> str:
    return f"men_{_sha(f'{question_id_}|{concept_name.strip()}')[:16]}"


def canonical_id_from_seed(seed: str) -> str:
    return f"c_{_sha(seed)[:16]}"


def slot_record_cache_key(item: dict[str, Any]) -> str:
    """Hash key for solution cache (question content + verification)."""
    rec = item.get("record") or {}
    stub = {
        "final_slot_id": item.get("final_slot_id"),
        "subject": rec.get("subject"),
        "canonical_question_latex": rec.get("canonical_question_latex"),
        "canonical_options": rec.get("canonical_options"),
        "final_answer": rec.get("final_answer"),
        "verification_status": item.get("verification_status"),
    }
    return _sha(json.dumps(stub, sort_keys=True, ensure_ascii=False))


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def solution_cache_key(
    slot_record_key: str,
    prompt_hash: str,
    schema_hash: str,
    model_policy: str,
) -> str:
    return _sha(
        f"{slot_record_key}|{prompt_hash}|{schema_hash}|{model_policy}"
    )[:32]
