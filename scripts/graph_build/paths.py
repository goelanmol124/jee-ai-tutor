"""Repository paths for graph_build pipeline."""
from __future__ import annotations

from pathlib import Path

_PKG = Path(__file__).resolve().parent
SCRIPTS = _PKG.parent
REPO = SCRIPTS.parent
SLOTS_V2_ROOT = REPO / "ground_truth_pipeline" / "slots_v2"
GRAPH_RUNS = REPO / "graph_runs"
STRUCTURED_SOLUTIONS_ROOT = GRAPH_RUNS / "structured_solutions"
SNAPSHOTS_ROOT = GRAPH_RUNS / "snapshots"
STRUCTURED_REVIEW_QUEUE = GRAPH_RUNS / "structured_solution_review_queue.jsonl"
GROK_ITERATE = SCRIPTS / "grok_iterate"
DEFAULT_PROMPT = GROK_ITERATE / "PROMPT_CONTEXT_FINAL.md"
DEFAULT_SCHEMA = GROK_ITERATE / "schema_context_v3.json"
