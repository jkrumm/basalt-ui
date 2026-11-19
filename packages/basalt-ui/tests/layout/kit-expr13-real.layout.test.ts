/**
 * Expression cycle 13 kit fixes on the real page shapes (`v3-expr-13-kit-fixes`, Issue 2468): the
 * charts of n57, n58 (round 0), n59 and n62 as their scenarios build them. A zone or rule caption
 * sits where no line, rule or other caption passes through it and gives way to a data label; an end
 * label is by its line's end or joined to it; a value past the cap is written once, with the true
 * number. Fixture: `fixture/kit-expr13-real-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, meet, paths, strikes } from './expr13-support'
import type { Box, Chart, Path } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const IDS = ['x13-cpu', 'x13-disk', 'x13-pools', 'x13-wind', 'x13-storm', 'x13-night'] as const

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('real', 'expr13')
})
afterAll(() => doc?.cleanup())

type Found = { chart: Chart; lines: Path[] }
const measured = new Map<number, Promise<Map<string, Found>>>()

/** The fixture's charts and their line paths at one viewport: one page per width. */
function measure(viewport: Viewport): Promise<Map<string, Found>> {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x13-night"] svg.ts-chart')
    await page.settle()
    const marks = await charts(page, IDS)
    return new Map(
      await Promise.all(
        marks.map(
          async (chart) => [chart.id, { chart, lines: await paths(page, chart.id) }] as const,
        ),
      ),
    )
  })()
  measured.set(viewport.width, found)
  return found
}

const pick = async (viewport: Viewport, id: string): Promise<Found> => {
  const found = (await measure(viewport)).get(id)
  if (found === undefined) throw new Error(`${id}: not measured`)
  return found
}
const textOf = (c: Chart, prefix: string): { text: string; box: Box }[] =>
  c.marks
    .filter((m) => m.tag === 'text' && m.key.startsWith(prefix))
    .map((m) => ({ text: m.text, box: m.box }))

const VIEWPORTS = [WIDE, PHONE]

const dist = (box: Box, p: { x: number; y: number }): number =>
  Math.hypot(Math.max(box.l - p.x, 0, p.x - box.r), Math.max(box.t - p.y, 0, p.y - box.b))
const near = (box: Box, line: Path): number => Math.min(...line.points.map((p) => dist(box, p)))
const lineOf = (f: Found, key: string): Path[] => f.lines.filter((l) => l.key.startsWith(`${key}:`))
const endOf = (f: Found, key: string): { x: number; y: number } => {
  const end = lineOf(f, key).at(-1)?.points.at(-1)
  if (end === undefined) throw new Error(`${f.chart.id}: no line ${key}`)
  return end
}
const rules = (c: Chart): Mark[] =>
  c.marks.filter((m) => m.tag === 'line' && /^ref-\d+:/.test(m.key))
type Mark = Chart['marks'][number]

layout('a zone caption sits where nothing passes through it (findings .3, .33, .54)', () => {
  for (const viewport of VIEWPORTS) {
    test(`no line, rule or other zone lies under a zone caption at ${viewport.width}`, async () => {
      const bad: string[] = []
      for (const id of ['x13-cpu', 'x13-wind', 'x13-storm', 'x13-night']) {
        const f = await pick(viewport, id)
        const zones = f.chart.marks.flatMap((m) => {
          const z = /^xzone-(\d+):/.exec(m.key)
          return z !== null && m.tag === 'rect' ? [{ i: Number(z[1]), box: m.box }] : []
        })
        for (const cap of f.chart.marks.filter(
          (m) => m.tag === 'text' && /^xzone-\d+-label:/.test(m.key),
        )) {
          const i = Number(/^xzone-(\d+)-label:/.exec(cap.key)?.[1])
          for (const l of f.lines)
            if (strikes(l, cap.box)) bad.push(`${id} ${cap.text}: struck by ${l.key.split(':')[0]}`)
          for (const r of rules(f.chart))
            if (cap.box.t < r.box.t && r.box.t < cap.box.b)
              bad.push(`${id} ${cap.text}: struck by ${r.key.split(':')[0]}`)
          for (const z of zones)
            if (z.i !== i && meet(cap.box, z.box)) bad.push(`${id} ${cap.text}: over zone ${z.i}`)
        }
      }
      expect(bad).toEqual([])
    })
  }

  test('the pegged CPU chart keeps its "edge silent" caption, off the forge line, at 1800', async () => {
    const f = await pick(WIDE, 'x13-cpu')
    const caption = textOf(f.chart, 'xzone-0-label:')
    expect(caption.map((c) => c.text)).toEqual(['edge silent'])
    const forge = lineOf(f, 'forge')
    for (const l of forge) expect(strikes(l, caption[0]!.box)).toBe(false)
  })

  for (const viewport of VIEWPORTS) {
    test(`n62's zones find a clean spot for a caption before dropping it at ${viewport.width}`, async () => {
      const f = await pick(viewport, 'x13-wind')
      const labels = f.chart.marks
        .filter((m) => m.tag === 'text' && /^xzone-\d+-label:/.test(m.key))
        .map((m) => m.text)
        .toSorted()
      // At 390 the narrow 'Gusty' zone sits between two others: no spot is clean, and it drops.
      expect(labels).toEqual(
        viewport.width === WIDE.width
          ? ['Gusty, 5 h', 'Offshore', 'Steady, 7 h']
          : ['Offshore', 'Steady, 7 h'],
      )
    })
  }
})

layout('a rule caption gives way to a data label (findings .14, .26)', () => {
  for (const viewport of VIEWPORTS) {
    test(`the vault label survives beside its line end and 'Limit' is clear of it at ${viewport.width}`, async () => {
      const f = await pick(viewport, 'x13-disk')
      const label = textOf(f.chart, 'text-').find((t) => t.text === 'vault 94 %')
      // The phone's plot leaves no room beside the end: there the label is dropped, never the caption's loser.
      if (viewport.width === WIDE.width) {
        expect(label).toBeDefined()
        expect(dist(label!.box, endOf(f, 'vault'))).toBeLessThan(14)
      }
      for (const cap of textOf(f.chart, 'ref-0-label:')) {
        if (label !== undefined) expect(meet(cap.box, label.box)).toBe(false)
        for (const l of f.lines) expect(strikes(l, cap.box)).toBe(false)
        for (const r of rules(f.chart))
          expect(cap.box.t < r.box.t && r.box.t < cap.box.b).toBe(false)
      }
    })

    test(`the Expiry caption is struck by no rule or line at ${viewport.width}`, async () => {
      const f = await pick(viewport, 'x13-pools')
      const [cap] = textOf(f.chart, 'xref-0-label:')
      expect(cap).toBeDefined()
      for (const r of rules(f.chart))
        expect(cap!.box.t < r.box.t && r.box.t < cap!.box.b).toBe(false)
      for (const l of f.lines) expect(strikes(l, cap!.box)).toBe(false)
    })
  }
})

layout(
  'an end label is by its own line end or joined to it by a leader (findings .12, .13, .27)',
  () => {
    const KEYS = ['team', 'teamProj', 'research', 'researchProj', 'batch'] as const
    for (const viewport of VIEWPORTS) {
      test(`every pool, the two-point stub included, keeps a label near its end or a leader to it at ${viewport.width}`, async () => {
        const f = await pick(viewport, 'x13-pools')
        const off: string[] = []
        for (const key of KEYS) {
          const [label] = textOf(f.chart, `${key}-end-label:`)
          if (label === undefined) {
            off.push(`${key}: no label`)
            continue
          }
          const leader = f.chart.marks.some((m) => m.key.startsWith(`${key}-end-leader:`))
          const own = dist(label.box, endOf(f, key))
          if (!leader && own > 24) off.push(`${key}: ${Math.round(own)} px from its end, no leader`)
          // Nearer to another line than to its own, and nothing joins it to its own (the phone's
          // plot has no free height for the longest label: it keeps the nearest one).
          if (!leader && viewport.width === WIDE.width) {
            const other = Math.min(
              ...KEYS.filter((k) => k !== key).flatMap((k) =>
                lineOf(f, k).map((l) => near(label.box, l)),
              ),
            )
            if (other + 1 < Math.min(...lineOf(f, key).map((l) => near(label.box, l))))
              off.push(`${key}: nearer to another line than to its own`)
          }
        }
        expect(off).toEqual([])
      })
    }

    test("'Team pool, out 27 Nov' sits beside its dashed line's end, not far below it, at 1800", async () => {
      const f = await pick(WIDE, 'x13-pools')
      const [label] = textOf(f.chart, 'teamProj-end-label:')
      expect(dist(label!.box, endOf(f, 'teamProj'))).toBeLessThan(24)
      expect(f.chart.marks.some((m) => m.key.startsWith('teamProj-end-leader:'))).toBe(false)
    })
  },
)

layout('a value past the cap is written once, with its true number (finding .56)', () => {
  const PEAK = '91 kt'
  for (const viewport of VIEWPORTS) {
    test(`the storm's clamp carries the 91 kt of the footer once, over no caret at ${viewport.width}`, async () => {
      const f = await pick(viewport, 'x13-storm')
      const values = f.chart.marks.filter(
        (m) => m.tag === 'text' && /^off-scale-[^:]*-value:/.test(m.key),
      )
      expect(values.filter((m) => m.text === PEAK)).toHaveLength(1)
      // Every other value is another series' own peak, never a point's neighbour's number.
      for (const v of values) expect(['91 kt', '51 kt']).toContain(v.text)
      const carets = f.chart.marks.filter(
        (m) => m.tag === 'text' && /^off-scale-[^:]*-top:/.test(m.key),
      )
      expect(carets.length).toBeGreaterThan(0)
      for (const v of values) for (const c of carets) expect(meet(v.box, c.box)).toBe(false)
    })
  }
})
