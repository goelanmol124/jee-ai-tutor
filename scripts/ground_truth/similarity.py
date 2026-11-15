"""Token normalization and cross-slot similarity (heuristic, no ML)."""

from __future__ import annotations

import difflib
import re
from collections import Counter, defaultdict
from dataclasses import dataclass

BLEND_JACCARD = 0.62
BLEND_SEQUENCE = 0.38


def normalize_tokens(s: str, max_tokens: int = 400) -> list[str]:
    s = s.lower()
    s = re.sub(r"[^\w\s\d]", " ", s, flags=re.UNICODE)
    return [t for t in s.split() if len(t) > 1][:max_tokens]


def multiset_jaccard(a: list[str], b: list[str]) -> float:
    ca, cb = Counter(a), Counter(b)
    inter = sum((ca & cb).values())
    union = sum((ca | cb).values())
    return float(inter) / union if union else 0.0


def sequence_token_ratio(a: list[str], b: list[str], cap: int = 160) -> float:
    """Fuzzy overlap on glued token sequence (captures order-ish similarity)."""
    sa = " ".join(a[:cap])
    sb = " ".join(b[:cap])
    if not sa and not sb:
        return 0.0
    return float(difflib.SequenceMatcher(None, sa, sb).ratio())


def blended_similarity(a: list[str], b: list[str], *, jaccard_prefilter: float = 0.06) -> float:
    """
    Multiset Jaccard plus sequence alignment on tokens (fuzzy / order-aware).
    SequenceMatcher runs only when Jaccard is above a small threshold — full O(n²)
    cross-slot passes stay fast.
    """
    ja = multiset_jaccard(a, b)
    if ja < jaccard_prefilter:
        return ja
    seq = sequence_token_ratio(a, b)
    return BLEND_JACCARD * ja + BLEND_SEQUENCE * seq


@dataclass
class Fingerprint:
    slot_id: str
    paper_index: int
    nta_question_id: str
    tokens: list[str]
    preview: str


def collect_fingerprints(
    slot_id: str,
    questions: list[dict],
    preview_len: int = 240,
    min_tokens: int = 8,
) -> list[Fingerprint]:
    fps: list[Fingerprint] = []
    for q in questions:
        txt = ""
        c = q.get("coaching") or {}
        if isinstance(c, dict):
            txt = c.get("question_excerpt") or ""
        if not txt.strip():
            continue
        tokens = normalize_tokens(txt)
        if len(tokens) < min_tokens:
            continue
        fps.append(
            Fingerprint(
                slot_id=slot_id,
                paper_index=int(q["paper_index"]),
                nta_question_id=str(q.get("nta_question_id", "")),
                tokens=tokens,
                preview=txt[:preview_len].replace("\n", " "),
            )
        )
    return fps


def _index_token(t: str) -> bool:
    """Skip very common short tokens so inverted-index buckets stay small."""
    if len(t) <= 2:
        return False
    if any(ch.isdigit() for ch in t):
        return True
    return len(t) >= 4


def cross_slot_neighbors(
    all_fp: list[Fingerprint],
    top_k: int = 3,
    min_score: float = 0.12,
) -> dict[tuple[str, int], list[dict]]:
    """Map (slot_id, paper_index) -> list of {other_slot, other_paper_index, score, preview}."""
    n = len(all_fp)
    df: dict[str, int] = defaultdict(int)
    for f in all_fp:
        for t in set(f.tokens):
            if _index_token(t):
                df[t] += 1
    max_df = max(24, int(n * 0.07))

    tok_to_idx: dict[str, set[int]] = defaultdict(set)
    for idx, f in enumerate(all_fp):
        for t in set(f.tokens):
            if _index_token(t) and df[t] <= max_df:
                tok_to_idx[t].add(idx)

    out: dict[tuple[str, int], list[dict]] = {}
    for i in range(n):
        fi = all_fp[i]
        key = (fi.slot_id, fi.paper_index)
        cand: set[int] = set()
        for t in fi.tokens:
            if _index_token(t) and df[t] <= max_df:
                cand.update(tok_to_idx.get(t, ()))
        cand.discard(i)
        hits: list[tuple[float, Fingerprint]] = []
        for j in cand:
            fj = all_fp[j]
            if fj.slot_id == fi.slot_id:
                continue
            sc = blended_similarity(fi.tokens, fj.tokens)
            if sc >= min_score:
                hits.append((sc, fj))
        hits.sort(key=lambda x: -x[0])
        out[key] = [
            {
                "other_slot_id": h[1].slot_id,
                "other_paper_index": h[1].paper_index,
                "other_nta_question_id": h[1].nta_question_id,
                "similarity": round(h[0], 4),
                "preview_other": h[1].preview,
            }
            for h in hits[:top_k]
        ]
    return out
