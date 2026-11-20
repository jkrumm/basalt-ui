/**
 * Expression cycle 15 kit fixes (`v3-expr-15-kit-fixes` 1 and 2), bar value labels in real Chrome at 1800
 * and 390: a label is kept where its bar has room, and keeps off the zone captions and rules.
 * Fixture: `fixture/kit-expr15-labels-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, meet } from './expr13-support'
import type { Chart } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const IDS = ['x15-net', 'x15-stars', 'x15-picks', 'x15-months'] as const

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('labels', 'expr15')
})
afterAll(() => doc?.cleanup())

const measured = new Map<number, Promise<Map<string, Chart>>>()
function measure(viewport: Viewport): Promise<Map<string, Chart>> {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x15-months"] svg.ts-chart')
    await page.settle()
    return new Map((await charts(page, IDS)).map((c) => [c.id, c] as const))
  })()
  measured.set(viewport.width, found)
  return found
}
const values = (c: Chart) =>
  c.marks.filter((m) => m.tag === 'text' && m.key.startsWith('bar-values-'))

const captionsOf = (c: Chart) =>
  c.marks.filter(
    (m) =>
      m.tag === 'text' &&
      (m.key.startsWith('xzone-') || m.key.startsWith('ref-') || m.key.startsWith('xref-')),
  )
const names = (c: Chart): string[] => values(c).map((m) => m.text)

layout('bar value labels', () => {
  for (const viewport of [WIDE, PHONE]) {
    describe(viewport.name, () => {
      test('a negative bar keeps its value (n70 Gift, a bar at the floor of its domain)', async () => {
        const net = (await measure(viewport)).get('x15-net')!
        expect(names(net)).toContain('\u2212€60')
        expect(names(net)).toHaveLength(9)
      })

      test('the tallest bar of a fixed domain keeps its value (n71 3 stars)', async () => {
        const stars = (await measure(viewport)).get('x15-stars')!
        expect(names(stars)).toContain('1,740')
        expect(names(stars)).toHaveLength(6)
      })

      test('a stack total under a zone caption is kept (n64 92, Gateway down)', async () => {
        const picks = (await measure(viewport)).get('x15-picks')!
        expect(names(picks)).toContain('92')
      })

      test('a named stack total is kept and no value label meets a caption or another label (n68)', async () => {
        const all = await measure(viewport)
        expect(names(all.get('x15-months')!)).toContain('85/129')
        for (const id of IDS) {
          const chart = all.get(id)!
          const labels = values(chart)
          for (const [i, label] of labels.entries()) {
            for (const caption of captionsOf(chart))
              expect(
                meet(label.box, caption.box),
                `${id}: ${label.text} over ${caption.text}`,
              ).toBe(false)
            for (const other of labels.slice(i + 1))
              expect(meet(label.box, other.box), `${id}: ${label.text} over ${other.text}`).toBe(
                false,
              )
          }
        }
      })
    })
  }
})
