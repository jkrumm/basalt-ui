/**
 * The chart label behaviours of expression cycle 9 (`v3-expr-9-kit-fixes` 2, 3 and 4) in real
 * Chrome at 1800 and 390: a label `chartLabels.place` can fit stays on the plot, whole; a reference
 * caption stays off the series lines; a mark past a bounded `y.domain` carries its value beside the
 * caret. Asserted here because happy-dom has no geometry.
 *
 * Self-contained like `charts-kit-fixes.layout.test.ts`: the fixture's Tailwind entry is compiled
 * into a temp directory and its bundle is inlined in memory.
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
  scratch = mkdtempSync(join(tmpdir(), 'charts-labels-'))
  const cssOut = join(scratch, 'charts-labels.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-labels.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-labels: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-labels-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-labels: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-labels</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="kl-refs"] svg')
  await page.settle()
  return page
}

/** The plot's clip rect and the rect of every `<text>` whose content matches `pattern`, as screen rects. */
const texts = (page: LayoutPage, id: string, pattern: string) =>
  page.raw.evaluate(
    ({ testid, source }) => {
      const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
      const clip = svg.querySelector('clipPath rect') as SVGRectElement
      const m = (svg.querySelector('g[data-ts-key="marks"]') as SVGGElement).getScreenCTM()!
      const plot = {
        l: m.e + m.a * clip.x.baseVal.value,
        r: m.e + m.a * (clip.x.baseVal.value + clip.width.baseVal.value),
        t: m.f + m.d * clip.y.baseVal.value,
        b: m.f + m.d * (clip.y.baseVal.value + clip.height.baseVal.value),
      }
      const re = new RegExp(source)
      const found = [...svg.querySelectorAll('text')]
        .filter((t) => re.test(t.textContent ?? ''))
        .map((t) => {
          const r = t.getBoundingClientRect()
          return { text: t.textContent ?? '', l: r.left, t: r.top, r: r.right, b: r.bottom }
        })
      return { plot, found }
    },
    { testid: id, source: pattern },
  )

/** Points along every drawn series line of a card (a stroked path with no fill), as screen px. */
const linePoints = (page: LayoutPage, id: string) =>
  page.raw.evaluate((testid) => {
    const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
    const out: { x: number; y: number }[] = []
    for (const path of svg.querySelectorAll('path')) {
      const fill = getComputedStyle(path).fill
      const stroke = getComputedStyle(path).stroke
      if (fill !== 'none' || stroke === 'none') continue
      const m = path.getScreenCTM()!
      const length = path.getTotalLength()
      for (let at = 0; at <= length; at += 2) {
        const p = path.getPointAtLength(at)
        out.push({ x: m.e + m.a * p.x, y: m.f + m.d * p.y })
      }
    }
    return out
  }, id)

layout('chart labels', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('place keeps the top item label on the plot, whole', async () => {
        const page = await open(viewport)
        const { plot, found } = await texts(page, 'kl-top', '^Decision 2018')
        expect(found.length, 'the label is drawn').toBe(1)
        const label = found[0]!
        expect(label.l).toBeGreaterThanOrEqual(plot.l - 0.5)
        expect(label.r).toBeLessThanOrEqual(plot.r + 0.5)
        // A text element's box is a little taller than the label's line box: 2 px of ascender air.
        expect(label.t).toBeGreaterThanOrEqual(plot.t - 2)
        expect(label.b).toBeLessThanOrEqual(plot.b + 2)
      })

      test('a clamped mark shows its true value beside the caret', async () => {
        const page = await open(viewport)
        const { plot, found } = await texts(page, 'kl-top-extreme', '^41$')
        expect(found.length, 'the value is drawn').toBe(1)
        const value = found[0]!
        expect(value.l).toBeGreaterThanOrEqual(plot.l - 0.5)
        expect(value.r).toBeLessThanOrEqual(plot.r + 0.5)
        expect(value.t).toBeGreaterThanOrEqual(plot.t - 2)
      })

      test('a reference caption sits clear of the series lines', async () => {
        const page = await open(viewport)
        const { found } = await texts(page, 'kl-refs', '^(Bar needs|Crew limit)')
        expect(found.length, 'both captions are drawn').toBe(2)
        const points = await linePoints(page, 'kl-refs')
        expect(points.length, 'the lines are sampled').toBeGreaterThan(0)
        for (const c of found) {
          const hit = points.filter((p) => p.x > c.l && p.x < c.r && p.y > c.t && p.y < c.b)
          expect(hit.length, c.text).toBe(0)
        }
      })
    })
  }
})
