"""Streaming-style entity resolution (heuristic offline; plug LLM routing later)."""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path

from . import db, hashing
from . import retrieval as retr


def redirect(con: sqlite3.Connection, oid: str) -> str:
    cur = con.cursor()
    cid = oid
    for _ in range(64):
        cur.execute(
            "SELECT new_concept_id FROM concept_redirects WHERE old_concept_id=?",
            (cid,),
        )
        r = cur.fetchone()
        if not r:
            return cid
        cid = r[0]
    return cid


def run_resolution(sqlite_path: Path, vectors_path: Path | None = None) -> dict[str, int]:
    con = db.connect(sqlite_path)
    cur = con.cursor()
    cur.execute("SELECT * FROM raw_concept_mentions ORDER BY subject, topic, mention_id")
    mentions = cur.fetchall()
    cmap: dict[str, sqlite3.Row] = {}
    for row in con.execute(
        "SELECT * FROM canonical_concepts WHERE lifecycle_state!='deprecated'"
    ).fetchall():
        cmap[row["concept_id"]] = row

    vp = vectors_path if vectors_path else sqlite_path.with_suffix(".vectors.json")
    if not vp.exists():
        alt = sqlite_path.with_suffix(".vectors.npy")
        vp = alt if alt.exists() else vp

    m_index = {mentions[i]["mention_id"]: i for i in range(len(mentions))}

    stats = {"resolved_same": 0, "resolved_new": 0, "aliases": 0}

    canon_by_subject: dict[str | None, list[sqlite3.Row]] = {}
    primitives: list[sqlite3.Row] = []
    for row in cmap.values():
        if row["concept_kind"] == "primitive":
            primitives.append(row)
        canon_by_subject.setdefault(row["subject"], []).append(row)

    for mr in mentions:
        if mr["resolution_status"] == "resolved" and mr["canonical_concept_id"]:
            continue

        name = (mr["name"] or "").strip()
        subj = mr["subject"]

        exact = retr.alias_exact_lookup(con, name, subj)
        if exact:
            cid = redirect(con, exact[0])
            attach_mention(con, mr, cid, "same_concept", 0.95, cands=[cid])
            stats["aliases"] += 1
            continue

        pool = list(canon_by_subject.get(subj, [])) + primitives
        mv = (
            retr.load_embedding_for_mention(con, vp, mr, m_index)
            if vp.exists()
            else None
        )
        cands = retr.hybrid_candidates(con, mr, pool, mv, limit=15)

        best = cands[0] if cands else None
        high = bool(
            best
            and best.score >= 1.85
            and retr._norm(best.name) == retr._norm(name)
        )
        med = bool(best and best.score >= 1.45)

        # Token-Jaccard tier: same-subject paraphrase with strong word overlap.
        # Only trigger when the candidate is in the same subject (sj>=0) so we
        # never pull cross-subject homonyms together.
        jacc_merge = False
        if best is not None and not high and not med:
            cand_tokens = retr._name_tokens(best.name)
            ment_tokens = retr._name_tokens(name)
            jacc = retr._jaccard(cand_tokens, ment_tokens)
            same_subj = retr._norm(best.subject) == retr._norm(subj)
            blocked = retr._discriminator_block(
                cand_tokens, ment_tokens
            ) or retr._discriminator_block_raw(best.name, name)
            if same_subj and jacc >= 0.85 and best.score >= 1.2 and not blocked:
                jacc_merge = True

        if high or med or jacc_merge:
            assert best is not None
            cid = redirect(con, best.concept_id)
            attach_mention(con, mr, cid, "same_concept", float(best.score), cands=cands)
            stats["resolved_same"] += 1
        else:
            cid = hashing.canonical_id_from_seed(f"{subj}|{name}|{mr['mention_id']}")
            collision = (
                con.execute(
                    "SELECT 1 FROM canonical_concepts WHERE concept_id=?",
                    (cid,),
                ).fetchone()
                is not None
            )
            if collision:
                cid = hashing.canonical_id_from_seed(f"{subj}|{name}|{mr['mention_id']}|x")
            insert_new_canonical(con, mr, cid, name)
            nrow = con.execute(
                "SELECT * FROM canonical_concepts WHERE concept_id=?",
                (cid,),
            ).fetchone()
            if nrow:
                cmap[cid] = nrow
                canon_by_subject.setdefault(subj, []).append(nrow)
            attach_mention(con, mr, cid, "new_concept", 0.6, cands=cands)
            stats["resolved_new"] += 1

    con.commit()
    con.close()
    return stats


def insert_new_canonical(con: sqlite3.Connection, mr: sqlite3.Row, cid: str, name: str) -> None:
    now = time.time()
    con.execute(
        """INSERT OR REPLACE INTO canonical_concepts (
            concept_id, canonical_name, subject, primary_topic, topics_json, subtopics_json,
            definition, when_to_use, statement, scope_in, scope_out, cognitive_operation,
            concept_kind, lifecycle_state, created_from_mention_id, confidence, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            cid,
            name,
            mr["subject"],
            mr["topic"],
            json.dumps([mr["topic"]], ensure_ascii=False),
            json.dumps([mr["subtopic"]], ensure_ascii=False),
            None,
            mr["when_to_use"],
            mr["statement"],
            None,
            None,
            "apply",
            "compound_application",
            "created",
            mr["mention_id"],
            mr["question_confidence"],
            now,
        ),
    )
    con.execute(
        """INSERT INTO concept_aliases (concept_id, alias, evidence_mention_ids_json,
        confidence) VALUES (?,?,?,?)""",
        (
            cid,
            name,
            json.dumps([mr["mention_id"]], ensure_ascii=False),
            mr["question_confidence"],
        ),
    )


def attach_mention(
    con: sqlite3.Connection,
    mr: sqlite3.Row,
    cid: str,
    decision: str,
    conf: float,
    *,
    cands: list,
) -> None:
    dec_id = "d_" + uuid.uuid4().hex[:22]
    cjson = []
    for c in cands:
        if isinstance(c, str):
            cjson.append({"concept_id": c})
        else:
            cjson.append({"concept_id": c.concept_id, "score": c.score})

    con.execute(
        """INSERT INTO concept_resolution_decisions (
           decision_id, mention_id, candidate_concept_ids_json, decision,
           chosen_concept_id, reason, model, confidence, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            dec_id,
            mr["mention_id"],
            json.dumps(cjson, ensure_ascii=False),
            decision,
            cid,
            "offline_heuristic_resolver",
            "graph_build.resolve",
            conf,
            time.time(),
        ),
    )
    con.execute(
        """UPDATE raw_concept_mentions SET canonical_concept_id=?, resolution_status='resolved'
        WHERE mention_id=?""",
        (cid, mr["mention_id"]),
    )
