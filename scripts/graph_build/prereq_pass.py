"""LLM prerequisite pass scaffolding (queues follow-up merges / edges)."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

from . import db


def run_llm_prereq_pass_stub(
    sqlite_path: Path,
    *,
    model_stub: str = "graph_build.llm_placeholder",
) -> int:
    """Insert review-queue items instead of calling an API."""
    del model_stub  # wired when API policy is plugged in

    con = db.connect(sqlite_path)
    cur = con.cursor()
    n = 0
    for row in cur.execute(
        """SELECT concept_id FROM canonical_concepts
        WHERE lifecycle_state IN ('enriched','reviewed','created') LIMIT 800"""
    ).fetchall():
        cur.execute(
            """INSERT INTO review_queue (item_type, priority, payload_json, created_at)
            VALUES (?,?,?,?)""",
            (
                "llm_prereq_pass_candidate",
                0.85,
                json.dumps({"concept_id": row[0]}, ensure_ascii=False),
                time.time(),
            ),
        )
        n += 1
    con.commit()
    con.close()
    return n


def note_prereq_evidence_from_strings(
    con: sqlite3.Connection,
    concept_id: str,
    prereq_names: list[str],
) -> None:
    """When LLM returns names, map them to concepts + insert evidence (stub)."""
    del con, concept_id, prereq_names
    return
