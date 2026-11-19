/** Household balances at 24 month-ends (Nov 2024 to Oct 2026), seeded so every build draws the same page. */

export type Month = {
  key: string
  at: Date
  cash: number
  depot: number
  rest: number
  /** Money paid into the depot so far; the depot's baseline. */
  paidIn: number
  /** False before the depot was opened: the depot is absent, not zero. */
  hasDepot: boolean
  /** Booked after the last statement, not read from one. */
  estimated: boolean
}

/** `default` has a cash dip and a depot drawdown; `drop` ends the year poorer; `fresh` opened its depot late and holds nothing in other accounts. */
const FIXTURES = ['default', 'drop', 'fresh'] as const
export type FixtureName = (typeof FIXTURES)[number]

const COUNT = 24

/** mulberry32: a small seeded generator, so the fixture is deterministic. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round10 = (n: number): number => Math.round(n / 10) * 10

const isFixture = (name: string | undefined): name is FixtureName =>
  FIXTURES.some((known) => known === name)

export function buildMonths(fixture: string | undefined): readonly Month[] {
  const name: FixtureName = isFixture(fixture) ? fixture : 'default'
  const noise = seeded(name === 'default' ? 14 : name === 'drop' ? 41 : 77)
  const months: Month[] = []
  let depot = name === 'fresh' ? 0 : 31000
  let paidIn = name === 'fresh' ? 0 : 29500

  for (let i = 0; i < COUNT; i++) {
    const wobble = noise() - 0.5
    const opens = name === 'fresh' && i === 15
    const hasDepot = name !== 'fresh' || i >= 15
    const contribution = opens
      ? 5000
      : !hasDepot
        ? 0
        : name === 'drop' && i >= 14
          ? 0
          : i < 12
            ? 800
            : 1200
    const growth =
      name === 'drop' && i >= 14
        ? -0.035 - wobble * 0.01
        : name === 'default' && i >= 15 && i <= 17
          ? -0.045
          : 0.006 + wobble * 0.03
    depot = hasDepot ? Math.round((depot + contribution) * (1 + (opens ? 0 : growth))) : 0
    paidIn += contribution

    const cash =
      name === 'drop'
        ? 16000 - Math.max(0, i - 8) * 800 + wobble * 1200
        : name === 'default' && i === 13
          ? 420
          : 14000 + Math.sin(i / 3.2) * 2500 + i * 180 + wobble * 1500
    const rest = name === 'fresh' ? 0 : 21000 + i * 210 + wobble * 300

    const at = new Date(Date.UTC(2024, 10 + i, 1))
    months.push({
      key: `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`,
      at,
      cash: round10(cash),
      depot,
      rest: round10(rest),
      paidIn,
      hasDepot,
      estimated: i === 9 || i >= COUNT - 2,
    })
  }
  return months
}

export const total = (m: Month): number => m.cash + m.depot + m.rest
