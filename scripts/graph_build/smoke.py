"""Runtime smoke harness: exporter + trivial picker/diagnosis read checks."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _read_jsonl(path: Path, limit: int = 1000) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if not ln:
                continue
            rows.append(json.loads(ln))
            if len(rows) >= limit:
                break
    return rows


def simulate_cold_start_picker(snapshot_root: Path) -> dict[str, Any]:
    """Pick a low-load question whose core concepts have shallow derived depth."""
    derived = snapshot_root / "derived_metrics.jsonl"
    qc = snapshot_root / "question_concepts.jsonl"
    dr = _read_jsonl(derived, 5000)
    qc_rows = _read_jsonl(qc, 8000)

    depths: dict[str, int] = {}
    qload: dict[str, float] = {}
    for d in dr:
        if d.get("kind") == "concept" and "concept_id" in d:
            depths[str(d["concept_id"])] = int(d.get("depth") or 0)
        if d.get("kind") == "question" and d.get("question_id"):
            qload[str(d["question_id"])] = float(d.get("load_score") or 999)

    qc_by_q: dict[str, list[str]] = {}
    for q in qc_rows:
        qc_by_q.setdefault(str(q["question_id"]), []).append(str(q["concept_id"]))

    ranked: list[tuple[float, str]] = []
    for qid, cids in qc_by_q.items():
        if not cids:
            continue
        avg_d = sum(depths.get(c, 999) for c in cids) / max(len(cids), 1)
        wl = qload.get(qid, 1.0)
        score = -avg_d * 10 - wl * 2
        ranked.append((score, qid))

    ranked.sort(reverse=True)
    best = ranked[0] if ranked else (0.0, None)
    return {
        "profile": "cold_start",
        "chosen_question_id": best[1],
        "candidate_count": len(ranked),
        "explain": "higher_rank_score means shallower prerequisite depth + lighter load heuristic",
        "score": best[0],
    }


def simulate_diagnosis_trace(snapshot_root: Path, question_id: str, step_hint: str) -> dict[str, Any]:
    """Return core concept cards for tutor-style diagnosis read contract."""
    del step_hint  # future: locate step-specific concept
    qcs = [
        q
        for q in _read_jsonl(snapshot_root / "question_concepts.jsonl", 50000)
        if str(q["question_id"]) == question_id
    ]
    concepts = {
        str(c["concept_id"]): c
        for c in _read_jsonl(snapshot_root / "concepts.jsonl", 100000)
    }
    out: dict[str, Any] = {"question_id": question_id, "anchors": [], "fallback": None}
    for qc in sorted(qcs, key=lambda z: (-int(z["is_diagnostic_anchor"]), z.get("role") or "")):
        cid = str(qc["concept_id"])
        card = concepts.get(cid)
        if not card:
            continue
        out["anchors"].append(
            {
                "concept_id": cid,
                "role": qc.get("role"),
                "is_diagnostic_anchor": qc.get("is_diagnostic_anchor"),
                "canonical_name": card.get("canonical_name"),
                "when_to_use": card.get("when_to_use"),
                "statement": card.get("statement"),
            }
        )
    return out


def run_smoke_snapshot(snapshot_root: Path) -> dict[str, Any]:
    """Assert primary artifacts exist; run canned student scenarios."""
    required = (
        "concepts.jsonl",
        "questions.jsonl",
        "question_concepts.jsonl",
        "concept_edges.jsonl",
        "derived_metrics.jsonl",
        "manifest.json",
        "graph_quality_report.json",
    )
    missing = [p for p in required if not (snapshot_root / p).is_file()]
    report: dict[str, Any] = {
        "snapshot": str(snapshot_root),
        "missing": missing,
        "cold_start_picker": simulate_cold_start_picker(snapshot_root),
    }
    best_q = report["cold_start_picker"].get("chosen_question_id")
    if isinstance(best_q, str) and best_q:
        report["diagnosis_demo"] = simulate_diagnosis_trace(
            snapshot_root, best_q, "step_3"
        )
    return report
