export type Payer = 'Platform' | 'Product'

export type Workflow = {
  id: string
  name: string
  payer: Payer
  production: number
  eval: number
  verify: number
  other: number
  /** Spend billed with no purpose set. */
  unset: number
  total: number
  /** Production as a percent of the workflow's own spend; 0 when it spent nothing. */
  share: number
}

type Seed = {
  name: string
  payer: Payer
  weights: readonly [number, number, number, number, number]
  base: number
}

const SEEDS: readonly Seed[] = [
  { name: 'support-triage', payer: 'Product', weights: [1, 0.08, 0.05, 0.02, 0], base: 4200 },
  { name: 'doc-summarise', payer: 'Product', weights: [1, 0.2, 0.1, 0.03, 0], base: 2900 },
  { name: 'code-review-assist', payer: 'Platform', weights: [0.5, 0.5, 0.6, 0.05, 0], base: 2300 },
  { name: 'nightly-regression-evals', payer: 'Platform', weights: [0, 1, 0.1, 0, 0], base: 1900 },
  { name: 'search-rerank', payer: 'Product', weights: [1, 0.1, 0.05, 0, 0], base: 1700 },
  { name: 'onboarding-chat', payer: 'Product', weights: [1, 0.15, 0.1, 0.05, 0], base: 1300 },
  { name: 'answer-verifier', payer: 'Platform', weights: [0.05, 0.1, 1, 0, 0], base: 1100 },
  { name: 'prompt-playground', payer: 'Platform', weights: [0, 0, 0, 0.3, 1], base: 800 },
  { name: 'invoice-extraction', payer: 'Product', weights: [1, 0.05, 0.2, 0, 0], base: 640 },
  { name: 'adhoc-notebooks', payer: 'Platform', weights: [0, 0, 0, 0.2, 1], base: 420 },
  { name: 'translation-batch', payer: 'Product', weights: [1, 0.05, 0, 0, 0.1], base: 210 },
  {
    name: 'new-experiment-with-a-very-long-workflow-name',
    payer: 'Platform',
    weights: [0, 0, 0, 0, 0],
    base: 0,
  },
]

/** Deterministic: the same fixture on every shot. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cents = (n: number): number => Math.round(n * 100) / 100

function build(seeds: readonly Seed[], scale: (i: number) => number): readonly Workflow[] {
  const rand = seeded(2411)
  return seeds
    .map((seed, i): Workflow => {
      const at = (k: number): number =>
        cents((seed.weights[k] ?? 0) * seed.base * scale(i) * (0.85 + rand() * 0.3))
      const [production, evalSpend, verify, other, unset] = [at(0), at(1), at(2), at(3), at(4)]
      const total = cents(production + evalSpend + verify + other + unset)
      return {
        id: `wf-${i}`,
        name: seed.name,
        payer: seed.payer,
        production,
        eval: evalSpend,
        verify,
        other,
        unset,
        total,
        share: total === 0 ? 0 : (production / total) * 100,
      }
    })
    .toSorted((a, b) => b.total - a.total)
}

/** Default: a mixed month; one workflow bills nothing, two have no purpose set. */
const SPEND_30D = build(SEEDS, () => 1)

/** `zero`: every workflow bills evals and verification only, production is $0. */
const ZERO_SEEDS = SEEDS.map((s) => ({
  ...s,
  weights: [
    0,
    s.weights[1] + 0.1,
    s.weights[2] + 0.1,
    s.weights[3],
    s.weights[4],
  ] as Seed['weights'],
}))
const SPEND_NO_PRODUCTION = build(ZERO_SEEDS, () => 1)

/** `extreme`: one production workflow spends about forty times the median. */
const SPEND_EXTREME = build(SEEDS, (i) => (i === 0 ? 40 : 1))

export function fixtureRows(name: string | undefined): readonly Workflow[] {
  if (name === 'zero') return SPEND_NO_PRODUCTION
  if (name === 'extreme') return SPEND_EXTREME
  return SPEND_30D
}
