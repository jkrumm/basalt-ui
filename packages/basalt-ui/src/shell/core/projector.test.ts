/**
 * The projector: rail rows, section folds, block rows, badge rollups and the attention assertion,
 * plus the seeded property test of the phone rows (invariant 14: never two `aria-current`).
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { Mock } from 'bun:test'
import { badgeTone, isLit, rollupBadges } from './badges'
import type { CoreBlock } from './block-model'
import { projectMobileNav } from './mobile-projection'
import type { PhoneRow } from './mobile-projection'
import { createNavRuntimeDouble } from './nav-runtime'
import { createProjector, projectRail } from './projector'
import type { RailRow } from './projector'
import type { BadgeMap, CoreNavConfig, CoreNavItem, CoreNavSection } from './types'

const NO_STATE = { activeId: undefined, ancestorIds: new Set<string>() }
const item = (id: string, extra: Partial<CoreNavItem> = {}): CoreNavItem => ({
  id,
  label: id,
  ...extra,
})

const NAV: CoreNavConfig = {
  sections: [
    {
      id: 'training',
      label: 'Training',
      collapsible: true,
      items: [item('overview'), item('finance', { children: [item('month')] }), item('jobs')],
    },
    {
      id: 'admin',
      label: 'Admin',
      collapsible: true,
      defaultCollapsed: true,
      items: [item('users')],
    },
    { id: 'static', label: 'Static', defaultCollapsed: true, items: [item('about')] },
  ],
  pinned: [item('settings')],
}

describe('rollupBadges', () => {
  test('counts sum, dots alone give a dot, nothing lit gives null', () => {
    expect(rollupBadges([{ count: 2 }, { count: 3 }])).toEqual({ count: 5 })
    expect(rollupBadges([{ dot: true }, null, undefined])).toEqual({ dot: true })
    expect(rollupBadges([{ dot: true }, { count: 1 }])).toEqual({ count: 1 })
    expect(rollupBadges([{ count: 0 }, null])).toBeNull()
    expect(rollupBadges([])).toBeNull()
  })

  test('attention survives the rollup as the one warn colour; an unlit attention badge does not', () => {
    const rolled = rollupBadges([
      { count: 2, attention: true },
      { count: 1, attention: true },
      { dot: true },
    ])
    expect(rolled).toEqual({ count: 3, attention: true })
    expect(badgeTone(rolled)).toBe('warn')
    expect(rollupBadges([{ count: 0, attention: true }, { count: 1 }])).toEqual({ count: 1 })
    expect(badgeTone({ count: 0, attention: true })).toBe('neutral')
    expect(isLit({ count: 0 })).toBe(false)
  })
})

describe('projectRail', () => {
  test('rows hold the declared item, carry depth, and exactly one is active', () => {
    const runtime = createNavRuntimeDouble(NAV, 'month', ['finance'])
    const rail = projectRail({ nav: runtime.nav, state: runtime.getState() })
    const finance = rail.sections[0]?.rows[1]
    expect(finance?.item).toBe(NAV.sections[0]!.items[1]!)
    expect(finance?.ancestor).toBe(true)
    expect(finance?.active).toBe(false)
    expect(finance?.children[0]?.active).toBe(true)
    expect(finance?.children[0]?.depth).toBe(1)
    expect(rail.sections[0]?.containsActive).toBe(true)
    expect(rail.sections[1]?.containsActive).toBe(false)
    expect(rail.pinned.map((row) => row.id)).toEqual(['settings'])
  })

  test('section fold is keyed by section id, seeded by defaultCollapsed, false when not collapsible', () => {
    const rail = projectRail({ nav: NAV, state: NO_STATE, folds: { training: true } })
    expect(rail.sections.map((s) => [s.foldKey, s.folded])).toEqual([
      ['sidebar-section:training', true],
      ['sidebar-section:admin', true],
      ['sidebar-section:static', false],
    ])
    const unfolded = projectRail({ nav: NAV, state: NO_STATE, folds: { admin: false } })
    expect(unfolded.sections[1]?.folded).toBe(false)
  })

  test('badges: a row rolls up its children, a section its rows; the tone follows attention', () => {
    const badges: BadgeMap = {
      finance: { count: 2 },
      month: { count: 1, attention: true },
      jobs: { dot: true },
    }
    const rail = projectRail({ nav: NAV, state: NO_STATE, badges })
    const [overview, finance, jobs] = rail.sections[0]!.rows
    expect(overview?.rollup).toBeNull()
    expect(finance?.badge).toEqual({ count: 2 })
    expect(finance?.rollup).toEqual({ count: 3, attention: true })
    expect(finance?.tone).toBe('warn')
    expect(jobs?.rollup).toEqual({ dot: true })
    expect(rail.sections[0]?.rollup).toEqual({ count: 3, attention: true })
    expect(rail.sections[1]?.rollup).toBeNull()
  })

  test('blocks split by placement and carry their rail form, fold key and visible count', () => {
    const blocks: CoreBlock[] = [
      {
        kind: 'list',
        id: 'awaiting',
        label: 'Awaiting',
        icon: () => null,
        count: 2,
        max: 1,
        items: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      },
      { kind: 'progress', id: 'quota', label: 'Quota', value: 0.7 },
      { kind: 'custom', id: 'tree', mobile: { label: 'Library', icon: () => null } },
    ]
    const rail = projectRail({ nav: NAV, state: NO_STATE, blocks })
    expect(rail.blocks.nav.map((b) => [b.id, b.rail, b.mobile, b.visibleCount])).toEqual([
      ['awaiting', 'dot', 'more', 1],
      ['tree', 'icon', 'more', undefined],
    ])
    expect(rail.blocks.bottom.map((b) => [b.id, b.rail, b.foldKey])).toEqual([
      ['quota', 'ring', 'sidebar-block:quota'],
    ])
  })
})

describe('createProjector: the attention assertion', () => {
  let warn: Mock<typeof console.warn>
  const warnings = (): string[] => warn.mock.calls.map((args) => args.map(String).join(' '))
  beforeEach(() => {
    warn = spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  const twoLit: BadgeMap = {
    finance: { count: 3, attention: true },
    jobs: { dot: true, attention: true },
    users: { count: 1 },
  }

  test('two attention badges lit raise the dev assertion once; the rollup shows one warn colour', () => {
    const project = createProjector()
    const first = project({ nav: NAV, state: NO_STATE, badges: twoLit })
    project({ nav: NAV, state: NO_STATE, badges: twoLit })
    project({ nav: NAV, state: NO_STATE, badges: { ...twoLit } })
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain('"finance", "jobs"')
    expect(first.rail.sections[0]?.rollup).toEqual({ count: 3, attention: true })
    expect(first.rail.sections[0]?.tone).toBe('warn')
    const tones = new Set(
      first.rail.sections.flatMap((s) => [s.tone, ...s.rows.map((r) => r.tone)]),
    )
    expect([...tones].toSorted()).toEqual(['neutral', 'warn'])
  })

  test('one lit attention badge, or two where one is unlit, raises nothing', () => {
    const project = createProjector()
    project({ nav: NAV, state: NO_STATE, badges: { finance: { count: 3, attention: true } } })
    project({
      nav: NAV,
      state: NO_STATE,
      badges: { finance: { count: 3, attention: true }, jobs: { count: 0, attention: true } },
    })
    expect(warnings()).toHaveLength(0)
  })

  test('each projector asserts on its own, and production is silent', () => {
    const calls: string[][] = []
    createProjector({ onAttentionConflict: (ids) => calls.push([...ids]) })({
      nav: NAV,
      state: NO_STATE,
      badges: twoLit,
    })
    expect(calls).toEqual([['finance', 'jobs']])

    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      createProjector()({ nav: NAV, state: NO_STATE, badges: twoLit })
    } finally {
      if (env === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = env
    }
    expect(warnings()).toHaveLength(0)
  })

  test('the projection is the rail and the phone of one input', () => {
    const runtime = createNavRuntimeDouble(NAV, 'jobs')
    const { rail, phone } = createProjector()({ nav: runtime.nav, state: runtime.getState() })
    expect(rail.sections[0]?.rows[2]?.active).toBe(true)
    expect(phone.slots.filter((s) => s.active)).toHaveLength(1)
  })
})

// ── seeded property test ─────────────────────────────────────────────────────────────────────────

/** mulberry32: a tiny seeded PRNG, so a failing case replays from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!
const MOBILE = ['tab', 'tab', 'more', 'hidden', true, false] as const

function genNav(rng: Rng): { nav: CoreNavConfig; ids: string[] } {
  let counter = 0
  const ids: string[] = []
  const genItem = (depth: number): CoreNavItem => {
    const id = `i${counter++}`
    ids.push(id)
    const children =
      depth < 2 && rng() < 0.3
        ? Array.from({ length: 1 + Math.floor(rng() * 3) }, () => genItem(depth + 1))
        : undefined
    return {
      id,
      label: id,
      ...(rng() < 0.6 && { mobile: pick(rng, MOBILE) }),
      ...(rng() < 0.1 && { disabled: true }),
      ...(children && { children }),
    }
  }
  const genItems = (): CoreNavItem[] =>
    Array.from({ length: 1 + Math.floor(rng() * 5) }, () => genItem(0))
  const sections: CoreNavSection[] = Array.from({ length: 1 + Math.floor(rng() * 4) }, (_, i) => {
    const roll = rng()
    const mobile = roll < 0.15 ? false : roll < 0.4 ? { tab: true as const } : undefined
    return {
      id: `s${i}`,
      label: `S${i}`,
      items: genItems(),
      ...(mobile !== undefined && { mobile }),
    }
  })
  const nav: CoreNavConfig = {
    sections,
    ...(rng() < 0.4 && { pinned: genItems() }),
    ...(rng() < 0.5 && {
      mobile: { maxTabs: 1 + Math.floor(rng() * 6), menuMax: 1 + Math.floor(rng() * 14) },
    }),
  }
  if (rng() < 0.2) {
    const tabs = Array.from({ length: Math.floor(rng() * 6) }, () =>
      rng() < 0.7 ? pick(rng, ids) : pick(rng, sections).id,
    )
    nav.mobile = { ...nav.mobile, tabs }
  }
  return { nav, ids }
}

function* walkRows(rows: readonly PhoneRow[]): Generator<PhoneRow> {
  for (const row of rows) {
    yield row
    yield* walkRows(row.children)
  }
}

function* walkRail(rows: readonly RailRow[]): Generator<RailRow> {
  for (const row of rows) {
    yield row
    yield* walkRail(row.children)
  }
}

describe('property: generated nav and coverage', () => {
  test('at most one phone slot and at most one phone row is current; never two aria-current', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (let seed = 1; seed <= 400; seed++) {
        const rng = mulberry32(seed)
        const { nav, ids } = genNav(rng)
        for (const activeId of [undefined, ...ids]) {
          const phone = projectMobileNav({ nav, state: { activeId, ancestorIds: new Set() } })
          const activeSlots = phone.slots.filter((slot) => slot.active)
          expect({ seed, activeId, slots: activeSlots.length <= 1 }).toEqual({
            seed,
            activeId,
            slots: true,
          })

          // Rows are what carry aria-current inside a surface; a link slot's row is the slot itself.
          const currentRows = phone.slots.flatMap((slot) =>
            slot.kind === 'link'
              ? slot.active
                ? [slot.row.id]
                : []
              : slot.groups
                  .flatMap((g) => [...walkRows(g.rows)])
                  .filter((row) => row.active)
                  .map((row) => row.id),
          )
          expect({ seed, activeId, currentRows: currentRows.length <= 1 }).toEqual({
            seed,
            activeId,
            currentRows: true,
          })
          // The current row, if any, is the active item, and only a slot covering it is lit.
          if (currentRows.length === 1) {
            expect(currentRows[0]).toBe(activeId)
            expect(activeSlots).toHaveLength(1)
          }

          const rail = projectRail({ nav, state: { activeId, ancestorIds: new Set() } })
          const railActive = [
            ...rail.sections.flatMap((s) => [...walkRail(s.rows)]),
            ...walkRail(rail.pinned),
          ].filter((r) => r.active)
          expect(railActive.length).toBe(activeId === undefined ? 0 : 1)
        }
      }
    } finally {
      warn.mockRestore()
    }
  })

  test('every visible destination stays reachable: a slot or a More row covers it', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (let seed = 1; seed <= 200; seed++) {
        const { nav } = genNav(mulberry32(seed))
        if (nav.mobile?.tabs !== undefined) continue // `tabs` may name nothing and push everything to More
        const phone = projectMobileNav({ nav, state: NO_STATE })
        const reached = new Set<string>()
        for (const slot of phone.slots) {
          if (slot.kind === 'link') reached.add(slot.row.id)
          else for (const g of slot.groups) for (const row of walkRows(g.rows)) reached.add(row.id)
        }
        const visible: string[] = []
        const visit = (items: readonly CoreNavItem[]): void => {
          for (const it of items) {
            if (it.mobile !== 'hidden' && it.mobile !== false) visible.push(it.id)
            visit(it.children ?? [])
          }
        }
        for (const s of nav.sections) if (s.mobile !== false) visit(s.items)
        visit(nav.pinned ?? [])
        for (const id of visible)
          expect({ seed, id, reached: reached.has(id) }).toEqual({ seed, id, reached: true })
      }
    } finally {
      warn.mockRestore()
    }
  })
})
