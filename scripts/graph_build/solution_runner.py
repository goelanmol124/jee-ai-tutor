"""Batch structured-solution generation with content-addressed cache."""
from __future__ import annotations

import json
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from . import hashing, paths, validators

# pylint: disable=wrong-import-position
def _grok_sys_path() -> None:
    p = str(paths.GROK_ITERATE)
    if p not in sys.path:
        sys.path.insert(0, p)


_grok_sys_path()
import pipeline as P  # noqa: E402
import run as R  # noqa: E402
import slots_v2 as S2  # noqa: E402


MODEL_POLICY_LABEL = (
    f"cheap:{P.CHEAP_MODEL}|reason:{P.REASONING_MODEL}|pipeline_v2"
)


def fingerprint_inputs(prompt_path: Path, schema_path: Path) -> tuple[str, str]:
    ph = hashing.file_sha256(prompt_path)
    sh = hashing.file_sha256(schema_path)
    return ph, sh


def cached_solution_path(run_dir: Path, slot_id: str, question_id: str) -> Path:
    return run_dir / slot_id / f"{question_id}.json"


def load_cache_meta(path: Path) -> dict[str, Any] | None:
    meta = path.with_suffix(path.suffix + ".meta.json")
    if not meta.is_file():
        return None
    try:
        return json.loads(meta.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def should_skip_cache(
    out_path: Path,
    slot_record_key: str,
    prompt_hash: str,
    schema_hash: str,
    force: bool,
) -> bool:
    if force or not out_path.is_file():
        return False
    meta = load_cache_meta(out_path)
    if not meta:
        return False
    ck = hashing.solution_cache_key(
        slot_record_key,
        prompt_hash,
        schema_hash,
        MODEL_POLICY_LABEL,
    )
    return meta.get("solution_cache_key") == ck


def append_review_queue(payload: dict[str, Any]) -> None:
    paths.STRUCTURED_REVIEW_QUEUE.parent.mkdir(parents=True, exist_ok=True)
    with paths.STRUCTURED_REVIEW_QUEUE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def write_solution_bundle(
    out_path: Path,
    slot_record_key: str,
    prompt_hash: str,
    schema_hash: str,
    log: dict[str, Any],
    parsed: dict[str, Any] | None,
    validation_errors: list[str],
    *,
    ingest_path: Path | None = None,
) -> None:
    ck = hashing.solution_cache_key(
        slot_record_key,
        prompt_hash,
        schema_hash,
        MODEL_POLICY_LABEL,
    )
    bundle = {
        "solution_cache_key": ck,
        "slot_record_cache_key": slot_record_key,
        "prompt_sha256": prompt_hash,
        "schema_sha256": schema_hash,
        "model_policy": MODEL_POLICY_LABEL,
        "prompt_version": str(paths.DEFAULT_PROMPT.name),
        "schema_version": str(paths.DEFAULT_SCHEMA.name),
        "validation_errors": validation_errors,
        "pipeline_log": log,
        "parsed_solution": parsed,
        "ingest_source_path": str(ingest_path) if ingest_path else None,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(bundle, indent=2, ensure_ascii=False), encoding="utf-8")
    meta_path = out_path.with_suffix(out_path.suffix + ".meta.json")
    meta_path.write_text(
        json.dumps(
            {"solution_cache_key": ck, "slot_record_cache_key": slot_record_key},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def generate_structured_solutions(
    *,
    prompt_path: Path | None = None,
    schema_path: Path | None = None,
    run_id: str | None = None,
    concurrency: int = 4,
    force: bool = False,
    max_questions: int | None = None,
    skip_api: bool = False,
    slot_filter: list[str] | None = None,
    final_slot_id_filter: list[str] | None = None,
) -> Path:
    """Run pipeline across all slots; write bundles under structured_solutions."""
    pp = prompt_path or paths.DEFAULT_PROMPT
    sp = schema_path or paths.DEFAULT_SCHEMA
    template = pp.read_text(encoding="utf-8")
    schema = json.loads(sp.read_text(encoding="utf-8"))
    prompt_hash, schema_hash = fingerprint_inputs(pp, sp)
    rid = run_id or f"run_{uuid.uuid4().hex[:10]}"
    run_dir = paths.STRUCTURED_SOLUTIONS_ROOT / rid
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "run_id": rid,
        "started_at": time.time(),
        "prompt_path": str(pp.relative_to(paths.REPO)),
        "schema_path": str(sp.relative_to(paths.REPO)),
        "model_policy": MODEL_POLICY_LABEL,
    }
    (run_dir / "run_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    work: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    for sid, item in S2.iter_all_slot_records():
        if slot_filter and sid not in slot_filter:
            continue
        if final_slot_id_filter and item.get("final_slot_id") not in final_slot_id_filter:
            continue
        q = S2.as_question(item, slot_id=sid)
        srk = hashing.slot_record_cache_key(item)
        work.append((sid, item, q))

    if max_questions is not None:
        work = work[: max_questions]

    if skip_api:
        for sid, item, q in work:
            out_path = cached_solution_path(run_dir, sid, q["id"])
            if should_skip_cache(
                out_path, hashing.slot_record_cache_key(item),
                prompt_hash, schema_hash, force,
            ):
                continue
            write_solution_bundle(
                out_path,
                hashing.slot_record_cache_key(item),
                prompt_hash,
                schema_hash,
                {
                    "skipped_api": True,
                    "id": q["id"],
                    "slot_id": sid,
                    "final_slot_id": item["final_slot_id"],
                },
                None,
                ["skip_api_no_generation"],
            )
        return run_dir

    api_key = R.load_api_key()

    def one(job: tuple[str, dict[str, Any], dict[str, Any]]) -> None:
        sid, item, q = job
        out_path = cached_solution_path(run_dir, sid, q["id"])
        srk = hashing.slot_record_cache_key(item)
        if should_skip_cache(out_path, srk, prompt_hash, schema_hash, force):
            return
        stage_dir = run_dir / "_stage_logs" / q["id"]
        stage_dir.mkdir(parents=True, exist_ok=True)
        log = P.run_one(q, template, schema, api_key, out_dir=stage_dir)
        log["slot_id"] = sid
        log["final_slot_id"] = item["final_slot_id"]
        final_path = stage_dir / f'{q["id"]}__FINAL.txt'
        final_text = final_path.read_text(encoding="utf-8")
        ok, score, errs, pdata = validators.validate_solution_payload(
            final_text,
            q.get("ground_truth"),
            q.get("ground_truth_option_position"),
        )
        log["validation_ok"] = ok
        log["validation_errors_codes"] = errs
        log["validators_score_topics"] = {
            k: score.get(k)
            for k in ("parses", "topic_equals_subject", "subtopic_present")
            if k in score
        }
        val_errs_summary = errs
        if ok:
            write_solution_bundle(
                out_path,
                srk,
                prompt_hash,
                schema_hash,
                log,
                pdata,
                [],
                ingest_path=out_path,
            )
        else:
            append_review_queue(
                {
                    "slot_id": sid,
                    "question_id": q["id"],
                    "final_slot_id": item["final_slot_id"],
                    "errors": val_errs_summary,
                    "run_id": rid,
                }
            )
            write_solution_bundle(
                out_path,
                srk,
                prompt_hash,
                schema_hash,
                log,
                pdata,
                val_errs_summary,
                ingest_path=out_path,
            )

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
        futs = {pool.submit(one, job): job for job in work}
        for fut in as_completed(futs):
            fut.result()

    elapsed = round(time.time() - t0, 2)
    manifest["finished_at"] = time.time()
    manifest["wall_seconds"] = elapsed
    manifest["questions_scheduled"] = len(work)
    (run_dir / "run_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return run_dir
