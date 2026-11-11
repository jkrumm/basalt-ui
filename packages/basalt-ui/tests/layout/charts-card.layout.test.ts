/**
 * v3 `ChartCard` (docs/v3/concepts/charts-cards-kanban.md section 9) in real Chrome at 1440, 768, 390
 * and 320. Asserted here because happy-dom has no geometry: the card is as tall in ready, loading,
 * stale, error and empty and as a Suspense fallback; a chart slot at twice the box height does not
 * move the card; a `fill` card takes its parent; the tooltip stays inside the card on both axes and
 * off the plot's tick labels; a failed series reads unavailable with the chart still drawn; nothing
 * pushes the page sideways; axe finds nothing serious or critical in either colour scheme.
 *
 * The page is self-contained: `fixture/charts-card.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/charts-card-fixture.tsx` is bundled in memory (its CSS modules included).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  PHONE_SMALL,
  TABLET_768,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-card-'))
  const cssOut = join(scratch, 'charts-card.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-card.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`charts-card: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-card-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-card: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  // The chart CSS modules come out as a sibling artifact: inline it beside the Tailwind sheet.
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-card</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="cc-tip"] svg')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

type Rect = { l: number; t: number; r: number; b: number; w: number; h: number }
const rectOf = (page: LayoutPage, selector: string): Promise<Rect> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }
  }, selector)

const CARD = (id: string): string => `[data-testid="${id}"] [data-slot="card"]`
const BOX = (id: string): string => `[data-testid="${id}"] [data-slot="chart-box"]`
const PHASES = ['cc-ready', 'cc-loading', 'cc-stale', 'cc-error', 'cc-empty'] as const

type AxeResult = { violations: { id: string; impact: string; nodes: { html: string }[] }[] }

layout('ChartCard', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('ready, loading, stale, error and empty are the same height, the Suspense fallback too', async () => {
        const page = await open(viewport)
        const heights: Record<string, number> = {}
        for (const id of PHASES) heights[id] = (await rectOf(page, CARD(id))).h
        const ready = heights['cc-ready']!
        for (const id of PHASES) expect(heights[id], id).toBeCloseTo(ready, 0)
        // The fallback states the same head, figure and footer, and has no chart to call.
        expect((await rectOf(page, CARD('cc-suspense'))).h).toBeCloseTo(ready, 0)
        const boxes = await Promise.all(PHASES.map((id) => rectOf(page, BOX(id))))
        for (const box of boxes) expect(box.h).toBeCloseTo(boxes[0]!.h, 0)
      })

      test('the phase prints on the card and the box', async () => {
        const page = await open(viewport)
        const seen = await page.raw.evaluate(
          (ids) =>
            ids.map((id) => [
              document
                .querySelector(`[data-testid="${id}"] [data-slot="card"]`)
                ?.getAttribute('data-phase'),
              document
                .querySelector(`[data-testid="${id}"] [data-slot="chart-box"]`)
                ?.getAttribute('data-phase'),
            ]),
          [...PHASES],
        )
        expect(seen).toEqual([
          ['ready', 'ready'],
          ['loading', 'loading'],
          ['stale', 'stale'],
          ['error', 'error'],
          ['empty', 'empty'],
        ])
      })

      test('a slot at 2x the box height does not move the card, and the box clips it', async () => {
        const page = await open(viewport)
        const small = await rectOf(page, CARD('cc-slot-small'))
        const tall = await rectOf(page, CARD('cc-slot-tall'))
        expect(tall.h).toBeCloseTo(small.h, 0)
        const box = await rectOf(page, BOX('cc-slot-tall'))
        const body = await rectOf(page, '[data-testid="cc-tall-body"]')
        expect(body.h).toBeGreaterThanOrEqual(2 * box.h)
        const clipped = await page.raw.evaluate(
          (sel) => getComputedStyle(document.querySelector(sel)!).overflow,
          BOX('cc-slot-tall'),
        )
        expect(clipped).toBe('clip')
      })

      test('a fill card takes its 420 px parent, the plot inside it', async () => {
        const page = await open(viewport)
        const parent = await rectOf(page, '[data-testid="cc-fill"]')
        const card = await rectOf(page, CARD('cc-fill'))
        const svg = await rectOf(page, `${BOX('cc-fill')} svg`)
        expect(card.h).toBeCloseTo(parent.h, 0)
        expect(svg.h).toBeGreaterThan(150)
        expect(svg.b).toBeLessThanOrEqual(card.b + 0.5)
      })

      test('the header, figure and footer share one left edge', async () => {
        const page = await open(viewport)
        const edges = await page.raw.evaluate(() => {
          const root = document.querySelector('[data-testid="cc-ready"]')!
          const pick = (sel: string): number =>
            root.querySelector(sel)!.getBoundingClientRect().left
          return [
            pick('[data-slot="icon-tile"]'),
            pick('[data-slot="chart-figure"]'),
            pick('[data-slot="chart-footer"] dt'),
          ]
        })
        expect(edges[0]).toBeCloseTo(edges[1]!, 0)
        expect(edges[0]).toBeCloseTo(edges[2]!, 0)
      })

      test('the failed series reads unavailable in the legend, the chart is still drawn', async () => {
        const page = await open(viewport)
        const probe = await page.raw.evaluate(() => {
          const root = document.querySelector('[data-testid="cc-failed"]')!
          const legend = root.querySelector('[data-legend-key="b"]')
          return {
            phase: root.querySelector('[data-slot="card"]')?.getAttribute('data-phase'),
            text: legend?.textContent,
            svg: root.querySelector('svg') !== null,
            alert: root.querySelector('[role="alert"]') !== null,
          }
        })
        expect(probe.phase).toBe('ready')
        expect(probe.text).toContain('unavailable')
        expect(probe.svg).toBe(true)
        expect(probe.alert).toBe(false)
      })

      test('nothing pushes the page sideways', async () => {
        const page = await open(viewport)
        const over = await page.raw.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(over).toBeLessThanOrEqual(0.5)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
          await page.raw.addScriptTag({ content: axeSource })
          const violations = await page.raw.evaluate(async () => {
            const axe = (window as unknown as { axe: { run: () => Promise<AxeResult> } }).axe
            const result = await axe.run()
            return result.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
          })
          expect(violations).toEqual([])
        })
      }
    })
  }

  describe('tooltip, desktop', () => {
    const TIP = '.ts-chart-tooltip'

    /** Hovers the plot at `fx`, `fy` (fractions of the svg) and returns the tooltip, the card and the tick labels. */
    async function hover(fx: number, fy: number) {
      const page = await open(DESKTOP_1440)
      const at = await page.raw.evaluate(
        ([x, y]) => {
          const svg = document.querySelector('[data-testid="cc-tip"] svg')!
          svg.scrollIntoView({ block: 'center' })
          const r = svg.getBoundingClientRect()
          return { x: r.left + r.width * x!, y: r.top + r.height * y! }
        },
        [fx, fy],
      )
      await page.raw.mouse.move(at.x - 8, at.y)
      await page.raw.mouse.move(at.x, at.y)
      await page.settle()
      await page.raw.waitForSelector(`[data-testid="cc-tip"] ${TIP}, ${TIP}`, { timeout: 3000 })
      return page.raw.evaluate((sel) => {
        const tip = document.querySelector(sel)!
        const t = tip.getBoundingClientRect()
        const c = document
          .querySelector('[data-testid="cc-tip"] [data-slot="card"]')!
          .getBoundingClientRect()
        // The axis tick labels: svg text in the lowest row of the plot's text.
        const texts = [...document.querySelectorAll('[data-testid="cc-tip"] svg text')].map((n) =>
          n.getBoundingClientRect(),
        )
        const lowest = Math.max(...texts.map((r) => r.top))
        const xTicks = texts.filter((r) => Math.abs(r.top - lowest) < 2)
        return {
          tip: { l: t.left, t: t.top, r: t.right, b: t.bottom },
          card: { l: c.left, t: c.top, r: c.right, b: c.bottom },
          ticks: xTicks.map((r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })),
        }
      }, TIP)
    }

    const inside = (
      a: { l: number; t: number; r: number; b: number },
      o: { l: number; t: number; r: number; b: number },
    ): boolean => a.l >= o.l - 0.5 && a.r <= o.r + 0.5 && a.t >= o.t - 0.5 && a.b <= o.b + 0.5
    const overlaps = (
      a: { l: number; t: number; r: number; b: number },
      o: { l: number; t: number; r: number; b: number },
    ): boolean => a.l < o.r && a.r > o.l && a.t < o.b && a.b > o.t

    for (const [name, fx] of [
      ['first point', 0.02],
      ['middle', 0.5],
      ['last point', 0.98],
    ] as const) {
      test(`${name}: the tooltip stays inside the card on both axes and covers no x tick label`, async () => {
        const seen = await hover(fx, 0.5)
        expect(inside(seen.tip, seen.card)).toBe(true)
        expect(seen.ticks.length).toBeGreaterThan(0)
        for (const tick of seen.ticks) expect(overlaps(seen.tip, tick)).toBe(false)
      })
    }
  })
})
