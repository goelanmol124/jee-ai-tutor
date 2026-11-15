"""SQLite storage for raw graph evidence, canonical concepts, and derived rows."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS raw_questions (
  question_id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL,
  final_slot_id TEXT NOT NULL,
  exam_date TEXT,
  shift TEXT,
  subject TEXT,
  topic TEXT,
  subtopic TEXT,
  canonical_question_latex TEXT,
  canonical_options_json TEXT,
  processed_final_answer_json TEXT,
  verification_status TEXT,
  needs_human_review INTEGER,
  record_confidence TEXT,
  source_quality_json TEXT,
  difficulty TEXT,
  estimated_time_seconds INTEGER,
  answer_type TEXT,
  diagram_context_json TEXT,
  prompt_version TEXT,
  schema_version TEXT,
  model_policy TEXT,
  ingestion_source_path TEXT,
  solution_cache_key TEXT
);

CREATE TABLE IF NOT EXISTS raw_methods (
  method_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  method_name TEXT,
  method_index INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES raw_questions(question_id)
);

CREATE TABLE IF NOT EXISTS raw_concept_mentions (
  mention_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  name TEXT NOT NULL,
  statement TEXT,
  when_to_use TEXT,
  graph_role_in_question TEXT,
  subject TEXT,
  topic TEXT,
  subtopic TEXT,
  chapter_prereqs_json TEXT,
  local_prereq_concepts_json TEXT,
  step_ids_json TEXT,
  step_expressions_json TEXT,
  step_thoughts_json TEXT,
  nearby_step_concepts_json TEXT,
  source_quality_status TEXT,
  question_confidence TEXT,
  embedding_text TEXT,
  embedding_vector_id INTEGER,
  canonical_concept_id TEXT,
  resolution_status TEXT NOT NULL DEFAULT 'unresolved',
  FOREIGN KEY (question_id) REFERENCES raw_questions(question_id)
);

CREATE TABLE IF NOT EXISTS raw_steps (
  step_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  method_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  expression TEXT,
  thought TEXT,
  uses_results_from_json TEXT,
  raw_step_concept_name TEXT,
  is_structural INTEGER NOT NULL DEFAULT 0,
  concept_mention_id TEXT,
  FOREIGN KEY (question_id) REFERENCES raw_questions(question_id),
  FOREIGN KEY (method_id) REFERENCES raw_methods(method_id)
);

CREATE TABLE IF NOT EXISTS canonical_concepts (
  concept_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  subject TEXT,
  primary_topic TEXT,
  topics_json TEXT,
  subtopics_json TEXT,
  definition TEXT,
  when_to_use TEXT,
  statement TEXT,
  scope_in TEXT,
  scope_out TEXT,
  cognitive_operation TEXT,
  concept_kind TEXT NOT NULL DEFAULT 'compound_application',
  lifecycle_state TEXT NOT NULL DEFAULT 'created',
  created_from_mention_id TEXT,
  confidence TEXT,
  created_at REAL,
  last_reviewed_at REAL
);

CREATE TABLE IF NOT EXISTS concept_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  evidence_mention_ids_json TEXT,
  confidence TEXT,
  FOREIGN KEY (concept_id) REFERENCES canonical_concepts(concept_id)
);

CREATE TABLE IF NOT EXISTS concept_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id TEXT NOT NULL,
  step_id TEXT,
  question_id TEXT,
  kind TEXT DEFAULT 'positive',
  selected_for_teaching INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (concept_id) REFERENCES canonical_concepts(concept_id)
);

CREATE TABLE IF NOT EXISTS concept_pitfalls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id TEXT NOT NULL,
  pitfall_text TEXT NOT NULL,
  evidence_question_ids_json TEXT,
  FOREIGN KEY (concept_id) REFERENCES canonical_concepts(concept_id)
);

CREATE TABLE IF NOT EXISTS question_concepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  role TEXT NOT NULL,
  step_ids_json TEXT,
  is_diagnostic_anchor INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, concept_id, role)
);

CREATE TABLE IF NOT EXISTS concept_resolution_decisions (
  decision_id TEXT PRIMARY KEY,
  mention_id TEXT NOT NULL,
  candidate_concept_ids_json TEXT,
  decision TEXT NOT NULL,
  chosen_concept_id TEXT,
  reason TEXT,
  model TEXT,
  confidence REAL,
  created_at REAL
);

CREATE TABLE IF NOT EXISTS concept_merge_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_concept_id TEXT NOT NULL,
  to_concept_id TEXT NOT NULL,
  reason TEXT,
  confidence REAL,
  decision_id TEXT,
  affected_mention_count INTEGER
);

CREATE TABLE IF NOT EXISTS concept_redirects (
  old_concept_id TEXT PRIMARY KEY,
  new_concept_id TEXT NOT NULL,
  merged_at REAL,
  decision_id TEXT
);

CREATE TABLE IF NOT EXISTS graph_edge_evidence (
  evidence_id TEXT PRIMARY KEY,
  edge_type TEXT NOT NULL,
  source_concept_id TEXT,
  target_concept_id TEXT,
  question_id TEXT,
  method_id TEXT,
  step_id TEXT,
  evidence_source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.7,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS concept_edges (
  source_concept_id TEXT NOT NULL,
  target_concept_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  support_count INTEGER NOT NULL DEFAULT 1,
  evidence_ids_json TEXT,
  PRIMARY KEY (source_concept_id, target_concept_id, edge_type)
);

CREATE TABLE IF NOT EXISTS embedding_index (
  row_index INTEGER PRIMARY KEY AUTOINCREMENT,
  mention_id TEXT NOT NULL UNIQUE,
  dim INTEGER NOT NULL,
  projection TEXT NOT NULL,
  FOREIGN KEY (mention_id) REFERENCES raw_concept_mentions(mention_id)
);

CREATE TABLE IF NOT EXISTS concept_derived (
  concept_id TEXT PRIMARY KEY,
  difficulty_band TEXT,
  depth INTEGER,
  downstream_count INTEGER,
  mention_count INTEGER,
  prereq_closure_json TEXT,
  FOREIGN KEY (concept_id) REFERENCES canonical_concepts(concept_id)
);

CREATE TABLE IF NOT EXISTS question_derived (
  question_id TEXT PRIMARY KEY,
  load_score REAL,
  FOREIGN KEY (question_id) REFERENCES raw_questions(question_id)
);

CREATE TABLE IF NOT EXISTS chapter_cluster_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  concept_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,
  priority REAL NOT NULL,
  payload_json TEXT NOT NULL,
  created_at REAL
);

CREATE TABLE IF NOT EXISTS concept_merge_llm_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_key TEXT NOT NULL UNIQUE,
  concept_a_id TEXT NOT NULL,
  concept_b_id TEXT NOT NULL,
  context_json TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  decision TEXT NOT NULL,
  confidence REAL NOT NULL,
  survivor_concept_id TEXT,
  proposed_canonical_name TEXT,
  reason TEXT,
  risk_flags_json TEXT,
  similarity_signals_json TEXT,
  usage_json TEXT,
  raw_response_json TEXT,
  created_at REAL NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_merge_llm_pair ON concept_merge_llm_decisions(concept_a_id, concept_b_id);

CREATE INDEX IF NOT EXISTS idx_mentions_resolution ON raw_concept_mentions(resolution_status);
CREATE INDEX IF NOT EXISTS idx_mentions_subject ON raw_concept_mentions(subject);
CREATE INDEX IF NOT EXISTS idx_canonical_subject ON canonical_concepts(subject);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    return con


MERGE_SCHEMA_FRAGMENT = """
CREATE TABLE IF NOT EXISTS concept_merge_llm_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair_key TEXT NOT NULL UNIQUE,
  concept_a_id TEXT NOT NULL,
  concept_b_id TEXT NOT NULL,
  context_json TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  decision TEXT NOT NULL,
  confidence REAL NOT NULL,
  survivor_concept_id TEXT,
  proposed_canonical_name TEXT,
  reason TEXT,
  risk_flags_json TEXT,
  similarity_signals_json TEXT,
  usage_json TEXT,
  raw_response_json TEXT,
  created_at REAL NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_merge_llm_pair ON concept_merge_llm_decisions(concept_a_id, concept_b_id);
"""


def ensure_merge_llm_schema(db_path: Path) -> None:
    """Ensure concept_merge_llm_decisions exists (older DB files pre-dating merge pass)."""
    con = connect(db_path)
    for stmt in MERGE_SCHEMA_FRAGMENT.split(";"):
        s = stmt.strip()
        if s:
            con.execute(s)
    con.commit()
    con.close()


def init_db(con: sqlite3.Connection) -> None:
    # Split raw_steps FK to mentions — SQLite may not reorder; create mentions first
    parts = SCHEMA.split(";")
    for stmt in parts:
        s = stmt.strip()
        if not s or s.startswith("PRAGMA"):
            if s:
                con.execute(s)
            continue
        con.execute(s)
    con.commit()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


def jdump(x: Any) -> str:
    return json.dumps(x, ensure_ascii=False)
