/**
 * `projectMobileNav` — the slot-selection law, one test per numbered rule.
 *
 * This is the highest-value suite in the mobile-nav rewrite: every decision the bottom bar makes
 * (which destinations get a slot, which slot navigates and which raises a surface, whether that
 * surface is a menu or a sheet, what falls into More) is decided here and painted by
 * `app-mobile-nav.tsx` without a single further choice. Pinning the projection therefore pins the
 * interaction model itself, with no renderer, no DOM and no timing — a rule that regresses fails
 * as a value comparison rather than as a flaky query against a portalled dropdown.
 *
 * Two regressions in particular are what this file exists to keep dead:
 *  - a slot that raises a full surface to show ONE row (§2.2 cardinality inference), and
 *  - a `disabled` destination that is silently dropped instead of rendered disabled (rule 11).
 */
import { describe, expect, test } from 'bun:test'
import { MOBILE_MORE_KEY, blockRowCount, projectMobileNav } from './mobile-nav-model'
import type { ProjectMobileNavOptions } from './mobile-nav-model'
import {
  sidebarBlockFoldKey,
  sidebarBlockMobile,
  sidebarBlockPlacement,
  sidebarBlockRail,
  sidebarBlockVisibleCount,
  sidebarSectionFoldKey,
  slugifyLabel,
} from './sidebar-block-model'
import type {
  MobileNavGroup,
  MobileNavModel,
  MobileNavSlot,
  SidebarCustomBlock,
  SidebarItem,
  SidebarListBlock,
  SidebarProgressBlock,
} from '../nav/types'

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────

/** A destination. `icon: null` keeps the whole suite JSX-free — the model never reads the icon. */
function item(key: string, extra: Partial<SidebarItem> = {}): SidebarItem {
  return { key, label: key.toUpperCase(), icon: null, ...extra }
}

/** `n` plain destinations named `d1…dn`, the shape every cardinality case counts rows against. */
function items(n: number, extra: Partial<SidebarItem> = {}): SidebarItem[] {
  return Array.from({ length: n }, (_, i) => item(`d${i + 1}`, extra))
}

const keys = (model: MobileNavModel): string[] => model.slots.map((slot) => slot.key)
const kinds = (model: MobileNavModel): string[] => model.slots.map((slot) => slot.kind)

function slotAt(model: MobileNavModel, index: number): MobileNavSlot {
  const slot = model.slots[index]
  if (!slot) throw new Error(`expected a slot at index ${index}, got ${model.slots.length} slots`)
  return slot
}

/** The trailing More slot, asserted to exist and to be a surface (a `link` More is rule 10's
 *  collapse case and is asserted by key/kind directly where it is the point). */
function moreSlot(model: MobileNavModel): Extract<MobileNavSlot, { groups: MobileNavGroup[] }> {
  const slot = model.slots.at(-1)
  if (!slot || slot.kind === 'link') throw new Error('expected a menu/sheet More slot last')
  expect(slot.key).toBe(MOBILE_MORE_KEY)
  expect(slot.isMore).toBe(true)
  return slot
}

/** Every destination key a surface slot renders, depth-first — the reachability assertion. */
function rowKeys(groups: readonly MobileNavGroup[]): string[] {
  const out: string[] = []
  const walk = (list: readonly SidebarItem[]): void => {
    for (const row of list) {
      out.push(row.key)
      walk(row.children ?? [])
    }
  }
  for (const group of groups) walk(group.items)
  return out
}

/**
 * Runs the projection with `console.warn` captured. The DEV warnings are part of the contract
 * (rules 11 and 13 are "warn, then do the safe thing"), and swallowing them here also keeps the
 * suite's output clean — the cases below deliberately trigger them.
 */
function projectQuietly(
  sections: Parameters<typeof projectMobileNav>[0],
  opts?: ProjectMobileNavOptions,
): { model: MobileNavModel; warnings: string[] } {
  const warnings: string[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }
  try {
    return { model: projectMobileNav(sections, opts), warnings }
  } finally {
    console.warn = original
  }
}

// ── the law ──────────────────────────────────────────────────────────────────────────────────────

describe('projectMobileNav', () => {
  /** Rule 6 — the bar must be usable with the consumer having configured nothing at all. */
  test('1. zero-config fallback takes the first maxTabs-1 non-disabled top-level destinations', () => {
    const model = projectMobileNav([
      {
        label: 'Main',
        items: [
          item('a'),
          item('b', { disabled: true }),
          item('c'),
          item('d'),
          item('e'),
          item('f'),
        ],
      },
    ])

    // Four link slots (maxTabs 5 minus the More the leftovers force), the disabled one skipped.
    expect(keys(model)).toEqual(['a', 'c', 'd', 'e', MOBILE_MORE_KEY])
    expect(kinds(model)).toEqual(['link', 'link', 'link', 'link', 'menu'])
    expect(rowKeys(moreSlot(model).groups)).toEqual(['b', 'f'])
  })

  /** Rules 8-9 — nothing left over, no account, no settings: the bar fills all five slots. */
  test('2. no overflow and no extra rows yields maxTabs slots and NO More', () => {
    const model = projectMobileNav([{ label: 'Main', items: items(5, { mobile: 'tab' }) }])

    expect(model.slots).toHaveLength(5)
    expect(kinds(model)).toEqual(['link', 'link', 'link', 'link', 'link'])
    expect(keys(model)).not.toContain(MOBILE_MORE_KEY)
  })

  /** Rules 9 + 13 — the slice is what creates the overflow, and it says so in DEV. */
  test('3. six tab requests become four slots plus More, with the last two in overflow', () => {
    const { model, warnings } = projectQuietly([
      { label: 'Main', items: items(6, { mobile: 'tab' }) },
    ])

    expect(keys(model)).toEqual(['d1', 'd2', 'd3', 'd4', MOBILE_MORE_KEY])
    expect(rowKeys(moreSlot(model).groups)).toEqual(['d5', 'd6'])
    expect(warnings.some((line) => line.includes('6 slot candidates for 4'))).toBe(true)
  })

  /** Rule 5 — the one named escape hatch, and it REPLACES the declarative pass rather than
   *  reordering its result: `a` asks for a tab and still does not get one. */
  test('4. config.tabs replaces every item placement and preserves the given order', () => {
    const model = projectMobileNav(
      [
        {
          label: 'Main',
          items: [item('a', { mobile: 'tab' }), item('b', { mobile: 'tab' }), item('c'), item('d')],
        },
      ],
      { config: { tabs: ['d', 'b'] } },
    )

    expect(keys(model)).toEqual(['d', 'b', MOBILE_MORE_KEY])
    expect(rowKeys(moreSlot(model).groups)).toEqual(['a', 'c'])
  })

  /** §2.2 — a group of one IS a destination. This is the case that raises a full-viewport drawer
   *  for a single row today, and the reason surface inference is cardinality, not configuration. */
  test('5. a mobile:{tab:true} section holding one destination collapses to a link slot', () => {
    const model = projectMobileNav([
      { label: 'Main', items: [item('a')] },
      { label: 'Admin', mobile: { tab: true }, items: [item('settings')] },
    ])

    const slot = slotAt(model, 0)
    expect(slot.kind).toBe('link')
    expect(slot.key).toBe('settings')
    // The SLOT is what the consumer configured, so the section's label names it.
    expect(slot.label).toBe('Admin')
    if (slot.kind !== 'link') throw new Error('unreachable')
    expect(slot.item.key).toBe('settings')
  })

  /** §2.2 — the same section, twice, differing only in how many rows it holds. */
  test('6. a group slot of 4 destinations is a menu; of 9 it is a sheet', () => {
    const small = projectMobileNav([{ label: 'Reports', mobile: { tab: true }, items: items(4) }])
    const large = projectMobileNav([{ label: 'Reports', mobile: { tab: true }, items: items(9) }])

    expect(slotAt(small, 0).kind).toBe('menu')
    expect(slotAt(large, 0).kind).toBe('sheet')
  })

  /** The threshold is arithmetic (6 rows x 44px + 8px fits above a 56px bar on a 568px viewport),
   *  so the boundary itself is worth pinning — off-by-one here renders a menu below the fold. */
  test('7. menuMax is inclusive: exactly menuMax rows is a menu, one more is a sheet', () => {
    const atLimit = projectMobileNav([{ label: 'Reports', mobile: { tab: true }, items: items(6) }])
    const overLimit = projectMobileNav([
      { label: 'Reports', mobile: { tab: true }, items: items(7) },
    ])

    expect(slotAt(atLimit, 0).kind).toBe('menu')
    expect(slotAt(overLimit, 0).kind).toBe('sheet')

    // And the threshold is a knob, not a constant: lowering it moves the same six rows to a sheet.
    const tightened = projectMobileNav(
      [{ label: 'Reports', mobile: { tab: true }, items: items(6) }],
      { config: { menuMax: 5 } },
    )
    expect(slotAt(tightened, 0).kind).toBe('sheet')
  })

  /**
   * Rule 8 + §11 risk 6 — account and settings rows are only reachable from More now that the
   * full-height sidebar drawer is gone, so they must count toward the menu-vs-sheet threshold.
   * The model cannot see them (they are Mantine chrome, not `SidebarItem`s); the shell counts.
   */
  test('8. extraMoreRows push a six-destination More over the threshold into a sheet', () => {
    const sections = [{ label: 'Main', items: [item('a', { mobile: 'tab' }), ...items(6)] }]

    expect(slotAt(projectMobileNav(sections), 1).kind).toBe('menu')
    expect(slotAt(projectMobileNav(sections, { extraMoreRows: 1 }), 1).kind).toBe('sheet')
  })

  /** Rule 1 — a section's `mobile: false` wins over every item inside it, everywhere. */
  test('9. mobile:false on a section hides all its destinations from slots AND from overflow', () => {
    const model = projectMobileNav([
      { label: 'Main', items: [item('a')] },
      {
        label: 'Internal',
        mobile: false,
        items: [item('secret'), item('debug', { mobile: 'tab' })],
      },
    ])

    expect(keys(model)).toEqual(['a'])
    expect(JSON.stringify(model)).not.toContain('secret')
    expect(JSON.stringify(model)).not.toContain('debug')
  })

  /**
   * Rule 11 — THE REGRESSION THIS DESIGN FIXES. Today's projection drops `disabled` outright and
   * ships a live row; the law is the opposite: never a tab (a tab that cannot be tapped is a dead
   * 72px of bar), always a row, always rendered disabled.
   */
  test('10. a disabled destination is never a link slot but survives into the More rows', () => {
    const { model, warnings } = projectQuietly([
      {
        label: 'Main',
        items: [item('a', { mobile: 'tab' }), item('x', { mobile: 'tab', disabled: true })],
      },
    ])

    expect(keys(model)).toEqual(['a', MOBILE_MORE_KEY])
    const more = moreSlot(model)
    expect(rowKeys(more.groups)).toEqual(['x'])
    expect(more.groups[0]?.items[0]?.disabled).toBe(true)
    expect(warnings.some((line) => line.includes('"x"') && line.includes('disabled'))).toBe(true)
  })

  /** Rule 2 — nesting is a lookup-order concern, not a rendering one: the tree reaches the rows
   *  intact, so a child no longer reads as a sibling of its own parent on mobile. */
  test('11. nested children are preserved as a tree in the overflow rows, not flattened away', () => {
    const model = projectMobileNav([
      {
        label: 'Main',
        items: [
          item('a', { mobile: 'tab' }),
          item('reports', { children: [item('daily'), item('weekly')] }),
        ],
      },
    ])

    const more = moreSlot(model)
    const reports = more.groups[0]?.items[0]
    expect(reports?.key).toBe('reports')
    expect(reports?.children?.map((child) => child.key)).toEqual(['daily', 'weekly'])
    // Depth-first, parent before children — the order the renderer indents against.
    expect(rowKeys(more.groups)).toEqual(['reports', 'daily', 'weekly'])
  })

  /** Rule 12 — today's `items.some(i => i.active)` leaves the tab dark while a child route is
   *  open, which reads as "you are nowhere". A slot is active when ANY destination under it is. */
  test('12. a slot is active when a NESTED child is the active destination', () => {
    const model = projectMobileNav([
      {
        label: 'Main',
        items: [
          item('reports', { mobile: 'tab', children: [item('daily', { active: true })] }),
          item('other', { mobile: 'tab' }),
        ],
      },
    ])

    expect(slotAt(model, 0).active).toBe(true)
    expect(slotAt(model, 1).active).toBe(false)
  })

  /** §2.4 — a five-slot bar is ~72px wide, so the bar label is `short` when the consumer supplied
   *  one and the full label otherwise. Both paths, one test. */
  test('13. the slot label is `short`, falling back to `label`', () => {
    const model = projectMobileNav([
      {
        label: 'Main',
        items: [
          item('dashboard', { mobile: 'tab', label: 'Dashboard', short: 'Dash' }),
          item('activity', { mobile: 'tab', label: 'Activity' }),
        ],
      },
    ])

    expect(slotAt(model, 0).short).toBe('Dash')
    // `label` stays the FULL text — it is the accessible name, which is never abbreviated.
    expect(slotAt(model, 0).label).toBe('Dashboard')
    expect(slotAt(model, 1).short).toBe('Activity')
  })
})

/**
 * `blockRowCount` — the `accountRowCount` sibling for sidebar blocks (`docs/CONTROLS-SPEC.md`
 * §2.3). It exists for one reason: `BasaltShell` needs the More-surface row count BEFORE the
 * projection runs, because that count is what picks `menu` vs `sheet` against `menuMax`. A second,
 * independent estimate of the same rows is exactly how a "1 row" account shipped a 9-row menu into
 * headroom sized for 6.
 */
/** A three-item list block, the shape every row-count case counts against. */
const list = (extra: Partial<SidebarListBlock> = {}): SidebarListBlock => ({
  kind: 'list',
  key: extra.key ?? 'awaiting',
  label: 'Awaiting action',
  items: [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
  ],
  ...extra,
})

describe('blockRowCount', () => {
  test('undefined and an empty list are both zero', () => {
    expect(blockRowCount(undefined)).toBe(0)
    expect(blockRowCount([])).toBe(0)
  })

  test('ONE row per list block, never one per item — the row opens a nested sheet', () => {
    expect(blockRowCount([list(), list({ key: 'second' })])).toBe(2)
  })

  test("mobile:'hidden' drops a list; a progress block is hidden until it asks otherwise", () => {
    expect(blockRowCount([list({ mobile: 'hidden' })])).toBe(0)
    const progress: SidebarProgressBlock = {
      kind: 'progress',
      key: 'onboarding',
      label: 'Getting started',
      value: 1,
      total: 5,
    }
    expect(blockRowCount([progress])).toBe(0)
    expect(blockRowCount([{ ...progress, mobile: 'more' }])).toBe(1)
  })

  test('a custom block never reaches mobile — it is desktop-only by kind', () => {
    expect(blockRowCount([{ kind: 'custom', key: 'tree', node: null }])).toBe(0)
  })

  /** Same rule the renderer applies: an empty list would open a sheet with nothing in it. */
  test('an empty list block contributes no row', () => {
    expect(blockRowCount([list({ items: [] })])).toBe(0)
  })

  /** The threshold this number exists to move, asserted end to end against the projection. */
  test('block rows push a six-destination More over the threshold into a sheet', () => {
    const sections = [{ label: 'Main', items: [item('a', { mobile: 'tab' }), ...items(6)] }]
    expect(slotAt(projectMobileNav(sections), 1).kind).toBe('menu')
    expect(
      slotAt(projectMobileNav(sections, { extraMoreRows: blockRowCount([list()]) }), 1).kind,
    ).toBe('sheet')
  })
})

/**
 * The block-default resolvers. Three call sites read them — the sidebar (placement + rail), the
 * renderer (paint) and `blockRowCount` (the count above) — and a default re-derived per call site
 * is how the count and the renderer drift apart.
 */
describe('sidebar block defaults', () => {
  const listBlock: SidebarListBlock = { kind: 'list', key: 'k', label: 'L', items: [] }
  const progressBlock: SidebarProgressBlock = {
    kind: 'progress',
    key: 'p',
    label: 'P',
    value: 1,
    total: 5,
  }
  const customBlock: SidebarCustomBlock = { kind: 'custom', key: 'c', node: null }

  test('placement: list/custom default to nav, progress to bottom', () => {
    expect(sidebarBlockPlacement(listBlock)).toBe('nav')
    expect(sidebarBlockPlacement(customBlock)).toBe('nav')
    expect(sidebarBlockPlacement(progressBlock)).toBe('bottom')
    expect(sidebarBlockPlacement({ ...listBlock, placement: 'bottom' })).toBe('bottom')
  })

  test('rail: a dot only for a list with BOTH a count and an icon, a ring for progress', () => {
    expect(sidebarBlockRail(listBlock)).toBe('hidden')
    expect(sidebarBlockRail({ ...listBlock, count: 3, icon: null })).toBe('dot')
    expect(sidebarBlockRail({ ...listBlock, count: 3, icon: null, rail: 'hidden' })).toBe('hidden')
    // Neither half alone earns one — and an explicit `rail: 'dot'` cannot conjure the node either.
    expect(sidebarBlockRail({ ...listBlock, count: 3 })).toBe('hidden')
    expect(sidebarBlockRail({ ...listBlock, icon: null })).toBe('hidden')
    expect(sidebarBlockRail({ ...listBlock, rail: 'dot' })).toBe('hidden')
    expect(sidebarBlockRail(progressBlock)).toBe('ring')
    expect(sidebarBlockRail({ ...progressBlock, rail: 'hidden' })).toBe('hidden')
    expect(sidebarBlockRail(customBlock)).toBe('hidden')
  })

  test('mobile: a list is reachable from More by default, progress and custom are not', () => {
    expect(sidebarBlockMobile(listBlock)).toBe('more')
    expect(sidebarBlockMobile({ ...listBlock, mobile: 'hidden' })).toBe('hidden')
    expect(sidebarBlockMobile(progressBlock)).toBe('hidden')
    expect(sidebarBlockMobile({ ...progressBlock, mobile: 'more' })).toBe('more')
    expect(sidebarBlockMobile(customBlock)).toBe('hidden')
  })

  test('visible count honours max, and a max past the count changes nothing', () => {
    expect(sidebarBlockVisibleCount(6, 3)).toBe(3)
    expect(sidebarBlockVisibleCount(6, undefined)).toBe(6)
    expect(sidebarBlockVisibleCount(2, 9)).toBe(2)
  })

  /** The fold keys are a consumer-readable contract — a rename resets every user's sidebar. */
  test('the fold keys namespace to basalt:sidebar-block:<key> / basalt:sidebar-section:<slug>', () => {
    expect(sidebarBlockFoldKey('awaiting')).toBe('sidebar-block:awaiting')
    expect(sidebarSectionFoldKey('Tools & More')).toBe('sidebar-section:tools-more')
    expect(slugifyLabel('  Awaiting Action! ')).toBe('awaiting-action')
  })
})
