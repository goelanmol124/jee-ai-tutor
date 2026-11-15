"""Quality-first LLM adjudication over concept merge pairs (cached, auditable).

Runs after heuristic resolution; applies only high-confidence merges that pass
gates and similarity-signal checks. See plan: Quality-First LLM Concept Merging.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import db as graph_db
from . import retrieval as retr
from .mention_cards import _embedding_from_text, cosine
from .resolve import redirect

# Bump when judge prompt / candidate policy shifts materially (included in pair_key).
MERGE_PROMPT_VERSION = "v5"

MERGE_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "decision": {
            "type": "string",
            "description": "merge | do_not_merge | needs_human_review",
        },
        "confidence": {"type": "number", "description": "0.0 to 1.0"},
        "survivor_concept_id": {
            "type": "string",
            "description": "When decision is merge, must equal one of the two input concept ids",
        },
        "canonical_name": {
            "type": "string",
            "description": "Preferred display name after merge (optional)",
        },
        "reason": {"type": "string"},
        "risk_flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["decision", "confidence", "reason"],
}

SYSTEM_PROMPT = """You adjudicate merge candidates for a JEE-style learning graph.

Output **merge** only when BOTH concepts are the SAME graph node identity: students should never need two
distinct cards for what is materially one idea (pure paraphrase, notation swap, or obvious synonym naming).

Output **needs_human_review** when they are RELATED (same chapter, prerequisites, formulas that co-occur)
but still DISTINCT knowledge objects—for example phase vs impedance in LCR series, reversible adiabatic WORK
versus the PV^γ relation alone, capacitor network rules versus capacitance of a geometry, min versus max distance.

Output **do_not_merge** when they are plainly different topics, quantities, constructs, gates, circuits vs
different domains even if wording shares tokens.

Prefer **risk_flags** when hesitant (e.g. different_object, circuit_vs_generic, geometry_vs_combo,
extrema_distinct, prerequisite_not_duplicate).

Respond ONLY with JSON matching the schema."""

# Auto-merge blocked if LLM attaches any of these risk flags (string match)
SEVERE_RISK_FLAGS = frozenset(
    {
        "different_quantity",
        "different_object",
        "wrong_domain",
        "circuit_vs_nuclear",
        "gates_distinct",
        "extrema_distinct",
        "conics_distinct",
        "circuit_vs_generic",
        "geometry_vs_combo",
    }
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _pair_key(cid_a: str, cid_b: str, model: str) -> str:
    lo, hi = sorted((cid_a, cid_b))
    raw = f"{lo}|{hi}|{MERGE_PROMPT_VERSION}|{model}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _concept_embed_blob(row: sqlite3.Row) -> str:
    return (
        str(row["canonical_name"] or "")
        + "\n"
        + str(row["statement"] or "")
        + "\n"
        + str(row["definition"] or "")
        + "\nwhen_to_use: "
        + str(row["when_to_use"] or "")
    )


def _load_aliases_map(con: sqlite3.Connection) -> dict[str, set[str]]:
    m: dict[str, set[str]] = {}
    for r in con.execute("SELECT concept_id, lower(trim(alias)) AS a FROM concept_aliases"):
        cid, a = r[0], r[1]
        if not a:
            continue
        m.setdefault(cid, set()).add(a)
    return m


def _mention_count(con: sqlite3.Connection, cid: str) -> int:
    return int(
        con.execute(
            "SELECT COUNT(*) FROM raw_concept_mentions WHERE canonical_concept_id=?",
            (cid,),
        ).fetchone()[0]
    )


def _mention_snippets(
    con: sqlite3.Connection, cid: str, *, limit: int = 2
) -> list[dict[str, Any]]:
    """Short evidence lines for the LLM judge + human JSONL inspection."""
    cur = con.cursor()
    out: list[dict[str, Any]] = []
    for r in cur.execute(
        """SELECT name, graph_role_in_question,
                  substr(coalesce(statement, ''), 1, 260) AS stmt
           FROM raw_concept_mentions
           WHERE canonical_concept_id=?
           ORDER BY mention_id
           LIMIT ?""",
        (cid, limit),
    ):
        out.append(
            {
                "mention_name": r[0],
                "role": r[1],
                "statement_prefix": r[2],
            }
        )
    return out


def _canonical_row(con: sqlite3.Connection, cid: str) -> sqlite3.Row | None:
    r = con.execute(
        "SELECT * FROM canonical_concepts WHERE concept_id=?",
        (cid,),
    ).fetchone()
    return r


def _independent_signals(
    row_a: sqlite3.Row,
    row_b: sqlite3.Row,
    vec_a: list[float],
    vec_b: list[float],
    aliases_a: set[str],
    aliases_b: set[str],
) -> tuple[list[str], bool]:
    """Return (signal_names, meets_bar). Used for conservative auto-merge gating."""
    signals: list[str] = []
    ta = retr._name_tokens(row_a["canonical_name"])
    tb = retr._name_tokens(row_b["canonical_name"])
    jacc = retr._jaccard(ta, tb)
    if jacc >= 0.42:
        signals.append(f"jaccard>={round(jacc, 3)}")
    emb = cosine(vec_a, vec_b)
    if emb >= 0.80:
        signals.append(f"embedding>={round(emb, 3)}")
    na = retr._norm(row_a["canonical_name"])
    nb = retr._norm(row_b["canonical_name"])
    if na == nb:
        signals.append("name_norm_exact")
    elif na and nb and (na in nb or nb in na):
        signals.append("name_substring")
    if retr._norm(row_a["subject"]) == retr._norm(row_b["subject"]) and retr._norm(
        row_a["primary_topic"]
    ) == retr._norm(row_b["primary_topic"]) and jacc >= 0.28:
        signals.append("same_topic_lexical")
    if aliases_a & aliases_b:
        signals.append("shared_alias")

    meets = (
        emb >= 0.80
        or jacc >= 0.38
        or "name_norm_exact" in signals
        or "shared_alias" in signals
        or (("same_topic_lexical" in signals) and jacc >= 0.35)
    )
    return signals, meets


def _grok_available() -> bool:
    try:
        if str(_repo_root()) not in sys.path:
            sys.path.insert(0, str(_repo_root()))
        from scripts.grok_iterate.run import load_api_key  # noqa: WPS433

        load_api_key()
        return True
    except SystemExit:
        return False
    except Exception:
        return False


def _call_grok_json(
    model: str,
    user_prompt: str,
    *,
    schema: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    if str(_repo_root()) not in sys.path:
        sys.path.insert(0, str(_repo_root()))
    from scripts.grok_iterate.run import (  # noqa: WPS433
        call_grok,
        extract_text,
        load_api_key,
    )

    api_key = load_api_key()
    resp = call_grok(model, user_prompt, api_key, system=SYSTEM_PROMPT, json_schema=schema)
    text = extract_text(resp)
    return resp, text


def parse_json_output(text: str) -> dict[str, Any]:
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    if fence:
        t = fence.group(1).strip()
    return json.loads(t)


def _rewrite_edges_after_merge(con: sqlite3.Connection, loser: str, winner: str) -> None:
    cur = con.cursor()
    rows = cur.execute(
        """SELECT source_concept_id, target_concept_id, edge_type,
                  confidence, support_count, evidence_ids_json
           FROM concept_edges WHERE source_concept_id=? OR target_concept_id=?""",
        (loser, loser),
    ).fetchall()
    cur.execute(
        "DELETE FROM concept_edges WHERE source_concept_id=? OR target_concept_id=?",
        (loser, loser),
    )
    for r in rows:
        s = winner if r["source_concept_id"] == loser else r["source_concept_id"]
        t = winner if r["target_concept_id"] == loser else r["target_concept_id"]
        et = r["edge_type"]
        if s == t:
            continue
        ex = cur.execute(
            """SELECT confidence, support_count, evidence_ids_json FROM concept_edges
               WHERE source_concept_id=? AND target_concept_id=? AND edge_type=?""",
            (s, t, et),
        ).fetchone()
        if ex:
            nc = max(float(r["confidence"] or 0), float(ex["confidence"] or 0))
            ns = int(r["support_count"] or 0) + int(ex["support_count"] or 0)
            # naive evidence id merge JSON
            try:
                a = json.loads(r["evidence_ids_json"] or "[]")
                b = json.loads(ex["evidence_ids_json"] or "[]")
                merged_ids = json.dumps(list(dict.fromkeys((a if isinstance(a, list) else []) + (b if isinstance(b, list) else []))), ensure_ascii=False)
            except json.JSONDecodeError:
                merged_ids = ex["evidence_ids_json"]
            cur.execute(
                """UPDATE concept_edges SET confidence=?, support_count=?, evidence_ids_json=?
                   WHERE source_concept_id=? AND target_concept_id=? AND edge_type=?""",
                (nc, ns, merged_ids, s, t, et),
            )
        else:
            cur.execute(
                """INSERT INTO concept_edges (
                   source_concept_id, target_concept_id, edge_type,
                   confidence, support_count, evidence_ids_json)
                   VALUES (?,?,?,?,?,?)""",
                (
                    s,
                    t,
                    et,
                    float(r["confidence"] or 0),
                    int(r["support_count"] or 1),
                    r["evidence_ids_json"],
                ),
            )


def apply_merge_into(
    con: sqlite3.Connection,
    loser: str,
    winner: str,
    *,
    proposed_name: str | None,
    decision_id: str,
    llm_confidence: float,
) -> int:
    """Merge ``loser`` into ``winner`` (winner survives). Returns total mentions on winner."""
    cur = con.cursor()
    loser = redirect(con, loser)
    winner = redirect(con, winner)
    if loser == winner:
        return 0

    cur.execute(
        """UPDATE concept_redirects SET new_concept_id=? WHERE new_concept_id=?""",
        (winner, loser),
    )
    now = time.time()
    cur.execute(
        """INSERT OR REPLACE INTO concept_redirects (
           old_concept_id, new_concept_id, merged_at, decision_id)
           VALUES (?,?,?,?)""",
        (loser, winner, now, decision_id),
    )

    cur.execute(
        """UPDATE raw_concept_mentions SET canonical_concept_id=?
           WHERE canonical_concept_id=?""",
        (winner, loser),
    )
    mentions_updated = cur.rowcount

    for row in cur.execute(
        "SELECT alias, evidence_mention_ids_json, confidence FROM concept_aliases WHERE concept_id=?",
        (loser,),
    ):
        cur.execute(
            """INSERT INTO concept_aliases (concept_id, alias, evidence_mention_ids_json, confidence)
               VALUES (?,?,?,?)""",
            (winner, row["alias"], row["evidence_mention_ids_json"], row["confidence"]),
        )
    cur.execute("DELETE FROM concept_aliases WHERE concept_id=?", (loser,))

    cur.execute(
        "UPDATE concept_examples SET concept_id=? WHERE concept_id=?",
        (winner, loser),
    )
    cur.execute(
        "UPDATE concept_pitfalls SET concept_id=? WHERE concept_id=?",
        (winner, loser),
    )
    cur.execute(
        "UPDATE question_concepts SET concept_id=? WHERE concept_id=?",
        (winner, loser),
    )
    # Dedupe question_concepts
    cur.execute(
        """DELETE FROM question_concepts WHERE id NOT IN (
            SELECT MIN(id) FROM question_concepts
            GROUP BY question_id, concept_id, role)"""
    )

    cur.execute(
        """UPDATE graph_edge_evidence SET source_concept_id=?
           WHERE source_concept_id=?""",
        (winner, loser),
    )
    cur.execute(
        """UPDATE graph_edge_evidence SET target_concept_id=?
           WHERE target_concept_id=?""",
        (winner, loser),
    )
    cur.execute(
        "DELETE FROM graph_edge_evidence WHERE source_concept_id = target_concept_id",
    )

    _rewrite_edges_after_merge(con, loser, winner)

    cur.execute("DELETE FROM concept_derived WHERE concept_id=?", (loser,))

    wrow = cur.execute(
        "SELECT topics_json FROM canonical_concepts WHERE concept_id=?",
        (winner,),
    ).fetchone()
    lrow = cur.execute(
        "SELECT topics_json, subtopics_json FROM canonical_concepts WHERE concept_id=?",
        (loser,),
    ).fetchone()
    if wrow and lrow:
        try:
            wt = json.loads(wrow["topics_json"] or "[]")
            lt = json.loads(lrow["topics_json"] or "[]")
            merged_topics = sorted(set((wt if isinstance(wt, list) else []) + (lt if isinstance(lt, list) else [])))
            cur.execute(
                "UPDATE canonical_concepts SET topics_json=? WHERE concept_id=?",
                (json.dumps(merged_topics, ensure_ascii=False), winner),
            )
        except json.JSONDecodeError:
            pass

    cur.execute("DELETE FROM canonical_concepts WHERE concept_id=?", (loser,))

    win_name_row = cur.execute(
        "SELECT canonical_name FROM canonical_concepts WHERE concept_id=?",
        (winner,),
    ).fetchone()
    new_name = (proposed_name or "").strip() if proposed_name else ""
    if new_name and win_name_row:
        cur.execute(
            "UPDATE canonical_concepts SET canonical_name=? WHERE concept_id=?",
            (new_name, winner),
        )

    menc = cur.execute(
        "SELECT COUNT(*) FROM raw_concept_mentions WHERE canonical_concept_id=?",
        (winner,),
    ).fetchone()[0]

    cur.execute(
        """INSERT INTO concept_merge_history (
           from_concept_id, to_concept_id, reason, confidence, decision_id, affected_mention_count)
           VALUES (?,?,?,?,?,?)""",
        (
            loser,
            winner,
            "llm_merge_judge",
            llm_confidence,
            decision_id,
            menc,
        ),
    )
    del mentions_updated
    return menc


def _fix_applied_flag(con: sqlite3.Connection, pair_key_: str) -> None:
    con.execute(
        "UPDATE concept_merge_llm_decisions SET applied=1 WHERE pair_key=?",
        (pair_key_,),
    )


@dataclass
class MergePair:
    concept_a_id: str
    concept_b_id: str
    heuristic_score: float
    signals: list[str]


def build_merge_candidates(
    con: sqlite3.Connection,
    *,
    max_pairs: int,
    cross_topic: bool,
) -> list[MergePair]:
    cur = con.cursor()
    rows = cur.execute(
        """SELECT concept_id, canonical_name, subject, primary_topic,
                  statement, definition, when_to_use
           FROM canonical_concepts
           WHERE lower(trim(coalesce(lifecycle_state, ''))) != 'deprecated'"""
    ).fetchall()
    active = list(rows)
    vec_by: dict[str, list[float]] = {
        r["concept_id"]: _embedding_from_text(_concept_embed_blob(r), seed_suffix=b"cmerge")
        for r in active
    }

    by_bucket: dict[tuple[str, str], list[sqlite3.Row]] = {}
    cross_pool: dict[str | None, list[sqlite3.Row]] = {}
    for r in active:
        s = retr._norm(r["subject"]) or ""
        t = retr._norm(r["primary_topic"]) or ""
        by_bucket.setdefault((s, t), []).append(r)
        cross_pool.setdefault(r["subject"], []).append(r)

    alias_map = _load_aliases_map(con)

    cand_map: dict[tuple[str, str], float] = {}
    cand_signals: dict[tuple[str, str], list[str]] = {}

    def add_pair(ra: sqlite3.Row, rb: sqlite3.Row, score: float, sigs: list[str]) -> None:
        ia, ib = sorted([ra["concept_id"], rb["concept_id"]])
        key = (ia, ib)
        if score > cand_map.get(key, 0.0):
            cand_map[key] = score
            cand_signals[key] = sigs

    for (_s, _t), items in by_bucket.items():
        if len(items) < 2:
            continue
        topic_blank = (_t == "")
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                ra, rb = items[i], items[j]
                va = vec_by[ra["concept_id"]]
                vb = vec_by[rb["concept_id"]]
                emb = cosine(va, vb)
                ta = retr._name_tokens(ra["canonical_name"])
                tb = retr._name_tokens(rb["canonical_name"])
                jacc = retr._jaccard(ta, tb)
                nm_a = retr._norm(ra["canonical_name"])
                nm_b = retr._norm(rb["canonical_name"])
                sub_hit = nm_a == nm_b or (nm_a and nm_b and (nm_a in nm_b or nm_b in nm_a))
                aliases_a = alias_map.get(ra["concept_id"], set())
                aliases_b = alias_map.get(rb["concept_id"], set())

                signals, _met = _independent_signals(
                    ra, rb, va, vb, aliases_a, aliases_b
                )
                lex = sub_hit or (aliases_a & aliases_b) or jacc >= 0.38
                paired = jacc >= 0.26 and emb >= 0.80
                emb_only_ok = emb >= 0.93

                # Bucket (subject,'') lumps many unrelated chapters when primary_topic empty.
                # Require stronger lexical or dual-signal gates there.
                if topic_blank:
                    primary_match = retr._norm(ra["primary_topic"]) == retr._norm(rb["primary_topic"])
                    lex = (
                        sub_hit
                        or (aliases_a & aliases_b)
                        or jacc >= 0.52
                        or (primary_match and retr._norm(ra["primary_topic"]) != "")
                    )
                    paired = (jacc >= 0.44 and emb >= 0.84) or jacc >= 0.62
                    emb_only_ok = emb >= 0.965

                if lex or paired or emb_only_ok:
                    score = jacc * 0.55 + emb * 0.45 + (0.07 if sub_hit else 0) + (
                        0.05 if (aliases_a & aliases_b) else 0
                    )
                    add_pair(ra, rb, score, signals)

    if cross_topic:
        for subj, items in cross_pool.items():
            if len(items) < 2:
                continue
            for i in range(len(items)):
                for j in range(i + 1, len(items)):
                    ra, rb = items[i], items[j]
                    if retr._norm(ra["primary_topic"]) == retr._norm(rb["primary_topic"]):
                        continue
                    va = vec_by[ra["concept_id"]]
                    vb = vec_by[rb["concept_id"]]
                    emb = cosine(va, vb)
                    ta = retr._name_tokens(ra["canonical_name"])
                    tb = retr._name_tokens(rb["canonical_name"])
                    jacc = retr._jaccard(ta, tb)
                    if (jacc >= 0.70 and emb >= 0.80) or jacc >= 0.78 or emb >= 0.945:
                        aliases_a = alias_map.get(ra["concept_id"], set())
                        aliases_b = alias_map.get(rb["concept_id"], set())
                        sigs, _ = _independent_signals(
                            ra, rb, va, vb, aliases_a, aliases_b
                        )
                        score = jacc * 0.45 + emb * 0.55
                        add_pair(ra, rb, score + 0.02, sigs)

    merged = sorted(
        (
            MergePair(k[0], k[1], cand_map[k], cand_signals[k])
            for k in cand_map.keys()
        ),
        key=lambda p: -p.heuristic_score,
    )
    return merged[:max_pairs]


def enqueue_merge_review(con: sqlite3.Connection, item_type: str, priority: float, payload: dict) -> None:
    con.execute(
        """INSERT INTO review_queue (item_type, priority, payload_json, created_at)
           VALUES (?,?,?,?)""",
        (item_type, priority, json.dumps(payload, ensure_ascii=False), time.time()),
    )


def usage_from_response(resp: dict) -> dict[str, Any]:
    u = resp.get("usage") or {}
    return {
        "input_tokens": u.get("input_tokens") or u.get("prompt_tokens"),
        "output_tokens": u.get("output_tokens") or u.get("completion_tokens"),
        "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"),
    }


def run_llm_merge_pass(
    sqlite_path: Path,
    *,
    model: str,
    max_pairs: int = 1200,
    min_confidence: float = 0.90,
    dry_run: bool = False,
    force: bool = False,
    skip_api: bool = False,
    cross_topic_candidates: bool = True,
    signals_trust_min_confidence: float | None = 0.93,
) -> dict[str, Any]:
    graph_db.ensure_merge_llm_schema(sqlite_path)
    con = graph_db.connect(sqlite_path)
    cur = con.cursor()

    candidates = build_merge_candidates(
        con, max_pairs=max_pairs, cross_topic=cross_topic_candidates
    )
    stats = {
        "pairs_considered_config_cap": max_pairs,
        "candidates_found": len(candidates),
        "api_calls": 0,
        "cache_hits": 0,
        "applied_merges": 0,
        "skipped_signals": 0,
        "skipped_severe_flag": 0,
        "skipped_subject": 0,
        "needs_review_enqueued": 0,
        "dry_run": dry_run,
        "merge_prompt_version": MERGE_PROMPT_VERSION,
        "signals_trust_min_confidence": signals_trust_min_confidence,
    }

    alias_map = _load_aliases_map(con)

    api_ok = skip_api or _grok_available()
    if not api_ok:
        skip_api = True

    vec_memo: dict[str, list[float]] = {}

    def _vec_for_canonical(rrow: sqlite3.Row) -> list[float]:
        k = rrow["concept_id"]
        if k not in vec_memo:
            vec_memo[k] = _embedding_from_text(
                _concept_embed_blob(rrow), seed_suffix=b"cmerge"
            )
        return vec_memo[k]

    for pair in candidates:
        a_id, b_id = pair.concept_a_id, pair.concept_b_id
        a_id = redirect(con, a_id)
        b_id = redirect(con, b_id)
        if a_id == b_id:
            continue
        row_a = _canonical_row(con, a_id)
        row_b = _canonical_row(con, b_id)
        if not row_a or not row_b:
            continue
        pk = _pair_key(a_id, b_id, model)

        vec_a = _vec_for_canonical(row_a)
        vec_b = _vec_for_canonical(row_b)
        sig_list, signals_ok = _independent_signals(
            row_a,
            row_b,
            vec_a,
            vec_b,
            alias_map.get(a_id, set()),
            alias_map.get(b_id, set()),
        )

        context = {
            "concept_a": {
                "id": a_id,
                "name": row_a["canonical_name"],
                "subject": row_a["subject"],
                "topic": row_a["primary_topic"],
                "statement": (row_a["statement"] or "")[:800],
                "mentions": _mention_count(con, a_id),
                "mention_samples": _mention_snippets(con, a_id, limit=3),
            },
            "concept_b": {
                "id": b_id,
                "name": row_b["canonical_name"],
                "subject": row_b["subject"],
                "topic": row_b["primary_topic"],
                "statement": (row_b["statement"] or "")[:800],
                "mentions": _mention_count(con, b_id),
                "mention_samples": _mention_snippets(con, b_id, limit=3),
            },
            "signals": sig_list + [f"heuristic_rank={pair.heuristic_score:.3f}"],
        }
        ctx_json = json.dumps(context, ensure_ascii=False)

        cached_row = None if force else cur.execute(
            """SELECT decision, confidence, survivor_concept_id, proposed_canonical_name,
                      reason, risk_flags_json FROM concept_merge_llm_decisions WHERE pair_key=?""",
            (pk,),
        ).fetchone()

        parsed: dict[str, Any]
        resp: dict[str, Any]
        usage_json: dict[str, Any]

        if cached_row:
            stats["cache_hits"] += 1
            parsed = {
                "decision": cached_row["decision"],
                "confidence": float(cached_row["confidence"]),
                "survivor_concept_id": cached_row["survivor_concept_id"],
                "canonical_name": cached_row["proposed_canonical_name"],
                "reason": cached_row["reason"] or "",
                "risk_flags": json.loads(cached_row["risk_flags_json"] or "[]"),
            }
            resp = {}
            usage_json = {}
        else:
            user_prompt = (
                ctx_json
                + "\n\nDecide merge | do_not_merge | needs_human_review. "
                + "Merge only for identical node identity, not prerequisites or related-but-distinct notions. "
                + "If decision is merge, survivor_concept_id MUST be exactly concept_a.id or concept_b.id (the surviving node)."
            )

            if skip_api:
                parsed = {
                    "decision": "do_not_merge",
                    "confidence": 1.0,
                    "reason": "skip_api mode (no Grok call)",
                    "risk_flags": [],
                    "survivor_concept_id": a_id,
                }
                resp = {}
                usage_json = {}
            else:
                stats["api_calls"] += 1
                resp, text = _call_grok_json(
                    model, user_prompt, schema=MERGE_RESPONSE_JSON_SCHEMA
                )
                usage_json = usage_from_response(resp)
                try:
                    parsed = parse_json_output(text)
                except json.JSONDecodeError:
                    parsed = {
                        "decision": "needs_human_review",
                        "confidence": 0.5,
                        "reason": "unparseable model output",
                        "risk_flags": ["parse_error"],
                        "survivor_concept_id": a_id,
                    }

            rf_ins = parsed.get("risk_flags")
            rf_ins = rf_ins if isinstance(rf_ins, list) else []
            cur.execute(
                """INSERT OR REPLACE INTO concept_merge_llm_decisions (
                     pair_key, concept_a_id, concept_b_id, context_json,
                     model, prompt_version, decision, confidence,
                     survivor_concept_id, proposed_canonical_name, reason,
                     risk_flags_json, similarity_signals_json, usage_json, raw_response_json, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    pk,
                    a_id,
                    b_id,
                    ctx_json,
                    model,
                    MERGE_PROMPT_VERSION,
                    str(parsed.get("decision") or "needs_human_review"),
                    float(parsed.get("confidence") or 0.0),
                    parsed.get("survivor_concept_id"),
                    parsed.get("canonical_name"),
                    str(parsed.get("reason") or ""),
                    json.dumps(rf_ins, ensure_ascii=False),
                    json.dumps(sig_list, ensure_ascii=False),
                    json.dumps(usage_json, ensure_ascii=False),
                    json.dumps(resp, ensure_ascii=False)[:24000],
                    time.time(),
                ),
            )

        dec = str(parsed.get("decision") or "").lower().strip()
        conf = float(parsed.get("confidence") or 0.0)
        risk_flags_raw = (
            parsed.get("risk_flags") if isinstance(parsed.get("risk_flags"), list) else []
        )
        risk_low = {str(x).strip().lower() for x in risk_flags_raw}

        if dec == "needs_human_review" or (dec == "merge" and conf < min_confidence):
            enqueue_merge_review(
                con,
                "llm_merge_review",
                conf,
                {
                    "pair_key": pk,
                    "concept_a_id": a_id,
                    "concept_b_id": b_id,
                    "decision": dec,
                    "confidence": conf,
                    "risk_flags": list(risk_low),
                    "reason": parsed.get("reason"),
                },
            )
            stats["needs_review_enqueued"] += 1
            con.commit()
            continue

        if dec != "merge":
            con.commit()
            continue

        if retr._norm(row_a["subject"]) != retr._norm(row_b["subject"]):
            stats["skipped_subject"] += 1
            con.commit()
            continue

        if any(f in risk_low for f in SEVERE_RISK_FLAGS):
            stats["skipped_severe_flag"] += 1
            enqueue_merge_review(
                con,
                "llm_merge_review",
                conf,
                {
                    "pair_key": pk,
                    "concept_a_id": a_id,
                    "concept_b_id": b_id,
                    "decision": dec,
                    "confidence": conf,
                    "risk_flags": list(risk_low),
                    "reason": parsed.get("reason"),
                    "note": "severe_flag_blocked_auto_merge",
                },
            )
            con.commit()
            continue

        trust_bypass_ok = signals_trust_min_confidence is not None and (
            conf + 1e-9 >= signals_trust_min_confidence
        )
        # Pair already passed lexical/embedding shortlist; deterministic signals can disagree slightly.
        if not signals_ok and not trust_bypass_ok:
            stats["skipped_signals"] += 1
            enqueue_merge_review(
                con,
                "llm_merge_review",
                float(conf),
                {
                    "pair_key": pk,
                    "concept_a_id": a_id,
                    "concept_b_id": b_id,
                    "decision": dec,
                    "confidence": conf,
                    "risk_flags": list(risk_low),
                    "reason": parsed.get("reason"),
                    "note": "signals_gate_failed",
                },
            )
            con.commit()
            continue

        survivor = parsed.get("survivor_concept_id")
        if survivor not in (a_id, b_id):
            stats["skipped_signals"] += 1
            enqueue_merge_review(
                con,
                "llm_merge_review",
                conf,
                {
                    "pair_key": pk,
                    "concept_a_id": a_id,
                    "concept_b_id": b_id,
                    "survivor": survivor,
                    "reason": parsed.get("reason"),
                    "note": "bad_survivor_id",
                },
            )
            con.commit()
            continue

        loser = b_id if survivor == a_id else a_id
        winner = str(survivor)
        pname = (
            parsed.get("canonical_name") if isinstance(parsed.get("canonical_name"), str) else None
        )

        if dry_run:
            enqueue_merge_review(
                con,
                "llm_merge_dry_run",
                float(conf),
                {"would_merge": loser, "into": winner, "confidence": conf, "name": pname},
            )
            con.commit()
            continue

        merge_decision_id = f"llmm_{uuid.uuid4().hex[:20]}"
        apply_merge_into(
            con,
            loser,
            winner,
            proposed_name=pname or None,
            decision_id=merge_decision_id,
            llm_confidence=conf,
        )
        _fix_applied_flag(con, pk)
        stats["applied_merges"] += 1
        alias_map = _load_aliases_map(con)
        con.commit()

    con.close()
    return stats
