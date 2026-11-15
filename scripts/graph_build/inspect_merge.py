"""Human-friendly dump of merge adjudication rows and prerequisite edge sample."""
from __future__ import annotations

import argparse
import io
import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path


def _utf8_stdio() -> None:
    buf = getattr(sys.stdout, "buffer", None)
    if buf is not None and hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(buf, encoding="utf-8", line_buffering=True)


def pname(con: sqlite3.Connection, cid: str) -> str:
    r = con.execute(
        "SELECT canonical_name FROM canonical_concepts WHERE concept_id=?",
        (cid,),
    ).fetchone()
    return r["canonical_name"] if r else f"<gone:{cid}>"


def inspect_merge_sqlite(
    sqlite_path: Path,
    *,
    sample_decisions: int = 22,
    show_merges_only: bool = False,
    show_context: bool = False,
    prereq_top: int = 8,
) -> None:
    _utf8_stdio()
    sqlite_path = sqlite_path.resolve()
    con = sqlite3.connect(str(sqlite_path))
    con.row_factory = sqlite3.Row

    print("===", sqlite_path)
    tbl = con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='concept_merge_llm_decisions'"
    ).fetchone()
    if not tbl:
        print("(no concept_merge_llm_decisions table)")
    else:
        n = int(con.execute("SELECT COUNT(*) FROM concept_merge_llm_decisions").fetchone()[0])
        print("concept_merge_llm_decisions:", n)

        pv = Counter(
            str(r[0] or "")
            for r in con.execute(
                "SELECT prompt_version FROM concept_merge_llm_decisions"
            ).fetchall()
        )
        print("  by_prompt_version:", dict(pv))

        by_dec = Counter(
            r[0]
            for r in con.execute("SELECT decision FROM concept_merge_llm_decisions").fetchall()
        )
        print("  by_decision:", dict(by_dec))

        applied = con.execute(
            "SELECT SUM(COALESCE(applied, 0)) FROM concept_merge_llm_decisions"
        ).fetchone()[0]
        print("  applied_total:", applied or 0)

        filt = ""
        if show_merges_only:
            filt = "WHERE lower(trim(decision)) = 'merge'"

        rows = list(
            con.execute(
                f"""SELECT pair_key, decision, confidence, concept_a_id, concept_b_id,
                           survivor_concept_id, applied, prompt_version,
                           substr(reason,1,200) AS rr
                    FROM concept_merge_llm_decisions {filt}
                    ORDER BY rowid DESC LIMIT ?""",
                (sample_decisions,),
            )
        )

        print(f"\n--- sample_decisions (last {sample_decisions}{', merge only' if show_merges_only else ''}) ---")
        for r in rows:
            a, b = r["concept_a_id"], r["concept_b_id"]
            pv_ = r["prompt_version"]
            print(
                f"  [{r['decision']}] v={pv_} conf={r['confidence']:.3f} "
                f"applied={r['applied']}"
            )
            print(f"      A {pname(con, a)!r}")
            print(f"      B {pname(con, b)!r}")
            if r["survivor_concept_id"]:
                print(f"      survivor -> {pname(con, r['survivor_concept_id'])!r}")
            print(f"      reason: {r['rr']}")
            if show_context:
                cj = con.execute(
                    "SELECT context_json FROM concept_merge_llm_decisions WHERE pair_key=?",
                    (r["pair_key"],),
                ).fetchone()
                if cj and cj[0]:
                    try:
                        ctx = json.loads(cj[0])
                        snippets = []
                        for key in ("concept_a", "concept_b"):
                            sub = ctx.get(key) or {}
                            ms = sub.get("mention_samples") or []
                            snippets.append(ms)
                        print(f"      mention_samples: {json.dumps(snippets, ensure_ascii=False)[:400]}...")
                    except json.JSONDecodeError:
                        print("      (context not JSON)")

    rq = Counter(
        r[0]
        for r in con.execute(
            "SELECT item_type FROM review_queue WHERE item_type LIKE 'llm_merge%'"
        ).fetchall()
    )
    print("\nreview_queue llm_* types:", dict(rq) if rq else "(none or empty)")

    pc = int(
        con.execute(
            "SELECT COUNT(*) FROM concept_edges WHERE edge_type='prerequisite_of'"
        ).fetchone()[0]
        or 0
    )
    print(f"\n--- prerequisite_of edges (sample top {prereq_top} by support) ---")
    print("  prerequisite_of:", pc)
    for row in con.execute(
        """SELECT source_concept_id, target_concept_id, confidence, support_count
           FROM concept_edges WHERE edge_type='prerequisite_of'
           ORDER BY support_count DESC LIMIT ?""",
        (prereq_top,),
    ):
        print(
            f"  [{row['support_count']}x] {pname(con, row['source_concept_id'])[:54]} "
            f"=> {pname(con, row['target_concept_id'])[:54]} ({row['confidence']:.2f})",
        )

    con.close()
    print("\n(done)")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Inspect LLM merge decisions in a graph SQLite DB")
    p.add_argument("sqlite", type=Path)
    p.add_argument("-n", "--sample", type=int, default=22)
    p.add_argument(
        "--merges-only",
        action="store_true",
        help="Only list rows whose decision is merge",
    )
    p.add_argument(
        "--context",
        action="store_true",
        help="Truncated mention_samples from stored context_json",
    )
    p.add_argument("--prereq-top", type=int, default=8)
    args = p.parse_args(argv)
    inspect_merge_sqlite(
        args.sqlite,
        sample_decisions=args.sample,
        show_merges_only=args.merges_only,
        show_context=args.context,
        prereq_top=args.prereq_top,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
