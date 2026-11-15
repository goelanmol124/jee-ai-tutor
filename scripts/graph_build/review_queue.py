"""Ranked human review queue exporter.

Item types written here include merge candidates plus ``llm_merge_review`` /
``llm_merge_dry_run`` rows produced by ``llm_merge`` (see scripts/graph_build/llm_merge.py).
"""
from __future__ import annotations

import json
import sqlite3
import time

from pathlib import Path

from . import db
from . import retrieval as retr


def build_review_priorities(sqlite_path: Path) -> None:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    for row in cur.execute(
        """SELECT canonical_concept_id, COUNT(*) c FROM raw_concept_mentions
        GROUP BY canonical_concept_id ORDER BY c DESC LIMIT 80"""
    ).fetchall():
        cur.execute(
            """INSERT INTO review_queue (item_type, priority, payload_json, created_at)
            VALUES (?,?,?,?)""",
            (
                "high_traffic_concept",
                float(row[1]),
                json.dumps({"concept_id": row[0], "mentions": row[1]}, ensure_ascii=False),
                time.time(),
            ),
        )

    for row in cur.execute(
        """SELECT source_concept_id, target_concept_id FROM concept_edges
        WHERE edge_type='prerequisite_of'"""
    ).fetchall():
        cur.execute(
            """INSERT INTO review_queue (item_type, priority, payload_json, created_at)
            VALUES (?,?,?,?)""",
            (
                "prereq_edge",
                0.6,
                json.dumps(
                    {"source": row[0], "target": row[1]},
                    ensure_ascii=False,
                ),
                time.time(),
            ),
        )

    rows = cur.execute(
        """SELECT concept_id, canonical_name, subject, primary_topic, concept_kind
           FROM canonical_concepts WHERE lifecycle_state!='deprecated'"""
    ).fetchall()
    by_bucket: dict[tuple[str, str], list] = {}
    for r in rows:
        by_bucket.setdefault((r[2] or "", r[3] or ""), []).append(r)
    seen_pairs: set[tuple[str, str]] = set()
    for (_subj, _topic), items in by_bucket.items():
        if len(items) < 2:
            continue
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                ta = retr._name_tokens(a[1])
                tb = retr._name_tokens(b[1])
                jacc = retr._jaccard(ta, tb)
                if jacc < 0.5:
                    continue
                blocked = retr._discriminator_block(ta, tb) or retr._discriminator_block_raw(a[1], b[1])
                key = tuple(sorted((a[0], b[0])))
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                priority = jacc * (0.4 if blocked else 1.0)
                cur.execute(
                    """INSERT INTO review_queue (item_type, priority, payload_json, created_at)
                    VALUES (?,?,?,?)""",
                    (
                        "candidate_merge" if not blocked else "candidate_merge_blocked",
                        float(priority),
                        json.dumps(
                            {
                                "a": {"concept_id": a[0], "name": a[1]},
                                "b": {"concept_id": b[0], "name": b[1]},
                                "name_jaccard": round(jacc, 3),
                                "subject": a[2],
                                "topic": a[3],
                                "discriminator_blocked": blocked,
                            },
                            ensure_ascii=False,
                        ),
                        time.time(),
                    ),
                )

    con.commit()
    con.close()


def dump_review_queue(sqlite_path: Path, out_jsonl: Path) -> None:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    out_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with out_jsonl.open("w", encoding="utf-8") as f:
        for r in cur.execute(
            "SELECT item_type, priority, payload_json FROM review_queue ORDER BY priority DESC"
        ).fetchall():
            f.write(
                json.dumps(
                    {"type": r[0], "priority": r[1], "payload": json.loads(r[2])},
                    ensure_ascii=False,
                )
                + "\n"
            )
    con.close()
