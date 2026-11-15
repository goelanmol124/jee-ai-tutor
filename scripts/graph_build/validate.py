"""Structural validators + dirty re-resolve stubs."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from . import db


def detect_prereq_cycles(con: sqlite3.Connection) -> list[list[str]]:
    cur = con.cursor()
    adj: dict[str, list[str]] = {}
    for a, b in cur.execute(
        """SELECT source_concept_id, target_concept_id FROM concept_edges
        WHERE edge_type='prerequisite_of'"""
    ).fetchall():
        adj.setdefault(a, []).append(b)

    cycles: list[list[str]] = []
    WHITE, GRAY, BLACK = 0, 1, 2
    state: dict[str, int] = {}

    def dfs(u: str, path_stack: list[str]) -> None:
        state[u] = GRAY
        path_stack.append(u)
        for v in adj.get(u, []):
            sv = state.get(v, WHITE)
            if sv == WHITE:
                dfs(v, path_stack)
            elif sv == GRAY:
                try:
                    i = path_stack.index(v)
                    cycles.append(path_stack[i:] + [v])
                except ValueError:
                    cycles.append([u, v])
        path_stack.pop()
        state[u] = BLACK

    nodes = set(adj.keys()) | {v for vs in adj.values() for v in vs}
    for n in sorted(nodes):
        if state.get(n, WHITE) == WHITE:
            dfs(n, [])

    return cycles[:1]


def run_validation(sqlite_path: Path) -> dict[str, Any]:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    issues: dict[str, Any] = {
        "unresolved_mentions": 0,
        "questions_missing_core_placeholder": 0,
        "core_mentions_without_steps": [],
        "supporting_mentions_without_steps": [],
        "prereq_cycles": [],
        "concepts_created_only": 0,
    }

    issues["unresolved_mentions"] = cur.execute(
        """SELECT COUNT(*) FROM raw_concept_mentions
        WHERE canonical_concept_id IS NULL OR resolution_status!='resolved'"""
    ).fetchone()[0]

    issues["concepts_created_only"] = cur.execute(
        """SELECT COUNT(*) FROM canonical_concepts WHERE lifecycle_state='created'"""
    ).fetchone()[0]

    for _ in cur.execute("SELECT question_id FROM raw_questions"):
        row = cur.execute(
            """SELECT COUNT(*) FROM raw_concept_mentions rm
            WHERE rm.question_id=? AND rm.graph_role_in_question='core'
            AND rm.canonical_concept_id IS NOT NULL""",
            (_[0],),
        ).fetchone()
        if row and row[0] == 0:
            issues["questions_missing_core_placeholder"] += 1

    for row in cur.execute(
        """SELECT question_id, name, graph_role_in_question, step_ids_json
        FROM raw_concept_mentions
        WHERE graph_role_in_question IN ('core', 'supporting')
          AND (step_ids_json IS NULL OR step_ids_json = '[]')"""
    ).fetchall():
        bucket = (
            "core_mentions_without_steps"
            if row["graph_role_in_question"] == "core"
            else "supporting_mentions_without_steps"
        )
        issues[bucket].append(
            {
                "question_id": row["question_id"],
                "name": row["name"],
                "role": row["graph_role_in_question"],
            }
        )

    issues["prereq_cycles"] = detect_prereq_cycles(con)
    issues["edges_prerequisite_promoted"] = cur.execute(
        "SELECT COUNT(*) FROM concept_edges WHERE edge_type='prerequisite_of'"
    ).fetchone()[0]
    issues["edges_cooccurrence"] = cur.execute(
        "SELECT COUNT(*) FROM concept_edges WHERE edge_type='often_cooccurs_with'"
    ).fetchone()[0]
    issues["evidence_step_local_order"] = cur.execute(
        """SELECT COUNT(*) FROM graph_edge_evidence
           WHERE evidence_source='step_local_order'"""
    ).fetchone()[0]
    issues["mentions_total"] = cur.execute(
        "SELECT COUNT(*) FROM raw_concept_mentions"
    ).fetchone()[0]
    issues["canonical_total"] = cur.execute(
        "SELECT COUNT(*) FROM canonical_concepts"
    ).fetchone()[0]

    con.close()
    return issues


def mark_dirty_after_merge(con: sqlite3.Connection, from_c: str, to_c: str) -> None:
    del to_c  # mentions pointing at from_c flagged
    con.execute(
        """UPDATE raw_concept_mentions SET resolution_status='dirty_re_resolve'
        WHERE canonical_concept_id=?""",
        (from_c,),
    )
    con.commit()
