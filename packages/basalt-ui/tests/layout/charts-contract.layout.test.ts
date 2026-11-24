/**
 * The charts contract amendment of expression cycle 4 (`v3-expr-4-contract`) in real Chrome at 1800
 * and 390: a custom mark places three labels through `chartLabels.place` at the plot pixels
 * `plot.x`/`plot.y` give, clear of every dot; an x-range zone with a y bound and a caption draws
 * over a time axis and over a log axis. Asserted here because happy-dom has no geometry.
 *
 * The page is self-contained like `charts-kit-fixes.layout.test.ts`: the fixture's Tailwind entry
 * is compiled into a temp directory and its bundle is inlined in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
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
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [WIDE, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-contract-'))
  const cssOut = join(scratch, 'charts-contract.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-contract.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-contract: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-contract-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-contract: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-contract</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="cc-zone-log"] svg')
  await page.settle()
  return page
}

type Rect = { l: number; t: number; r: number; b: number }

const meets = (a: Rect, b: Rect): boolean => !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)

/** Every element matching `selector` inside the chart of `testid`, as screen rects. */
const rects = (page: LayoutPage, testid: string, selector: string): Promise<Rect[]> =>
  page.raw.evaluate(
    ({ id, sel }) =>
      [...document.querySelectorAll(`[data-testid="${id}"] svg.ts-chart ${sel}`)].map((e) => {
        const r = e.getBoundingClientRect()
        return { l: r.left, t: r.top, r: r.right, b: r.bottom }
      }),
    { id: testid, sel: selector },
  )

/** The plot area: the clip rect of the marks group, on screen. */
const plotRect = (page: LayoutPage, testid: string): Promise<Rect> =>
  page.raw.evaluate((id) => {
    const svg = document.querySelector(`[data-testid="${id}"] svg.ts-chart`)!
    const clip = svg.querySelector('clipPath rect') as SVGRectElement
    const m = (svg.querySelector('g[data-ts-key="marks"]') as SVGGElement).getScreenCTM()!
    const x = clip.x.baseVal.value
    const y = clip.y.baseVal.value
    return {
      l: m.e + m.a * x,
      t: m.f + m.d * y,
      r: m.e + m.a * (x + clip.width.baseVal.value),
      b: m.f + m.d * (y + clip.height.baseVal.value),
    }
  }, testid)

const captionRect = (page: LayoutPage, testid: string, label: string): Promise<Rect | null> =>
  page.raw.evaluate(
    ({ id, text }) => {
      const hit = [...document.querySelectorAll(`[data-testid="${id}"] svg text`)].find(
        (t) => t.textContent === text,
      )
      if (!hit) return null
      const r = hit.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    },
    { id: testid, text: label },
  )

layout('charts contract amendment', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('a custom mark places three labels through chartLabels, clear of every dot', async () => {
        const page = await open(viewport)
        const found = await Promise.all(
          ['Weekly digest', 'Receipts', 'Promo blast'].map((t) =>
            captionRect(page, 'cc-labels', t),
          ),
        )
        const labels = found.filter((r): r is Rect => r !== null)
        const dots = await rects(page, 'cc-labels', 'g[data-ts-key="d"] circle')
        const plot = await plotRect(page, 'cc-labels')
        expect(dots.length).toBe(12)
        expect(labels.length).toBe(3)
        for (const label of labels) {
          for (const dot of dots) expect(meets(label, dot)).toBe(false)
          expect(label.l).toBeGreaterThanOrEqual(plot.l - 0.5)
          expect(label.r).toBeLessThanOrEqual(plot.r + 0.5)
          expect(label.t).toBeGreaterThanOrEqual(plot.t - 0.5)
          expect(label.b).toBeLessThanOrEqual(plot.b + 0.5)
        }
        // Two labels may touch at a corner within a pixel: the engine places their ink, a text box is a line taller.
        const shrunk = (r: Rect): Rect => ({ l: r.l + 1, t: r.t + 1, r: r.r - 1, b: r.b - 1 })
        for (let i = 0; i < labels.length; i++)
          for (let j = i + 1; j < labels.length; j++)
            expect(meets(shrunk(labels[i]!), shrunk(labels[j]!))).toBe(false)
      })

      for (const [id, caption] of [
        ['cc-zone-time', 'Best window'],
        ['cc-zone-log', 'Mute'],
      ] as const)
        test(`${id}: an x zone is bounded on x and y and carries its caption`, async () => {
          const page = await open(viewport)
          const plot = await plotRect(page, id)
          const [zone] = await rects(page, id, 'g[data-ts-key="xzone-0"] rect')
          expect(zone).toBeDefined()
          const z = zone!
          // Bounded on x: it starts inside the plot; bounded on y: it stops short of the top.
          expect(z.l).toBeGreaterThan(plot.l + 1)
          expect(z.r).toBeLessThanOrEqual(plot.r + 0.5)
          expect(z.t).toBeGreaterThan(plot.t + 1)
          expect(Math.abs(z.b - plot.b)).toBeLessThan(1)
          const label = await captionRect(page, id, caption)
          expect(label).not.toBeNull()
          const l = label!
          // Under the zone's top edge, or above it where a line crosses the corner (cycle 13: a caption
          // is never struck through), inside the plot, starting at or after the zone's start.
          expect(l.t >= z.t - 0.5 || l.b <= z.t + 0.5).toBe(true)
          expect(l.l).toBeGreaterThanOrEqual(z.l - 0.5)
          expect(l.r).toBeLessThanOrEqual(plot.r + 0.5)
        })
    })
  }
})
