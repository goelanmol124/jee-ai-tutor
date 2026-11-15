// Mock concept ontology and belief states.
// In production this comes from the curated graph (~1,500–3,000 nodes).
// Here we use a small representative slice for the prototype.

export type ConceptId = string;

export interface Concept {
  id: ConceptId;
  name: string;
  chapter: string;
  subject: 'math' | 'physics' | 'chemistry';
  /** Directed prereq edges: knowing these helps before this concept. */
  prereqIds: ConceptId[];
  // centrality 0..1 — proxy for downstream_unlock weight
  centrality: number;
}

export const CHAPTERS: Record<string, { id: string; title: string; subject: 'math' | 'physics' | 'chemistry' }> = {
  algebra: { id: 'algebra', title: 'Algebra', subject: 'math' },
  trig: { id: 'trig', title: 'Trigonometry', subject: 'math' },
  calculus_diff: { id: 'calculus_diff', title: 'Differential Calculus', subject: 'math' },
  calculus_int: { id: 'calculus_int', title: 'Integral Calculus', subject: 'math' },
  vectors: { id: 'vectors', title: 'Vectors & 3D', subject: 'math' },
  prob: { id: 'prob', title: 'Probability', subject: 'math' },
  mechanics: { id: 'mechanics', title: 'Mechanics', subject: 'physics' },
  emag: { id: 'emag', title: 'Electromagnetism', subject: 'physics' },
  modern: { id: 'modern', title: 'Modern Physics', subject: 'physics' },
  organic: { id: 'organic', title: 'Organic', subject: 'chemistry' },
  inorganic: { id: 'inorganic', title: 'Inorganic', subject: 'chemistry' },
  physical: { id: 'physical', title: 'Physical Chemistry', subject: 'chemistry' },
};

export const CONCEPTS: Concept[] = [
  // Differential calculus
  { id: 'limit_def', name: 'Limit definition', chapter: 'calculus_diff', subject: 'math', prereqIds: [], centrality: 0.9 },
  { id: 'derivative_def', name: 'Derivative as limit', chapter: 'calculus_diff', subject: 'math', prereqIds: ['limit_def'], centrality: 0.95 },
  { id: 'power_rule', name: 'Power rule', chapter: 'calculus_diff', subject: 'math', prereqIds: ['derivative_def'], centrality: 0.85 },
  { id: 'trig_deriv', name: 'Derivatives of trig functions', chapter: 'calculus_diff', subject: 'math', prereqIds: ['derivative_def'], centrality: 0.7 },
  { id: 'chain_rule', name: 'Chain rule', chapter: 'calculus_diff', subject: 'math', prereqIds: ['power_rule', 'trig_deriv'], centrality: 0.85 },
  { id: 'product_rule', name: 'Product rule', chapter: 'calculus_diff', subject: 'math', prereqIds: ['power_rule', 'chain_rule'], centrality: 0.7 },
  { id: 'quotient_rule', name: 'Quotient rule', chapter: 'calculus_diff', subject: 'math', prereqIds: ['product_rule'], centrality: 0.55 },
  { id: 'implicit_diff', name: 'Implicit differentiation', chapter: 'calculus_diff', subject: 'math', prereqIds: ['chain_rule'], centrality: 0.6 },
  { id: 'log_diff', name: 'Logarithmic differentiation', chapter: 'calculus_diff', subject: 'math', prereqIds: ['chain_rule', 'logs'], centrality: 0.45 },
  { id: 'inverse_trig_deriv', name: 'Inverse trig derivatives', chapter: 'calculus_diff', subject: 'math', prereqIds: ['trig_deriv'], centrality: 0.5 },
  { id: 'maxima_minima', name: 'Maxima & minima', chapter: 'calculus_diff', subject: 'math', prereqIds: ['derivative_def'], centrality: 0.75 },
  { id: 'mean_value_thm', name: 'Mean value theorem', chapter: 'calculus_diff', subject: 'math', prereqIds: ['derivative_def'], centrality: 0.4 },

  // Trig
  { id: 'sin_cos_id', name: 'sin² + cos² identity', chapter: 'trig', subject: 'math', prereqIds: [], centrality: 0.9 },
  { id: 'double_angle', name: 'Double-angle formulas', chapter: 'trig', subject: 'math', prereqIds: ['sin_cos_id'], centrality: 0.8 },
  { id: 'compound_angle', name: 'Compound-angle formulas', chapter: 'trig', subject: 'math', prereqIds: ['sin_cos_id'], centrality: 0.75 },
  { id: 'inverse_trig', name: 'Inverse trig functions', chapter: 'trig', subject: 'math', prereqIds: ['sin_cos_id'], centrality: 0.5 },

  // Integral calculus
  { id: 'antideriv', name: 'Antiderivative', chapter: 'calculus_int', subject: 'math', prereqIds: ['derivative_def'], centrality: 0.85 },
  { id: 'def_integral', name: 'Definite integral', chapter: 'calculus_int', subject: 'math', prereqIds: ['antideriv', 'limit_def'], centrality: 0.85 },
  { id: 'u_sub', name: 'Substitution', chapter: 'calculus_int', subject: 'math', prereqIds: ['antideriv', 'chain_rule'], centrality: 0.8 },
  { id: 'int_by_parts', name: 'Integration by parts', chapter: 'calculus_int', subject: 'math', prereqIds: ['antideriv', 'product_rule'], centrality: 0.7 },
  { id: 'partial_frac', name: 'Partial fractions', chapter: 'calculus_int', subject: 'math', prereqIds: ['antideriv', 'logs'], centrality: 0.5 },

  // Algebra
  { id: 'quadratic', name: 'Quadratic equations', chapter: 'algebra', subject: 'math', prereqIds: [], centrality: 0.85 },
  { id: 'binomial', name: 'Binomial theorem', chapter: 'algebra', subject: 'math', prereqIds: [], centrality: 0.7 },
  { id: 'complex_num', name: 'Complex numbers', chapter: 'algebra', subject: 'math', prereqIds: [], centrality: 0.65 },
  { id: 'sequences', name: 'Sequences & series', chapter: 'algebra', subject: 'math', prereqIds: [], centrality: 0.6 },
  { id: 'logs', name: 'Logarithms', chapter: 'algebra', subject: 'math', prereqIds: [], centrality: 0.7 },

  // Vectors
  { id: 'dot_product', name: 'Dot product', chapter: 'vectors', subject: 'math', prereqIds: [], centrality: 0.6 },
  { id: 'cross_product', name: 'Cross product', chapter: 'vectors', subject: 'math', prereqIds: ['dot_product'], centrality: 0.55 },
  { id: 'line_3d', name: 'Lines in 3D', chapter: 'vectors', subject: 'math', prereqIds: ['cross_product'], centrality: 0.45 },

  // Probability
  { id: 'cond_prob', name: 'Conditional probability', chapter: 'prob', subject: 'math', prereqIds: [], centrality: 0.55 },
  { id: 'bayes', name: "Bayes' theorem", chapter: 'prob', subject: 'math', prereqIds: ['cond_prob'], centrality: 0.45 },

  // Mechanics
  { id: 'kinematics_1d', name: '1D kinematics', chapter: 'mechanics', subject: 'physics', prereqIds: [], centrality: 0.85 },
  { id: 'newton_laws', name: "Newton's laws", chapter: 'mechanics', subject: 'physics', prereqIds: [], centrality: 0.9 },
  { id: 'projectile', name: 'Projectile motion', chapter: 'mechanics', subject: 'physics', prereqIds: ['kinematics_1d'], centrality: 0.7 },
  { id: 'work_energy', name: 'Work-energy theorem', chapter: 'mechanics', subject: 'physics', prereqIds: ['kinematics_1d'], centrality: 0.75 },
  { id: 'momentum', name: 'Momentum & collisions', chapter: 'mechanics', subject: 'physics', prereqIds: ['newton_laws'], centrality: 0.65 },
  { id: 'rotation', name: 'Rotational dynamics', chapter: 'mechanics', subject: 'physics', prereqIds: ['newton_laws'], centrality: 0.55 },
  { id: 'shm', name: 'SHM', chapter: 'mechanics', subject: 'physics', prereqIds: ['rotation'], centrality: 0.5 },

  // EM
  { id: 'coulomb', name: "Coulomb's law", chapter: 'emag', subject: 'physics', prereqIds: [], centrality: 0.7 },
  { id: 'gauss', name: "Gauss's law", chapter: 'emag', subject: 'physics', prereqIds: ['coulomb'], centrality: 0.65 },
  { id: 'capacitor', name: 'Capacitors', chapter: 'emag', subject: 'physics', prereqIds: ['gauss'], centrality: 0.55 },
  { id: 'biot_savart', name: 'Biot-Savart', chapter: 'emag', subject: 'physics', prereqIds: [], centrality: 0.5 },
  { id: 'emi', name: 'EM induction', chapter: 'emag', subject: 'physics', prereqIds: ['biot_savart'], centrality: 0.55 },

  // Modern
  { id: 'photon', name: 'Photon energy', chapter: 'modern', subject: 'physics', prereqIds: [], centrality: 0.5 },
  { id: 'bohr', name: 'Bohr model', chapter: 'modern', subject: 'physics', prereqIds: ['photon'], centrality: 0.45 },

  // Organic
  { id: 'sn1_sn2', name: 'SN1 vs SN2', chapter: 'organic', subject: 'chemistry', prereqIds: [], centrality: 0.65 },
  { id: 'e1_e2', name: 'E1 vs E2', chapter: 'organic', subject: 'chemistry', prereqIds: ['sn1_sn2'], centrality: 0.55 },
  { id: 'aromaticity', name: 'Aromaticity', chapter: 'organic', subject: 'chemistry', prereqIds: [], centrality: 0.5 },
  { id: 'carbonyl', name: 'Carbonyl reactions', chapter: 'organic', subject: 'chemistry', prereqIds: ['sn1_sn2'], centrality: 0.55 },

  // Inorganic
  { id: 'periodic_trends', name: 'Periodic trends', chapter: 'inorganic', subject: 'chemistry', prereqIds: [], centrality: 0.6 },
  { id: 'coord_compounds', name: 'Coordination compounds', chapter: 'inorganic', subject: 'chemistry', prereqIds: ['periodic_trends'], centrality: 0.5 },

  // Physical
  { id: 'thermo', name: 'Thermodynamics', chapter: 'physical', subject: 'chemistry', prereqIds: [], centrality: 0.7 },
  { id: 'kinetics', name: 'Chemical kinetics', chapter: 'physical', subject: 'chemistry', prereqIds: ['thermo'], centrality: 0.55 },
  { id: 'equilibrium', name: 'Equilibrium', chapter: 'physical', subject: 'chemistry', prereqIds: ['thermo'], centrality: 0.6 },
];

// Belief 0..1 per concept. Derived from "I covered: Calculus + Trig" with priors:
// covered chapters → ~0.3, others → ~0.05, with some noise to look real.
export function makeInitialBeliefs(coveredChapters: string[]): Record<ConceptId, number> {
  const out: Record<ConceptId, number> = {};
  const seed = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
  };
  for (const c of CONCEPTS) {
    const covered = coveredChapters.includes(c.chapter);
    const base = covered ? 0.32 : 0.06;
    const noise = (seed(c.id) - 0.5) * (covered ? 0.35 : 0.10);
    out[c.id] = Math.max(0.02, Math.min(0.98, base + noise));
  }
  return out;
}

// "Mastered" threshold per §7
export const MASTERY_THRESHOLD = 0.7;
export const SHAKY_THRESHOLD = 0.35;
