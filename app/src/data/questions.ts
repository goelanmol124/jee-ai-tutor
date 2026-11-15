// Mock JEE question bank with canonical step-by-step solutions
// and concept tags per step. This is what the diagnosis pipeline matches against.

export type Mode = 'diagnose' | 'build' | 'polish';

export interface CommonError {
  // Token pattern (alternates with | as in matchPatterns) that uniquely identifies a
  // common mistake at this step. If matched AND the canonical match is weak, mark broken.
  pattern: string;
  // Coach message describing the gap
  note: string;
}

export interface CanonicalStep {
  // LaTeX-friendly description of what this step says
  text: string;
  // Concept used at this step (must exist in concepts.ts)
  conceptId: string;
  // Keyword/phrase patterns the student step should contain to "match" this step.
  // Multiple alternates separated by | -- match if ANY alternate's tokens are present.
  // Tokens are AND'd within an alternate. Case-insensitive.
  matchPatterns: string[];
  // Patterns of typical wrong attempts at this step.
  commonErrors?: CommonError[];
  // A short coach hint if the student is stuck on this step
  hint: string;
  // Worked example for this specific step
  example?: string;
}

export interface Question {
  id: string;
  source: string; // e.g. "JEE Main 2024 — Shift 1"
  prompt: string; // LaTeX
  prereqConcepts: string[];
  // Multiple solution methods (§9). For demo we ship 1 main + 1 alt.
  methods: {
    id: string;
    name: string;
    steps: CanonicalStep[];
  }[];
  finalAnswer: string; // LaTeX
  difficulty: 1 | 2 | 3 | 4 | 5;
  mode: Mode;
}

// A clean, demoable derivative problem.
// Differentiate y = x^2 \sin(2x) at x = pi/4
// Canonical method: product rule + chain rule + trig values
export const DEMO_QUESTIONS: Question[] = [
  {
    id: 'q1',
    source: 'JEE Main 2024 — practice variant',
    prompt: String.raw`If \(y = x^{2}\sin(2x)\), find \(\dfrac{dy}{dx}\) at \(x = \dfrac{\pi}{4}\).`,
    prereqConcepts: ['power_rule', 'product_rule', 'chain_rule', 'trig_deriv', 'sin_cos_id'],
    finalAnswer: String.raw`\dfrac{\pi}{2}`,
    difficulty: 3,
    mode: 'build',
    methods: [
      {
        id: 'm1',
        name: 'Product rule + chain rule',
        steps: [
          {
            text: String.raw`Apply the product rule: \(\dfrac{dy}{dx} = \dfrac{d}{dx}(x^{2}) \cdot \sin(2x) + x^{2} \cdot \dfrac{d}{dx}\sin(2x)\)`,
            conceptId: 'product_rule',
            matchPatterns: [
              'product rule',
              'd/dx(x^2)|d(x^2) sin|2x sin(2x) + x^2',
              'sin(2x) + x^2',
            ],
            hint: 'Two factors of x are multiplied. Which differentiation rule combines two factors?',
            example: String.raw`If \(y = u(x)\,v(x)\) then \(y' = u'v + uv'\). Here \(u=x^{2}\), \(v=\sin 2x\).`,
          },
          {
            text: String.raw`Differentiate \(x^{2}\) using the power rule: \(\dfrac{d}{dx}(x^{2}) = 2x\)`,
            conceptId: 'power_rule',
            matchPatterns: ['2x', 'power rule', 'd/dx x^2 = 2x'],
            hint: 'Power rule: bring the exponent down, reduce by one.',
          },
          {
            text: String.raw`Differentiate \(\sin(2x)\) using the chain rule: \(\dfrac{d}{dx}\sin(2x) = 2\cos(2x)\)`,
            conceptId: 'chain_rule',
            matchPatterns: [
              'chain rule',
              '2 cos(2x)|2cos(2x)',
              'cos(2x) * 2|cos(2x)*2',
            ],
            commonErrors: [
              {
                pattern: 'd/dx sin(2x) = cos(2x)',
                note: "You wrote d/dx sin(2x) = cos(2x), but you're missing the chain-rule factor. The inner function 2x has derivative 2.",
              },
            ],
            hint: 'sin of (something other than x). The "something" is 2x — its derivative is 2. Multiply.',
            example: String.raw`\(\dfrac{d}{dx}\sin(g(x)) = \cos(g(x)) \cdot g'(x)\). Here \(g(x)=2x\), \(g'(x)=2\).`,
          },
          {
            text: String.raw`Combine: \(\dfrac{dy}{dx} = 2x\sin(2x) + 2x^{2}\cos(2x)\)`,
            conceptId: 'product_rule',
            matchPatterns: [
              '2x sin(2x) + 2x^2 cos(2x)',
              '2x sin(2x)|2xsin(2x)',
              '2x^2 cos(2x)|2x^2cos(2x)',
            ],
            hint: 'Substitute the two pieces back into the product rule expression.',
          },
          {
            text: String.raw`Substitute \(x = \dfrac{\pi}{4}\): \(\sin\!\left(\dfrac{\pi}{2}\right)=1\), \(\cos\!\left(\dfrac{\pi}{2}\right)=0\)`,
            conceptId: 'trig_deriv',
            matchPatterns: [
              'sin(pi/2) = 1|sin pi/2 = 1',
              'cos(pi/2) = 0|cos pi/2 = 0',
              'pi/4',
            ],
            hint: 'Plug x = π/4. Note 2·(π/4) = π/2 — a familiar special angle.',
          },
          {
            text: String.raw`Result: \(\dfrac{dy}{dx} = 2 \cdot \dfrac{\pi}{4} \cdot 1 + 2 \cdot \dfrac{\pi^{2}}{16} \cdot 0 = \dfrac{\pi}{2}\)`,
            conceptId: 'product_rule',
            matchPatterns: [
              'pi/2',
              'π/2',
            ],
            hint: 'Multiply through: 2·(π/4)·1 + 2·(π²/16)·0.',
          },
        ],
      },
    ],
  },
  // a couple of bonus questions for the warm-up flash cards
  {
    id: 'q2',
    source: 'JEE Main 2023',
    prompt: String.raw`Evaluate \(\displaystyle \int x \cos x \, dx\).`,
    prereqConcepts: ['int_by_parts', 'trig_deriv', 'antideriv'],
    finalAnswer: String.raw`x\sin x + \cos x + C`,
    difficulty: 2,
    mode: 'build',
    methods: [
      {
        id: 'm1',
        name: 'Integration by parts',
        steps: [
          {
            text: String.raw`Choose \(u = x\), \(dv = \cos x\,dx\). Then \(du = dx\), \(v = \sin x\).`,
            conceptId: 'int_by_parts',
            matchPatterns: ['u = x', 'dv = cos', 'integration by parts'],
            hint: 'LIATE: pick u as the algebraic factor.',
          },
          {
            text: String.raw`Apply \(\int u\,dv = uv - \int v\,du\): \(x\sin x - \int \sin x\,dx\)`,
            conceptId: 'int_by_parts',
            matchPatterns: ['x sin x - integral sin', 'uv - integral'],
            hint: 'Standard integration-by-parts identity.',
          },
          {
            text: String.raw`\(\int \sin x\,dx = -\cos x\), so result is \(x\sin x + \cos x + C\)`,
            conceptId: 'antideriv',
            matchPatterns: ['x sin x + cos x', '-cos x'],
            hint: 'Antiderivative of sin x is -cos x.',
          },
        ],
      },
    ],
  },
];

// Anki-style flash cards (for the warm-up)
export interface FlashCard {
  id: string;
  prompt: string;
  answer: string;
  conceptId: string;
  source: 'review_due' | 'recent_stumble' | 'freebie';
}

export const WARMUP_CARDS: FlashCard[] = [
  {
    id: 'fc1',
    prompt: String.raw`\(\dfrac{d}{dx}\sin(ax) = \;?\)`,
    answer: String.raw`a\cos(ax)`,
    conceptId: 'chain_rule',
    source: 'review_due',
  },
  {
    id: 'fc2',
    prompt: String.raw`\(\sin^{2}\theta + \cos^{2}\theta = \;?\)`,
    answer: String.raw`1`,
    conceptId: 'sin_cos_id',
    source: 'freebie',
  },
  {
    id: 'fc3',
    prompt: String.raw`Product rule: \(\dfrac{d}{dx}[u(x)\,v(x)] = \;?\)`,
    answer: String.raw`u'(x)\,v(x) + u(x)\,v'(x)`,
    conceptId: 'product_rule',
    source: 'recent_stumble',
  },
  {
    id: 'fc4',
    prompt: String.raw`\(\cos\!\left(\dfrac{\pi}{2}\right) = \;?\)`,
    answer: String.raw`0`,
    conceptId: 'trig_deriv',
    source: 'review_due',
  },
  {
    id: 'fc5',
    prompt: String.raw`\(\dfrac{d}{dx}(x^{n}) = \;?\)`,
    answer: String.raw`n\,x^{n-1}`,
    conceptId: 'power_rule',
    source: 'freebie',
  },
];
