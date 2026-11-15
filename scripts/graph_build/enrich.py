"""Post-resolution enrichment hooks (lifecycle, examples)."""
from __future__ import annotations

import json
import sqlite3

from pathlib import Path

from . import db


def run_enrichment_phase(sqlite_path: Path) -> None:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    rows = cur.execute(
        """SELECT canonical_concept_id, COUNT(*) as c FROM raw_concept_mentions
        WHERE canonical_concept_id IS NOT NULL
        GROUP BY canonical_concept_id HAVING c >= 3"""
    ).fetchall()
    for cid, _ in rows:
        cur.execute(
            """UPDATE canonical_concepts SET lifecycle_state='enriched'
            WHERE concept_id=? AND lifecycle_state IN ('created', 'enriched')""",
            (cid,),
        )

    mentions = cur.execute(
        """SELECT canonical_concept_id, mention_id, question_id, step_ids_json
        FROM raw_concept_mentions
        WHERE canonical_concept_id IS NOT NULL"""
    ).fetchall()

    by_c: dict[str, list[tuple[str, str, str]]] = {}
    for cid, mn, pq, sj in mentions:
        by_c.setdefault(cid, []).append((mn, pq, sj))

    cur.execute("DELETE FROM concept_examples")

    for cid, tuples in by_c.items():
        for i, (_, pq, sj) in enumerate(sorted(tuples)[:5]):
            try:
                sids = json.loads(sj or "[]")
            except json.JSONDecodeError:
                sids = []
            step_id = str(sids[0]) if sids else None
            sel = 1 if i < 3 else 0
            cur.execute(
                """INSERT INTO concept_examples (
                    concept_id, step_id, question_id, kind, selected_for_teaching)
                    VALUES (?,?,?,?,?)""",
                (cid, step_id, pq, "positive", sel),
            )

    con.commit()
    con.close()
