/**
 * Header priority tiers against spike S6 (`docs/v3/spikes/shell-frame.md`): shutterflow's cluster,
 * 3 status badges as one `custom` at priority 1, job progress at 2, two quick actions at 3.
 */
import { describe, expect, test } from 'bun:test'
import type { SizeClass } from '../contract'
import {
  HEADER_TIER_MIN_WIDTH,
  HEADER_TITLEBAR_BRAND_PX,
  headerPriority,
  projectHeaderTiers,
} from './header-tiers'
import type { HeaderTierItem } from './header-tiers'

/** The S6 cluster, declaration order. */
const S6_CLUSTER: HeaderTierItem[] = [
  { id: 'badges', priority: 1 },
  { id: 'progress', priority: 2 },
  { id: 'import', priority: 3 },
  { id: 'tag', priority: 3 },
]

/** The viewport size class: compact < 840 <= medium < 1200 <= expanded. */
const sizeClassAt = (width: number): SizeClass =>
  width >= 1200 ? 'expanded' : width >= 840 ? 'medium' : 'compact'
/** The identity row at a window with the rail expanded: the window less the rail and the panel inset and edges. */
const RAIL_AND_PANEL = 240 + 10
const at = (windowWidth: number) => ({
  rowWidth: windowWidth - RAIL_AND_PANEL,
  sizeClass: sizeClassAt(windowWidth),
})

describe('S6 cluster', () => {
  test.each([
    [1024, ['badges'], ['progress', 'import', 'tag'], 'short'],
    [1200, ['badges', 'progress'], ['import', 'tag'], 'long'],
    [1440, ['badges', 'progress', 'import', 'tag'], [], 'long'],
  ] as const)('window %i: shown %p, kebab %p, %s labels', (width, shown, kebab, labels) => {
    expect(projectHeaderTiers(S6_CLUSTER, at(width))).toEqual({ shown, kebab, labels })
  })

  test('the thresholds are the spike numbers less the expanded rail, in row content width (row minus 12)', () => {
    expect(HEADER_TIER_MIN_WIDTH).toEqual({ 1: 0, 2: 860, 3: 1040 })
    const row = (rowWidth: number) => ({ rowWidth, sizeClass: 'expanded' as const })
    expect(projectHeaderTiers(S6_CLUSTER, row(871)).shown).toEqual(['badges'])
    expect(projectHeaderTiers(S6_CLUSTER, row(872)).shown).toEqual(['badges', 'progress'])
    expect(projectHeaderTiers(S6_CLUSTER, row(1051)).kebab).toEqual(['import', 'tag'])
    expect(projectHeaderTiers(S6_CLUSTER, row(1052)).kebab).toEqual([])
  })
})

test('the header classes hold these numbers, the title bar 240 px more', async () => {
  const source = await Bun.file(new URL('../parts/header.tsx', import.meta.url)).text()
  for (const tier of [2, 3] as const) {
    const web = HEADER_TIER_MIN_WIDTH[tier]
    const titlebar = web + HEADER_TITLEBAR_BRAND_PX
    expect(source).toContain(`@max-[${web - 0.02}px]/header:hidden`)
    expect(source).toContain(`@max-[${titlebar - 0.02}px]/header:hidden`)
  }
})

describe('priority', () => {
  test('missing is 1, out of range clamps', () => {
    expect([undefined, 0, 1, 2, 3, 7, Number.NaN, 2.4].map(headerPriority)).toEqual([
      1, 1, 1, 2, 3, 3, 1, 2,
    ])
  })

  test('sweep: nothing is lost, the kebab keeps declaration order, a hidden item never outranks a shown one', () => {
    for (let width = 320; width <= 1600; width += 4) {
      const tiers = projectHeaderTiers(S6_CLUSTER, at(width))
      expect([...tiers.shown, ...tiers.kebab].toSorted()).toEqual(
        S6_CLUSTER.map((i) => i.id).toSorted(),
      )
      expect(tiers.kebab).toEqual(
        S6_CLUSTER.filter((i) => tiers.kebab.includes(i.id)).map((i) => i.id),
      )
      const prio = (id: string) => headerPriority(S6_CLUSTER.find((i) => i.id === id)?.priority)
      const worstShown = Math.max(...tiers.shown.map(prio))
      for (const id of tiers.kebab) expect(prio(id)).toBeGreaterThan(worstShown)
      expect(tiers.labels).toBe(width >= 1200 ? 'long' : 'short')
    }
  })
})
