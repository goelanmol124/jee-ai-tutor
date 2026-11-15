#!/usr/bin/env python3
"""Build per-slot heuristic ground-truth JSON from archive extracts (no LLM)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from answer_audit import (
    audit_coaching_vs_official_mcq,
    resolve_effective_official_mcq,
    summarize_answer_audits,
)
from coaching_blocks import attach_coaching_to_rows, extract_coaching_excerpts
from nta_keys import load_session1_keys, ordered_question_ids_for_session1_slot
from nta_qp import parse_nta_question_paper_text, rows_from_ordered_question_ids
from similarity import collect_fingerprints, cross_slot_neighbors
from transcripts import transcript_hints_for_question


def load_manifest(archive_root: Path) -> dict:
    raw = (archive_root / "metadata.json").read_text(encoding="utf-8-sig", errors="replace")
    return json.loads(raw)


def official_nta_extract_path(archive_root: Path, manifest_rows: list[dict], slot_id: str) -> Path | None:
    for row in manifest_rows:
        if row.get("slot_id") != slot_id:
            continue
        lp = row.get("local_path") or ""
        if "nta-official_question-paper" not in lp.lower():
            continue
        if not lp.lower().endswith(".pdf"):
            continue
        pdf = archive_root / lp
        ex = pdf.parent / f"{pdf.stem}.extracted.full.txt"
        if ex.is_file():
            return ex
    return None


def fallback_qp_extract_path(archive_root: Path, manifest_rows: list[dict], slot_id: str) -> Path | None:
    """Any shift PDF extract that contains NTA Question Number / Question Id headers."""
    hits: list[Path] = []
    for row in manifest_rows:
        if row.get("slot_id") != slot_id:
            continue
        lp = row.get("local_path") or ""
        if not lp.lower().endswith(".pdf"):
            continue
        ex = archive_root / Path(lp).parent / f"{Path(lp).stem}.extracted.full.txt"
        if not ex.is_file():
            continue
        head = ex.read_text(encoding="utf-8", errors="replace")[:12000]
        if "Question Number : 1" in head and "Question Id" in head:
            hits.append(ex)
    return hits[0] if hits else None


def resolve_qp_extract(archive_root: Path, manifest_rows: list[dict], slot_id: str) -> tuple[Path | None, list[str]]:
    w: list[str] = []
    p = official_nta_extract_path(archive_root, manifest_rows, slot_id)
    if p:
        return p, w
    p = fallback_qp_extract_path(archive_root, manifest_rows, slot_id)
    if p:
        w.append("used_non_nta_pdf_extract_for_skeleton")
        return p, w
    return None, ["missing_official_nta_extract"]


def resolve_skeleton_rows(
    archive_root: Path, manifest_rows: list[dict], slot_id: str
) -> tuple[Path | None, list, list[str]]:
    """
    Return (qp_extract_path_or_none, nta_rows, warnings).
    Uses official NTA extract, else third-party NTA-shaped extract, else Session-1 option-key order.
    """
    warnings: list[str] = []
    qp_path, fw = resolve_qp_extract(archive_root, manifest_rows, slot_id)
    warnings.extend(fw)
    if qp_path is not None:
        rows = parse_nta_question_paper_text(qp_path.read_text(encoding="utf-8", errors="replace"))
        return qp_path, rows, warnings
    qids = None
    if slot_id.startswith("2026-01-"):
        qids = ordered_question_ids_for_session1_slot(archive_root, slot_id)
    if qids:
        warnings = [w for w in warnings if w != "missing_official_nta_extract"]
        warnings.append("skeleton_from_session1_option_key_order")
        if len(qids) != 75:
            warnings.append(f"option_key_qid_count_{len(qids)}_not_75")
        return None, rows_from_ordered_question_ids(qids), warnings
    return None, [], warnings


def merge_coaching_for_slot(
    archive_root: Path, manifest_rows: list[dict], slot_id: str
) -> dict[int, object]:
    by_g: dict = {}
    for row in manifest_rows:
        if row.get("slot_id") != slot_id:
            continue
        lp = row.get("local_path") or ""
        if not lp.lower().endswith(".pdf"):
            continue
        if "nta-official_question-paper" in lp.lower():
            continue
        stem = Path(lp).stem
        sj = archive_root / Path(lp).parent / f"{stem}.extracted.structure.json"
        if not sj.is_file():
            continue
        extracted = extract_coaching_excerpts(sj)
        for g, ce in extracted.items():
            prev = by_g.get(g)
            if prev is None or len(ce.question_excerpt) > len(prev.question_excerpt):
                by_g[g] = ce
    return by_g


def _session1_official_lookup_ids(
    archive_root: Path,
    slot_id: str,
    paper_index: int,
    nta_question_id: str,
    dom_slot: dict[str, str],
    oid_slot: dict[str, str],
) -> tuple[str, str | None, str | None]:
    """
    Session-1 keys use the option-id PDF's question-id column; QP extracts may differ.
    Try skeleton id first, then same paper_index in option-key order (India chunk).
    """
    d = dom_slot.get(nta_question_id)
    o = oid_slot.get(nta_question_id)
    if d is not None or o is not None:
        return nta_question_id, d, o
    if not slot_id.startswith("2026-01-"):
        return nta_question_id, None, None
    ordered = ordered_question_ids_for_session1_slot(archive_root, slot_id)
    if not ordered:
        return nta_question_id, None, None
    i = paper_index - 1
    if not (0 <= i < len(ordered)):
        return nta_question_id, None, None
    alt = ordered[i]
    return alt, dom_slot.get(alt), oid_slot.get(alt)


def build_slot_record(
    archive_root: Path,
    repo_root: Path,
    slot_id: str,
    manifest_rows: list[dict],
    domestic_keys: dict[str, dict[str, str]],
    option_id_keys: dict[str, dict[str, str]],
    neighbors: dict[tuple[str, int], list[dict]],
    with_transcripts: bool,
) -> dict:
    qp_path, rows, warnings = resolve_skeleton_rows(archive_root, manifest_rows, slot_id)

    coaching_by_g = merge_coaching_for_slot(archive_root, manifest_rows, slot_id)
    merged = attach_coaching_to_rows(rows, coaching_by_g)

    dom_slot = domestic_keys.get(slot_id, {})
    oid_slot = option_id_keys.get(slot_id, {})

    questions_out: list[dict] = []
    for m in merged:
        qid = m["nta_question_id"]
        co = m.get("coaching")
        qx = co.get("question_excerpt", "") if co else ""
        hints = []
        if with_transcripts and qx.strip():
            tr_root = repo_root / "jee_mains_2026_transcripts"
            if tr_root.is_dir():
                hints = transcript_hints_for_question(qx, tr_root, slot_id)
        nbr = neighbors.get((slot_id, int(m["paper_index"])), [])
        key_qid, dom_v, oid_v = _session1_official_lookup_ids(
            archive_root,
            slot_id,
            int(m["paper_index"]),
            qid,
            dom_slot,
            oid_slot,
        )
        official = None
        if dom_v is not None or oid_v is not None:
            official = {
                "domestic_or_numeric": dom_v,
                "correct_option_id": oid_v,
                "stress_test": bool(dom_v or oid_v),
            }
            if key_qid != qid:
                official["session1_key_question_id"] = key_qid

        eff_mcq, mcq_meta = resolve_effective_official_mcq(
            dom_v,
            oid_v,
            m.get("option_ids") or [],
        )
        answer_audit = None
        if official:
            answer_audit = audit_coaching_vs_official_mcq(
                question_type=str(m.get("question_type") or ""),
                official_domestic=eff_mcq,
                answer_excerpt=(co.get("answer_excerpt") if co else "") or "",
                question_excerpt=(co.get("question_excerpt") if co else "") or "",
            )
            if answer_audit is not None:
                answer_audit["official_mcq_source"] = mcq_meta.get("official_mcq_source")
                answer_audit["official_mcq_conflict"] = bool(mcq_meta.get("official_mcq_conflict"))
        questions_out.append(
            {
                **m,
                "official_answer": official,
                "answer_audit": answer_audit,
                "transcript_hints": hints,
                "cross_slot_similar": nbr,
            }
        )

    coaching_filled = sum(1 for q in questions_out if q.get("coaching"))
    keys_filled = sum(
        1
        for q in questions_out
        if q.get("official_answer")
        and (
            q["official_answer"].get("domestic_or_numeric") is not None
            or q["official_answer"].get("correct_option_id") is not None
        )
    )

    audit_sum = summarize_answer_audits(questions_out)

    return {
        "slot_id": slot_id,
        "official_qp_extract": str(qp_path.as_posix()) if qp_path else None,
        "skeleton_source": "nta_question_paper_extract"
        if qp_path
        else ("session1_option_key_order" if rows else "none"),
        "question_count": len(questions_out),
        "coverage": {
            "with_nta_metadata": len([q for q in questions_out if q.get("nta_question_id")]),
            "with_coaching_excerpt": coaching_filled,
            "with_official_session1_key": keys_filled,
            "with_transcript_hint": sum(1 for q in questions_out if q.get("transcript_hints")),
            "with_cross_slot_match": sum(1 for q in questions_out if q.get("cross_slot_similar")),
            **{f"answer_audit_{k}": v for k, v in audit_sum.items()},
        },
        "warnings": warnings,
        "questions": questions_out,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--archive",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "jee-main-2026-archive",
        help="Path to jee-main-2026-archive",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="AdvancedLearning repo root",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "ground_truth_heuristic",
        help="Output directory",
    )
    parser.add_argument("--slots", type=str, default="", help="Comma-separated slot_ids; empty = all inventory")
    parser.add_argument("--no-transcripts", action="store_true")
    args = parser.parse_args()

    archive_root = args.archive
    manifest = load_manifest(archive_root)
    rows = manifest.get("manifest") or []
    inventory = [s["slot_id"] for s in manifest.get("slot_inventory", [])]

    if args.slots.strip():
        want = {x.strip() for x in args.slots.split(",") if x.strip()}
        slot_list = [s for s in inventory if s in want]
    else:
        slot_list = list(inventory)

    domestic_keys, option_id_keys = load_session1_keys(archive_root)

    # Pass 1: build question payloads without neighbors
    base_recs: dict[str, dict] = {}
    all_fp = []
    for sid in slot_list:
        rec = build_slot_record(
            archive_root,
            args.repo,
            sid,
            rows,
            domestic_keys,
            option_id_keys,
            neighbors={},
            with_transcripts=not args.no_transcripts,
        )
        base_recs[sid] = rec
        all_fp.extend(collect_fingerprints(sid, rec["questions"]))

    neighbors = cross_slot_neighbors(all_fp, top_k=3, min_score=0.12)

    out_dir = args.out / "slots"
    out_dir.mkdir(parents=True, exist_ok=True)
    summaries = []
    for sid in slot_list:
        rec = base_recs[sid]
        for q in rec["questions"]:
            q["cross_slot_similar"] = neighbors.get((sid, int(q["paper_index"])), [])
        cwm = sum(1 for q in rec["questions"] if q.get("cross_slot_similar"))
        rec["coverage"]["with_cross_slot_match"] = cwm
        out_path = out_dir / f"{sid}.json"
        out_path.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
        summaries.append(
            {
                "slot_id": sid,
                "question_count": rec["question_count"],
                "coverage": rec["coverage"],
                "warnings": rec["warnings"],
            }
        )

    report = {
        "archive_root": str(archive_root.as_posix()),
        "slots_built": len(summaries),
        "session1_key_slots": sorted(set(domestic_keys.keys()) | set(option_id_keys.keys())),
        "slots": summaries,
    }
    (args.out / "coverage_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(summaries)} slot files under {out_dir}")
    print(f"Coverage report: {args.out / 'coverage_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
