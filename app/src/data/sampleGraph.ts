/**
 * Original sample content for JEE preparation (physics, chemistry, maths).
 *
 * Every question below was written for this repository. None is copied from a
 * JEE paper, coaching material or answer key. The full production graph built
 * from past papers is NOT distributed; point the app at your own snapshot with
 * `npm run sync:graph` (writes the git-ignored `public/data/graph.json`) or
 * `AL_GRAPH_PATH=/path/to/graph.json` on the server.
 *
 * Step `checks` / `traps` drive the offline step-level diagnoser
 * (`src/services/offlineDiagnosis.ts`). Each entry is one alternative; tokens
 * inside an alternative are separated by `&&` and must all appear in the
 * normalised student text (lower-case, no spaces, π→pi, α→a, β→b, ×/·→*).
 */
import type {
  CanonicalStepNode,
  ChapterNode,
  ConceptNode,
  GraphData,
  GraphEdge,
  QuestionNode,
  Subject,
} from '../domain/types';

const R = String.raw;

type ConceptSeed = Omit<ConceptNode, 'subject' | 'centrality'> & { centrality?: number };

const CHAPTERS: ChapterNode[] = [
  { id: 'math_differentiation', title: 'Differentiation', subject: 'math' },
  { id: 'math_quadratic_equations', title: 'Quadratic Equations', subject: 'math' },
  { id: 'math_probability', title: 'Probability', subject: 'math' },
  { id: 'physics_kinematics', title: 'Kinematics', subject: 'physics' },
  { id: 'physics_laws_of_motion', title: 'Laws of Motion', subject: 'physics' },
  { id: 'physics_work_energy', title: 'Work, Energy and Power', subject: 'physics' },
  { id: 'chemistry_mole_concept', title: 'Some Basic Concepts (Mole Concept)', subject: 'chemistry' },
  { id: 'chemistry_atomic_structure', title: 'Atomic Structure', subject: 'chemistry' },
  { id: 'chemistry_equilibrium', title: 'Equilibrium', subject: 'chemistry' },
];

const CONCEPT_SEEDS: ConceptSeed[] = [
  // Maths — differentiation
  { id: 'm_power_rule', name: 'Power rule', chapterId: 'math_differentiation', prereqIds: [], centrality: 0.9,
    statement: R`\(\frac{d}{dx}x^n = n x^{n-1}\).`, whenToUse: 'Differentiating any power of x.' },
  { id: 'm_product_rule', name: 'Product rule', chapterId: 'math_differentiation', prereqIds: ['m_power_rule'], centrality: 0.7,
    statement: R`\((uv)' = u'v + uv'\).`, whenToUse: 'The function is a product of two x-dependent factors.' },
  { id: 'm_chain_rule', name: 'Chain rule', chapterId: 'math_differentiation', prereqIds: ['m_power_rule'], centrality: 0.85,
    statement: R`\(\frac{d}{dx}f(g(x)) = f'(g(x))\,g'(x)\).`, whenToUse: 'Something other than plain x sits inside a function.' },
  { id: 'm_trig_values', name: 'Standard trigonometric values', chapterId: 'math_differentiation', prereqIds: [], centrality: 0.6,
    statement: R`\(\sin\frac{\pi}{2}=1,\ \cos\frac{\pi}{2}=0,\ \sin\frac{\pi}{6}=\frac12\), …`, whenToUse: 'Substituting standard angles.' },
  { id: 'm_tangent_slope', name: 'Derivative as slope of a tangent', chapterId: 'math_differentiation', prereqIds: ['m_power_rule'], centrality: 0.5,
    statement: R`The slope of the tangent at \(x=a\) is \(f'(a)\).`, whenToUse: 'Asked for a tangent slope or rate at a point.' },

  // Maths — quadratics
  { id: 'm_roots_sum_product', name: 'Sum and product of roots', chapterId: 'math_quadratic_equations', prereqIds: [], centrality: 0.8,
    statement: R`For \(ax^2+bx+c=0\): \(\alpha+\beta=-b/a\), \(\alpha\beta=c/a\).`, whenToUse: 'Symmetric expressions in the roots.' },
  { id: 'm_algebraic_identities', name: 'Algebraic identities', chapterId: 'math_quadratic_equations', prereqIds: [], centrality: 0.7,
    statement: R`\(\alpha^2+\beta^2=(\alpha+\beta)^2-2\alpha\beta\).`, whenToUse: 'Rewriting a symmetric expression in terms of sum and product.' },
  { id: 'm_discriminant', name: 'Discriminant and nature of roots', chapterId: 'math_quadratic_equations', prereqIds: ['m_roots_sum_product'], centrality: 0.6,
    statement: R`\(D=b^2-4ac\); equal roots iff \(D=0\).`, whenToUse: 'Questions about real, equal or imaginary roots.' },

  // Maths — probability
  { id: 'm_counting', name: 'Counting outcomes', chapterId: 'math_probability', prereqIds: [], centrality: 0.7,
    statement: 'List or count every equally likely outcome; order matters for distinguishable objects.', whenToUse: 'Building the sample space.' },
  { id: 'm_classical_probability', name: 'Classical probability', chapterId: 'math_probability', prereqIds: ['m_counting'], centrality: 0.75,
    statement: R`\(P(E)=\frac{\text{favourable}}{\text{total}}\) for equally likely outcomes.`, whenToUse: 'Finite, equally likely sample spaces.' },
  { id: 'm_complement', name: 'Complement rule', chapterId: 'math_probability', prereqIds: ['m_classical_probability'], centrality: 0.55,
    statement: R`\(P(\text{at least one}) = 1 - P(\text{none})\).`, whenToUse: '"At least one" questions.' },

  // Physics — kinematics
  { id: 'p_suvat', name: 'Equations of motion (constant acceleration)', chapterId: 'physics_kinematics', prereqIds: [], centrality: 0.9,
    statement: R`\(v=u+at,\ s=ut+\tfrac12at^2,\ v^2=u^2+2as\).`, whenToUse: 'Uniform acceleration in a straight line.' },
  { id: 'p_sign_convention', name: 'Sign convention in 1D motion', chapterId: 'physics_kinematics', prereqIds: [], centrality: 0.6,
    statement: 'Choose a positive direction; vectors against it are negative (e.g. g = −10 m/s² when up is positive).', whenToUse: 'Any vertical motion problem.' },
  { id: 'p_trig_components', name: 'Resolving a vector into components', chapterId: 'physics_kinematics', prereqIds: ['m_trig_values'], centrality: 0.8,
    statement: R`At angle \(\theta\) from the horizontal: \(u_x=u\cos\theta,\ u_y=u\sin\theta\).`, whenToUse: 'Projectiles, inclined forces.' },
  { id: 'p_projectile', name: 'Projectile motion', chapterId: 'physics_kinematics', prereqIds: ['p_suvat', 'p_trig_components'], centrality: 0.6,
    statement: R`Horizontal and vertical motions are independent; \(T=\frac{2u\sin\theta}{g}\).`, whenToUse: 'Objects launched at an angle.' },

  // Physics — laws of motion
  { id: 'p_free_body', name: 'Free-body diagrams', chapterId: 'physics_laws_of_motion', prereqIds: [], centrality: 0.85,
    statement: 'Isolate one body and draw every force acting on it — nothing else.', whenToUse: 'Before writing any F = ma equation.' },
  { id: 'p_newton_second', name: "Newton's second law", chapterId: 'physics_laws_of_motion', prereqIds: ['p_free_body'], centrality: 0.9,
    statement: R`\(F_{\text{net}} = ma\) for the chosen system.`, whenToUse: 'Linking forces and acceleration.' },
  { id: 'p_friction', name: 'Kinetic friction', chapterId: 'physics_laws_of_motion', prereqIds: ['p_newton_second'], centrality: 0.6,
    statement: R`\(f_k=\mu_k N\), opposing relative motion.`, whenToUse: 'Rough surfaces with sliding.' },

  // Physics — work & energy
  { id: 'p_work', name: 'Work done by a force', chapterId: 'physics_work_energy', prereqIds: ['p_trig_components'], centrality: 0.7,
    statement: R`\(W = Fd\cos\theta\).`, whenToUse: 'Force and displacement are known.' },
  { id: 'p_kinetic_energy', name: 'Kinetic energy', chapterId: 'physics_work_energy', prereqIds: [], centrality: 0.6,
    statement: R`\(K=\tfrac12mv^2\).`, whenToUse: 'Energy of a moving body.' },
  { id: 'p_energy_conservation', name: 'Conservation of mechanical energy', chapterId: 'physics_work_energy', prereqIds: ['p_kinetic_energy', 'p_work'], centrality: 0.75,
    statement: R`With only conservative forces, \(K+U\) is constant: \(mgh=\tfrac12mv^2\).`, whenToUse: 'Falls, swings, slides without friction.' },

  // Chemistry — mole concept
  { id: 'c_molar_mass', name: 'Molar mass', chapterId: 'chemistry_mole_concept', prereqIds: [], centrality: 0.8,
    statement: R`Sum of atomic masses, in g/mol (\(\mathrm{H_2O}=18\)).`, whenToUse: 'Converting grams to moles.' },
  { id: 'c_mole', name: 'Mole calculations', chapterId: 'chemistry_mole_concept', prereqIds: ['c_molar_mass'], centrality: 0.9,
    statement: R`\(n = \frac{m}{M}\).`, whenToUse: 'Any quantity conversion.' },
  { id: 'c_stoichiometry', name: 'Stoichiometry', chapterId: 'chemistry_mole_concept', prereqIds: ['c_mole'], centrality: 0.7,
    statement: 'Coefficients of a balanced equation give mole ratios.', whenToUse: 'Relating reactants and products.' },
  { id: 'c_limiting_reagent', name: 'Limiting reagent', chapterId: 'chemistry_mole_concept', prereqIds: ['c_stoichiometry'], centrality: 0.6,
    statement: 'The reactant that runs out first fixes the amount of product.', whenToUse: 'Two reactant amounts are given.' },

  // Chemistry — atomic structure
  { id: 'c_bohr_energy', name: 'Bohr energy levels', chapterId: 'chemistry_atomic_structure', prereqIds: [], centrality: 0.7,
    statement: R`For hydrogen, \(E_n=-\frac{13.6}{n^2}\) eV.`, whenToUse: 'Energy of an electron in orbit n.' },
  { id: 'c_spectral_lines', name: 'Spectral transitions', chapterId: 'chemistry_atomic_structure', prereqIds: ['c_bohr_energy'], centrality: 0.5,
    statement: R`From level n to ground, the number of possible lines is \(\frac{n(n-1)}{2}\).`, whenToUse: 'Counting emission lines.' },
  { id: 'c_quantum_numbers', name: 'Shells and electron capacity', chapterId: 'chemistry_atomic_structure', prereqIds: [], centrality: 0.6,
    statement: R`Shell n holds at most \(2n^2\) electrons (two spins per orbital, \(n^2\) orbitals).`, whenToUse: 'Electron capacity of a shell.' },

  // Chemistry — equilibrium
  { id: 'c_ph', name: 'pH of strong acids', chapterId: 'chemistry_equilibrium', prereqIds: [], centrality: 0.7,
    statement: R`\(\mathrm{pH}=-\log[\mathrm{H^+}]\); a strong acid dissociates fully.`, whenToUse: 'Acidity of strong acid solutions.' },
  { id: 'c_le_chatelier', name: "Le Chatelier's principle", chapterId: 'chemistry_equilibrium', prereqIds: [], centrality: 0.75,
    statement: 'An equilibrium shifts to oppose an imposed change in concentration, pressure or temperature.', whenToUse: 'Predicting the direction of shift.' },
];

const SUBJECT_BY_CHAPTER: Record<string, Subject> = Object.fromEntries(
  CHAPTERS.map((chapter) => [chapter.id, chapter.subject]),
);

const CONCEPTS: ConceptNode[] = CONCEPT_SEEDS.map((seed) => ({
  ...seed,
  subject: SUBJECT_BY_CHAPTER[seed.chapterId],
  centrality: seed.centrality ?? 0.5,
  confidence: 'high',
}));

type StepSeed = Omit<CanonicalStepNode, 'id'>;

interface QuestionSeed {
  id: string;
  chapterId: string;
  prompt: string;
  options?: string[];
  /** Zero-based index of the correct option (MCQ only). */
  answerIndex?: number;
  finalAnswer: string;
  answerChecks: string[];
  difficulty: QuestionNode['difficulty'];
  estimatedTimeSeconds?: number;
  steps: StepSeed[];
}

const QUESTION_SEEDS: QuestionSeed[] = [
  // ─── Maths ───────────────────────────────────────────────
  {
    id: 'sample_m_diff_1',
    chapterId: 'math_differentiation',
    prompt: R`If \(y = x^2\sin(2x)\), find \(\frac{dy}{dx}\) at \(x = \frac{\pi}{4}\).`,
    options: [R`\(\frac{\pi}{2}\)`, R`\(\frac{\pi}{4}\)`, R`\(\pi\)`, R`\(1+\frac{\pi}{2}\)`],
    answerIndex: 0,
    finalAnswer: R`\frac{\pi}{2} (option 1)`,
    answerChecks: ['pi/2'],
    difficulty: 2,
    steps: [
      { text: R`Product rule: \(\frac{dy}{dx} = 2x\sin(2x) + x^2\frac{d}{dx}\sin(2x)\).`, conceptIds: ['m_product_rule', 'm_power_rule'],
        checks: ['2xsin(2x)', '2xsin2x', 'product'], hint: 'Two x-dependent factors are multiplied — which rule handles that?' },
      { text: R`Chain rule: \(\frac{d}{dx}\sin(2x) = 2\cos(2x)\), so the second term is \(2x^2\cos(2x)\).`, conceptIds: ['m_chain_rule'],
        checks: ['2x^2cos(2x)', '2x^2cos2x', 'sin(2x)=2cos(2x)', 'sin2x=2cos2x'],
        traps: [{ checks: ['+x^2cos(2x)', '+x^2cos2x', 'sin(2x)=cos(2x)', 'sin2x=cos2x'], mistakeType: 'conceptual_gap',
          note: R`The inner \(2x\) was not differentiated: \(\frac{d}{dx}\sin(2x)\) needs the chain-rule factor from \(\frac{d}{dx}(2x)\).` }],
        hint: R`What is the derivative of the inside, \(2x\)?` },
      { text: R`At \(x=\frac{\pi}{4}\): \(\sin\frac{\pi}{2}=1\) and \(\cos\frac{\pi}{2}=0\).`, conceptIds: ['m_trig_values'],
        checks: ['sin(pi/2)=1', 'sinpi/2=1', 'cos(pi/2)=0', 'cospi/2=0'],
        traps: [{ checks: ['sin(pi/4)', 'sinpi/4', '1/sqrt2', 'sqrt2/2'], mistakeType: 'silly_mistake',
          note: R`Substitute into \(2x\) first — the angle inside \(\sin\) and \(\cos\) is \(2x\), not \(x\).` }],
        hint: R`What is \(2x\) when \(x=\frac{\pi}{4}\)?` },
    ],
  },
  {
    id: 'sample_m_diff_2',
    chapterId: 'math_differentiation',
    prompt: R`Find the slope of the tangent to the curve \(y = (x^2+1)^3\) at \(x = 1\).`,
    options: ['12', '24', '48', '6'],
    answerIndex: 1,
    finalAnswer: '24 (option 2)',
    answerChecks: ['24'],
    difficulty: 2,
    steps: [
      { text: R`Chain rule: \(\frac{dy}{dx} = 3(x^2+1)^2\cdot 2x = 6x(x^2+1)^2\).`, conceptIds: ['m_chain_rule', 'm_power_rule'],
        checks: ['3(x^2+1)^2*2x', '3(x^2+1)^2(2x)', '6x(x^2+1)^2', '2x*3(x^2+1)^2'],
        traps: [{ checks: ['=3(x^2+1)^2', '3*4=12', '=12'], mistakeType: 'conceptual_gap',
          note: R`The bracket \((x^2+1)\) is an inner function — its derivative \(2x\) must multiply in.` }],
        hint: 'Something other than plain x is being cubed.' },
      { text: R`At \(x=1\): \(6(1)(1+1)^2 = 6\cdot 4\).`, conceptIds: ['m_tangent_slope'],
        checks: ['6(1)(4)', '6*4', '6*1*4', '(1+1)^2', '(1^2+1)^2'], hint: 'Substitute x = 1 into your derivative.' },
    ],
  },
  {
    id: 'sample_m_quad_1',
    chapterId: 'math_quadratic_equations',
    prompt: R`If \(\alpha\) and \(\beta\) are the roots of \(x^2 - 5x + 3 = 0\), find \(\alpha^2 + \beta^2\).`,
    options: ['19', '22', '31', '25'],
    answerIndex: 0,
    finalAnswer: '19 (option 1)',
    answerChecks: ['19'],
    difficulty: 2,
    steps: [
      { text: R`By Vieta: \(\alpha+\beta = 5\) and \(\alpha\beta = 3\).`, conceptIds: ['m_roots_sum_product'],
        checks: ['a+b=5', 'sum=5', 'sumofroots=5'],
        traps: [{ checks: ['a+b=-5', 'sum=-5'], mistakeType: 'procedure_error',
          note: R`Sign slip in Vieta: the sum of roots is \(-b/a = -(-5)/1 = 5\).` }],
        hint: 'What are the sum and product of the roots in terms of the coefficients?' },
      { text: R`\(\alpha^2+\beta^2 = (\alpha+\beta)^2 - 2\alpha\beta = 25 - 6\).`, conceptIds: ['m_algebraic_identities'],
        checks: ['(a+b)^2-2ab', '25-6', '5^2-2(3)', '5^2-2*3'],
        traps: [
          { checks: ['(a+b)^2-ab', '25-3', '=22'], mistakeType: 'conceptual_gap',
            note: R`The identity is \((\alpha+\beta)^2 - 2\alpha\beta\) — the cross term appears twice.` },
          { checks: ['(a+b)^2+2ab', '25+6', '=31'], mistakeType: 'procedure_error',
            note: R`\((\alpha+\beta)^2 = \alpha^2+\beta^2+2\alpha\beta\), so you subtract \(2\alpha\beta\), not add it.` },
        ],
        hint: R`Expand \((\alpha+\beta)^2\). What extra term appears?` },
    ],
  },
  {
    id: 'sample_m_quad_2',
    chapterId: 'math_quadratic_equations',
    prompt: R`For which positive value of \(k\) does \(x^2 + kx + 9 = 0\) have equal roots? (Enter an integer.)`,
    finalAnswer: '6',
    answerChecks: ['6'],
    difficulty: 1,
    steps: [
      { text: R`Equal roots \(\Rightarrow D = k^2 - 4(1)(9) = 0\), so \(k^2 = 36\).`, conceptIds: ['m_discriminant'],
        checks: ['k^2-36', 'k^2=36', 'k^2-4(9)', 'k^2-4*9', 'k^2-4(1)(9)', 'b^2-4ac=0', 'd=0'],
        traps: [{ checks: ['k^2-9', 'k^2=9', 'k=3'], mistakeType: 'procedure_error',
          note: R`The discriminant is \(b^2 - 4ac\) — the factor 4 went missing.` }],
        hint: 'Which quantity is zero exactly when the roots are equal?' },
    ],
  },
  {
    id: 'sample_m_prob_1',
    chapterId: 'math_probability',
    prompt: 'Two fair six-sided dice are thrown. What is the probability that the sum of the numbers is 8?',
    options: [R`\(\frac{5}{36}\)`, R`\(\frac{1}{6}\)`, R`\(\frac{7}{36}\)`, R`\(\frac{1}{9}\)`],
    answerIndex: 0,
    finalAnswer: R`\frac{5}{36} (option 1)`,
    answerChecks: ['5/36'],
    difficulty: 1,
    steps: [
      { text: R`Total outcomes: \(6 \times 6 = 36\).`, conceptIds: ['m_counting'],
        checks: ['36', '6*6', '6^2'], hint: 'How many ordered pairs can two dice show?' },
      { text: 'Favourable: (2,6), (3,5), (4,4), (5,3), (6,2) — five outcomes.', conceptIds: ['m_classical_probability', 'm_counting'],
        checks: ['(2,6)&&(6,2)', '5outcomes', '5ways', '5cases', 'favourable=5', 'favorable=5'],
        traps: [{ checks: ['4/36', '1/9', '4ways', '4outcomes', '3/36'], mistakeType: 'wrong_understanding',
          note: '(2,6) and (6,2) are different outcomes — the two dice are distinguishable, so order matters.' }],
        hint: 'List the pairs that add to 8. Is (2,6) the same outcome as (6,2)?' },
    ],
  },
  {
    id: 'sample_m_prob_2',
    chapterId: 'math_probability',
    prompt: 'A fair coin is tossed three times. What is the probability of getting at least one head?',
    options: [R`\(\frac{7}{8}\)`, R`\(\frac{1}{8}\)`, R`\(\frac{3}{8}\)`, R`\(\frac{1}{2}\)`],
    answerIndex: 0,
    finalAnswer: R`\frac{7}{8} (option 1)`,
    answerChecks: ['7/8'],
    difficulty: 1,
    steps: [
      { text: R`\(P(\text{no head}) = \left(\frac12\right)^3 = \frac18\).`, conceptIds: ['m_complement', 'm_counting'],
        checks: ['1/8', '(1/2)^3', 'ttt'], hint: 'What is the only way to get no heads at all?' },
      { text: R`\(P(\text{at least one head}) = 1 - \frac18\).`, conceptIds: ['m_complement'],
        checks: ['1-1/8', '1-(1/2)^3'],
        traps: [{ checks: ['3/8'], mistakeType: 'wrong_understanding',
          note: '3/8 is "exactly one head". "At least one" also includes two and three heads.' }],
        hint: '"At least one" is the complement of which event?' },
    ],
  },

  // ─── Physics ─────────────────────────────────────────────
  {
    id: 'sample_p_kin_1',
    chapterId: 'physics_kinematics',
    prompt: R`A ball is thrown vertically upward with a speed of \(20\ \text{m/s}\). Taking \(g = 10\ \text{m/s}^2\), find the maximum height reached.`,
    options: ['20 m', '40 m', '10 m', '2 m'],
    answerIndex: 0,
    finalAnswer: '20 m (option 1)',
    answerChecks: ['20m', 'h=20', '=20'],
    difficulty: 1,
    steps: [
      { text: R`At the highest point \(v = 0\).`, conceptIds: ['p_suvat'],
        checks: ['v=0', 'finalvelocity0', 'velocityiszero', 'velocity=0'], hint: 'What is the velocity at the very top?' },
      { text: R`\(v^2 = u^2 - 2gh \Rightarrow 0 = 400 - 20h\).`, conceptIds: ['p_suvat', 'p_sign_convention'],
        checks: ['400-20h', '20^2-2(10)h', '20^2-2*10*h', '400=20h', 'u^2/2g', 'u^2/(2g)', 'h=400/20'],
        traps: [
          { checks: ['400+20h', 'u^2+2gh'], mistakeType: 'procedure_error',
            note: 'Gravity opposes the upward motion, so the acceleration term is −2gh when up is positive.' },
          { checks: ['400/10', 'h=40', 'u^2/g'], mistakeType: 'silly_mistake',
            note: R`The factor 2 in \(v^2=u^2-2gh\) was dropped.` },
        ],
        hint: 'Which equation links u, v and displacement without time?' },
    ],
  },
  {
    id: 'sample_p_kin_2',
    chapterId: 'physics_kinematics',
    prompt: R`A projectile is launched at \(30^\circ\) above the horizontal with a speed of \(20\ \text{m/s}\). Taking \(g = 10\ \text{m/s}^2\), find its time of flight.`,
    options: ['2 s', '4 s', '3.46 s', '1 s'],
    answerIndex: 0,
    finalAnswer: '2 s (option 1)',
    answerChecks: ['2s', 't=2', '=2'],
    difficulty: 2,
    steps: [
      { text: R`Vertical component: \(u_y = 20\sin 30^\circ = 10\ \text{m/s}\).`, conceptIds: ['p_trig_components'],
        checks: ['20sin30', 'uy=10', 'usin', '20(1/2)', '20*1/2', '20*0.5'],
        traps: [{ checks: ['20cos30', 'uy=17.3', '10sqrt3', '17.3'], mistakeType: 'conceptual_gap',
          note: R`The vertical component uses \(\sin\theta\) when \(\theta\) is measured from the horizontal.` }],
        hint: 'Only the vertical part of the velocity decides how long it stays up.' },
      { text: R`\(T = \frac{2u_y}{g} = \frac{2(10)}{10}\).`, conceptIds: ['p_projectile', 'p_suvat'],
        checks: ['2uy/g', '2usin', '2(10)/10', '2*10/10', '20/10'],
        traps: [{ checks: ['10/10', 't=1'], mistakeType: 'wrong_understanding',
          note: R`\(u_y/g\) is only the time to the top; the flight is up and back down, \(2u_y/g\).` }],
        hint: 'How does the time going up compare with the time coming down?' },
    ],
  },
  {
    id: 'sample_p_nlm_1',
    chapterId: 'physics_laws_of_motion',
    prompt: R`A \(5\ \text{kg}\) block rests on a rough horizontal floor (\(\mu_k = 0.2\)). It is pulled by a horizontal force of \(20\ \text{N}\). Taking \(g = 10\ \text{m/s}^2\), find its acceleration.`,
    options: [R`\(2\ \text{m/s}^2\)`, R`\(4\ \text{m/s}^2\)`, R`\(3\ \text{m/s}^2\)`, R`\(1\ \text{m/s}^2\)`],
    answerIndex: 0,
    finalAnswer: R`2\ \text{m/s}^2 (option 1)`,
    answerChecks: ['a=2', '2m/s'],
    difficulty: 2,
    steps: [
      { text: R`Friction: \(f = \mu_k mg = 0.2 \times 5 \times 10 = 10\ \text{N}\).`, conceptIds: ['p_friction', 'p_free_body'],
        checks: ['0.2*5*10', '0.2*50', 'f=10', 'umg', 'friction=10', 'f=0.2'], hint: 'Which force opposes the pull?' },
      { text: R`\(F - f = ma \Rightarrow 20 - 10 = 5a\).`, conceptIds: ['p_newton_second'],
        checks: ['20-10', '10=5a', '(20-10)/5'],
        traps: [{ checks: ['20=5a', 'a=4', '20/5'], mistakeType: 'conceptual_gap',
          note: 'Friction is missing from the net force — draw the free-body diagram before writing F = ma.' }],
        hint: 'What is the NET horizontal force?' },
    ],
  },
  {
    id: 'sample_p_nlm_2',
    chapterId: 'physics_laws_of_motion',
    prompt: R`Blocks of mass \(2\ \text{kg}\) and \(3\ \text{kg}\) are in contact on a frictionless floor. A horizontal force of \(10\ \text{N}\) pushes the \(2\ \text{kg}\) block. Find the contact force between the blocks.`,
    options: ['6 N', '4 N', '10 N', '2 N'],
    answerIndex: 0,
    finalAnswer: '6 N (option 1)',
    answerChecks: ['6n', '=6'],
    difficulty: 2,
    steps: [
      { text: R`Whole system: \(a = \frac{10}{2+3} = 2\ \text{m/s}^2\).`, conceptIds: ['p_newton_second'],
        checks: ['10/5', '10/(2+3)', 'a=2'],
        traps: [{ checks: ['10/2', 'a=5'], mistakeType: 'conceptual_gap',
          note: 'The push accelerates both blocks together, so divide by the total mass.' }],
        hint: 'Both blocks move together — what mass does the 10 N accelerate?' },
      { text: R`Isolate the \(3\ \text{kg}\) block: \(N = 3a = 6\ \text{N}\).`, conceptIds: ['p_free_body', 'p_newton_second'],
        checks: ['3*2', '3(2)', 'n=6', '3a'],
        traps: [{ checks: ['2*2', 'n=4'], mistakeType: 'wrong_understanding',
          note: 'The only horizontal force on the 3 kg block is the contact force, so use that block: N = 3a.' }],
        hint: 'Which block has only the contact force acting on it horizontally?' },
    ],
  },
  {
    id: 'sample_p_we_1',
    chapterId: 'physics_work_energy',
    prompt: R`A \(2\ \text{kg}\) ball is dropped from rest from a height of \(5\ \text{m}\). Ignoring air resistance and taking \(g = 10\ \text{m/s}^2\), find its speed just before it hits the ground.`,
    options: [R`\(10\ \text{m/s}\)`, R`\(5\ \text{m/s}\)`, R`\(100\ \text{m/s}\)`, R`\(7.07\ \text{m/s}\)`],
    answerIndex: 0,
    finalAnswer: R`10\ \text{m/s} (option 1)`,
    answerChecks: ['10m/s', 'v=10'],
    difficulty: 1,
    steps: [
      { text: R`\(mgh = \tfrac12 mv^2 \Rightarrow v^2 = 2gh = 100\).`, conceptIds: ['p_energy_conservation', 'p_kinetic_energy'],
        checks: ['mgh=1/2mv^2', 'mgh=(1/2)mv^2', 'v^2=2gh', '2*10*5', 'v^2=100', 'sqrt(2gh)', 'sqrt(100)'],
        traps: [{ checks: ['v^2=gh', 'v^2=50', 'v=gh', 'sqrt50'], mistakeType: 'procedure_error',
          note: R`Kinetic energy is \(\tfrac12mv^2\) — the half was lost, so \(v^2 = 2gh\).` }],
        hint: 'Potential energy at the top turns into which energy at the bottom?' },
    ],
  },
  {
    id: 'sample_p_we_2',
    chapterId: 'physics_work_energy',
    prompt: R`A force of \(4\ \text{N}\) acts on a body at \(60^\circ\) to its displacement of \(5\ \text{m}\). Find the work done by the force.`,
    options: ['10 J', '20 J', '17.3 J', '0 J'],
    answerIndex: 0,
    finalAnswer: '10 J (option 1)',
    answerChecks: ['10j', 'w=10', '=10'],
    difficulty: 1,
    steps: [
      { text: R`\(W = Fd\cos\theta = 4 \times 5 \times \cos 60^\circ = 20 \times \tfrac12\).`, conceptIds: ['p_work', 'p_trig_components'],
        checks: ['fdcos', 'fscos', '4*5*cos60', '4*5*0.5', '4*5*1/2', '20*0.5', '20cos60', '20(1/2)', '20*1/2'],
        traps: [
          { checks: ['sin60', '17.3', '10sqrt3'], mistakeType: 'conceptual_gap',
            note: R`Work uses the component along the displacement: \(\cos\theta\), not \(\sin\theta\).` },
          { checks: ['=20j', 'w=20', '4*5=20j'], mistakeType: 'conceptual_gap',
            note: 'Only the part of the force along the displacement does work — the angle matters.' },
        ],
        hint: 'Which component of the force points along the displacement?' },
    ],
  },

  // ─── Chemistry ───────────────────────────────────────────
  {
    id: 'sample_c_mole_1',
    chapterId: 'chemistry_mole_concept',
    prompt: R`How many moles of water are present in \(9\ \text{g}\) of \(\mathrm{H_2O}\)? (H = 1, O = 16)`,
    options: ['0.5', '2', '0.25', '1'],
    answerIndex: 0,
    finalAnswer: '0.5 (option 1)',
    answerChecks: ['0.5', '1/2'],
    difficulty: 1,
    steps: [
      { text: R`Molar mass of \(\mathrm{H_2O} = 2(1) + 16 = 18\ \text{g/mol}\).`, conceptIds: ['c_molar_mass'],
        checks: ['18g/mol', 'm=18', '2+16', '2(1)+16', 'molarmass=18', '=18'],
        traps: [{ checks: ['1+16', '=17', 'm=17'], mistakeType: 'silly_mistake',
          note: R`There are two hydrogen atoms in \(\mathrm{H_2O}\): \(2(1)+16 = 18\).` }],
        hint: 'Add up the atomic masses — how many H atoms are there?' },
      { text: R`\(n = \frac{9}{18}\).`, conceptIds: ['c_mole'],
        checks: ['9/18', 'n=m/m'],
        traps: [{ checks: ['18/9', 'n=2'], mistakeType: 'wrong_understanding',
          note: R`Moles are mass divided by molar mass, \(n = m/M\), not the other way round.` }],
        hint: 'Moles = ? / ?' },
    ],
  },
  {
    id: 'sample_c_mole_2',
    chapterId: 'chemistry_mole_concept',
    prompt: R`\(2\ \text{g}\) of \(\mathrm{H_2}\) is mixed with \(32\ \text{g}\) of \(\mathrm{O_2}\) and reacted: \(2\mathrm{H_2} + \mathrm{O_2} \rightarrow 2\mathrm{H_2O}\). What mass of water forms?`,
    options: ['18 g', '36 g', '34 g', '9 g'],
    answerIndex: 0,
    finalAnswer: '18 g (option 1)',
    answerChecks: ['18g', '=18'],
    difficulty: 3,
    steps: [
      { text: R`\(n(\mathrm{H_2}) = 2/2 = 1\ \text{mol}\), \(n(\mathrm{O_2}) = 32/32 = 1\ \text{mol}\).`, conceptIds: ['c_mole'],
        checks: ['2/2', 'h2=1', '1molh2', '1molofh2', 'n(h2)=1'], hint: 'Convert both masses to moles first.' },
      { text: R`1 mol \(\mathrm{H_2}\) needs only 0.5 mol \(\mathrm{O_2}\), so \(\mathrm{H_2}\) is the limiting reagent.`, conceptIds: ['c_limiting_reagent', 'c_stoichiometry'],
        checks: ['h2islimiting', 'h2limiting', 'limitingreagentish2', 'limitingish2', 'h2isthelimiting', '0.5molo2', 'o2inexcess', 'o2isinexcess'],
        traps: [
          { checks: ['o2islimiting', 'o2limiting', 'limitingiso2'], mistakeType: 'wrong_understanding',
            note: R`Compare with the 2 : 1 ratio — 1 mol \(\mathrm{H_2}\) only needs 0.5 mol \(\mathrm{O_2}\), so oxygen is in excess.` },
          { checks: ['36g', '=36', '34g', '=34'], mistakeType: 'conceptual_gap',
            note: 'Not all of the mixture reacts — find which reactant runs out first.' },
        ],
        hint: 'Which reactant runs out first, given the 2 : 1 ratio?' },
      { text: R`Water formed = 1 mol = \(18\ \text{g}\).`, conceptIds: ['c_stoichiometry'],
        checks: ['1molh2o', '1molwater', '1*18'], hint: 'How many moles of water come from 1 mol of H₂?' },
    ],
  },
  {
    id: 'sample_c_atom_1',
    chapterId: 'chemistry_atomic_structure',
    prompt: R`The energy of the electron in the first Bohr orbit of hydrogen is \(-13.6\ \text{eV}\). What is its energy in the \(n = 2\) orbit?`,
    options: [R`\(-3.4\ \text{eV}\)`, R`\(-6.8\ \text{eV}\)`, R`\(-13.6\ \text{eV}\)`, R`\(-1.51\ \text{eV}\)`],
    answerIndex: 0,
    finalAnswer: R`-3.4\ \text{eV} (option 1)`,
    answerChecks: ['-3.4', '3.4'],
    difficulty: 1,
    steps: [
      { text: R`\(E_n = -\frac{13.6}{n^2} = -\frac{13.6}{4}\).`, conceptIds: ['c_bohr_energy'],
        checks: ['13.6/n^2', '13.6/4', '13.6/2^2', '13.6/(2^2)'],
        traps: [{ checks: ['13.6/2', '-6.8', '6.8'], mistakeType: 'conceptual_gap',
          note: R`Energy scales as \(1/n^2\), not \(1/n\).` }],
        hint: 'How does Bohr energy depend on n?' },
    ],
  },
  {
    id: 'sample_c_atom_2',
    chapterId: 'chemistry_atomic_structure',
    prompt: R`An electron in a sample of hydrogen atoms falls from \(n = 4\) to the ground state through every possible route. How many distinct spectral lines can appear? (Enter an integer.)`,
    finalAnswer: '6',
    answerChecks: ['6'],
    difficulty: 2,
    steps: [
      { text: R`Number of lines \(= \frac{n(n-1)}{2} = \frac{4 \times 3}{2}\).`, conceptIds: ['c_spectral_lines'],
        checks: ['n(n-1)/2', '4*3/2', '4(3)/2', '4(4-1)/2', '3+2+1'],
        traps: [{ checks: ['n-1', '=3', '3lines'], mistakeType: 'wrong_understanding',
          note: 'Count every pair of levels (4→3, 4→2, 4→1, 3→2, 3→1, 2→1), not just one jump per level.' }],
        hint: 'Each pair of levels can produce one line. How many pairs are there?' },
    ],
  },
  {
    id: 'sample_c_atom_3',
    chapterId: 'chemistry_atomic_structure',
    prompt: R`What is the maximum number of electrons that can be accommodated in the shell with \(n = 3\)? (Enter an integer.)`,
    finalAnswer: '18',
    answerChecks: ['18'],
    difficulty: 1,
    steps: [
      { text: R`Capacity \(= 2n^2 = 2(3)^2\).`, conceptIds: ['c_quantum_numbers'],
        checks: ['2n^2', '2(3)^2', '2*9', '2*3^2', '2+6+10'],
        traps: [{ checks: ['n^2=9', '=9', '9electrons'], mistakeType: 'conceptual_gap',
          note: R`\(n^2\) counts orbitals; each orbital holds two electrons (opposite spins), so \(2n^2\).` }],
        hint: 'How many orbitals, and how many electrons per orbital?' },
    ],
  },
  {
    id: 'sample_c_eq_1',
    chapterId: 'chemistry_equilibrium',
    prompt: R`Find the pH of a \(0.001\ \text{M}\) aqueous HCl solution at \(25^\circ\text{C}\).`,
    options: ['3', '11', '1', '0.001'],
    answerIndex: 0,
    finalAnswer: '3 (option 1)',
    answerChecks: ['3'],
    difficulty: 1,
    steps: [
      { text: R`HCl is a strong acid: \([\mathrm{H^+}] = 10^{-3}\ \text{M}\).`, conceptIds: ['c_ph'],
        checks: ['10^-3', '10^(-3)', '1e-3', '[h+]=0.001', 'h+=0.001'], hint: 'How much of a strong acid dissociates?' },
      { text: R`\(\mathrm{pH} = -\log(10^{-3}) = 3\).`, conceptIds: ['c_ph'],
        checks: ['-log', 'log(10^-3)', 'ph=3'],
        traps: [{ checks: ['ph=11', '14-3'], mistakeType: 'wrong_understanding',
          note: 'For an acid, pH comes straight from [H⁺]; subtracting from 14 gives the pH of a base.' }],
        hint: 'pH is minus the log of what?' },
    ],
  },
  {
    id: 'sample_c_eq_2',
    chapterId: 'chemistry_equilibrium',
    prompt: R`For the exothermic equilibrium \(\mathrm{N_2(g) + 3H_2(g) \rightleftharpoons 2NH_3(g)}\), which change shifts the equilibrium towards \(\mathrm{NH_3}\)?`,
    options: ['Increasing the pressure', 'Increasing the temperature', 'Removing some N₂', 'Adding an inert gas at constant volume'],
    answerIndex: 0,
    finalAnswer: 'Increasing the pressure (option 1)',
    answerChecks: ['pressure'],
    difficulty: 2,
    steps: [
      { text: 'Gas moles fall from 4 (left) to 2 (right).', conceptIds: ['c_le_chatelier'],
        checks: ['4moles', '4->2', '4→2', '4to2', 'fewermoles', 'lessmoles', 'fewergas', '4:2'], hint: 'Count gas moles on each side.' },
      { text: 'Raising pressure favours the side with fewer gas moles, i.e. NH₃.', conceptIds: ['c_le_chatelier'],
        checks: ['pressure'],
        traps: [{ checks: ['increasetemperature', 'increasingtemperature', 'heatit', 'raisetemperature'], mistakeType: 'wrong_understanding',
          note: 'The forward reaction releases heat, so heating pushes the equilibrium backwards.' }],
        hint: 'Which side does a system favour when it is squeezed?' },
    ],
  },
];

function buildQuestion(seed: QuestionSeed): QuestionNode {
  const conceptIds = Array.from(new Set(seed.steps.flatMap((step) => step.conceptIds)));
  const conceptById = new Map(CONCEPTS.map((concept) => [concept.id, concept]));
  const prereqIds = Array.from(new Set([
    ...conceptIds,
    ...conceptIds.flatMap((id) => conceptById.get(id)?.prereqIds ?? []),
  ]));
  return {
    id: seed.id,
    source: 'AdvancedLearning original sample',
    prompt: seed.prompt,
    options: seed.options,
    answerIndex: seed.answerIndex,
    answerChecks: seed.answerChecks,
    subject: SUBJECT_BY_CHAPTER[seed.chapterId],
    chapterId: seed.chapterId,
    conceptIds,
    prereqIds,
    canonicalSteps: seed.steps.map((step, index) => ({ ...step, id: `${seed.id}_step_${index + 1}` })),
    finalAnswer: seed.finalAnswer,
    answerType: seed.options ? 'choice' : 'integer',
    difficulty: seed.difficulty,
    mode: 'build',
    examFeel: 0.8,
    estimatedTimeSeconds: seed.estimatedTimeSeconds ?? 120,
  };
}

const QUESTIONS: QuestionNode[] = QUESTION_SEEDS.map(buildQuestion);

function buildEdges(): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const concept of CONCEPTS) {
    for (const prereqId of concept.prereqIds) {
      edges.push({ from: prereqId, to: concept.id, kind: 'prereq', weight: 1 });
    }
  }
  const seen = new Set(edges.map((edge) => `${edge.from}|${edge.to}`));
  for (const question of QUESTIONS) {
    const ids = [...question.conceptIds].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: ids[i], to: ids[j], kind: 'co_occurs', weight: 0.25 });
      }
    }
  }
  return edges;
}

export const SAMPLE_GRAPH: GraphData = {
  version: 'sample_v1',
  generatedAt: '2026-11-15T00:00:00.000Z',
  source: 'sample',
  chapters: CHAPTERS,
  concepts: CONCEPTS,
  questions: QUESTIONS,
  edges: buildEdges(),
};
