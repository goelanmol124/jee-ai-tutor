"""Extract question/answer excerpts from coaching PDF structure JSON (segments_heuristic)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

BUNDLE_SEP = "— — — answer / key — — —"


@dataclass
class CoachingExcerpt:
    global_paper_index: int
    local_number: int
    coaching_subject: str
    section_b: bool
    question_excerpt: str
    answer_excerpt: str
    segment_id: int
    structure_path: str


_SUBJ_TAIL = re.compile(r"(MATHEMATICS|CHEMISTRY|PHYSICS)\s*$", re.M)


def _last_subject_hint(text: str) -> str | None:
    m = _SUBJ_TAIL.search(text.rstrip())
    if m:
        return m.group(1).lower()[:4]
    for w in ("MATHEMATICS", "CHEMISTRY", "PHYSICS"):
        if text.rstrip().endswith(w):
            return w.lower()[:4]
    return None


def coaching_local_to_global(subject_key: str, local: int, section_b: bool) -> int | None:
    """Map coaching PDF local index (1–25 per subject) to NTA paper index 1–75."""
    if subject_key == "math":
        if section_b:
            if 21 <= local <= 25:
                return local
        else:
            if 1 <= local <= 20:
                return local
        if 21 <= local <= 25:
            return local
        return None
    if subject_key == "phys":
        if section_b:
            if 21 <= local <= 25:
                return 25 + local
        else:
            if 1 <= local <= 20:
                return 25 + local
        return None
    if subject_key == "chem":
        if section_b:
            if 21 <= local <= 25:
                return 50 + local
        else:
            if 1 <= local <= 20:
                return 50 + local
        return None
    return None


def _leading_qnum(s: str) -> int | None:
    s = s.lstrip()
    m = re.match(r"^(\d{1,2})\.\s", s)
    return int(m.group(1)) if m else None


def _leading_qnum_any(s: str) -> int | None:
    """Coaching '1. ...' (Aakash) or 'Q1. ...' / 'Q26. ...' (MathonGo global numbering)."""
    s = s.lstrip()
    m = re.match(r"^Q(\d{1,2})\.", s, re.I)
    if m:
        return int(m.group(1))
    return _leading_qnum(s)


_Q_BLOCK_START = re.compile(r"(?m)^Q(\d{1,2})\.\s", re.I)


def iter_global_q_style_blocks(text: str) -> list[tuple[int, str, str]]:
    """Split a segment that packs Q1., Q2., … Q26. … (MathonGo). Returns (display_num, question, answer)."""
    matches = list(_Q_BLOCK_START.finditer(text))
    if len(matches) < 1:
        return []
    chunks: list[tuple[int, str, str]] = []
    for i, m in enumerate(matches):
        local = int(m.group(1))
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end].strip()
        if BUNDLE_SEP in chunk:
            q_part, a_part = chunk.split(BUNDLE_SEP, 1)
            q_blob = q_part.strip()
            a_blob = a_part.strip()
        else:
            q_blob, a_blob = chunk, ""
        chunks.append((local, q_blob, a_blob[:8000]))
    return chunks


def resolve_global_paper_index(
    local: int,
    current_subj: str | None,
    section_b: bool,
    *,
    global_q_style: bool,
) -> int | None:
    if global_q_style and 1 <= local <= 75:
        return local
    if current_subj is not None:
        return coaching_local_to_global(current_subj, local, section_b)
    return None


def _pick_local_and_question_parts(parts: list[str]) -> tuple[int | None, str]:
    """Identify local index and question-bearing text from segments split by BUNDLE_SEP."""
    if not parts:
        return None, ""
    if len(parts) == 1:
        qtext = parts[0]
        return _leading_qnum_any(qtext), qtext
    a, b = parts[0], parts[1]
    la, lb = _leading_qnum_any(a), _leading_qnum_any(b)
    if la is not None:
        return la, a
    if lb is not None:
        return lb, b
    return None, ""


def _split_question_answer_bundle(text: str) -> list[str]:
    if BUNDLE_SEP not in text:
        return [text]
    return text.split(BUNDLE_SEP)


def extract_coaching_excerpts(structure_path: Path) -> dict[int, CoachingExcerpt]:
    data = json.loads(structure_path.read_text(encoding="utf-8", errors="replace"))
    segs = data.get("segments_heuristic") or []
    out: dict[int, CoachingExcerpt] = {}
    current_subj: str | None = None
    section_b = False

    for seg in segs:
        kind = seg.get("kind")
        text = seg.get("text") or ""
        sid = seg.get("id")

        if kind == "section_or_part":
            hint = _last_subject_hint(text)
            if hint:
                current_subj = hint
                section_b = False
            if "SECTION - B" in text.upper() or "SECTION-B" in text.upper().replace(" ", ""):
                section_b = True
            elif "SECTION - A" in text.upper():
                section_b = False

        if kind != "question_answer_bundle":
            continue

        def push_ce(
            g: int,
            local: int,
            subj: str,
            q_ex: str,
            a_ex: str,
            global_style: bool,
        ) -> None:
            subj_tag = "global_q_enum" if global_style else subj
            ce = CoachingExcerpt(
                global_paper_index=g,
                local_number=local,
                coaching_subject=subj_tag,
                section_b=section_b,
                question_excerpt=q_ex[:6000],
                answer_excerpt=a_ex[:8000],
                segment_id=int(sid) if sid is not None else -1,
                structure_path=str(structure_path.as_posix()),
            )
            prev = out.get(g)
            if prev is None or len(q_ex) > len(prev.question_excerpt):
                out[g] = ce

        q_style_chunks = iter_global_q_style_blocks(text)
        if q_style_chunks:
            for local, q_blob, a_blob in q_style_chunks:
                g = resolve_global_paper_index(
                    local,
                    current_subj,
                    section_b,
                    global_q_style=True,
                )
                if g is None or not q_blob.strip():
                    continue
                push_ce(g, local, current_subj or "global_q_enum", q_blob, a_blob, True)
            continue

        parts = _split_question_answer_bundle(text)
        local, q_blob = _pick_local_and_question_parts(parts)
        if local is None or not q_blob.strip():
            continue
        g = resolve_global_paper_index(
            local,
            current_subj,
            section_b,
            global_q_style=False,
        )
        if g is None:
            continue
        ans_chunks: list[str] = []
        for p in parts:
            ps = p.strip()
            if not ps or ps == q_blob.strip():
                continue
            ans_chunks.append(ps[:4500])
        a_ex = "\n...\n".join(ans_chunks)[:8000]
        if not a_ex and len(parts) >= 2:
            a_ex = (parts[1] if q_blob == parts[0] else parts[0])[:8000]

        push_ce(
            g,
            local,
            current_subj or "unknown",
            q_blob,
            a_ex,
            False,
        )

    return out


def attach_coaching_to_rows(
    rows: list[Any],
    by_global: dict[int, CoachingExcerpt],
) -> list[dict]:
    """Merge coaching excerpts into NTA skeleton rows (paper_index match)."""
    merged = []
    for r in rows:
        ce = by_global.get(r.paper_index)
        merged.append(
            {
                "paper_index": r.paper_index,
                "nta_question_id": r.nta_question_id,
                "section_key": r.section_key,
                "question_type": r.question_type,
                "option_ids": r.option_ids,
                "coaching": None
                if ce is None
                else {
                    "local_number": ce.local_number,
                    "coaching_subject": ce.coaching_subject,
                    "section_b": ce.section_b,
                    "question_excerpt": ce.question_excerpt,
                    "answer_excerpt": ce.answer_excerpt,
                    "structure_path": ce.structure_path,
                    "segment_id": ce.segment_id,
                },
            }
        )
    return merged
