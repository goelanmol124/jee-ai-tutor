"""Heuristic audit: coaching materials vs official Session-1 MCQ key (no LLM)."""

from __future__ import annotations

import re
from typing import Any

# Primary: explicit "Answer (k)" in solutions (Aakash / similar).
_ANSWER_PAREN = re.compile(
    r"(?:^|[\n\r]|[^\d\w])Answer\s*[\s.:]*\(\s*([1-4])\s*\)",
    re.I | re.M,
)
# Secondary: Ans / Key lines
_ANSWER_SHORT = re.compile(
    r"(?:^|[\n\r])\s*(?:Ans(?:wer)?|Key)\s*[\s.:]+\(?\s*([1-4])\s*\)?\b",
    re.I | re.M,
)


def _hints_from_text(text: str, patterns: tuple[re.Pattern[str], ...]) -> list[str]:
    return [m.group(1) for rx in patterns for m in rx.finditer(text or "")]


def _norm_id(s: str) -> str:
    t = s.strip()
    return t.lstrip("0") or "0"


def resolve_effective_official_mcq(
    domestic_or_numeric: str | None,
    correct_option_id: str | None,
    option_ids: list[str],
) -> tuple[str | None, dict[str, Any]]:
    """
    Prefer betech domestic 1–4; if missing (common before shift-II parse fix),
    infer MCQ index from official option-id column + NTA option ids.
    """
    meta: dict[str, Any] = {
        "official_mcq_source": None,
        "official_mcq_conflict": False,
    }
    dom = (domestic_or_numeric or "").strip()
    from_opts: str | None = None
    if correct_option_id and option_ids:
        co = str(correct_option_id).strip()
        for i, oid in enumerate(option_ids):
            o = str(oid).strip()
            if o == co or _norm_id(o) == _norm_id(co):
                from_opts = str(i + 1)
                break
    if dom and dom.lower() != "drop" and re.fullmatch(r"[1-4]", dom):
        meta["official_mcq_source"] = "domestic_key"
        if from_opts is not None and from_opts != dom:
            meta["official_mcq_conflict"] = True
        return dom, meta
    if from_opts:
        meta["official_mcq_source"] = "option_id_column"
        return from_opts, meta
    return None, meta


def audit_coaching_vs_official_mcq(
    *,
    question_type: str,
    official_domestic: str | None,
    answer_excerpt: str,
    question_excerpt: str,
) -> dict[str, Any]:
    """
    Compare third-party coaching MCQ letter hint to NTA domestic key (1–4).

    Returns versus_official: match | mismatch | no_coaching_hint | ambiguous_hint
    | not_applicable (non-MCQ, Drop, or non–1–4 official).
    """
    out: dict[str, Any] = {
        "coaching_mcq_hints": [],
        "coaching_mcq_primary": None,
        "versus_official_mcq": "not_applicable",
    }
    if question_type != "MCQ":
        return out
    dom = (official_domestic or "").strip()
    if not dom or dom.lower() == "drop":
        return out
    if not re.fullmatch(r"[1-4]", dom):
        return out

    ae, qe = answer_excerpt or "", question_excerpt or ""
    primary_hints = _hints_from_text(ae, (_ANSWER_PAREN,))
    if not primary_hints:
        primary_hints = _hints_from_text(ae, (_ANSWER_SHORT,))
    secondary = []
    if not primary_hints:
        secondary = _hints_from_text(qe, (_ANSWER_PAREN, _ANSWER_SHORT))

    hints = primary_hints or secondary
    out["coaching_mcq_hints"] = hints
    if not hints:
        out["versus_official_mcq"] = "no_coaching_hint"
        return out

    uniq = list(dict.fromkeys(hints))
    if len(uniq) > 1:
        out["versus_official_mcq"] = "ambiguous_hint"
        return out

    out["coaching_mcq_primary"] = uniq[0]
    out["versus_official_mcq"] = "match" if uniq[0] == dom else "mismatch"
    return out


def summarize_answer_audits(questions: list[dict]) -> dict[str, int]:
    """Aggregate counts for slot-level coverage."""
    s = {
        "mcq_audited": 0,
        "mcq_match": 0,
        "mcq_mismatch": 0,
        "mcq_no_coaching_hint": 0,
        "mcq_ambiguous_hint": 0,
        "mcq_official_conflict": 0,
    }
    for q in questions:
        a = q.get("answer_audit")
        if a is None:
            continue
        if a.get("versus_official_mcq") == "not_applicable":
            continue
        s["mcq_audited"] += 1
        if a.get("official_mcq_conflict"):
            s["mcq_official_conflict"] += 1
        v = a.get("versus_official_mcq")
        if v == "match":
            s["mcq_match"] += 1
        elif v == "mismatch":
            s["mcq_mismatch"] += 1
        elif v == "no_coaching_hint":
            s["mcq_no_coaching_hint"] += 1
        elif v == "ambiguous_hint":
            s["mcq_ambiguous_hint"] += 1
    return s
