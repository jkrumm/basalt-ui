/**
 * Charts work without the React Compiler, and a page of shipped chart parts passes `shot detect`
 * (Issue 2823). The fixture is a stock app's page: every kind that takes a `useChartFocus` is
 * written with data, accessors, series, legend, tooltip and domain created anew on each render, in
 * the production bundle and with no compiler. Fixture: `fixture/kit-parts-inline-fixture.tsx`.
 *
 * - hovering and keying a mark of each kind settles: no error, a bounded render count, and no render
 *   once the pointer rests;
 * - `shot detect`'s own measurer and rules, run on each card of the page, find no P0 or P1;
 * - the legend toggle is at least the 24 px hit floor each way, at both shot viewports.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { HIT_FINE } from '../../src/common/hit-floor'
import { readScaleInPage } from '../../src/cli/shot/capture'
import { detectFindings } from '../../src/cli/shot/detect'
import { finishMeasurement, measureAnchor } from '../../src/cli/shot/measure'
import type { Scheme, ShotMetrics } from '../../src/cli/shot/types'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'
import type { FixtureSpec } from './fixture/spec'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
/** The two viewports `shot` renders by default (`DEFAULT_VIEWPORTS`). */
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const VIEWPORTS = [PHONE, WIDE] as const
const KINDS = ['p-lines', 'p-bars', 'p-heat', 'p-cartesian', 'p-track'] as const
const CARDS = ['p-lines', 'p-bars', 'p-heat'] as const

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('inline', 'parts')
})
afterAll(() => doc?.cleanup())

type Probe = { renders: Record<string, number>; errors: string[] }

async function open(viewport: Viewport, scheme: Scheme = 'light'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="p-heat"] .ts-chart-host svg')
  await page.raw.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme)
  await page.settle()
  return page
}

const probe = (page: LayoutPage): Promise<Probe> =>
  page.raw.evaluate(() => (window as unknown as { fixtureProbe: Probe }).fixtureProbe)

const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

for (const viewport of VIEWPORTS) {
  layout(`focus without the React Compiler at ${viewport.name}`, () => {
    for (const id of KINDS) {
      test(`${id}: a pointer and a key focus settle`, async () => {
        const page = await open(viewport)
        const name = id.replace('p-', '')
        const host = page.raw.locator(`[data-testid="${id}"] .ts-chart-host svg`).first()
        await host.scrollIntoViewIfNeeded()
        const box = (await host.boundingBox())!
        // A sweep across the plot: every step is a new focused mark and a new definition.
        for (const [x, y] of [
          [0.15, 0.3],
          [0.4, 0.5],
          [0.65, 0.4],
          [0.85, 0.6],
        ] as const) {
          await page.raw.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 3 })
        }
        await settle(300)
        const wrap = page.raw.locator(`[data-testid="${id}"] [data-chart-focus]`).first()
        if ((await wrap.count()) > 0) {
          await wrap.focus()
          await page.raw.keyboard.press('ArrowRight')
          await page.raw.keyboard.press('ArrowRight')
          await settle(300)
        }
        const after = await probe(page)
        expect(after.errors, `${id} errors`).toEqual([])
        expect(after.renders[name] ?? 0, `${id} renders`).toBeLessThan(60)
        // At rest nothing renders again: a loop that React has not yet stopped would still be counting.
        await settle(800)
        expect((await probe(page)).renders[name], `${id} renders at rest`).toBe(after.renders[name])
      })
    }

    test('the heat grid and the table that holds its rows settle together', async () => {
      const page = await open(viewport)
      const row = page.raw.locator('[data-testid="p-heat-table"] [role="row"]').nth(2)
      await row.scrollIntoViewIfNeeded()
      await row.hover()
      await settle(400)
      const host = page.raw.locator('[data-testid="p-heat"] .ts-chart-host svg').first()
      await host.scrollIntoViewIfNeeded()
      const box = (await host.boundingBox())!
      await page.raw.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 4 })
      await settle(400)
      const after = await probe(page)
      expect(after.errors).toEqual([])
      expect(after.renders.heat ?? 0).toBeLessThan(60)
    })
  })
}

for (const viewport of VIEWPORTS) {
  for (const scheme of ['light', 'dark'] as const) {
    layout(`shot detect on a page of shipped chart parts at ${viewport.name}, ${scheme}`, () => {
      test('finds no P0 or P1', async () => {
        const page = await open(viewport, scheme)
        const steps = await page.raw.evaluate(readScaleInPage)
        const label = `${viewport.width}x${viewport.height}`
        const anchors: ShotMetrics['anchors'] = []
        for (const id of CARDS) {
          const card = page.raw.locator(`[data-testid="${id}"] [data-slot="chart-card"]`)
          await card.scrollIntoViewIfNeeded()
          const reading = finishMeasurement(await card.evaluate(measureAnchor))
          anchors.push({ route: '/', name: id, scheme, viewport: label, ...reading })
        }
        const metrics: ShotMetrics = {
          version: 1,
          generatedAt: '',
          base: '',
          routes: ['/'],
          viewports: [label],
          schemes: [scheme],
          states: [],
          scale: [{ scheme, viewport: label, ...steps }],
          anchors,
          shots: [],
        }
        const blocking = detectFindings(metrics).filter(
          (f) => f.severity === 'P0' || f.severity === 'P1',
        )
        expect(
          blocking.map((f) => `${f.anchor} ${f.rule}: ${f.defect}`),
          'the P0 and P1 findings',
        ).toEqual([])
      })
    })
  }

  layout(`the legend toggle at ${viewport.name}`, () => {
    test('is at least the hit floor each way', async () => {
      const page = await open(viewport)
      const toggles = page.raw.locator('[data-testid="p-bars"] button[data-legend-key]')
      expect(await toggles.count()).toBeGreaterThan(1)
      const boxes = await toggles.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { key: el.getAttribute('data-legend-key'), w: r.width, h: r.height }
        }),
      )
      for (const { key, w, h } of boxes) {
        expect(w, `${key} width`).toBeGreaterThanOrEqual(HIT_FINE)
        expect(h, `${key} height`).toBeGreaterThanOrEqual(HIT_FINE)
      }
    })
  })
}
