"""Ingest validated structured solutions into SQLite raw layer."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from . import db, hashing, paths


def _norm_concept(step_concept: str) -> str:
    return (step_concept or "").strip().lower()


def is_structural_answer_step(concept_name: str) -> bool:
    return _norm_concept(concept_name) == "final answer extraction"


def iter_solution_bundle_paths(run_root: Path) -> list[Path]:
    out: list[Path] = []
    for slot_dir in sorted(run_root.iterdir()):
        if not slot_dir.is_dir() or slot_dir.name.startswith("_"):
            continue
        for jp in sorted(slot_dir.glob("*.json")):
            if jp.name.endswith(".meta.json"):
                continue
            out.append(jp)
    return out


def _evidence_id(parts: tuple[str, ...]) -> str:
    return hashing.canonical_id_from_seed("|".join(parts))[:32]


def load_source_slot_record(slot_id: str, final_slot_id: str) -> dict[str, Any] | None:
    source = paths.SLOTS_V2_ROOT / slot_id / "final75" / "final_75_records.json"
    if not source.is_file():
        return None
    data = json.loads(source.read_text(encoding="utf-8"))
    for item in data.get("records", []):
        if item.get("final_slot_id") == final_slot_id:
            return item
    return None


def ingest_structured_solution_run(
    sqlite_path: Path,
    structured_solutions_run: Path,
    *,
    require_validation_clean: bool = True,
) -> dict[str, int]:
    con = db.connect(sqlite_path)
    db.init_db(con)
    totals = {"questions": 0, "methods": 0, "steps": 0, "mentions": 0, "skipped": 0}

    for bundle_path in iter_solution_bundle_paths(structured_solutions_run):
        blob = json.loads(bundle_path.read_text(encoding="utf-8"))
        val_err = blob.get("validation_errors") or []
        if require_validation_clean and val_err:
            totals["skipped"] += 1
            continue

        pdata = blob.get("parsed_solution")
        if not isinstance(pdata, dict):
            totals["skipped"] += 1
            continue

        log = blob.get("pipeline_log") or {}
        slot_id_logged = log.get("slot_id") or bundle_path.parent.name
        final_slot_id = log.get("final_slot_id")
        if not final_slot_id:
            totals["skipped"] += 1
            continue

        qid_expect = hashing.question_id(slot_id_logged, final_slot_id)
        if bundle_path.stem != qid_expect:
            totals["skipped"] += 1
            continue

        ingest_one_bundle(con, pdata, blob, log, bundle_path)

        totals["questions"] += 1
        totals["methods"] += _count_methods(pdata)
        totals["steps"] += _count_steps(pdata)
        totals["mentions"] += _count_mentions(pdata)

    con.commit()
    con.close()
    return totals


def _count_methods(pdata: dict) -> int:
    return len(pdata.get("methods") or [])


def _count_steps(pdata: dict) -> int:
    return sum(len(m.get("steps") or []) for m in pdata.get("methods") or [])


def _count_mentions(pdata: dict) -> int:
    return sum(
        1
        for c in pdata.get("concepts_used") or []
        if (c.get("name") or "").strip()
        and not is_structural_answer_step(str(c.get("name")))
    )


def ingest_one_bundle(
    con: sqlite3.Connection,
    pdata: dict[str, Any],
    blob: dict[str, Any],
    log: dict[str, Any],
    bundle_path: Path,
) -> None:
    cur = con.cursor()
    slot_id_logged = log["slot_id"]
    final_slot_id = log["final_slot_id"]
    pq = hashing.question_id(slot_id_logged, final_slot_id)
    try:
        rel_path = str(bundle_path.relative_to(paths.REPO))
    except ValueError:
        rel_path = str(bundle_path.resolve())

    rq = pdata
    source_item = load_source_slot_record(slot_id_logged, final_slot_id) or {}
    source_record = source_item.get("record") or {}
    sq = rq.get("source_quality") if isinstance(rq.get("source_quality"), dict) else {}
    diagram_context = rq.get("diagram_context") or {}
    source_diagram = source_record.get("diagram") or {}
    if source_diagram:
        diagram_context = {
            **diagram_context,
            "source_present": source_diagram.get("present"),
            "source_essential_for_solving": source_diagram.get("essential_for_solving"),
            "source_description": source_diagram.get("description"),
        }

    cur.execute(
        """INSERT OR REPLACE INTO raw_questions (
            question_id, slot_id, final_slot_id, exam_date, shift, subject, topic,
            subtopic, canonical_question_latex, canonical_options_json,
            processed_final_answer_json, verification_status, needs_human_review,
            record_confidence, source_quality_json, difficulty, estimated_time_seconds,
            answer_type, diagram_context_json, prompt_version, schema_version,
            model_policy, ingestion_source_path, solution_cache_key
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            pq,
            slot_id_logged,
            final_slot_id,
            None,
            None,
            rq.get("subject"),
            rq.get("topic"),
            rq.get("subtopic"),
            source_record.get("canonical_question_latex") or rq.get("question"),
            json.dumps(source_record.get("canonical_options") or [], ensure_ascii=False),
            json.dumps(
                {
                    "structured_final_answer": rq.get("final_answer"),
                    "structured_final_answer_detail": rq.get("final_answer_detail") or {},
                    "processed_final_answer": source_record.get("final_answer"),
                },
                ensure_ascii=False,
            ),
            log.get("verification_status"),
            1 if log.get("needs_human_review") else 0,
            str(log.get("confidence") or ""),
            json.dumps(sq, ensure_ascii=False),
            rq.get("difficulty"),
            int(rq.get("estimated_time_seconds") or 1),
            rq.get("answer_type"),
            json.dumps(diagram_context, ensure_ascii=False),
            blob.get("prompt_version"),
            blob.get("schema_version"),
            blob.get("model_policy"),
            rel_path,
            blob.get("solution_cache_key"),
        ),
    )

    methods = rq.get("methods") or []
    cu = rq.get("concepts_used") or []
    mention_by_norm: dict[str, str] = {}

    for cu_row in cu:
        name = (cu_row.get("name") or "").strip()
        if not name or is_structural_answer_step(name):
            continue
        mid = hashing.mention_id(pq, name)
        mention_by_norm[_norm_concept(name)] = mid

        step_ids: list[str] = []
        exprs: list[str] = []
        thoughts: list[str] = []
        nearby: set[str] = set()

        for mi, m in enumerate(methods):
            mid_m = hashing.method_id(pq, mi, str(m.get("method_name") or f"m{mi}"))
            for st in m.get("steps") or []:
                cname = str(st.get("concept") or "")
                if _norm_concept(cname) == _norm_concept(name):
                    sid = hashing.step_id(pq, mid_m, int(st.get("step_number") or 0))
                    step_ids.append(sid)
                    exprs.append(str(st.get("expression") or ""))
                    thoughts.append(str(st.get("thought") or ""))
                elif cname and not is_structural_answer_step(cname):
                    nearby.add(cname)

        cur.execute(
            """INSERT OR REPLACE INTO raw_concept_mentions (
                mention_id, question_id, name, statement, when_to_use,
                graph_role_in_question, subject, topic, subtopic,
                chapter_prereqs_json, local_prereq_concepts_json,
                step_ids_json, step_expressions_json, step_thoughts_json,
                nearby_step_concepts_json, source_quality_status, question_confidence,
                embedding_text, embedding_vector_id, canonical_concept_id,
                resolution_status
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,'unresolved')""",
            (
                mid,
                pq,
                name,
                cu_row.get("statement"),
                cu_row.get("when_to_use"),
                cu_row.get("graph_role"),
                rq.get("subject"),
                rq.get("topic"),
                rq.get("subtopic"),
                json.dumps(rq.get("chapter_prereqs") or [], ensure_ascii=False),
                json.dumps(cu_row.get("prereq_concepts") or [], ensure_ascii=False),
                json.dumps(step_ids, ensure_ascii=False),
                json.dumps(exprs, ensure_ascii=False),
                json.dumps(thoughts, ensure_ascii=False),
                json.dumps(sorted(nearby), ensure_ascii=False),
                sq.get("status"),
                str(sq.get("confidence") or ""),
                None,
            ),
        )

    for mi, m in enumerate(methods):
        mname = str(m.get("method_name") or f"method_{mi}")
        mid_m = hashing.method_id(pq, mi, mname)
        cur.execute(
            """INSERT OR REPLACE INTO raw_methods (method_id, question_id, method_name, method_index)
            VALUES (?,?,?,?)""",
            (mid_m, pq, mname, mi),
        )

        for st in m.get("steps") or []:
            snum = int(st.get("step_number") or 0)
            sid = hashing.step_id(pq, mid_m, snum)
            concept_name = str(st.get("concept") or "")
            struct = is_structural_answer_step(concept_name)
            men_id = None if struct else mention_by_norm.get(_norm_concept(concept_name))
            cur.execute(
                """INSERT OR REPLACE INTO raw_steps (
                  step_id, question_id, method_id, step_number, expression,
                  thought, uses_results_from_json, raw_step_concept_name,
                  is_structural, concept_mention_id)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    sid,
                    pq,
                    mid_m,
                    snum,
                    st.get("expression"),
                    st.get("thought"),
                    json.dumps(st.get("uses_results_from") or [], ensure_ascii=False),
                    concept_name,
                    1 if struct else 0,
                    men_id,
                ),
            )

            uf = st.get("uses_results_from") or []
            for other in uf:
                ostep = hashing.step_id(pq, mid_m, int(other))
                eid = _evidence_id((pq, sid, "to", ostep, "step_dep"))
                cur.execute(
                    """INSERT OR IGNORE INTO graph_edge_evidence (
                      evidence_id, edge_type, source_concept_id, target_concept_id,
                      question_id, method_id, step_id, evidence_source, confidence, notes)
                      VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (
                        eid,
                        "step_dependency",
                        None,
                        None,
                        pq,
                        mid_m,
                        sid,
                        "step_dependency",
                        0.8,
                        f"uses_results_from->{ostep}",
                    ),
                )