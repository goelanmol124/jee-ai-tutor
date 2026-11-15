"""Subject-first hybrid candidate retrieval for mentions."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .mention_cards import _embedding_from_text, cosine, mention_card_from_row


def _norm(s: str | None) -> str:
    return (s or "").strip().lower()


_STOPWORDS = {
    "of", "for", "in", "on", "the", "a", "an", "to", "from", "and", "or",
    "with", "by", "at", "as", "is", "are", "be", "into", "via", "vs", "use",
    "using", "between", "across", "two", "one",
}


def _name_tokens(s: str | None) -> set[str]:
    if not s:
        return set()
    import re as _re

    raw = _re.sub(r"[^a-zA-Z0-9 ]+", " ", s.lower())
    toks = [t for t in raw.split() if t and t not in _STOPWORDS and len(t) > 1]
    out: set[str] = set()
    for t in toks:
        if t.endswith("s") and len(t) > 3:
            out.add(t[:-1])
        else:
            out.add(t)
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


# Two-tier discriminator groups.
#
# STRICT groups (heavy nouns / object identifiers): if the symmetric difference
# between two names contains ANY member of a strict group, the concepts refer
# to different objects/quantities and must not be merged. Even if only ONE
# side carries the discriminator, the other side's silence on that object is
# enough to mark them distinct (e.g. "Capacitor energy formula" vs
# "Total binding energy formula" — only one mentions a circuit element, and
# that's enough to know they're different things).
_DISCRIMINATOR_GROUPS_STRICT: list[set[str]] = [
    # circuit elements vs other nouns
    {"capacitor", "inductor", "resistor", "transistor", "diode", "battery",
        "transformer", "rectifier", "amplifier", "galvanometer", "voltmeter",
        "ammeter", "potentiometer"},
    # electrical / electromagnetic quantities
    {"resistance", "inductance", "capacitance", "conductance", "impedance",
        "reactance", "permittivity", "permeability", "resistivity",
        "conductivity"},
    # field & force types
    {"electric", "magnetic", "gravitational", "electromagnetic",
        "frictional", "viscous", "centripetal", "centrifugal", "nuclear"},
    # energy/state-function modifiers
    {"binding", "kinetic", "potential", "thermal", "rotational",
        "vibrational", "translational", "ionization", "dissociation",
        "activation"},
    # state functions / thermo nouns
    {"enthalpy", "entropy", "gibbs", "helmholtz"},
    # particles
    {"electron", "proton", "neutron", "photon", "phonon", "neutrino",
        "muon", "pion"},
    # mechanical quantities
    {"torque", "momentum", "impulse"},
    # kinematic quantities
    {"velocity", "acceleration", "displacement", "trajectory"},
    # wave quantities (when used as the *primary* quantity, not modifier)
    {"wavelength", "frequency", "wavenumber", "wavevector"},
    # named constants
    {"planck", "boltzmann", "avogadro", "faraday", "rydberg", "stefan"},
    # spectral series
    {"lyman", "balmer", "paschen", "brackett", "pfund"},
    # rigid bodies
    {"sphere", "shell", "disc", "disk", "ring", "cylinder", "rod", "hoop"},
    # alkyl/aryl
    {"methyl", "ethyl", "propyl", "butyl", "pentyl", "hexyl", "phenyl",
        "benzyl", "allyl", "vinyl", "isopropyl"},
    # functional groups
    {"alcohol", "aldehyde", "ketone", "ester", "amide", "amine",
        "carboxylic", "ether", "nitrile"},
    # conic sections
    {"ellipse", "hyperbola", "parabola"},
    # complex-number primary properties
    {"modulus", "argument", "conjugate", "moduli"},
]


# MODIFIER groups (soft, common words like "and", "min", "max", "sum"):
# block ONLY when both sides commit to *different* members of the group. If
# only one side carries a member, treat as ambiguous (let scorer decide). This
# avoids false-positive blocks like "EM wave E *and* B field" being treated
# as a logic gate due to the conjunction "and".
_DISCRIMINATOR_GROUPS_MODIFIER: list[set[str]] = [
    # logic gates
    {"and", "or", "not", "nor", "nand", "xor", "xnor"},
    # binary operations
    {"sum", "product", "difference", "quotient", "ratio"},
    # extrema / comparators
    {"min", "minimum", "max", "maximum", "smallest", "largest",
        "greatest", "least", "greater", "less", "lesser", "more", "fewer"},
    # trig families
    {"sin", "sine", "cos", "cosine", "tan", "tangent", "sec", "secant",
        "csc", "cosecant", "cot", "cotangent"},
    # number sets
    {"real", "imaginary", "rational", "irrational"},
    # sign
    {"positive", "negative"},
    # parity
    {"even", "odd"},
    # progressions
    {"arithmetic", "geometric", "harmonic"},
    # transformation verbs on a quantity
    {"scaling", "reversing", "adding", "subtracting", "multiplying",
        "dividing", "increasing", "decreasing"},
    # bias / direction
    {"forward", "reverse", "backward"},
    # collision types
    {"elastic", "inelastic"},
    # series/parallel
    {"series", "parallel"},
    # cell types
    {"galvanic", "electrolytic", "voltaic"},
    # acid/base
    {"acid", "base", "acidic", "basic"},
    # powers
    {"square", "squared", "cube", "cubed", "fourth", "fifth", "sixth"},
    # equation types
    {"linear", "quadratic", "cubic", "quartic", "polynomial",
        "exponential", "logarithmic", "trigonometric"},
    # ordinals
    {"first", "second", "third", "fourth", "fifth"},
    # mathematical roles
    {"stoichiometric", "percentage", "fraction", "molar", "molal", "normal"},
    # math relation types (general/particular/etc.)
    {"general", "particular", "specific", "common", "unique"},
]


# Backward-compat alias (used by review_queue and resolve fallback paths).
_DISCRIMINATOR_GROUPS: list[set[str]] = (
    _DISCRIMINATOR_GROUPS_STRICT + _DISCRIMINATOR_GROUPS_MODIFIER
)


def _raw_word_set(s: str | None) -> set[str]:
    """Lowercase word split with no stopword stripping (preserves and/or/not/etc.)."""
    if not s:
        return set()
    import re as _re
    raw = _re.sub(r"[^a-zA-Z0-9 ]+", " ", s.lower())
    return {t for t in raw.split() if t}


def _strict_block(a_toks: set[str], b_toks: set[str]) -> bool:
    """Block if symmetric difference intersects ANY strict (heavy-noun) group.
    Captures cases where one side commits to an object/quantity and the other
    is silent about it — a strong signal of distinct concepts."""
    sym = (a_toks - b_toks) | (b_toks - a_toks)
    if not sym:
        return False
    for group in _DISCRIMINATOR_GROUPS_STRICT:
        if sym & group:
            return True
    return False


def _modifier_block(a_toks: set[str], b_toks: set[str]) -> bool:
    """Block only if both sides commit to *different* members of the same
    modifier group (handles soft conjunctions/short words)."""
    for group in _DISCRIMINATOR_GROUPS_MODIFIER:
        ah = a_toks & group
        bh = b_toks & group
        if ah and bh and ah != bh:
            return True
    return False


def _discriminator_block_raw(a_name: str | None, b_name: str | None) -> bool:
    """Discriminator check on raw lowercased words (no stopword strip).
    Use only for the modifier groups, where conjunctions matter (handles "and"
    in "Sum and product" vs "Sum of roots")."""
    return _modifier_block(_raw_word_set(a_name), _raw_word_set(b_name))


def _discriminator_block(a_tokens: set[str], b_tokens: set[str]) -> bool:
    """Stem-aware combined check: any strict-group sym-diff hit, OR any
    modifier-group both-sides-distinct hit."""
    return _strict_block(a_tokens, b_tokens) or _modifier_block(a_tokens, b_tokens)


@dataclass
class Candidate:
    concept_id: str
    name: str
    subject: str | None
    topic: str | None
    score: float
    tier: str


def load_embedding_for_mention(
    con: sqlite3.Connection,
    vectors_path: Path,
    mention_row: sqlite3.Row,
    mention_index_map: dict[str, int],
) -> list[float] | None:
    idx = mention_row["embedding_vector_id"]
    if idx is None:
        idx = mention_index_map.get(mention_row["mention_id"])
    if idx is None:
        return None
    if vectors_path.suffix == ".json":
        data = json.loads(vectors_path.read_text(encoding="utf-8"))
        row = data[idx]
        return [float(x) for x in row]
    try:
        import numpy as np  # type: ignore

        arr = np.load(str(vectors_path))
        return [float(x) for x in arr[idx].tolist()]
    except Exception:
        card = mention_card_from_row(mention_row)
        return _embedding_from_text(card, seed_suffix=b"full")


def hybrid_candidates(
    con: sqlite3.Connection,
    mention_row: sqlite3.Row,
    canon_rows: Iterable[sqlite3.Row],
    mv: list[float] | None,
    *,
    limit: int = 20,
) -> list[Candidate]:
    tier_match = []
    cand_vecs = {}
    for crow in canon_rows:
        cid = crow["concept_id"]
        nv = cand_vecs.get(cid)
        if nv is None:
            blob = crow["canonical_name"] + "\n" + (crow["statement"] or "") + (
                crow["definition"] or ""
            )
            nv = _embedding_from_text(blob, seed_suffix=b"cand")
            cand_vecs[cid] = nv
        ca = cosine(mv, nv) if mv else 0.0

        nm = _norm(crow["canonical_name"])
        tn = _norm(str(mention_row["name"]))
        nm_boost = 1.0 if nm == tn else (0.4 if tn in nm or nm in tn else 0.0)

        cand_tokens = _name_tokens(crow["canonical_name"])
        ment_tokens = _name_tokens(str(mention_row["name"]))
        jacc = _jaccard(cand_tokens, ment_tokens)
        # Token-Jaccard boost: paraphrases with most words in common earn
        # enough to clear the merge threshold. Suppressed when discriminator
        # tokens (e.g. min/max, sum/product, AND/OR) differ.
        is_blocked = _discriminator_block(cand_tokens, ment_tokens) or (
            _discriminator_block_raw(crow["canonical_name"], str(mention_row["name"]))
        )
        if is_blocked:
            jacc_boost = -0.5
            ca = 0.0
            nm_boost = 0.0
        elif jacc >= 0.85:
            jacc_boost = 1.1
        elif jacc >= 0.6:
            jacc_boost = 0.75
        elif jacc >= 0.4:
            jacc_boost = 0.4
        else:
            jacc_boost = 0.0

        sj = 0.25 if _norm(crow["subject"]) == _norm(str(mention_row["subject"])) else -0.1
        top = 0.15 if _norm(str(crow["primary_topic"])) == _norm(
            str(mention_row["topic"])
        ) else 0.0
        tier = (
            "topic"
            if top > 0
            else ("subject" if sj > 0 else ("primitive" if crow["concept_kind"] == "primitive" else "cross"))
        )
        score = 1.6 * nm_boost + jacc_boost + ca + sj + top
        if chapter_prereqs_overlap_topics(mention_row, crow):
            score += 0.05
        tier_match.append(Candidate(cid, crow["canonical_name"], crow["subject"], crow["primary_topic"], score, tier))

    tier_match.sort(key=lambda c: -c.score)
    return tier_match[:limit]


def chapter_prereqs_overlap_topics(mention_row: sqlite3.Row, crow: sqlite3.Row) -> bool:
    try:
        chap = json.loads(dict(mention_row)["chapter_prereqs_json"] or "[]")
    except json.JSONDecodeError:
        return False
    canon_blob = json.loads(crow["topics_json"] or "[]") if isinstance(
        crow["topics_json"], str
    ) else []
    if not canon_blob:
        canon_blob = [crow["primary_topic"]]
    return any(any(str(x).lower() in str(ch).lower() for x in canon_blob) for ch in chap)


def alias_exact_lookup(
    con: sqlite3.Connection, name: str, subject: str | None
) -> list[str]:
    cur = con.cursor()
    cur.execute(
        """SELECT ca.concept_id
        FROM concept_aliases ca
        JOIN canonical_concepts cc ON cc.concept_id = ca.concept_id
        WHERE lower(ca.alias)=lower(?)
          AND (cc.subject = ? OR cc.concept_kind = 'primitive')""",
        (name.strip(), subject),
    )
    return [r[0] for r in cur.fetchall()]
