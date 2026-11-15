"""CLI driver for offline graph builder."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main(argv: list[str] | None = None) -> int:
    repo = Path(__file__).resolve().parents[2]
    if str(repo) not in sys.path:
        sys.path.insert(0, str(repo))

    from scripts.graph_build import paths as P
    from scripts.graph_build import (
        cleanup,
        derived,
        enrich,
        edges,
        export,
        ingest_raw,
        inspect_merge,
        load_slots,
        llm_merge,
        mention_cards,
        prereq_pass,
        review_queue,
        smoke,
        validate,
    )
    from scripts.graph_build import resolve as res

    parser = argparse.ArgumentParser(description="Graph construction pipeline")
    subs = parser.add_subparsers(dest="cmd", required=True)

    subs.add_parser("inventory", help="Write graph_runs/inventory.json")

    p_sol = subs.add_parser("solutions", help="Run structured solutions with cache")
    p_sol.add_argument("--run-id", default=None)
    p_sol.add_argument("--concurrency", type=int, default=4)
    p_sol.add_argument("--force", action="store_true")
    p_sol.add_argument("--max-questions", type=int, default=None)
    p_sol.add_argument("--skip-api", action="store_true", help="Dry placeholder bundles")
    p_sol.add_argument("--slot", action="append", dest="slots", default=None)
    p_sol.add_argument(
        "--final-slot-id",
        action="append",
        dest="final_slot_ids",
        default=None,
        help="Restrict generation to specific final_slot_id values, e.g. physics_007",
    )

    p_init = subs.add_parser("init-db", help="Create SQLite schema only")
    p_init.add_argument(
        "--sqlite",
        default=str(P.GRAPH_RUNS / "graph.sqlite"),
        help="Path to SQLite database file",
    )

    p_ingest = subs.add_parser("ingest", help="Ingest solutions into SQLite")
    p_ingest.add_argument("--sqlite", required=True)
    p_ingest.add_argument("--solutions-dir", required=True)
    p_ingest.add_argument("--allow-failed-validation", action="store_true")

    p_emb = subs.add_parser("embed", help="Cards + deterministic vectors")
    p_emb.add_argument("--sqlite", required=True)

    p_res = subs.add_parser("resolve", help="Offline entity resolution")
    p_res.add_argument("--sqlite", required=True)

    sub_sqlite = argparse.ArgumentParser(add_help=False)
    sub_sqlite.add_argument("--sqlite", required=True)

    subs.add_parser("enrich", parents=[sub_sqlite])
    subs.add_parser("cleanup", parents=[sub_sqlite])
    subs.add_parser("edges", parents=[sub_sqlite])
    subs.add_parser("prereqs-stub", parents=[sub_sqlite])
    subs.add_parser("derived", parents=[sub_sqlite])
    subs.add_parser("review-queue", parents=[sub_sqlite])
    subs.add_parser("validate", parents=[sub_sqlite])

    p_exp = subs.add_parser("export", parents=[sub_sqlite])
    p_exp.add_argument("--version", required=True)

    p_smoke = subs.add_parser("smoke")
    p_smoke.add_argument(
        "--snapshot", required=True, help="Path to exported snapshot directory"
    )

    p_pipe = subs.add_parser("pipeline", parents=[sub_sqlite])
    p_pipe.add_argument("--solutions-dir", required=True)
    p_pipe.add_argument("--version", required=True)
    p_pipe.add_argument(
        "--llm-merge",
        action="store_true",
        help="After resolve, run quality-first LLM concept merge adjudication",
    )
    p_pipe.add_argument(
        "--llm-merge-model",
        default="grok-4-1-fast-non-reasoning",
        help="Model for merge judge",
    )
    p_pipe.add_argument("--llm-merge-max-pairs", type=int, default=1200)
    p_pipe.add_argument("--llm-merge-min-confidence", type=float, default=0.90)
    p_pipe.add_argument("--llm-merge-dry-run", action="store_true")
    p_pipe.add_argument("--llm-merge-force", action="store_true")
    p_pipe.add_argument("--llm-merge-skip-api", action="store_true")
    p_pipe.add_argument(
        "--llm-merge-signals-trust-min",
        type=float,
        default=0.93,
        help="Skip independent-signal bar for auto-merge when model confidence >= this (None if --llm-merge-require-independent-signals)",
    )
    p_pipe.add_argument(
        "--llm-merge-require-independent-signals",
        action="store_true",
        help="Always require heuristic signal bar (disables high-confidence trust bypass)",
    )
    p_pipe.add_argument(
        "--llm-merge-no-cross-topic",
        action="store_true",
        help="Do not propose cross-topic (same-subject) merge pairs",
    )

    p_llm = subs.add_parser("llm-merge", parents=[sub_sqlite])
    p_llm.add_argument(
        "--model",
        default="grok-4-1-fast-non-reasoning",
        help="Grok model for merge adjudication",
    )
    p_llm.add_argument("--max-pairs", type=int, default=1200)
    p_llm.add_argument("--min-confidence", type=float, default=0.90)
    p_llm.add_argument("--dry-run", action="store_true")
    p_llm.add_argument(
        "--force",
        action="store_true",
        help="Ignore cached judge rows and call API again",
    )
    p_llm.add_argument(
        "--skip-api",
        action="store_true",
        help="No API calls (writes do_not_merge decisions for uncovered pairs)",
    )
    p_llm.add_argument(
        "--no-cross-topic-candidates",
        action="store_true",
    )
    p_llm.add_argument(
        "--signals-trust-min",
        type=float,
        default=0.93,
        help="Allow auto-merge without independent-signal bar when confidence >= this value",
    )
    p_llm.add_argument(
        "--require-independent-signals",
        action="store_true",
        help="Never skip the independent-signal bar (strongest safety; may block some true merges)",
    )

    p_insp = subs.add_parser("inspect-merge", help="Print merge decision samples + prereq edge sample")
    p_insp.add_argument("--sqlite", required=True)
    p_insp.add_argument("-n", "--sample", type=int, default=22)
    p_insp.add_argument("--merges-only", action="store_true")
    p_insp.add_argument("--context", action="store_true")
    p_insp.add_argument("--prereq-top", type=int, default=8)

    ns = parser.parse_args(argv)

    if ns.cmd == "inventory":
        pout = load_slots.write_inventory()
        print("wrote:", pout.relative_to(repo))
        return 0

    if ns.cmd == "solutions":
        from scripts.graph_build import solution_runner

        run_dir = solution_runner.generate_structured_solutions(
            run_id=ns.run_id,
            concurrency=ns.concurrency,
            force=ns.force,
            max_questions=ns.max_questions,
            skip_api=ns.skip_api,
            slot_filter=ns.slots,
            final_slot_id_filter=ns.final_slot_ids,
        )
        print("structured_solutions_run:", run_dir.relative_to(repo))
        return 0

    if ns.cmd == "init-db":
        from scripts.graph_build import db as D

        sqlite_path = Path(ns.sqlite).resolve()
        con = D.connect(sqlite_path)
        D.init_db(con)
        con.commit()
        con.close()
        D.ensure_merge_llm_schema(sqlite_path)
        print("initialized:", sqlite_path.relative_to(repo))
        return 0

    if ns.cmd == "smoke":
        rep = smoke.run_smoke_snapshot(Path(ns.snapshot).resolve())
        print(json.dumps(rep, indent=2))
        return 0 if not rep.get("missing") else 1

    sq = Path(ns.sqlite).resolve()

    if ns.cmd == "inspect-merge":
        inspect_merge.inspect_merge_sqlite(
            sq,
            sample_decisions=ns.sample,
            show_merges_only=ns.merges_only,
            show_context=ns.context,
            prereq_top=ns.prereq_top,
        )
        return 0

    if ns.cmd == "ingest":
        counts = ingest_raw.ingest_structured_solution_run(
            sq,
            Path(ns.solutions_dir).resolve(),
            require_validation_clean=not ns.allow_failed_validation,
        )
        print("ingest_counts:", json.dumps(counts, indent=2))
        return 0

    if ns.cmd == "embed":
        npy_path = mention_cards.build_embeddings(sq)
        print("vectors:", npy_path)
        return 0

    if ns.cmd == "resolve":
        stats = res.run_resolution(sq)
        print("resolution_stats:", stats)
        return 0

    if ns.cmd == "enrich":
        enrich.run_enrichment_phase(sq)
        print("enrichment_complete")
        return 0

    if ns.cmd == "cleanup":
        cleanup.run_cleanup_pass(sq)
        print("cleanup_complete")
        return 0

    if ns.cmd == "edges":
        edges.collect_cooccurrence_and_prereq(sq)
        print("edges_done")
        return 0

    if ns.cmd == "prereqs-stub":
        nitems = prereq_pass.run_llm_prereq_pass_stub(sq)
        print("stub_prereq_queue_items:", nitems)
        return 0

    if ns.cmd == "derived":
        derived.compute_derived(sq)
        print("derived_done")
        return 0

    if ns.cmd == "review-queue":
        review_queue.build_review_priorities(sq)
        outp = sq.parent / "human_review_preview.jsonl"
        review_queue.dump_review_queue(sq, outp)
        print("review_preview:", outp)
        return 0

    if ns.cmd == "validate":
        vr = validate.run_validation(sq)
        outp = sq.parent / (sq.stem + "_validation.json")
        outp.write_text(json.dumps(vr, indent=2, ensure_ascii=False), encoding="utf-8")
        print("validation_written:", outp)
        print(json.dumps(vr, indent=2))
        code = 0
        if vr.get("unresolved_mentions", 0) > 0:
            code = 1
        if vr.get("prereq_cycles"):
            code = 1
        if vr.get("core_mentions_without_steps"):
            code = 1
        return code

    if ns.cmd == "export":
        dest = export.export_snapshot(sq, ns.version)
        print("exported:", dest.relative_to(repo))
        return 0

    if ns.cmd == "llm-merge":
        trust = None if ns.require_independent_signals else ns.signals_trust_min
        st = llm_merge.run_llm_merge_pass(
            sq,
            model=ns.model,
            max_pairs=ns.max_pairs,
            min_confidence=ns.min_confidence,
            dry_run=ns.dry_run,
            force=ns.force,
            skip_api=ns.skip_api,
            cross_topic_candidates=not ns.no_cross_topic_candidates,
            signals_trust_min_confidence=trust,
        )
        print("llm_merge_stats:", json.dumps(st, indent=2))
        return 0

    if ns.cmd == "pipeline":
        sol = Path(ns.solutions_dir).resolve()
        ingest_raw.ingest_structured_solution_run(sq, sol, require_validation_clean=True)
        mention_cards.build_embeddings(sq)
        res.run_resolution(sq)
        if ns.llm_merge:
            trust = (
                None
                if ns.llm_merge_require_independent_signals
                else ns.llm_merge_signals_trust_min
            )
            lm = llm_merge.run_llm_merge_pass(
                sq,
                model=ns.llm_merge_model,
                max_pairs=ns.llm_merge_max_pairs,
                min_confidence=ns.llm_merge_min_confidence,
                dry_run=ns.llm_merge_dry_run,
                force=ns.llm_merge_force,
                skip_api=ns.llm_merge_skip_api,
                cross_topic_candidates=not ns.llm_merge_no_cross_topic,
                signals_trust_min_confidence=trust,
            )
            print("llm_merge_stats:", json.dumps(lm, indent=2))
        enrich.run_enrichment_phase(sq)
        cleanup.run_cleanup_pass(sq)
        edges.collect_cooccurrence_and_prereq(sq)
        prereq_pass.run_llm_prereq_pass_stub(sq)
        derived.compute_derived(sq)
        review_queue.build_review_priorities(sq)
        snap = export.export_snapshot(sq, ns.version)
        review_queue.dump_review_queue(sq, snap / "review_queue.jsonl")
        print("pipeline_exported:", (P.SNAPSHOTS_ROOT / ns.version).relative_to(repo))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
