/**
 * `projectMobileNav`: the slot-selection law, one test per numbered rule. Ported from 2.x
 * `src/shell/mobile-nav-model.test.ts` (29 executed tests on origin/v2): its 18 projection and 6
 * row-count cases live here, its 5 block-default cases in `block-model.test.ts`.
 *
 * What changed in the port, and only this: items carry `id` (2.x `key`), sections carry `id`, the
 * active item comes from `NavState` instead of an `active` flag on the item, and the 2.x
 * `extraMoreRows` count is replaced by the rows the projector owns (`blocks`, `settings`,
 * `account`). Every assertion keeps its 2.x meaning.
 */
import { describe, expect, spyOn, test } from 'bun:test'
import type { Account, SettingsConfig } from '../contract'
import {
  MOBILE_MORE_ID,
  PINNED_GROUP_ID,
  phoneExtraRows,
  projectMobileNav,
} from './mobile-projection'
import type { PhoneGroup, PhoneModel, PhoneRow, PhoneSlot } from './mobile-projection'
import type { CoreBlock, CoreListBlock } from './block-model'
import type { CoreMobileConfig, CoreNavItem, CoreNavSection } from './types'

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────

function item(id: string, extra: Partial<CoreNavItem> = {}): CoreNavItem {
  return { id, label: id.toUpperCase(), ...extra }
}

function items(n: number, extra: Partial<CoreNavItem> = {}): CoreNavItem[] {
  return Array.from({ length: n }, (_, i) => item(`d${i + 1}`, extra))
}

/** A section whose id is its label's lowercase, as the codemod writes it. */
function section(
  label: string,
  sectionItems: CoreNavItem[],
  extra: Partial<CoreNavSection> = {},
): CoreNavSection {
  return { id: label.toLowerCase(), label, items: sectionItems, ...extra }
}

type Opts = {
  activeId?: string
  config?: CoreMobileConfig
  blocks?: readonly CoreBlock[]
  settings?: SettingsConfig
  account?: Account
  pinned?: CoreNavItem[]
}

function project(sections: CoreNavSection[], opts: Opts = {}): PhoneModel {
  return projectMobileNav({
    nav: {
      sections,
      ...(opts.config && { mobile: opts.config }),
      ...(opts.pinned && { pinned: opts.pinned }),
    },
    state: { activeId: opts.activeId, ancestorIds: new Set() },
    ...(opts.blocks && { blocks: opts.blocks }),
    ...(opts.settings && { settings: opts.settings }),
    ...(opts.account && { account: opts.account }),
  })
}

const ids = (model: PhoneModel): string[] => model.slots.map((slot) => slot.id)
const kinds = (model: PhoneModel): string[] => model.slots.map((slot) => slot.kind)

function slotAt(model: PhoneModel, index: number): PhoneSlot {
  const slot = model.slots[index]
  if (!slot) throw new Error(`expected a slot at index ${index}, got ${model.slots.length} slots`)
  return slot
}

function moreSlot(model: PhoneModel): Extract<PhoneSlot, { groups: readonly PhoneGroup[] }> {
  const slot = model.slots.at(-1)
  if (!slot || slot.kind === 'link') throw new Error('expected a menu/sheet More slot last')
  expect(slot.id).toBe(MOBILE_MORE_ID)
  expect(slot.isMore).toBe(true)
  return slot
}

function rowIds(groups: readonly PhoneGroup[]): string[] {
  const out: string[] = []
  const walk = (list: readonly PhoneRow[]): void => {
    for (const row of list) {
      out.push(row.id)
      walk(row.children)
    }
  }
  for (const group of groups) walk(group.rows)
  return out
}

/** Runs the projection with `console.warn` captured: the dev warnings are part of the contract. */
function projectQuietly(
  sections: CoreNavSection[],
  opts?: Opts,
): { model: PhoneModel; warnings: string[] } {
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const model = project(sections, opts)
    return { model, warnings: warn.mock.calls.map((args) => args.map(String).join(' ')) }
  } finally {
    warn.mockRestore()
  }
}

const oneSetting: SettingsConfig = {
  mode: 'menu',
  items: [{ id: 'lock', label: 'Lock', onClick: () => {} }],
}

/** One `mobile: { tab: true }` section of `n` destinations. */
const reportsOf = (n: number, config?: CoreMobileConfig): PhoneModel =>
  project([section('Reports', items(n), { mobile: { tab: true } })], config ? { config } : {})

// ── the law ──────────────────────────────────────────────────────────────────────────────────────

describe('projectMobileNav', () => {
  test('1. zero-config fallback takes the first maxTabs-1 non-disabled top-level destinations', () => {
    const model = project([
      section('Main', [
        item('a'),
        item('b', { disabled: true }),
        item('c'),
        item('d'),
        item('e'),
        item('f'),
      ]),
    ])
    expect(ids(model)).toEqual(['a', 'c', 'd', 'e', MOBILE_MORE_ID])
    expect(kinds(model)).toEqual(['link', 'link', 'link', 'link', 'menu'])
    expect(rowIds(moreSlot(model).groups)).toEqual(['b', 'f'])
  })

  test('2. no overflow and no extra rows yields maxTabs slots and NO More', () => {
    const model = project([section('Main', items(5, { mobile: 'tab' }))])
    expect(model.slots).toHaveLength(5)
    expect(kinds(model)).toEqual(['link', 'link', 'link', 'link', 'link'])
    expect(ids(model)).not.toContain(MOBILE_MORE_ID)
  })

  test('3. six tab requests become four slots plus More, with the last two in overflow', () => {
    const { model, warnings } = projectQuietly([section('Main', items(6, { mobile: 'tab' }))])
    expect(ids(model)).toEqual(['d1', 'd2', 'd3', 'd4', MOBILE_MORE_ID])
    expect(rowIds(moreSlot(model).groups)).toEqual(['d5', 'd6'])
    expect(warnings.some((line) => line.includes('6 slot candidates for 4'))).toBe(true)
  })

  test('4. mobile.tabs replaces every item placement and preserves the given order', () => {
    const model = project(
      [
        section('Main', [
          item('a', { mobile: 'tab' }),
          item('b', { mobile: 'tab' }),
          item('c'),
          item('d'),
        ]),
      ],
      { config: { tabs: ['d', 'b'] } },
    )
    expect(ids(model)).toEqual(['d', 'b', MOBILE_MORE_ID])
    expect(rowIds(moreSlot(model).groups)).toEqual(['a', 'c'])
  })

  test('5. a mobile:{tab:true} section holding one destination collapses to a link slot', () => {
    const model = project([
      section('Main', [item('a')]),
      section('Admin', [item('settings')], { mobile: { tab: true } }),
    ])
    const slot = slotAt(model, 0)
    expect(slot.kind).toBe('link')
    expect(slot.id).toBe('settings')
    expect(slot.label).toBe('Admin')
    if (slot.kind !== 'link') throw new Error('unreachable')
    expect(slot.row.id).toBe('settings')
  })

  test('6. group slots of 4 and 9 destinations are menus; 13 is a sheet', () => {
    expect(slotAt(reportsOf(4), 0).kind).toBe('menu')
    expect(slotAt(reportsOf(9), 0).kind).toBe('menu')
    expect(slotAt(reportsOf(13), 0).kind).toBe('sheet')
  })

  test('7. menuMax is inclusive: exactly menuMax (12) rows is a menu, one more is a sheet', () => {
    expect(slotAt(reportsOf(12), 0).kind).toBe('menu')
    expect(slotAt(reportsOf(13), 0).kind).toBe('sheet')
    expect(slotAt(reportsOf(6, { menuMax: 5 }), 0).kind).toBe('sheet')
    expect(slotAt(reportsOf(13, { menuMax: 30 }), 0).kind).toBe('menu')
  })

  /** 2.x passed `extraMoreRows: 1`; the projector now owns that row (one settings item). */
  test('8. extra More rows push a twelve-destination More over the threshold into a sheet', () => {
    const sections = [section('Main', [item('a', { mobile: 'tab' }), ...items(12)])]
    expect(slotAt(project(sections), 1).kind).toBe('menu')
    const withSetting = project(sections, { settings: oneSetting })
    expect(slotAt(withSetting, 1).kind).toBe('sheet')
    expect(moreSlot(withSetting).extras.map((row) => row.id)).toEqual(['settings:lock'])
  })

  test('9. mobile:false on a section hides all its destinations from slots AND from overflow', () => {
    const model = project([
      section('Main', [item('a')]),
      section('Internal', [item('secret'), item('debug', { mobile: 'tab' })], { mobile: false }),
    ])
    expect(ids(model)).toEqual(['a'])
    const text = JSON.stringify(model)
    expect(text).not.toContain('secret')
    expect(text).not.toContain('debug')
  })

  test('10. a disabled destination is never a link slot but survives into the More rows', () => {
    const { model, warnings } = projectQuietly([
      section('Main', [item('a', { mobile: 'tab' }), item('x', { mobile: 'tab', disabled: true })]),
    ])
    expect(ids(model)).toEqual(['a', MOBILE_MORE_ID])
    const more = moreSlot(model)
    expect(rowIds(more.groups)).toEqual(['x'])
    expect(more.groups[0]?.rows[0]?.disabled).toBe(true)
    expect(warnings.some((line) => line.includes('"x"') && line.includes('disabled'))).toBe(true)
  })

  test('11. nested children are preserved as a tree in the overflow rows, not flattened away', () => {
    const model = project([
      section('Main', [
        item('a', { mobile: 'tab' }),
        item('reports', { children: [item('daily'), item('weekly')] }),
      ]),
    ])
    const more = moreSlot(model)
    const reports = more.groups[0]?.rows[0]
    expect(reports?.id).toBe('reports')
    expect(reports?.children.map((child) => child.id)).toEqual(['daily', 'weekly'])
    expect(rowIds(more.groups)).toEqual(['reports', 'daily', 'weekly'])
  })

  test('12. a SECTION slot is active when a NESTED child is the active destination', () => {
    const model = project(
      [
        section('Main', [item('reports', { children: [item('daily')] })], {
          mobile: { tab: true },
        }),
        section('Other', [item('other', { mobile: 'tab' })]),
      ],
      { activeId: 'daily' },
    )
    expect(slotAt(model, 0).active).toBe(true)
    expect(slotAt(model, 1).active).toBe(false)
  })

  test('12. an ITEM tab does NOT light for a child it cannot navigate to; the overflow slot does', () => {
    const model = project(
      [
        section('Main', [
          item('reports', { mobile: 'tab', children: [item('daily')] }),
          item('other', { mobile: 'tab' }),
        ]),
      ],
      { activeId: 'daily' },
    )
    const active = model.slots.filter((slot) => slot.active)
    expect(active.length).toBe(1)
    expect(active[0]?.id).toBe(MOBILE_MORE_ID)
    expect(slotAt(model, 0).active).toBe(false)

    const more = moreSlot(model)
    expect(more.kind).toBe('menu')
    expect(rowIds(more.groups)).toEqual(['reports', 'daily'])
    const [reports] = more.groups[0]?.rows ?? []
    const daily = reports?.children[0]
    expect(reports?.active).toBe(false)
    expect(daily?.id).toBe('daily')
    expect(daily?.active).toBe(true)
  })

  test('12b. a covered parent stays as the group anchor for its overflowing children', () => {
    const model = project([
      section('Overview', [
        item('dashboard', {
          mobile: 'tab',
          children: [item('sessions'), item('traffic'), item('revenue')],
        }),
        item('activity', { mobile: 'tab' }),
      ]),
    ])
    const more = moreSlot(model)
    expect(rowIds(more.groups)).toEqual(['dashboard', 'sessions', 'traffic', 'revenue'])
    const [dashboard] = more.groups[0]?.rows ?? []
    expect(dashboard?.id).toBe('dashboard')
    expect(dashboard?.children.map((child) => child.id)).toEqual(['sessions', 'traffic', 'revenue'])
  })

  test('12c. a covered leaf with no surviving children still drops from the overflow', () => {
    const model = project([
      section('Main', [item('reports', { mobile: 'tab' }), item('other', { mobile: 'tab' })]),
      section('Rest', [item('settings'), item('billing')]),
    ])
    expect(rowIds(moreSlot(model).groups)).toEqual(['settings', 'billing'])
  })

  test('12d. both cardinality collapses read the destination itself, not the rollup', () => {
    const sectionCase = [
      section('Main', [item('a', { mobile: 'tab' })]),
      section('Admin', [item('settings')], { mobile: { tab: true } }),
    ]
    expect(slotAt(project(sectionCase, { activeId: 'settings' }), 1).active).toBe(true)
    expect(slotAt(project(sectionCase), 1).active).toBe(false)

    const moreCase = [
      section('Main', [
        item('a', { mobile: 'tab' }),
        item('b', { mobile: 'tab' }),
        item('leftover'),
      ]),
    ]
    const collapsed = slotAt(project(moreCase, { activeId: 'leftover' }), 2)
    expect(collapsed.kind).toBe('link')
    expect(collapsed.id).toBe('leftover')
    expect(collapsed.active).toBe(true)
    expect(slotAt(project(moreCase), 2).active).toBe(false)

    const nested = project(
      [
        section('Main', [item('a', { mobile: 'tab' })]),
        section('Admin', [item('settings', { children: [item('billing')] })], {
          mobile: { tab: true },
        }),
      ],
      { activeId: 'billing' },
    )
    expect(slotAt(nested, 1).kind).toBe('menu')
  })

  test('12. at most ONE slot is active, for every destination in a mixed definition', () => {
    const sections = [
      section('Overview', [
        item('dashboard', { mobile: 'tab', children: [item('sessions'), item('traffic')] }),
        item('activity', { mobile: 'tab' }),
      ]),
      section('Batteries', [item('query'), item('router'), item('forms')], {
        mobile: { tab: true },
      }),
      section('System', [item('settings'), item('user')]),
    ]
    const all = [
      'dashboard',
      'sessions',
      'traffic',
      'activity',
      'query',
      'router',
      'forms',
      'settings',
      'user',
    ]
    for (const id of all) {
      const active = project(sections, { activeId: id }).slots.filter((slot) => slot.active)
      expect({ id, count: active.length }).toEqual({ id, count: 1 })
    }
  })

  test('13. the slot label is `short`, falling back to `label`', () => {
    const model = project([
      section('Main', [
        item('dashboard', { mobile: 'tab', label: 'Dashboard', short: 'Dash' }),
        item('activity', { mobile: 'tab', label: 'Activity' }),
      ]),
    ])
    expect(slotAt(model, 0).short).toBe('Dash')
    expect(slotAt(model, 0).label).toBe('Dashboard')
    expect(slotAt(model, 1).short).toBe('Activity')
  })
})

// ── projector-owned More rows (2.x `blockRowCount`) ─────────────────────────────────────────────

const list = (extra: Partial<CoreListBlock> = {}): CoreListBlock => ({
  kind: 'list',
  id: extra.id ?? 'awaiting',
  label: 'Awaiting action',
  items: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  ...extra,
})

const blockRows = (blocks: readonly CoreBlock[] | undefined): number =>
  phoneExtraRows(blocks === undefined ? {} : { blocks }).length

describe('block More rows', () => {
  test('undefined and an empty list are both zero', () => {
    expect(blockRows(undefined)).toBe(0)
    expect(blockRows([])).toBe(0)
  })

  test('ONE row per list block, never one per item: the row opens a nested sheet', () => {
    expect(blockRows([list(), list({ id: 'second' })])).toBe(2)
  })

  test("mobile:'hidden' drops a list; a progress block is hidden until it asks otherwise", () => {
    expect(blockRows([list({ mobile: 'hidden' })])).toBe(0)
    const progress: CoreBlock = {
      kind: 'progress',
      id: 'onboarding',
      label: 'Getting started',
      value: 0.2,
    }
    expect(blockRows([progress])).toBe(0)
    expect(blockRows([{ ...progress, mobile: 'more' }])).toBe(1)
  })

  /** 2.x needed `mobile: 'more'` AND a `label`; the v3 `mobile` pair is both at once. */
  test('a custom block reaches the phone only with its mobile label and icon', () => {
    const custom: CoreBlock = { kind: 'custom', id: 'tree' }
    expect(blockRows([custom])).toBe(0)
    expect(blockRows([{ ...custom, mobile: { label: 'Albums', icon: () => null } }])).toBe(1)
  })

  test('an empty list block contributes no row', () => {
    expect(blockRows([list({ items: [] })])).toBe(0)
  })

  test('block rows push a twelve-destination More over the threshold into a sheet', () => {
    const sections = [section('Main', [item('a', { mobile: 'tab' }), ...items(12)])]
    expect(slotAt(project(sections), 1).kind).toBe('menu')
    expect(slotAt(project(sections, { blocks: [list()] }), 1).kind).toBe('sheet')
  })
})

// ── v3 additions ─────────────────────────────────────────────────────────────────────────────────

describe('projector-owned rows and badges', () => {
  test('account rows: none while loading, sign-in signed out, identity + rows + sign-out signed in', () => {
    expect(phoneExtraRows({ account: { status: 'loading' } })).toEqual([])
    expect(
      phoneExtraRows({ account: { status: 'signed-out', onSignIn: () => {} } }).map((r) => r.id),
    ).toEqual(['account:sign-in'])
    const signedIn: Account = {
      status: 'signed-in',
      name: 'N',
      rows: [{ label: 'Manage', onClick: () => {} }],
      onSignOut: () => {},
    }
    expect(phoneExtraRows({ account: signedIn }).map((r) => r.id)).toEqual([
      'account:identity',
      'account:row:0',
      'account:sign-out',
    ])
  })

  test('extra rows alone raise a More slot, ordered blocks, settings, account', () => {
    const model = project([section('Main', [item('a', { mobile: 'tab' })])], {
      blocks: [list()],
      settings: oneSetting,
      account: { status: 'signed-out', onSignIn: () => {} },
    })
    expect(moreSlot(model).extras.map((row) => row.kind)).toEqual(['block', 'settings', 'account'])
  })

  /** Found by the property test (seed 24); 2.x lit two slots for both shapes. */
  test('mobile.tabs naming an id twice, or an item inside a named section, covers it once', () => {
    const { model: twice } = projectQuietly([section('Main', [item('a'), item('b')])], {
      config: { tabs: ['a', 'a'] },
      activeId: 'a',
    })
    // One slot for `a`; the lone leftover `b` collapses the More slot into its link (rule 10).
    expect(ids(twice)).toEqual(['a', 'b'])
    expect(twice.slots.filter((slot) => slot.active)).toHaveLength(1)
    const { model: nested, warnings } = projectQuietly(
      [section('Main', [item('a'), item('b'), item('c')]), section('Other', [item('d')])],
      { config: { tabs: ['main', 'b'] }, activeId: 'b' },
    )
    expect(nested.slots.filter((slot) => slot.active).map((slot) => slot.id)).toEqual(['main'])
    expect(warnings.some((line) => line.includes('"b"') && line.includes('already covers'))).toBe(
      true,
    )
    // A section named after one of its items keeps the rest; the item's children hoist.
    const { model: after } = projectQuietly([section('Main', [item('a'), item('b'), item('c')])], {
      config: { tabs: ['b', 'main'] },
      activeId: 'b',
    })
    expect(after.slots.filter((slot) => slot.active).map((slot) => slot.id)).toEqual(['b'])
    const main = slotAt(after, 1)
    if (main.kind === 'link') throw new Error('expected a surface')
    expect(rowIds(main.groups)).toEqual(['a', 'c'])
  })

  /** Review finding: an empty section candidate rendered no slot but still took a slice place. */
  test('a section with nothing left to cover takes no place in the maxTabs slice', () => {
    const sections = [
      section('Main', [item('a')]),
      section('Other', [item('b'), item('c'), item('d')]),
    ]
    const { model, warnings } = projectQuietly(sections, {
      config: { tabs: ['a', 'main', 'b', 'c'], maxTabs: 4 },
      settings: oneSetting,
    })
    expect(ids(model)).toEqual(['a', 'b', 'c', MOBILE_MORE_ID])
    expect(warnings.some((line) => line.includes('"main"') && line.includes('already cover'))).toBe(
      true,
    )
    expect(warnings.some((line) => line.includes('moved into the More surface'))).toBe(false)

    const allHidden = project(
      [
        section('Hidden', [item('x', { mobile: 'hidden' })], { mobile: { tab: true } }),
        section('Main', [item('a', { mobile: 'tab' }), item('b', { mobile: 'tab' })]),
      ],
      { config: { maxTabs: 2 } },
    )
    expect(ids(allHidden)).toEqual(['a', 'b'])
  })

  test('pinned items project after the sections under no heading', () => {
    const model = project([section('Main', [item('a', { mobile: 'tab' }), item('b')])], {
      pinned: [item('settings', { mobile: 'more' })],
    })
    const groups = moreSlot(model).groups
    expect(groups.map((g) => g.id)).toEqual(['main', PINNED_GROUP_ID])
    expect(groups[1]?.label).toBeUndefined()
  })

  test('rows hold the declared item object, so anchor identity survives a re-projection', () => {
    const declared = item('a', { mobile: 'tab' })
    const sections = [section('Main', [declared])]
    const first = slotAt(project(sections), 0)
    const second = slotAt(project(sections, { activeId: 'a' }), 0)
    if (first.kind !== 'link' || second.kind !== 'link') throw new Error('expected links')
    expect(first.row.item).toBe(declared)
    expect(second.row.item).toBe(declared)
  })

  test('a link slot carries its own badge (tab dot); More sums its rows (More sum)', () => {
    const model = projectMobileNav({
      nav: { sections: [section('Main', [item('a', { mobile: 'tab' }), item('b'), item('c')])] },
      state: { activeId: undefined, ancestorIds: new Set() },
      badges: { a: { dot: true }, b: { count: 2 }, c: { count: 3, attention: true } },
    })
    expect(slotAt(model, 0).badge).toEqual({ dot: true })
    expect(moreSlot(model).badge).toEqual({ count: 5, attention: true })
  })
})
