"""Parse NTA final answer key extracts (domestic 1–4 / numeric + option-id PDFs)."""

from __future__ import annotations

import functools
import re
from pathlib import Path


def _date_to_slot_date(s: str) -> str | None:
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", s.strip())
    if not m:
        return None
    d, mo, y = m.groups()
    return f"{y}-{mo}-{d}"


def _shift_to_num(label: str) -> int | None:
    t = label.strip().lower().replace(" ", "").replace("\u2013", "-")
    # "shift-ii" contains substring "shift-i" — classify II / second before I / first.
    if "shift-ii" in t or "second" in t:
        return 2
    if "shift-i" in t or "first" in t:
        return 1
    return None


def _chunk_india_score(part: str) -> int:
    head = part[:500].lower()
    if "outside india" in head or "outside-india" in head:
        return 2
    if "centers in india" in head or "centres in india" in head:
        return 0
    return 1


def _parse_betech_domestic_chunk(part: str) -> dict[tuple[str, int, str], dict[str, str]]:
    """
    Triplet rows inside one Exam Date / Exam Shift block.
    Returns (slot_date, shift_num, section) -> {qid: answer}
    """
    lines = [ln.strip() for ln in part.splitlines()]
    out: dict[tuple[str, int, str], dict[str, str]] = {}

    slot_date: str | None = None
    shift_num: int | None = None
    sec_header = re.compile(r"^\(\s*(Mathematics|Physics|Chemistry)\s*\)\s*$", re.I)

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line.startswith("Exam Date"):
            m = re.search(r":\s*(.+)", line)
            if m:
                slot_date = _date_to_slot_date(m.group(1))
            i += 1
            continue
        if line.startswith("Exam Shift"):
            m = re.search(r":\s*(.+)", line)
            if m:
                shift_num = _shift_to_num(m.group(1))
            i += 1
            continue

        msm = sec_header.match(line)
        if msm and slot_date and shift_num:
            section = msm.group(1).lower()
            key = (slot_date, shift_num, section)
            out.setdefault(key, {})
            i += 1
            while i < n:
                if sec_header.match(lines[i]) or lines[i].startswith("Exam Date"):
                    break
                if lines[i] in ("Domestic", "Question_ID", "Correct Answer", "International", ""):
                    i += 1
                    continue
                if lines[i].startswith("NATIONAL") or lines[i].startswith("JEE ("):
                    i += 1
                    continue
                if i + 2 < n and lines[i].isdigit() and len(lines[i]) >= 9:
                    dom, ans, _intl = lines[i], lines[i + 1], lines[i + 2]
                    store: str | None = None
                    if ans.lower() == "drop":
                        store = "Drop"
                    elif re.fullmatch(r"\d+(?:\.\d+)?", ans):
                        store = ans
                    elif (am := re.match(r"^(\d+)", ans)):
                        store = am.group(1)
                    if store is not None:
                        out[key][dom] = store
                    i += 3
                    continue
                i += 1
            continue
        i += 1

    return out


def parse_betech_domestic_keys(text: str) -> dict[tuple[str, int, str], dict[str, str]]:
    """
    Triplet rows: domestic_qid, answer, international_qid
    Returns (slot_date, shift_num, section) -> {qid: answer}

    Session-1 PDF often includes both India and Outside-India keys with the same date/shift
    header; keep only one block per slot (prefer Centers in India).
    """
    parts = [p.strip() for p in re.split(r"\n(?=Exam Date\s*:)", text) if p.strip()]
    best: dict[tuple[str, int], tuple[int, dict[tuple[str, int, str], dict[str, str]]]] = {}

    for part in parts:
        dm = re.search(r"Exam Date\s*:\s*(\d{2}\.\d{2}\.\d{4})", part)
        sm = re.search(r"Exam Shift\s*:\s*([^\n]+)", part)
        if not dm or not sm:
            continue
        dkey = (_date_to_slot_date(dm.group(1)), _shift_to_num(sm.group(1)))
        if dkey[0] is None or dkey[1] is None:
            continue
        nested = _parse_betech_domestic_chunk(part)
        if not nested:
            continue
        score = _chunk_india_score(part)
        prev = best.get(dkey)
        if prev is None or score < prev[0]:
            best[dkey] = (score, nested)

    out: dict[tuple[str, int, str], dict[str, str]] = {}
    for _sk, nested in best.values():
        for sec_key, mapping in nested.items():
            out.setdefault(sec_key, {}).update(mapping)
    return out


def flatten_betech_by_slot(text: str) -> dict[str, dict[str, str]]:
    """slot_id -> question_id -> correct answer (1-4 or numeric)."""
    nested = parse_betech_domestic_keys(text)
    flat: dict[str, dict[str, str]] = {}
    for (d, sh, _sec), mapping in nested.items():
        sid = f"{d}-shift-{sh}"
        flat.setdefault(sid, {}).update(mapping)
    return flat


def _parse_option_id_key_chunk(part: str) -> dict[str, str]:
    """One Exam Date block -> question_id -> correct_option_id."""
    lines = part.splitlines()
    result: dict[str, str] = {}
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].strip()
        if line.startswith("Exam Date") or line.startswith("Exam Shift"):
            i += 1
            continue
        if line.startswith("( "):
            i += 1
            continue
        m_drop = re.match(r"^(\d{6,})\s+Drop\s*$", line, re.I)
        if m_drop:
            result[m_drop.group(1)] = "Drop"
            i += 1
            continue
        m_merged = re.match(r"^(\d{6,})\s+(\d+)", line)
        if m_merged:
            result[m_merged.group(1)] = m_merged.group(2)
            i += 1
            continue
        if re.fullmatch(r"\d{6,}", line) and i + 1 < n:
            nxt = lines[i + 1].strip()
            if re.fullmatch(r"\d+", nxt):
                result[line] = nxt
                i += 2
                continue
            if nxt.lower() == "drop":
                result[line] = "Drop"
                i += 2
                continue
            lead_ans = re.match(r"^(\d+)", nxt)
            if lead_ans:
                result[line] = lead_ans.group(1)
                i += 2
                continue
        i += 1
    return result


def parse_option_id_key_file(text: str) -> dict[str, dict[str, str]]:
    """
    slot_id -> question_id -> correct_option_id

    Prefer Centers in India when both India and Outside-India extracts share the same date/shift.
    """
    parts = [p.strip() for p in re.split(r"\n(?=Exam Date\s*:)", text) if p.strip()]
    best: dict[str, tuple[int, dict[str, str]]] = {}

    for part in parts:
        dm = re.search(r"Exam Date\s*:\s*(\d{2}\.\d{2}\.\d{4})", part)
        sm = re.search(r"Exam Shift\s*:\s*([^\n]+)", part)
        if not dm or not sm:
            continue
        slot_date = _date_to_slot_date(dm.group(1))
        shift_num = _shift_to_num(sm.group(1))
        if slot_date is None or shift_num is None:
            continue
        sid = f"{slot_date}-shift-{shift_num}"
        mapping = _parse_option_id_key_chunk(part)
        if not mapping:
            continue
        score = _chunk_india_score(part)
        prev = best.get(sid)
        if prev is None or score < prev[0]:
            best[sid] = (score, mapping)

    return {sid: mp for sid, (_sc, mp) in best.items()}


def load_session1_keys(
    archive_root: Path,
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    base = archive_root / "official" / "session-1"
    dom: dict[str, dict[str, str]] = {}
    oid: dict[str, dict[str, str]] = {}
    bet = base / "jee-main-2026_session-1_final-answer-keys_paper1-betech.extracted.full.txt"
    opt = base / "jee-main-2026_session-1_final-answer-keys_paper1-betech_option-ids.extracted.full.txt"
    if bet.is_file():
        dom = flatten_betech_by_slot(bet.read_text(encoding="utf-8", errors="replace"))
    if opt.is_file():
        oid = parse_option_id_key_file(opt.read_text(encoding="utf-8", errors="replace"))
    return dom, oid


@functools.lru_cache(maxsize=8)
def _session1_option_key_text_cached(archive_root_resolved: str) -> str | None:
    opt = (
        Path(archive_root_resolved)
        / "official"
        / "session-1"
        / "jee-main-2026_session-1_final-answer-keys_paper1-betech_option-ids.extracted.full.txt"
    )
    if not opt.is_file():
        return None
    return opt.read_text(encoding="utf-8", errors="replace")


def session1_option_key_raw(archive_root: Path) -> str | None:
    return _session1_option_key_text_cached(str(archive_root.resolve()))


def first_option_key_block_for_slot(option_key_text: str, slot_id: str) -> str | None:
    """
    One Session-1 key chunk: a single Exam Date header plus matching Exam Shift.
    Must NOT use 'Date.*?Shift' across pages — that absorbs the previous shift's questions.
    If both India and Outside-India PDFs are concatenated, prefer India ("Centers in India").
    """
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})-shift-(\d+)$", slot_id)
    if not m:
        return None
    y, mo, d, sh = m.groups()
    want_date = f"{d}.{mo}.{y}"
    want_shift_num = int(sh)
    parts = re.split(r"\n(?=Exam Date\s*:)", option_key_text)
    candidates: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        dm = re.search(r"Exam Date\s*:\s*(\d{2}\.\d{2}\.\d{4})", part)
        sm = re.search(r"Exam Shift\s*:\s*([^\n]+)", part)
        if not dm or not sm:
            continue
        if dm.group(1) != want_date:
            continue
        sn = _shift_to_num(sm.group(1))
        if sn != want_shift_num:
            continue
        candidates.append(part)
    if not candidates:
        return None

    candidates.sort(key=_chunk_india_score)
    return candidates[0]


def ordered_question_ids_from_option_block(block: str) -> list[str]:
    lines = [ln.strip() for ln in block.splitlines()]
    out: list[str] = []
    sec_header = re.compile(r"^\(\s*(MATHEMATICS|PHYSICS|CHEMISTRY)\s*\)\s*$", re.I)
    current: str | None = None
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        ms = sec_header.match(line)
        if ms:
            current = ms.group(1).lower()
            i += 1
            continue
        if not current:
            i += 1
            continue
        if line.startswith("( "):
            i += 1
            continue
        if re.match(r"^(\d{6,})\s+Drop\s*$", line, re.I):
            out.append(line.split()[0])
            i += 1
            continue
        m_merged = re.match(r"^(\d{6,})\s+(\d+)", line)
        if m_merged:
            out.append(m_merged.group(1))
            i += 1
            continue
        if re.fullmatch(r"\d{6,}", line) and i + 1 < n:
            nxt = lines[i + 1]
            if re.fullmatch(r"\d+", nxt):
                out.append(line)
                i += 2
                continue
            if nxt.lower() == "drop":
                out.append(line)
                i += 2
                continue
            lead_ans = re.match(r"^(\d+)", nxt.strip())
            if lead_ans:
                out.append(line)
                i += 2
                continue
        i += 1
    return out


@functools.lru_cache(maxsize=128)
def _ordered_question_ids_tuple(archive_root_resolved: str, slot_id: str) -> tuple[str, ...] | None:
    raw = _session1_option_key_text_cached(archive_root_resolved)
    if not raw:
        return None
    block = first_option_key_block_for_slot(raw, slot_id)
    if not block:
        return None
    qids = ordered_question_ids_from_option_block(block)
    if len(qids) < 65:
        return None
    return tuple(qids)


def ordered_question_ids_for_session1_slot(archive_root: Path, slot_id: str) -> list[str] | None:
    t = _ordered_question_ids_tuple(str(archive_root.resolve()), slot_id)
    return list(t) if t else None
