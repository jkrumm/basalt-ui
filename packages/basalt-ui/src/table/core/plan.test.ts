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

describe('cardDetail', () => {
  const input = (id: string, card: PlanInput['card'], cardFirst: boolean): PlanInput => ({
    id,
    kind: 'text',
    card,
    ...(cardFirst && { cardFirst }),
    priority: 2,
    width: { ch: 12, flex: false },
    pin: null,
  })

  test('a column that overflows its named slot is in the detail without asking for it', () => {
    const inputs = [
      input('name', ['title'], false),
      ...Array.from({ length: 7 }, (_, i) => input(`m${i}`, ['meta', 'detail'], true)),
      input('asked', ['detail', 'meta'], true),
    ]
    const plan = planInputs(inputs, quiet)
    const left = plan.columns.filter((p) => p.place === 'detail' && !p.cardDetail).map((p) => p.id)
    expect(left).toEqual(['m6'])
    expect(plan.columns.find((p) => p.id === 'asked')).toMatchObject({
      place: 'detail',
      cardDetail: true,
    })
  })
})

describe('phoneKeep', () => {
  test("keeps the identity, the card's value, its first meta and the actions", () => {
    const c = col<{ id: string; name: string; a: number; b: number; c: number }>()
    const plan = planTable(
      [
        c.number('a', { header: 'A' }),
        c.entity('name', { header: 'Name' }),
        c.number('b', { header: 'B', card: 'value' }),
        c.number('c', { header: 'C', card: 'meta' }),
      ],
      quiet,
    )
    const kept = Object.fromEntries(plan.columns.map((p) => [p.id, p.phoneKeep]))
    expect(kept).toEqual({ a: true, name: true, b: true, c: false })
  })
})

describe('a column that draws a mark keeps its card place', () => {
  type R = { id: string; name: string; a: number; b: number; c: number; used: number }
  const c = col<R>()
  const base = [
    c.entity('name'),
    c.number('a', { header: 'A' }),
    c.number('b', { header: 'B' }),
    c.number('c', { header: 'C' }),
    c.meter('used', { max: 100 }),
  ]

  test('a meter beside three numbers is a meta column of the card', () => {
    const plan = planTable(base, quiet)
    expect(plan.columns.find((p) => p.id === 'used')?.place).toBe('meta')
  })

  test('it is placed ahead of plain numbers when the meta slots run out', () => {
    const numbers = Array.from({ length: 8 }, (_, i) =>
      c.number('a', { header: `N${i}`, id: `n${i}`, card: 'meta' }),
    )
    const plan = planTable([c.entity('name'), ...numbers, c.meter('used', { max: 100 })], quiet)
    expect(plan.columns.find((p) => p.id === 'used')?.place).toBe('detail')
    const named = planTable(
      [c.entity('name'), ...numbers.slice(0, 5), c.meter('used', { max: 100 })],
      quiet,
    )
    expect(named.columns.find((p) => p.id === 'used')?.place).toBe('meta')
  })

  test('with the meta slots filled by unnamed numbers the meter still takes a place before them', () => {
    const numbers = Array.from({ length: 8 }, (_, i) =>
      c.number('a', { header: `N${i}`, id: `n${i}` }),
    )
    const plan = planTable([c.entity('name'), ...numbers, c.meter('used', { max: 100 })], quiet)
    // meta holds six: the meter, declared last, is placed before the numbers that come first
    expect(plan.columns.find((p) => p.id === 'used')?.place).toBe('meta')
    expect(plan.columns.filter((p) => p.place === 'meta').length).toBeLessThanOrEqual(6)
  })

  test("phone: 'columns' keeps the meter as its one meta column", () => {
    const kept = planTable(base, quiet)
      .columns.filter((p) => p.phoneKeep)
      .map((p) => p.id)
    expect(kept).toEqual(['name', 'a', 'used'])
  })

  test('a caller-named slot still wins', () => {
    const plan = planTable(
      [c.entity('name'), c.meter('used', { max: 100, card: 'detail' }), c.number('a')],
      quiet,
    )
    expect(plan.columns.find((p) => p.id === 'used')).toMatchObject({
      place: 'detail',
      cardDetail: true,
    })
  })
})

describe('the free width', () => {
  type R = { id: string; name: string; note: string; a: number }
  const c = col<R>()
  const columns = [c.entity('name'), c.text('note'), c.number('a')]

  test('a flexible column of the reading look has no cap', () => {
    const plan = planTable(columns, quiet)
    expect(plan.columns.filter((p) => p.flex).map((p) => p.capPx)).toEqual([null, null])
  })

  test('a column sized to its content keeps its cap in the reading look', () => {
    const plan = planTable(
      [c.entity('name', { width: 'content' }), c.text('note'), c.number('a')],
      {
        ...quiet,
        contentCh: { name: 12 },
      },
    )
    const [name, note] = plan.columns
    expect(name?.capPx).not.toBeNull()
    expect(note?.capPx).toBeNull()
  })

  test('the grid look keeps the cap of its kind', () => {
    const plan = planTable(columns, { ...quiet, look: 'grid' })
    expect(plan.columns.filter((p) => p.flex).every((p) => p.capPx !== null)).toBe(true)
  })
})

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

  test('the windows table of a 750 px cell (696 px, priority 1+2 at 560 px) keeps priority 3 in 718 px', () => {
    // 168 (flexible title, 18ch) + 120 + 136 + 136 + 136 (the priority 3 ratio) = 696, under the 700 step
    const plan = planInputs(
      [at(18, 1, 'entity'), at(12, 1), at(14, 2), at(14, 2), at(14, 3)],
      quiet,
    )
    expect(plan.reducedFrom).toBe(700)
    expect(plan.fullAt).toBe(700)
  })

  test('fullAt is the smallest step the visible widths fit; above 1800 stays reduced with a warning', () => {
    expect(planInputs([at(10)], quiet).fullAt).toBe(480)
    // a 748 px cell: five columns of 664 px keep every column (the next step up used to be 800)
    expect(
      planInputs([at(18, 1, 'entity'), at(14), at(10), at(10, 3), at(16, 3)], quiet).fullAt,
    ).toBe(680)
    // never below the card threshold: priority 1+2 of 504 px (reducedFrom 700) with one 3 of 32 px
    expect(planInputs([at(18, 1, 'entity'), at(18), at(18), at(1, 3)], quiet).fullAt).toBe(700)
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
    // the header "Amount (EUR)" is 12 characters; its floor adds the icon (3 ch) and one state mark (2 ch)
    expect(specOf(c.money('amount', { currency: 'EUR' })).width).toEqual({ ch: 17, flex: false })
    // "Total (EUR)" is 11 characters: 11 + 5 = 16
    expect(specOf(c.money('fee', { header: 'Total', currency: 'EUR' })).width).toEqual({
      ch: 16,
      flex: false,
    })
    expect(specOf(c.number('tax', { header: 'Q' })).width).toEqual({ ch: 10, flex: false })
  })
})
