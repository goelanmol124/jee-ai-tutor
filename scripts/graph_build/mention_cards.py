"""Mention-level cards + local embedding projections (deterministic fallback)."""
from __future__ import annotations

import hashlib
import json
import math
import sqlite3
from pathlib import Path

from . import db


def mention_card_from_row(row: sqlite3.Row) -> str:
    d = dict(row)
    chap = ""
    loc = ""
    try:
        chap = ", ".join(json.loads(d["chapter_prereqs_json"] or "[]"))
    except json.JSONDecodeError:
        chap = str(d["chapter_prereqs_json"])
    try:
        loc = ", ".join(json.loads(d["local_prereq_concepts_json"] or "[]"))
    except json.JSONDecodeError:
        loc = ""

    nb = ""
    try:
        nb = ", ".join(json.loads(d["nearby_step_concepts_json"] or "[]"))
    except json.JSONDecodeError:
        nb = ""

    rep_e = ""
    rep_t = ""
    try:
        ex = json.loads(d["step_expressions_json"] or "[]")
        th = json.loads(d["step_thoughts_json"] or "[]")
        if ex:
            rep_e = str(ex[0])
        if th:
            rep_t = str(th[0])
    except json.JSONDecodeError:
        pass

    return (
        f"name: {d.get('name')}\n"
        f"statement: {d.get('statement')}\n"
        f"when_to_use: {d.get('when_to_use')}\n"
        f"subject: {d.get('subject')}\n"
        f"topic: {d.get('topic')}\n"
        f"subtopic: {d.get('subtopic')}\n"
        f"graph_role_in_question: {d.get('graph_role_in_question')}\n"
        f"chapter_prereqs: {chap}\n"
        f"local_prereq_concepts: {loc}\n"
        f"nearby_step_concepts: {nb}\n"
        f"representative_step_expression: {rep_e}\n"
        f"representative_step_thought: {rep_t}\n"
        f"source_quality: {d.get('source_quality_status')} "
        f"confidence={d.get('question_confidence')}\n"
    )


def _embedding_from_text(text: str, dim: int = 384, seed_suffix: bytes = b"") -> list[float]:
    """Deterministic unit vector (~BGE-ish dim) without torch."""
    h = hashlib.blake2b(text.encode("utf-8"), digest_size=64, person=seed_suffix)
    rng = hashlib.sha256(h.digest()).digest()
    vec: list[float] = []
    for i in range(dim):
        chunk = rng[i % len(rng) : (i % len(rng)) + 1]
        # expand
        b = (rng[i * 3 % 32 : i * 3 % 32 + 3] or b"\x00\x00\x00")[:3]
        x = int.from_bytes(b + b"\x00", "big") / (16**6) - 0.5
        vec.append(float(x))
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def build_embeddings(sqlite_path: Path) -> Path:
    """Fill embedding_text, embedding_index; write vectors.npy if numpy available."""
    con = db.connect(sqlite_path)
    cur = con.cursor()
    cur.execute("SELECT * FROM raw_concept_mentions ORDER BY mention_id")
    rows = cur.fetchall()
    vectors: list[list[float]] = []
    try:
        import numpy as np  # type: ignore

        use_np = True
    except ImportError:
        use_np = False

    for idx, row in enumerate(rows):
        card = mention_card_from_row(row)
        cur.execute(
            "UPDATE raw_concept_mentions SET embedding_text=? , embedding_vector_id=? WHERE mention_id=?",
            (card, idx, row["mention_id"]),
        )
        full_v = _embedding_from_text(card, seed_suffix=b"full")
        narrow_ns = _embedding_from_text(
            f"{row['name']}\n{row['statement']}", seed_suffix=b"ns"
        )
        narrow_nw = _embedding_from_text(
            f"{row['name']}\n{row['when_to_use']}", seed_suffix=b"nw"
        )
        fused = [a + b + c for a, b, c in zip(full_v, narrow_ns, narrow_nw)]
        nf = math.sqrt(sum(x * x for x in fused)) or 1.0
        fused = [x / nf for x in fused]
        vectors.append(fused)
        cur.execute("DELETE FROM embedding_index WHERE mention_id=?", (row["mention_id"],))
        cur.execute(
            """INSERT INTO embedding_index (mention_id, dim, projection)
            VALUES (?,?,?)""",
            (row["mention_id"], len(fused), "fused_full_ns_nw"),
        )

    out_npy = sqlite_path.with_suffix(".vectors.npy")
    if use_np and vectors:
        import numpy as np  # type: ignore

        arr = np.array(vectors, dtype=np.float32)
        np.save(out_npy, arr)
    else:
        out_npy = sqlite_path.with_suffix(".vectors.json")
        out_npy.write_text(json.dumps(vectors), encoding="utf-8")

    con.commit()
    con.close()
    return out_npy
