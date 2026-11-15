"""Parse NTA official question paper .extracted.full.txt for Question Id grid."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class NTAQuestionRow:
    paper_index: int
    nta_question_id: str
    section_key: str
    question_type: str  # MCQ | SA
    option_ids: list[str]


_SEC_RE = re.compile(
    r"(Mathematics|Physics|Chemistry)\s+Section\s+([AB])",
    re.I,
)
_Q_RE = re.compile(
    r"Question\s+Number\s*:\s*(\d+)\s+Question\s+Id\s*:\s*(\d+)\s+Question\s+Type\s*:\s*(\w+)",
    re.I,
)
_OPT_RE = re.compile(r"Options\s*:\s*((?:\n?\d+\.)+)", re.I)


def _norm_sid(raw: str) -> str:
    s = raw.strip()
    if s.endswith("."):
        s = s[:-1]
    return s.lstrip("0") or "0"


def parse_nta_question_paper_text(text: str) -> list[NTAQuestionRow]:
    """Extract questions with section from flattened extract text."""
    rows: list[NTAQuestionRow] = []
    current_section = "unknown_a"

    i = 0
    lines = text.splitlines()
    n = len(lines)
    while i < n:
        line = lines[i]
        msec = _SEC_RE.search(line)
        if msec:
            subj = msec.group(1).lower()[:4]
            ab = msec.group(2).upper()
            current_section = f"{subj}_{ab.lower()}"
            i += 1
            continue

        mq = _Q_RE.search(line)
        if mq:
            paper_index = int(mq.group(1))
            qid = mq.group(2).strip()
            qtype = mq.group(3).upper()
            option_ids: list[str] = []
            rest = line[mq.end() :]
            blob = rest
            j = i + 1
            while j < n and not _Q_RE.search(lines[j]) and not _SEC_RE.search(lines[j]):
                blob += "\n" + lines[j]
                if j - i > 25:
                    break
                j += 1
            om = _OPT_RE.search(blob)
            if om:
                raw_opts = re.findall(r"\b(\d+)\.", om.group(1))
                option_ids = [_norm_sid(x) for x in raw_opts]

            rows.append(
                NTAQuestionRow(
                    paper_index=paper_index,
                    nta_question_id=qid,
                    section_key=current_section,
                    question_type="SA" if qtype == "SA" else "MCQ",
                    option_ids=option_ids,
                )
            )
        i += 1

    rows.sort(key=lambda r: r.paper_index)
    return rows


def parse_nta_question_paper_path(path: Path) -> list[NTAQuestionRow]:
    return parse_nta_question_paper_text(path.read_text(encoding="utf-8", errors="replace"))


def infer_section_key_and_type(paper_index: int) -> tuple[str, str]:
    """JEE Main 2026 Paper-1 style 75-question layout."""
    if 1 <= paper_index <= 20:
        return "math_a", "MCQ"
    if 21 <= paper_index <= 25:
        return "math_b", "SA"
    if 26 <= paper_index <= 45:
        return "phys_a", "MCQ"
    if 46 <= paper_index <= 50:
        return "phys_b", "SA"
    if 51 <= paper_index <= 70:
        return "chem_a", "MCQ"
    if 71 <= paper_index <= 75:
        return "chem_b", "SA"
    return "unknown", "MCQ"


def rows_from_ordered_question_ids(qids: list[str]) -> list[NTAQuestionRow]:
    """Fallback skeleton when QP extract missing (Session-1 order from official key)."""
    rows: list[NTAQuestionRow] = []
    for i, qid in enumerate(qids, start=1):
        sk, qt = infer_section_key_and_type(i)
        rows.append(
            NTAQuestionRow(
                paper_index=i,
                nta_question_id=qid,
                section_key=sk,
                question_type=qt,
                option_ids=[],
            )
        )
    return rows
