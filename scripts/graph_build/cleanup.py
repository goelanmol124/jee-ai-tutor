"""Topic cleanup + reversible merge helpers (minimal v1 heuristic)."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from . import db


def title_case_topic(s: str | None) -> str:
    if not s:
        return ""
    parts = []
    for w in str(s).replace("_", " ").split():
        if not w:
            continue
        parts.append(w[:1].upper() + w[1:].lower())
    return " ".join(parts)


def run_cleanup_pass(sqlite_path: Path) -> None:
    """Normalize canonical primary_topic capitalization; optionally cluster later."""
    con = db.connect(sqlite_path)
    cur = con.cursor()
    for row in cur.execute(
        "SELECT concept_id, primary_topic FROM canonical_concepts WHERE primary_topic IS NOT NULL"
    ).fetchall():
        tid = title_case_topic(row["primary_topic"])
        if tid and tid != row["primary_topic"]:
            cur.execute(
                "UPDATE canonical_concepts SET primary_topic=? WHERE concept_id=?",
                (tid, row["concept_id"]),
            )
            topics = json.dumps([tid], ensure_ascii=False)
            cur.execute(
                "UPDATE canonical_concepts SET topics_json=? WHERE concept_id=?",
                (topics, row["concept_id"]),
            )

    con.commit()
    con.close()


def propose_primitive_promotions(con: sqlite3.Connection) -> list[tuple[str, str]]:
    """Return (concept_id,) pairs flagged for primitive review when cross-subject overlap."""
    del con  # noqa: ARG001 stub for richer clustering later
    return []
