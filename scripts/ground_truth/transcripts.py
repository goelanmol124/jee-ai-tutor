"""Map archive slots to transcript folders; score transcript windows vs question text."""

from __future__ import annotations

import json
import re
from pathlib import Path

from similarity import multiset_jaccard, normalize_tokens

_SLOT_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-shift-(\d+)$")

# Handful of English STEM cues often present in romanized Hindi edu content
_STEM_HINT = frozenset(
    "newton coulomb volt capacitor inductor resistor velocity acceleration momentum "
    "integral derivative limit probability vector matrix determinant eigen logarithm "
    "equilibrium entropy enthalpy isomer benzene oxidation reduction polymer".split()
)


def transcript_relative_dir(slot_id: str) -> tuple[str, str] | None:
    """
    Return (session_folder, date_shift_path) under jee_mains_2026_transcripts, or None.
    """
    m = _SLOT_RE.match(slot_id)
    if not m:
        return None
    y, mo, d, sh = m.groups()
    date = f"{y}-{mo}-{d}"
    shift_path = f"{date}/shift_{sh}"
    if mo == "04":
        session = "session_2_april"
    elif mo == "01":
        session = "session_1_january"
    else:
        session = "session_1_january"
    return session, shift_path


def iter_transcript_files(transcripts_root: Path, slot_id: str) -> list[Path]:
    rel = transcript_relative_dir(slot_id)
    if not rel:
        return []
    session, sub = rel
    base = transcripts_root / session / sub
    if not base.is_dir():
        return []
    files: list[Path] = []
    for p in base.rglob("*.en.txt"):
        files.append(p)
    if not files:
        for p in base.rglob("*.roman.txt"):
            files.append(p)
    return sorted(files)


_TS_LINE = re.compile(r"^\[(\d+(?:\.\d+)?)s\]\s*(.*)$")


def chunk_transcript_lines(lines: list[str], max_lines: int = 25) -> list[tuple[float, float, str]]:
    """Return (t_start, t_end, text) chunks based on timestamp lines."""
    chunks: list[tuple[float, float, str]] = []
    buf: list[str] = []
    t_start: float | None = None
    t_last: float | None = None

    def flush() -> None:
        nonlocal buf, t_start, t_last
        if buf and t_start is not None and t_last is not None:
            chunks.append((t_start, t_last, "\n".join(buf)))
        buf = []
        t_start = None
        t_last = None

    for line in lines:
        m = _TS_LINE.match(line)
        if m:
            if len(buf) >= max_lines:
                flush()
            t = float(m.group(1))
            if t_start is None:
                t_start = t
            t_last = t
            buf.append(m.group(2))
        else:
            if buf:
                buf.append(line)
            if len(buf) >= max_lines:
                flush()
    flush()
    return chunks


def hint_bonus(q_tokens: set[str], chunk_lower: str) -> float:
    hits = sum(1 for w in _STEM_HINT if w in chunk_lower and w in q_tokens)
    return min(0.15, 0.02 * hits)


def transcript_hints_for_question(
    question_excerpt: str,
    transcripts_root: Path,
    slot_id: str,
    top_k: int = 3,
    min_score: float = 0.06,
) -> list[dict]:
    q_tok = normalize_tokens(question_excerpt)
    q_set = set(q_tok)
    if not q_tok:
        return []
    hints: list[tuple[float, dict]] = []
    for tf in iter_transcript_files(transcripts_root, slot_id):
        text = tf.read_text(encoding="utf-8", errors="replace")
        lines = text.splitlines()
        chunks = chunk_transcript_lines(lines)
        meta_path = tf.with_suffix(".meta.json")
        video_id = tf.stem
        if meta_path.is_file():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8", errors="replace"))
                video_id = meta.get("video_id", video_id)
            except json.JSONDecodeError:
                pass
        for t0, t1, chunk in chunks:
            ct = normalize_tokens(chunk)
            sc = multiset_jaccard(q_tok, ct) + hint_bonus(q_set, chunk.lower())
            if sc >= min_score:
                hints.append(
                    (
                        sc,
                        {
                            "video_id": video_id,
                            "transcript_path": str(tf.as_posix()),
                            "t_start_s": t0,
                            "t_end_s": t1,
                            "similarity": round(sc, 4),
                            "excerpt": chunk[:900],
                        },
                    )
                )
    hints.sort(key=lambda x: -x[0])
    dedup: list[dict] = []
    seen = set()
    for sc, h in hints:
        key = (h["video_id"], round(h["t_start_s"], 1))
        if key in seen:
            continue
        seen.add(key)
        dedup.append(h)
        if len(dedup) >= top_k:
            break
    return dedup
