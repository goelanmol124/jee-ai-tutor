# Graph build (offline)

Run from repo root with `PYTHONPATH` including the repo root (Cursor does this by default).

```bash
python -m scripts.graph_build inventory
python -m scripts.graph_build init-db --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build solutions --run-id myrun --concurrency 4
python -m scripts.graph_build ingest --sqlite graph_runs/graph.sqlite --solutions-dir graph_runs/structured_solutions/myrun
python -m scripts.graph_build embed --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build resolve --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build llm-merge --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build enrich --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build cleanup --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build edges --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build prereqs-stub --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build derived --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build review-queue --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build validate --sqlite graph_runs/graph.sqlite
python -m scripts.graph_build export --sqlite graph_runs/graph.sqlite --version v0.1.0
python -m scripts.graph_build smoke --snapshot graph_runs/snapshots/v0.1.0
```

Or chained: `pipeline --sqlite ... --solutions-dir ... --version v0.1.0`.

### LLM concept merge (quality-first)

Runs **after `resolve`** and **before `enrich`**. Uses cached JSON decisions per concept pair (`concept_merge_llm_decisions`). Requires `GROK_API_KEY` in repo `.env` unless you pass `--skip-api` (coverage / CI only).

```bash
python -m scripts.graph_build llm-merge --sqlite graph_runs/graph.sqlite \
  --model grok-4-1-fast-non-reasoning --max-pairs 1500

# Conservative dry-run (enqueue only)
python -m scripts.graph_build llm-merge --sqlite graph_runs/graph.sqlite --dry-run

# Pipe after resolve
python -m scripts.graph_build pipeline --sqlite graph_runs/graph.sqlite \
  --solutions-dir graph_runs/structured_solutions/myrun --version v1 --llm-merge
```

Judge prompt version / schema are in [`llm_merge.py`](llm_merge.py) (`MERGE_PROMPT_VERSION`, `MERGE_RESPONSE_JSON_SCHEMA`). Exported snapshots optionally include `concept_merge_llm_decisions.jsonl` when that table exists.

After tuning on a slice, run **`llm-merge` on the full corpus** (`--max-pairs` 5000–20000) once you are satisfied with false-positive rate.

Optional: `pip install -r scripts/graph_build/requirements-graph-build.txt` for `numpy` / `sentence-transformers` (otherwise vectors are JSON + deterministic hashes).
