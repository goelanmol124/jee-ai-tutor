"""Map inferred LLM topics to JEE-style syllabus chapters.

The catalog in ``data/jee_chapter_catalog.json`` has:

- **Fine** rows (~56): term lists for scoring (``map_syllabus_chapters``).
- **Coarse** buckets (see ``coarse_index`` in the catalog): ``coarse`` on each
  fine row; ``map_syllabus_coarse`` collapses the fine winner(s).

Refs: IIT JEE Advanced / NTA JEE Main syllabi (``jeeadv.ac.in``, ``jeemain.nta.ac.in``).

Heuristic: multiple fine chapters can partially match one topic; we return the
best-scoring as ``primary`` and up to ``top_k`` ordered distinct names.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_PKG = Path(__file__).resolve().parent
DEFAULT_CATALOG = _PKG / "data" / "jee_chapter_catalog.json"


def _norm_subject(subject: str | None) -> str | None:
    if not subject:
        return None
    s = subject.strip().lower()
    aliases = {"math": "mathematics", "maths": "mathematics"}
    return aliases.get(s, s)


@lru_cache(maxsize=2)
def _load_catalog_json(path_str: str) -> dict:
    path = Path(path_str)
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=2)
def _fine_to_coarse(path_str: str) -> dict[str, dict[str, str]]:
    data = _load_catalog_json(path_str)
    out: dict[str, dict[str, str]] = {}
    for subj, rows in data.get("subjects", {}).items():
        out[subj] = {
            str(r["name"]): str(r["coarse"])
            for r in rows
            if isinstance(r, dict) and r.get("name") and r.get("coarse")
        }
    return out


def _haystack(parts: tuple[str | None, ...]) -> str:
    return " ".join((p or "") for p in parts).lower()


def _score_row(haystack: str, chapter: dict) -> int:
    return sum(1 for t in chapter.get("terms", []) if t and t.lower() in haystack)


def map_syllabus_chapters(
    subject: str | None,
    topic: str | None,
    subtopic: str | None,
    *,
    top_k: int = 3,
    catalog_path: Path | None = None,
) -> tuple[str | None, list[str]]:
    """
    Returns ``(primary_chapter, chapters_top_n)``.
    Primary is ``None`` only if ``subject`` is unknown; chapters list capped at ``top_k``.
    """
    subj = _norm_subject(subject)
    if not subj:
        return None, []

    path = catalog_path if catalog_path is not None else DEFAULT_CATALOG
    data = _load_catalog_json(str(path.resolve()))
    rows = data.get("subjects", {}).get(subj)
    if not rows:
        return "Other — " + subject.strip().title(), ["Other — " + subject.strip().title()]

    hs = _haystack((subject, topic, subtopic))
    scored = [(str(chapter["name"]), _score_row(hs, chapter)) for chapter in rows]
    ranked = sorted(scored, key=lambda x: (-x[1], x[0]))
    positive = [(n, sc) for n, sc in ranked if sc > 0]

    if not positive:
        fallback = f"General — {subj.title()}"
        return fallback, [fallback]

    primary = positive[0][0]
    order_names: list[str] = []
    for name, _sc in positive:
        if name not in order_names:
            order_names.append(name)
        if len(order_names) >= max(1, top_k):
            break
    return primary, order_names[: max(1, top_k)]


def map_syllabus_coarse(
    subject: str | None,
    topic: str | None,
    subtopic: str | None,
    *,
    top_k: int = 3,
    catalog_path: Path | None = None,
) -> tuple[str | None, list[str]]:
    """Map topic text to **coarse** syllabus buckets (PCM; count in ``coarse_index``).

    Uses the same term scoring as ``map_syllabus_chapters``, then collapses
    fine chapter names via the ``coarse`` field in the catalog.
    """
    primary_fine, fines = map_syllabus_chapters(
        subject, topic, subtopic, top_k=top_k, catalog_path=catalog_path
    )
    subj = _norm_subject(subject)
    if not subj:
        return None, []

    path = catalog_path if catalog_path is not None else DEFAULT_CATALOG
    cmap = _fine_to_coarse(str(path.resolve())).get(subj, {})

    def to_coarse(fine: str) -> str:
        return cmap.get(fine, fine)

    primary_coarse = to_coarse(primary_fine) if primary_fine else None
    coarse_order: list[str] = []
    for f in fines:
        c = to_coarse(f)
        if c not in coarse_order:
            coarse_order.append(c)
        if len(coarse_order) >= max(1, top_k):
            break
    return primary_coarse, coarse_order[: max(1, top_k)]


def catalog_summary(catalog_path: Path | None = None) -> dict:
    """Metadata for exporters / manifest."""
    path = catalog_path if catalog_path is not None else DEFAULT_CATALOG
    data = _load_catalog_json(str(path.resolve()))
    coarse_index = data.get("coarse_index") or {}
    n_coarse = sum(len(v) for v in coarse_index.values() if isinstance(v, list))
    return {
        "catalog_relative": "scripts/graph_build/data/jee_chapter_catalog.json",
        "catalog_version": data.get("catalog_version"),
        "source_note": data.get("source_note"),
        "catalog_file": str(path),
        "coarse_index": coarse_index,
        "coarse_unit_count": n_coarse,
    }


def first_subtopic_from_json(blob: str | None) -> str | None:
    if not blob:
        return None
    try:
        arr = json.loads(blob)
        if isinstance(arr, list) and arr:
            return str(arr[0])
    except json.JSONDecodeError:
        pass
    return None
