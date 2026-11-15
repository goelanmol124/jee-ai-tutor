"""Deterministic derived metrics for export."""
from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from . import db


def all_prereq_edges(con: sqlite3.Connection) -> list[tuple[str, str, float]]:
    cur = con.cursor()
    out: list[tuple[str, str, float]] = []
    for r in cur.execute(
        """SELECT source_concept_id, target_concept_id, confidence
        FROM concept_edges WHERE edge_type='prerequisite_of'"""
    ).fetchall():
        out.append((r[0], r[1], float(r[2] or 0.5)))
    return out


def prereq_adj(edges: list[tuple[str, str, float]], tau: float = 0.25) -> dict[str, list[str]]:
    adj: dict[str, list[str]] = defaultdict(list)
    for a, b, c in edges:
        if c >= tau:
            adj[a].append(b)
    return adj


def dependent_count(adj: dict[str, list[str]], start: str) -> int:
    """Count concepts transitively requiring `start` as a prerequisite."""
    total: set[str] = set()
    stack = list(adj.get(start, []))
    while stack:
        u = stack.pop()
        if u in total:
            continue
        total.add(u)
        stack.extend(adj.get(u, []))
    return len(total)


def longest_prereq_depth(rev: dict[str, list[str]], nodes: set[str]) -> dict[str, int]:
    """Iterative relaxation: longest chain length over prerequisite edges into each node.

    Bounded to ``len(nodes)`` to ensure termination even if cycles slipped past
    the cycle-prevention pass in ``edges.promote_prereqs``.
    """
    depth: dict[str, int] = {n: 0 for n in nodes}
    cap = max(1, len(nodes))
    for _ in range(cap):
        changed = False
        for tgt, preds in rev.items():
            if tgt not in nodes:
                continue
            if not preds:
                continue
            best = max(depth.get(p, 0) for p in preds) + 1
            if best > cap:
                best = cap  # clamp; never exceed node count
            if best > depth.get(tgt, 0):
                depth[tgt] = best
                changed = True
        if not changed:
            break
    return depth


def compute_derived(sqlite_path: Path) -> None:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    edges = all_prereq_edges(con)
    adj = prereq_adj(edges)
    concepts = {r[0] for r in cur.execute("SELECT concept_id FROM canonical_concepts")}

    rev: dict[str, list[str]] = defaultdict(list)
    for src, tgt, conf in edges:
        if conf < 0.25:
            continue
        rev[tgt].append(src)

    depth = longest_prereq_depth(rev, concepts)

    down: dict[str, int] = {cid: dependent_count(adj, cid) for cid in concepts}

    closures: dict[str, list[str]] = {}
    for cid in concepts:
        vis: set[str] = set()
        stack = list(adj.get(cid, []))
        while stack:
            n = stack.pop()
            if n in vis:
                continue
            vis.add(n)
            stack.extend(adj.get(n, []))
        closures[cid] = sorted(vis)

    qload: dict[str, float] = {}
    for q in cur.execute(
        """SELECT rq.question_id,
        COUNT(DISTINCT rs.step_id) steps,
        COUNT(DISTINCT rm.mention_id) ments
        FROM raw_questions rq
        LEFT JOIN raw_steps rs ON rs.question_id=rq.question_id
        LEFT JOIN raw_concept_mentions rm ON rm.question_id=rq.question_id
        GROUP BY rq.question_id"""
    ).fetchall():
        qload[q[0]] = float(q[1]) * 0.4 + float(q[2]) * 0.6

    for cid in concepts:
        cur.execute(
            """INSERT OR REPLACE INTO concept_derived (
            concept_id, difficulty_band, depth, downstream_count, mention_count, prereq_closure_json)
            VALUES (?,?,?,?,?,?)""",
            (
                cid,
                None,
                int(depth.get(cid, 0)),
                int(down.get(cid, 0)),
                int(
                    cur.execute(
                        "SELECT COUNT(*) FROM raw_concept_mentions WHERE canonical_concept_id=?",
                        (cid,),
                    ).fetchone()[0]
                ),
                json.dumps(closures.get(cid, []), ensure_ascii=False),
            ),
        )

    for qid, sc in qload.items():
        cur.execute(
            "INSERT OR REPLACE INTO question_derived (question_id, load_score) VALUES (?,?)",
            (qid, sc),
        )

    chap: dict[tuple[str, str], set[str]] = defaultdict(set)
    for r in cur.execute(
        """SELECT rm.canonical_concept_id, rq.subject, rq.topic
        FROM raw_concept_mentions rm
        JOIN raw_questions rq ON rq.question_id = rm.question_id
        WHERE rm.canonical_concept_id IS NOT NULL"""
    ):
        cid, subj, topic = r[0], r[1], r[2]
        chap[(subj, topic)].add(cid)

    cur.execute("DELETE FROM chapter_cluster_index")
    for (subj, topic), ids in chap.items():
        cur.execute(
            """INSERT INTO chapter_cluster_index (subject, topic, concept_ids_json)
            VALUES (?,?,?)""",
            (subj, topic, json.dumps(sorted(ids), ensure_ascii=False)),
        )

    con.commit()
    con.close()
