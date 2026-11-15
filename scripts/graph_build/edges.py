"""Edge evidence rollup + prerequisite / cooccurrence promotion.

Duplication vs graph signal (see PLAN.md §6–8, §17):
- Concept *nodes* should err on the side of slightly more duplication (split
  ambiguous mergers) so belief and diagnosis stay sharp; resolution + review
  queue handle paraphrase merges.
- Prerequisite *edges* should be *denser* whenever evidence is trustworthy: the
  picker’s stretch_fit depends on a usable prereq DAG. We combine (1) LLM-
  declared local prereqs, (2) repeated step order within solutions, and (3) multi-
  question support; single high-confidence declarative edges still promote.
"""
from __future__ import annotations

import itertools
import json
import sqlite3
from pathlib import Path

from . import hashing
from . import db


def _collect_step_local_order_evidence(cur: sqlite3.Cursor) -> int:
    """Earlier step concept → later step concept (same method), weak signal."""
    cur.execute("DELETE FROM graph_edge_evidence WHERE evidence_source='step_local_order'")
    inserted = 0
    rows = cur.execute(
        """
        SELECT s1.question_id, s1.method_id, s2.step_id AS later_step_id,
               m1.canonical_concept_id AS earlier_c, m2.canonical_concept_id AS later_c,
               s1.step_id AS earlier_step_id
        FROM raw_steps s1
        JOIN raw_steps s2 ON s1.question_id = s2.question_id
            AND s1.method_id = s2.method_id
            AND s2.step_number = s1.step_number + 1
        JOIN raw_concept_mentions m1 ON m1.mention_id = s1.concept_mention_id
        JOIN raw_concept_mentions m2 ON m2.mention_id = s2.concept_mention_id
        WHERE COALESCE(s1.is_structural, 0) = 0 AND COALESCE(s2.is_structural, 0) = 0
          AND m1.canonical_concept_id IS NOT NULL
          AND m2.canonical_concept_id IS NOT NULL
          AND m1.canonical_concept_id != m2.canonical_concept_id
        """
    ).fetchall()
    for pq, mid, later_sid, c_from, c_to, earlier_sid in rows:
        eid = hashing.canonical_id_from_seed(f"slo|{c_from}|{c_to}|{pq}|{earlier_sid}")
        cur.execute(
            """INSERT OR IGNORE INTO graph_edge_evidence (
              evidence_id, edge_type, source_concept_id, target_concept_id,
              question_id, method_id, step_id, evidence_source, confidence, notes)
              VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                eid,
                "prerequisite_of",
                c_from,
                c_to,
                pq,
                mid,
                later_sid,
                "step_local_order",
                0.55,
                f"consecutive_steps:{earlier_sid}->{later_sid}",
            ),
        )
        inserted += cur.rowcount
    return inserted


def collect_cooccurrence_and_prereq(sqlite_path: Path) -> None:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    cur.execute("DELETE FROM concept_edges WHERE edge_type IN ('often_cooccurs_with','prerequisite_of','close_cousin_of','parent_of','contrasts_with')")

    qmentions: dict[str, set[str]] = {}
    for r in cur.execute(
        """SELECT question_id, canonical_concept_id FROM raw_concept_mentions
        WHERE canonical_concept_id IS NOT NULL"""
    ).fetchall():
        qmentions.setdefault(r[0], set()).add(r[1])

    co: dict[tuple[str, str], int] = {}
    for _, cset in qmentions.items():
        for a, b in itertools.combinations(sorted(cset), 2):
            key = (a, b) if a < b else (b, a)
            co[key] = co.get(key, 0) + 1

    for (a, b), k in co.items():
        if k < 2:
            continue
        eid = hashing.canonical_id_from_seed(f"co|{a}|{b}")
        cur.execute(
            """INSERT OR IGNORE INTO graph_edge_evidence (
              evidence_id, edge_type, source_concept_id, target_concept_id,
              question_id, method_id, step_id, evidence_source, confidence, notes)
              VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                eid,
                "often_cooccurs_with",
                a,
                b,
                None,
                None,
                None,
                "cooccurrence",
                min(0.99, 0.5 + 0.05 * k),
                f"count={k}",
            ),
        )
        cur.execute(
            """INSERT OR REPLACE INTO concept_edges (
              source_concept_id, target_concept_id, edge_type, confidence,
              support_count, evidence_ids_json)
              VALUES (?,?,?,?,?,?)""",
            (
                a,
                b,
                "often_cooccurs_with",
                min(0.99, 0.5 + 0.05 * k),
                k,
                json.dumps([eid], ensure_ascii=False),
            ),
        )

    for r in cur.execute("SELECT * FROM raw_concept_mentions").fetchall():
        try:
            loc = json.loads(r["local_prereq_concepts_json"] or "[]")
        except json.JSONDecodeError:
            loc = []
        target = r["canonical_concept_id"]
        if not target:
            continue
        for prereq_name in loc:
            pn = str(prereq_name or "").strip()
            if not pn:
                continue
            cur2 = con.execute(
                """SELECT canonical_concept_id FROM raw_concept_mentions
                WHERE question_id=? AND TRIM(name) <> ''
                  AND canonical_concept_id IS NOT NULL
                  AND lower(trim(name)) = lower(?)""",
                (r["question_id"], pn),
            ).fetchone()
            if not cur2:
                continue
            src = cur2[0]
            evidence_confidence = (
                0.75
                if r["source_quality_status"] == "verified"
                and r["question_confidence"] == "high"
                else 0.35
            )
            eid = hashing.canonical_id_from_seed(f"lpr|{src}|{target}|{r['question_id']}")
            cur.execute(
                """INSERT OR IGNORE INTO graph_edge_evidence (
                  evidence_id, edge_type, source_concept_id, target_concept_id,
                  question_id, method_id, step_id, evidence_source, confidence, notes)
                  VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    eid,
                    "prerequisite_of",
                    src,
                    target,
                    r["question_id"],
                    None,
                    None,
                    "declared_local_prereq",
                    evidence_confidence,
                    pn,
                ),
            )

    _collect_step_local_order_evidence(cur)
    promote_prereqs(con)

    con.commit()
    con.close()


def promote_prereqs(con: sqlite3.Connection) -> None:
    """Promote prerequisite_of edges from declared + step-local evidence.

    Rules:
    - Declared prereq confidence < 0.7 is ignored (low-trust extraction).
    - Step-local observations are ~0.55; need >=2 distinct pieces of evidence
      OR bundle with any declared signal for the same (src,tgt).
    - Single declared observation with confidence >= 0.75 promotes (PLAN §7
      wants LLM edges to seed the graph even before cross-question repetition).
    """
    cur = con.cursor()
    tally: dict[tuple[str, str], list[tuple[str, float]]] = {}
    for r in cur.execute(
        """SELECT evidence_id, source_concept_id, target_concept_id, confidence,
                  evidence_source
           FROM graph_edge_evidence
           WHERE edge_type='prerequisite_of'
             AND evidence_source IN ('declared_local_prereq', 'step_local_order')"""
    ):
        evid = r[0]
        src = r[1]
        tgt = r[2]
        conf = float(r[3] or 0.0)
        src_kind = r[4]
        if not src or not tgt or src == tgt:
            continue
        if src_kind == "declared_local_prereq" and conf < 0.7:
            continue
        if src_kind == "step_local_order":
            if conf < 0.5:
                continue
        tally.setdefault((src, tgt), []).append((evid, conf))

    qualified: dict[tuple[str, str], tuple[list[str], list[float]]] = {}
    for (src, tgt), pairs in tally.items():
        eids = [p[0] for p in pairs]
        confs = [p[1] for p in pairs]
        n = len(eids)
        max_c = max(confs)
        has_strong_decl = any(c >= 0.74 for c in confs)
        if has_strong_decl and n >= 1:
            qualified[(src, tgt)] = (eids, confs)
        elif n >= 2:
            qualified[(src, tgt)] = (eids, confs)

    # Cycle prevention. First, demote any 2-cycle pair (the LLM disagreed
    # about direction) into a single close_cousin_of edge. Then, build the DAG
    # by inserting remaining edges in (support, confidence) order and
    # rejecting any edge whose target already reaches its source (would create
    # a longer cycle).
    cousin_pairs: set[tuple[str, str]] = set()
    drop: set[tuple[str, str]] = set()
    for (a, b) in list(qualified.keys()):
        if (b, a) in qualified and (a, b) not in drop and (b, a) not in drop:
            ea, ca = qualified[(a, b)]
            eb, cb = qualified[(b, a)]
            sa = (len(ea), max(ca))
            sb = (len(eb), max(cb))
            if sa > sb:
                drop.add((b, a))
            elif sb > sa:
                drop.add((a, b))
            else:
                drop.add((a, b))
                drop.add((b, a))
                cousin_pairs.add(tuple(sorted((a, b))))
    for k in drop:
        qualified.pop(k, None)

    # Now break longer cycles by greedy DAG construction.
    forward: dict[str, set[str]] = {}

    def reaches(start: str, target: str, limit: int = 64) -> bool:
        if start == target:
            return True
        seen = {start}
        stack = [start]
        steps = 0
        while stack and steps < limit:
            node = stack.pop()
            for nxt in forward.get(node, ()):
                if nxt == target:
                    return True
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
            steps += 1
        return False

    ordered = sorted(
        qualified.items(),
        key=lambda kv: (-len(kv[1][0]), -max(kv[1][1])),
    )
    accepted: dict[tuple[str, str], tuple[list[str], list[float]]] = {}
    skipped_cycles: list[tuple[str, str]] = []
    for (src, tgt), val in ordered:
        if reaches(tgt, src):
            skipped_cycles.append((src, tgt))
            continue
        accepted[(src, tgt)] = val
        forward.setdefault(src, set()).add(tgt)

    qualified = accepted
    if skipped_cycles:
        print(
            f"edges.promote_prereqs: dropped {len(skipped_cycles)} edge(s) "
            f"to keep DAG acyclic; first few: {skipped_cycles[:3]}"
        )

    for (src, tgt), (eids, confs) in qualified.items():
        n = len(eids)
        max_c = max(confs)
        tier_boost = 0.06 if max_c >= 0.74 else 0.0
        edge_conf = min(0.95, 0.5 + 0.09 * n + tier_boost)
        cur.execute(
            """INSERT OR REPLACE INTO concept_edges (
              source_concept_id, target_concept_id, edge_type, confidence,
              support_count, evidence_ids_json)
              VALUES (?,?,?,?,?,?)""",
            (
                src,
                tgt,
                "prerequisite_of",
                edge_conf,
                n,
                json.dumps(eids, ensure_ascii=False),
            ),
        )

    for (a, b) in cousin_pairs:
        cur.execute(
            """INSERT OR REPLACE INTO concept_edges (
              source_concept_id, target_concept_id, edge_type, confidence,
              support_count, evidence_ids_json)
              VALUES (?,?,?,?,?,?)""",
            (a, b, "close_cousin_of", 0.6, 1, json.dumps([], ensure_ascii=False)),
        )
