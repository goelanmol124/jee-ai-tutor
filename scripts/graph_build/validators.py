"""Pre-ingestion validation gates aligned with Phase 1 plan."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def _ensure_grok_iterate_path() -> None:
    gi = Path(__file__).resolve().parents[1] / "grok_iterate"
    p = str(gi)
    if p not in sys.path:
        sys.path.insert(0, p)


_ensure_grok_iterate_path()
import batch_run as B  # noqa: E402


def validate_solution_payload(
    text: str,
    ground_truth: str | None,
    ground_truth_option_position: int | None,
) -> tuple[bool, dict[str, Any], list[str], dict[str, Any] | None]:
    """Returns (passes_all_gates, score_dict, failure_codes, parsed_json_or_none)."""
    errors: list[str] = []
    data: dict[str, Any] | None = None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        return False, {"parses": False, "parse_error": str(e)}, ["json_invalid"], None

    score = B.score_text(text, ground_truth, ground_truth_option_position or 0)
    if not score.get("parses"):
        errors.append("schema_or_parse_rules")

    if score.get("topic_equals_subject"):
        errors.append("topic_equals_subject")

    if not score.get("subtopic_present"):
        errors.append("subtopic_missing")

    cr = score.get("step_concept_unregistered") or []
    if cr:
        errors.append("step_concept_unregistered")

    if score.get("final_answer_extraction_misuse"):
        errors.append("final_answer_extraction_misuse")

    if score.get("forbidden_concept_names"):
        errors.append("forbidden_concept_names")

    methods = data.get("methods") or []
    stepped_concepts = {
        (step.get("concept") or "").strip().lower()
        for method in methods
        for step in (method.get("steps") or [])
        if (step.get("concept") or "").strip()
    }
    unused_core = [
        c.get("name")
        for c in (data.get("concepts_used") or [])
        if (c.get("name") or "").strip()
        and (c.get("name") or "").strip().lower() not in stepped_concepts
        and c.get("graph_role") == "core"
    ]
    if unused_core:
        score["unused_core_concepts"] = unused_core
        errors.append("unused_core_concepts")

    unused_supporting = [
        c.get("name")
        for c in (data.get("concepts_used") or [])
        if (c.get("name") or "").strip()
        and (c.get("name") or "").strip().lower() not in stepped_concepts
        and c.get("graph_role") == "supporting"
    ]
    if unused_supporting:
        score["unused_supporting_concepts"] = unused_supporting

    if isinstance(data.get("subject"), str) and isinstance(data.get("topic"), str):
        if data["topic"].strip().lower() == data["subject"].strip().lower():
            errors.append("topic_equals_subject_explicit")

    sq = data.get("source_quality")
    if not isinstance(sq, dict) or sq.get("status") is None:
        errors.append("source_quality_missing")

    fad = data.get("final_answer_detail")
    if (
        not isinstance(fad, dict)
        or fad.get("value_latex") is None
        or fad.get("is_unresolved") is None
    ):
        errors.append("final_answer_detail_incomplete")

    ok = len(errors) == 0 and bool(score.get("parses"))
    return ok, score, errors, data
