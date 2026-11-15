"""Versioned functional export (immutable snapshot directory per plan §12)."""
from __future__ import annotations

import json
import shutil
import time
from pathlib import Path
from typing import Any, Iterator

from . import db, jee_chapter_map, paths


def _jee_syllabus_bundle(
    subject: str | None, topic: str | None, subtopic: str | None
) -> dict[str, Any]:
    jp, jch = jee_chapter_map.map_syllabus_chapters(subject, topic, subtopic)
    jcp, jcch = jee_chapter_map.map_syllabus_coarse(subject, topic, subtopic)
    return {
        "jee_syllabus_primary_chapter": jp,
        "jee_syllabus_chapters": jch,
        "jee_syllabus_primary_coarse": jcp,
        "jee_syllabus_coarse_chapters": jcch,
    }


def _jobj(row: Any) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


def _write_jsonl(path: Path, rows: Iterator[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def export_snapshot(
    sqlite_path: Path,
    version: str,
    *,
    out_root: Path | None = None,
    quality_report: dict[str, Any] | None = None,
) -> Path:
    dest = (out_root or paths.SNAPSHOTS_ROOT) / version
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    con = db.connect(sqlite_path)
    cur = con.cursor()

    question_jee_meta: dict[str, dict[str, Any]] = {}
    for row in cur.execute(
        "SELECT question_id, subject, topic, subtopic FROM raw_questions"
    ):
        question_jee_meta[str(row["question_id"])] = _jee_syllabus_bundle(
            row["subject"], row["topic"], row["subtopic"]
        )

    manifest: dict[str, Any] = {
        "version": version,
        "build_timestamp": time.time(),
        "sqlite_path": str(sqlite_path),
    }

    def concepts() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM canonical_concepts"):
            r = _jobj(row)
            for k in list(r.keys()):
                if isinstance(r[k], bytes):
                    r[k] = r[k].decode("utf-8", "replace")
            r.update(
                _jee_syllabus_bundle(
                    r.get("subject"),
                    r.get("primary_topic"),
                    jee_chapter_map.first_subtopic_from_json(r.get("subtopics_json")),
                )
            )
            yield r

    def aliases() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM concept_aliases"):
            yield _jobj(row)

    def pitfalls() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM concept_pitfalls"):
            yield _jobj(row)

    def edges() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM concept_edges"):
            yield _jobj(row)

    def redirects() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM concept_redirects"):
            yield _jobj(row)

    def examples() -> Iterator[dict[str, Any]]:
        for row in cur.execute(
            "SELECT * FROM concept_examples WHERE selected_for_teaching=1"
        ):
            yield _jobj(row)

    def questions() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM raw_questions"):
            r = _jobj(row)
            if r.get("canonical_options_json"):
                try:
                    r["canonical_options_json"] = json.loads(
                        str(r["canonical_options_json"]) or "[]"
                    )
                except json.JSONDecodeError:
                    pass
            r.update(_jee_syllabus_bundle(r.get("subject"), r.get("topic"), r.get("subtopic")))
            yield r

    def question_methods() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM raw_methods"):
            yield _jobj(row)

    def question_steps() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM raw_steps"):
            yield _jobj(row)

    def question_concepts() -> Iterator[dict[str, Any]]:
        for row in cur.execute(
            """SELECT rm.question_id AS question_id,
                   rm.canonical_concept_id AS concept_id,
                   rm.graph_role_in_question AS role,
                   rm.step_ids_json AS step_ids_json,
                   CASE WHEN rm.graph_role_in_question = 'core' THEN 1 ELSE 0 END
                     AS is_diagnostic_anchor
            FROM raw_concept_mentions rm
            WHERE rm.canonical_concept_id IS NOT NULL"""
        ):
            sid = []
            raw = row["step_ids_json"]
            if raw:
                try:
                    sid = json.loads(raw)
                except json.JSONDecodeError:
                    sid = []
            qid = str(row["question_id"])
            out = {
                "question_id": qid,
                "concept_id": row["concept_id"],
                "role": row["role"],
                "step_ids": sid,
                "is_diagnostic_anchor": bool(row["is_diagnostic_anchor"]),
            }
            out.update(question_jee_meta.get(qid, {}))
            yield out

    def derived_metrics() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT * FROM concept_derived"):
            dd = dict(_jobj(row))
            qid_band = dd.get("difficulty_band")
            yield {
                "kind": "concept",
                **dd,
                "difficulty_band": qid_band,
            }
        for row in cur.execute("SELECT * FROM question_derived"):
            yield {"kind": "question", **_jobj(row)}

    def chapter_index() -> Iterator[dict[str, Any]]:
        for row in cur.execute("SELECT subject, topic, concept_ids_json FROM chapter_cluster_index"):
            subj = row["subject"]
            topic = row["topic"]
            try:
                cids = json.loads(row["concept_ids_json"])
            except json.JSONDecodeError:
                cids = []
            yield {
                "subject": subj,
                "topic": topic,
                "concept_ids": cids,
                **_jee_syllabus_bundle(subj, topic, None),
            }

    def topic_jee_chapter_map() -> Iterator[dict[str, Any]]:
        """One row per distinct (subject, topic) for faster UI / routing."""
        keys: set[tuple[str | None, str | None]] = set()
        for row in cur.execute(
            """SELECT DISTINCT subject, topic FROM raw_questions
               WHERE subject IS NOT NULL AND topic IS NOT NULL
               ORDER BY subject, topic"""
        ):
            k = (row["subject"], row["topic"])
            if k in keys:
                continue
            keys.add(k)
            yield {
                "subject": row["subject"],
                "topic": row["topic"],
                **_jee_syllabus_bundle(row["subject"], row["topic"], None),
            }

    tbl = cur.execute(
        """SELECT name FROM sqlite_master WHERE type='table'
           AND name='concept_merge_llm_decisions'"""
    ).fetchone()

    def merge_llm_decisions() -> Iterator[dict[str, Any]]:
        if not tbl:
            return
        yield from (_jobj(row) for row in cur.execute(
            "SELECT * FROM concept_merge_llm_decisions ORDER BY created_at DESC"
        ))

    stats = {}
    stats["concepts_jsonl"] = _write_jsonl(dest / "concepts.jsonl", concepts())
    stats["concept_aliases_jsonl"] = _write_jsonl(dest / "concept_aliases.jsonl", aliases())
    stats["concept_examples_jsonl"] = _write_jsonl(dest / "concept_examples.jsonl", examples())
    stats["concept_pitfalls_jsonl"] = _write_jsonl(dest / "concept_pitfalls.jsonl", pitfalls())
    stats["concept_edges_jsonl"] = _write_jsonl(dest / "concept_edges.jsonl", edges())
    stats["concept_redirects_jsonl"] = _write_jsonl(dest / "concept_redirects.jsonl", redirects())
    stats["questions_jsonl"] = _write_jsonl(dest / "questions.jsonl", questions())
    stats["question_methods_jsonl"] = _write_jsonl(dest / "question_methods.jsonl", question_methods())
    stats["question_steps_jsonl"] = _write_jsonl(dest / "question_steps.jsonl", question_steps())
    stats["question_concepts_jsonl"] = _write_jsonl(dest / "question_concepts.jsonl", question_concepts())
    stats["derived_metrics_jsonl"] = _write_jsonl(dest / "derived_metrics.jsonl", derived_metrics())
    stats["chapter_cluster_index_jsonl"] = _write_jsonl(
        dest / "chapter_cluster_index.jsonl", chapter_index()
    )
    stats["topic_jee_chapter_map_jsonl"] = _write_jsonl(
        dest / "topic_jee_chapter_map.jsonl", topic_jee_chapter_map()
    )
    if tbl:
        stats["concept_merge_llm_decisions_jsonl"] = _write_jsonl(
            dest / "concept_merge_llm_decisions.jsonl",
            merge_llm_decisions(),
        )

    qr = quality_report if quality_report is not None else {}
    if not qr:
        from .validate import run_validation as _rv

        qr = _rv(sqlite_path)
    stats["quality_report_present"] = bool(qr)
    (dest / "graph_quality_report.json").write_text(
        json.dumps(qr, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    manifest.update({"stats": stats})
    manifest["jee_syllabus"] = jee_chapter_map.catalog_summary()
    prompt_path = paths.DEFAULT_PROMPT if paths.DEFAULT_PROMPT.is_file() else None
    schema_path = paths.DEFAULT_SCHEMA if paths.DEFAULT_SCHEMA.is_file() else None
    try:
        manifest["prompt_file"] = (
            str(prompt_path.relative_to(paths.REPO)) if prompt_path else None
        )
    except ValueError:
        manifest["prompt_file"] = str(prompt_path) if prompt_path else None
    try:
        manifest["schema_file"] = (
            str(schema_path.relative_to(paths.REPO)) if schema_path else None
        )
    except ValueError:
        manifest["schema_file"] = str(schema_path) if schema_path else None

    (dest / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    con.close()
    return dest
