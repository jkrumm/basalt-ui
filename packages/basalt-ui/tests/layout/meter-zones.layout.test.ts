/**
 * Zoned Meter label row in a real browser: each zone name centred under its own span, the end ticks
 * inline in the same row, the holding zone never lost, and at most one caption line under the track.
 * Layout outcomes happy-dom cannot observe. Run at 1440 (5-col strip) and 390 (2-col strip).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  dash: true,
}

const SUBPIXEL = 0.5
const SNAP = 1
/** `--vx-space-control-gap` (0.375rem) at the 16px root the fixture runs at. */
const GAP_STEP = 6
const ZONES = ['Under', 'Optimal', 'Caution', 'Danger']

/** Per fixture: which zone names show (in zone order) and which end ticks. `clash` carries "Rest". */
type Shown = { zones: string[]; ticks: string[] }
const ENDS = ['0', '2.0']

const CASES: ReadonlyArray<readonly [string, Shown]> = [
  // Wave 38 (w38-strip2): a name wider than its span borrows free room beside it, so "Caution" shows in
  // full wherever the row has room.
  // Wave 38: the end figures sit ABOVE the track, so zone names own the row below and show whenever
  // they fit their own span ("Danger" no longer yields to the "2.0" end figure).
  ['dash-zl-120', { zones: ['Under', 'Optimal'], ticks: ENDS }],
  ['dash-zl-170', { zones: ['Under', 'Optimal', 'Danger'], ticks: ENDS }],
  ['dash-zl-220', { zones: ['Under', 'Optimal', 'Caution', 'Danger'], ticks: ENDS }],
  ['dash-zl-342', { zones: ['Under', 'Optimal', 'Caution', 'Danger'], ticks: ENDS }],
  ['dash-zl-card', { zones: ['Under', 'Optimal', 'Caution', 'Danger'], ticks: ENDS }],
  // The "Rest" tick sits on "Under"'s centre: the interior tick wins, the name hides.
  ['dash-zl-clash', { zones: ['Optimal', 'Caution', 'Danger'], ticks: [...ENDS, 'Rest'] }],
]
const STRIP: Record<string, Shown> = {
  expanded: { zones: ['Under', 'Optimal', 'Caution', 'Danger'], ticks: ENDS },
  'iPhone 14': { zones: ['Under', 'Optimal', 'Danger'], ticks: ENDS },
}

type Measured = {
  shorts: { name: string | null; text: string | null; left: number; right: number }[]
  zones: { name: string | null; left: number; right: number }[]
  labels: { name: string | null; left: number; right: number; top: number; holding: boolean }[]
  ticks: { name: string | null; left: number; right: number; top: number }[]
  trackTop: number
  trackLeft: number
  trackRight: number
  described: string
  captionTops: number[]
  strayLists: number
  overflow: boolean
}

const measure = (p: LayoutPage, root: string): Promise<Measured> =>
  p.raw.evaluate((id) => {
    const host = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!host) throw new Error(`LAYOUT: no ${id}`)
    const box = (el: Element) => el.getBoundingClientRect()
    const shown = (el: Element) => !el.hasAttribute('data-hidden')
    const meter = host.querySelector<HTMLElement>('[role="meter"]')
    const describedId = meter?.getAttribute('aria-describedby')
    const track = host.querySelector<HTMLElement>('[data-meter-track]')
    if (!track) throw new Error(`LAYOUT: no track in ${id}`)
    return {
      zones: [...host.querySelectorAll<HTMLElement>('[data-meter-zone]')].map((z) => ({
        name: z.getAttribute('data-meter-zone'),
        left: box(z).left,
        right: box(z).right,
      })),
      labels: [...host.querySelectorAll<HTMLElement>('[data-meter-zone-label]')]
        .filter(shown)
        .map((l) => ({
          name: l.getAttribute('data-meter-zone-label'),
          left: box(l).left,
          right: box(l).right,
          top: box(l).top,
          holding: l.hasAttribute('data-holding'),
        })),
      shorts: [...host.querySelectorAll<HTMLElement>('[data-meter-zone-short]')]
        .filter(shown)
        .map((l) => ({
          name: l.getAttribute('data-meter-zone-short'),
          text: l.textContent,
          left: box(l).left,
          right: box(l).right,
        })),
      ticks: [...host.querySelectorAll<HTMLElement>('[data-meter-tick-label]')]
        .filter(shown)
        .map((l) => ({
          name: l.textContent,
          left: box(l).left,
          right: box(l).right,
          top: box(l).top,
        })),
      trackTop: box(track).top,
      trackLeft: box(track).left,
      trackRight: box(track).right,
      described: describedId ? (document.getElementById(describedId)?.textContent ?? '') : '',
      captionTops: [
        ...new Set(
          [...host.querySelectorAll<HTMLElement>('[data-meter-captions] > span')].map((c) =>
            Math.round(box(c).top),
          ),
        ),
      ],
      strayLists: host.querySelectorAll('[data-meter-zone-list], [data-meter-tick-list]').length,
      overflow: host.scrollWidth > host.clientWidth,
    }
  }, root)

function assertRow(m: Measured, expected: Shown) {
  expect(m.strayLists).toBe(0)
  expect(m.overflow).toBe(false)
  // Every zone stays drawn and named, whatever its label does.
  expect(m.zones.map((z) => z.name)).toEqual(ZONES)
  for (const name of ZONES) expect(m.described).toContain(name)
  expect(m.described).toContain('is in Optimal')
  // The exact label set.
  expect(m.labels.map((l) => l.name)).toEqual(expected.zones)
  expect(m.ticks.map((t) => t.name)).toEqual(expected.ticks)
  // The holding zone's name is never lost.
  const holding = m.labels.filter((l) => l.holding)
  expect(holding.map((l) => l.name)).toEqual(['Optimal'])
  for (const l of m.labels) {
    const z = m.zones.find((zone) => zone.name === l.name)
    if (!z) throw new Error(`LAYOUT: no zone ${l.name}`)
    expect(l.left).toBeGreaterThanOrEqual(m.trackLeft - SUBPIXEL)
    expect(l.right).toBeLessThanOrEqual(m.trackRight + SUBPIXEL)
    if (l.holding) continue
    const centre = (l.left + l.right) / 2
    expect(centre).toBeGreaterThanOrEqual(z.left - SUBPIXEL)
    expect(centre).toBeLessThanOrEqual(z.right + SUBPIXEL)
  }
  // The end figures own the row above the track; the zone names and any interior tick share the row below.
  const above = m.ticks.filter((t) => t.top < m.trackTop)
  expect(above.map((t) => t.name)).toEqual(ENDS)
  for (const t of above) expect(Math.abs(t.top - above[0]!.top)).toBeLessThanOrEqual(SNAP)
  const below = m.ticks.filter((t) => t.top >= m.trackTop)
  const all = [...m.labels, ...below]
  for (const [i, a] of all.entries()) {
    for (const [j, b] of all.entries()) {
      if (j <= i) continue
      // A tick keeps a gap step (0.375rem) from every label; zone names only must not touch.
      const gap = i >= m.labels.length || j >= m.labels.length ? GAP_STEP : 0
      expect(a.right + gap <= b.left + SUBPIXEL || b.right + gap <= a.left + SUBPIXEL).toBe(true)
    }
  }
  // One row below: every name and interior tick shares one top.
  for (const x of all) expect(Math.abs(x.top - all[0]!.top)).toBeLessThanOrEqual(SNAP)
  expect(m.captionTops.length).toBeLessThanOrEqual(1)
}

layout('zoned Meter label row', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  for (const vp of [DESKTOP_1440, PHONE]) describe(`at ${vp.width}px`, () => rowSuite(vp))
})

function rowSuite(vp: Viewport) {
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, vp)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test.each(CASES)('zone names in their spans, ticks on their row (%s)', async (id, expected) => {
    assertRow(await measure(p, id), expected)
  })

  test('a StatStrip cell hosts it the same way', async () => {
    const expected = STRIP[vp.name]
    if (!expected) throw new Error(`LAYOUT: no strip expectation for ${vp.name}`)
    assertRow(await measure(p, 'dash-zl-strip'), expected)
  })

  test('a name too wide for its span borrows free room and shows in full, no short used', async () => {
    const m = await measure(p, 'dash-zl-short')
    expect(m.labels.map((l) => l.name)).toEqual(ZONES)
    expect(m.shorts).toEqual([])
    for (const l of m.labels) {
      const z = m.zones.find((zone) => zone.name === l.name)
      if (!z) throw new Error(`LAYOUT: no zone ${l.name}`)
      // Centred in its own span, or shifted to make room: the centre stays inside the span.
      expect((l.left + l.right) / 2).toBeGreaterThanOrEqual(z.left - SUBPIXEL)
      expect((l.left + l.right) / 2).toBeLessThanOrEqual(z.right + SUBPIXEL)
    }
  })

  test('the S2 training-load zones: both end figures sit above the track, the names share one register', async () => {
    const m = await measure(p, 'dash-zl-s2')
    expect(m.ticks.map((t) => t.name)).toEqual(ENDS)
    expect(m.labels.filter((l) => l.holding).map((l) => l.name)).toEqual(['Optimal'])
    for (const name of ['Low', 'Optimal', 'High', 'Overreaching'])
      expect(m.described).toContain(name)
    const all = [...m.labels, ...m.shorts, ...m.ticks.filter((t) => t.top >= m.trackTop)]
    const names = m.labels.length + m.shorts.length
    for (const [i, a] of all.entries()) {
      for (const [j, b] of all.entries()) {
        if (j <= i) continue
        const gap = i >= names || j >= names ? GAP_STEP : 0
        expect(a.right + gap <= b.left + SUBPIXEL || b.right + gap <= a.left + SUBPIXEL).toBe(true)
      }
    }
  })

  test('at 120px a zone that cannot fit its name shows its short label inside its span', async () => {
    const m = await measure(p, 'dash-zl-short-120')
    expect(m.shorts.map((s) => [s.name, s.text])).toEqual([
      ['Under', 'Und'],
      ['Danger', 'Dan'],
    ])
    expect(m.labels.map((l) => l.name)).toEqual(['Optimal'])
    expect(m.ticks.map((t) => t.name)).toEqual(ENDS)
    for (const name of ZONES) expect(m.described).toContain(name)
    for (const short of m.shorts) {
      const z = m.zones.find((zone) => zone.name === short.name)
      if (!z) throw new Error(`LAYOUT: no zone ${short.name}`)
      expect(short.left).toBeGreaterThanOrEqual(z.left - SUBPIXEL)
      expect(short.right).toBeLessThanOrEqual(z.right + SUBPIXEL)
    }
  })

  test('a tick beats a zone name it would touch; the name stays described', async () => {
    const m = await measure(p, 'dash-zl-clash')
    expect(m.ticks.map((t) => t.name)).toContain('Rest')
    expect(m.labels.map((l) => l.name)).not.toContain('Under')
    expect(m.described).toContain('Under')
    expect(m.described).toContain('Rest')
  })
}
