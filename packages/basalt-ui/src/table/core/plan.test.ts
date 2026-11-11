/**
 * The plan is pure and total (concept section 5): generated column sets place every column in
 * exactly one place, the caps hold, priority demotion follows declaration order, and the tier
 * thresholds come from kind widths.
 */
import { describe, expect, test } from 'bun:test'
import { col, specOf } from './kinds'
import { KIND_DEFAULTS } from './kinds-spec'
import type { CardPlace, KindName } from './kinds-spec'
import { FULL_AT_STEPS, SLOT_CAPS, planInputs, planTable, widthPx } from './plan'
import type { PlanInput } from './plan'

const KINDS = Object.keys(KIND_DEFAULTS) as KindName[]
const PLACES: readonly CardPlace[] = [
  'title',
  'subtitle',
  'badge',
  'value',
  'meta',
  'edit',
  'detail',
  'hidden',
  'kebab',
]
const quiet = { warn: () => {} }

/** Mulberry32: a seeded generator, so a failing set reproduces from its seed. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generate(seed: number): { inputs: PlanInput[]; visibility: Record<string, boolean> } {
  const next = rng(seed)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!
  const count = 1 + Math.floor(next() * 16)
  const inputs: PlanInput[] = []
  const visibility: Record<string, boolean> = {}
  for (let i = 0; i < count; i += 1) {
    const kind = pick(KINDS)
    const d = KIND_DEFAULTS[kind]
    const declared = pick([
      'title',
      'subtitle',
      'badge',
      'value',
      'meta',
      'edit',
      'detail',
      'hidden',
    ] as const)
    const card =
      kind === 'custom'
        ? [declared]
        : next() < 0.2 && kind !== 'actions'
          ? [declared, ...d.card]
          : d.card
    const priority =
      kind === 'actions'
        ? null
        : kind === 'custom' || next() < 0.3
          ? pick([1, 2, 3] as const)
          : d.priority
    const id = `c${i}`
    inputs.push({
      id,
      kind,
      card,
      priority,
      width: d.width,
      pin: kind === 'actions' ? 'end' : null,
    })
    if (next() < 0.15) visibility[id] = false
  }
  return { inputs, visibility }
}

describe('plan totality', () => {
  test('500 generated sets: every column lands in exactly one place and the caps hold', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const { inputs, visibility } = generate(seed)
      const plan = planInputs(inputs, { visibility, ...quiet })
      expect(plan.columns.map((c) => c.id)).toEqual(inputs.map((c) => c.id))
      const counts = new Map<CardPlace, number>()
      for (const column of plan.columns) {
        expect(PLACES).toContain(column.place)
        counts.set(column.place, (counts.get(column.place) ?? 0) + 1)
        if (!column.visible) expect(column.place).toBe('hidden')
        if (column.kind === 'actions' && column.visible) expect(column.place).toBe('kebab')
      }
      for (const [place, cap] of Object.entries(SLOT_CAPS)) {
        expect(counts.get(place as CardPlace) ?? 0).toBeLessThanOrEqual(cap)
      }
      const hasDataColumn = inputs.some((c) => c.kind !== 'actions')
      expect(counts.get('title') ?? 0).toBe(hasDataColumn ? 1 : 0)
      const ones = plan.columns.filter((c) => c.priority === 1)
      expect(ones.length).toBeLessThanOrEqual(2)
      expect(plan.fullAt === null || FULL_AT_STEPS.includes(plan.fullAt)).toBe(true)
      expect(planInputs(inputs, { visibility, ...quiet })).toEqual(plan)
    }
  })

  test('the identity column is the first entity, else the first data column; it is pinned start and cannot hide', () => {
    const plan = planInputs(
      [
        {
          id: 'n',
          kind: 'number',
          card: ['value'],
          priority: 2,
          width: { ch: 10, flex: false },
          pin: null,
        },
        {
          id: 'e',
          kind: 'entity',
          card: ['title'],
          priority: 1,
          width: { ch: 18, flex: true },
          pin: null,
        },
      ],
      { visibility: { e: false }, ...quiet },
    )
    expect(plan.columns.find((c) => c.identity)).toMatchObject({
      id: 'e',
      place: 'title',
      pin: 'start',
      visible: true,
    })
    const promoted = planInputs(
      [
        { id: 'a', kind: 'actions', card: ['kebab'], priority: null, width: 'icon', pin: 'end' },
        {
          id: 't',
          kind: 'text',
          card: ['subtitle'],
          priority: 2,
          width: { ch: 16, flex: true },
          pin: null,
        },
      ],
      quiet,
    )
    expect(promoted.columns.map((c) => [c.id, c.place, c.priority])).toEqual([
      ['a', 'kebab', null],
      ['t', 'title', 1],
    ])
  })
})

type Booking = {
  payee: string
  amount: number
  fee: number
  tax: number
  note: string
  state: string
}
const c = col<Booking>()

describe('card plan', () => {
  test('entity plus 2 money: the second money demotes to priority 2 and falls to meta', () => {
    const warnings: string[] = []
    const plan = planTable(
      [
        c.entity('payee'),
        c.money('amount', { currency: 'EUR' }),
        c.money('fee', { currency: 'EUR' }),
        c.money('tax', { currency: 'EUR' }),
      ],
      { warn: (m) => warnings.push(m) },
    )
    expect(plan.columns.map((x) => [x.id, x.place, x.priority])).toEqual([
      ['payee', 'title', 1],
      ['amount', 'value', 1],
      ['fee', 'meta', 2],
      ['tax', 'meta', 2],
    ])
    expect(plan.demoted).toEqual(['fee', 'tax'])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('fee, tax')
  })

  test('identity keeps priority 1 even when two other priority-1 columns are declared before it', () => {
    const plan = planTable(
      [
        c.money('amount', { currency: 'EUR' }),
        c.money('fee', { currency: 'EUR' }),
        c.entity('payee'),
      ],
      quiet,
    )
    expect(plan.columns.map((x) => [x.id, x.priority])).toEqual([
      ['amount', 1],
      ['fee', 2],
      ['payee', 1],
    ])
  })

  test('slots per kind: text subtitle, status badge, overflowed edit to detail', () => {
    const select = (id: 'note' | 'state' | 'payee') =>
      c.select(id, { label: () => id, options: ['a'], commit: () => {} })
    const plan = planTable(
      [
        c.entity('payee'),
        c.text('note'),
        c.status('state', { options: ['Open'] }),
        select('note'),
        select('state'),
        select('payee'),
      ],
      quiet,
    )
    expect(plan.columns.map((x) => x.place)).toEqual([
      'title',
      'subtitle',
      'badge',
      'edit',
      'edit',
      'detail',
    ])
  })

  test('more than six meta columns overflow to detail', () => {
    const dates = Array.from({ length: 8 }, (_, i) => c.date('note', { id: `d${i}` }))
    const plan = planTable([c.entity('payee'), ...dates], quiet)
    const places = plan.columns.map((x) => x.place)
    expect(places.filter((p) => p === 'meta')).toHaveLength(6)
    expect(places.slice(-2)).toEqual(['detail', 'detail'])
  })

  test('a hidden column is hidden in the card and out of the width sums', () => {
    const columns = [c.entity('payee'), c.text('note'), c.money('amount', { currency: 'EUR' })]
    const all = planTable(columns, quiet)
    const hidden = planTable(columns, { visibility: { note: false }, ...quiet })
    expect(hidden.columns[1]?.place).toBe('hidden')
    expect(hidden.columns[2]?.place).toBe('value')
    expect(all.columns.map((x) => x.widthPx)).toEqual(hidden.columns.map((x) => x.widthPx))
  })
})

describe('tiers', () => {
  const at = (ch: number, priority: 1 | 2 | 3 = 2, kind: KindName = 'number'): PlanInput => ({
    id: `x${ch}-${Math.random()}`,
    kind,
    card: ['meta'],
    priority,
    width: { ch, flex: false },
    pin: null,
  })

  test('fullAt is the smallest step the visible widths fit; above 1800 stays reduced with a warning', () => {
    expect(planInputs([at(10)], quiet).fullAt).toBe(800)
    // 10 columns of 12ch: 10 * (96 + 24) = 1200
    expect(
      planInputs(
        Array.from({ length: 10 }, () => at(12, 3)),
        quiet,
      ).fullAt,
    ).toBe(1200)
    expect(
      planInputs(
        Array.from({ length: 11 }, () => at(12, 3)),
        quiet,
      ).fullAt,
    ).toBe(1440)
    const warnings: string[] = []
    const wide = planInputs(
      Array.from({ length: 20 }, () => at(12, 3)),
      { warn: (m) => warnings.push(m) },
    )
    expect(wide.fullAt).toBeNull()
    expect(warnings.some((w) => w.includes('above 1800'))).toBe(true)
  })

  test('priority 1+2 above 480 px moves the card threshold to 800; above 800 trailing priority 2 demote', () => {
    expect(planInputs([at(10, 1, 'entity'), at(10)], quiet).reducedFrom).toBe(480)
    const five = Array.from({ length: 5 }, () => at(12))
    expect(planInputs([at(18, 1, 'entity'), ...five], quiet).reducedFrom).toBe(800)
    const nine = Array.from({ length: 9 }, () => at(12))
    const plan = planInputs([at(18, 1, 'entity'), ...nine], quiet)
    const core = plan.columns.filter((x) => x.priority !== 3).reduce((s, x) => s + x.widthPx, 0)
    expect(core).toBeLessThanOrEqual(800)
    const demotedTo3 = plan.columns.filter((x) => x.priority === 3).map((x) => x.id)
    expect(demotedTo3).toEqual(plan.columns.slice(-demotedTo3.length).map((x) => x.id))
  })

  test('widths are ch estimates plus padding; the icon column is a hit floor', () => {
    expect(widthPx({ ch: 10, flex: false })).toBe(104)
    expect(widthPx('icon')).toBe(44)
    expect(specOf(c.money('amount', { currency: 'EUR' })).width).toEqual({ ch: 12, flex: false })
  })
})
