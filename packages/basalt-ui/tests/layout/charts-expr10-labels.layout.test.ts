/**
 * The labels that name the answer in real Chrome at 1800 and 390 (`v3-expr-10-kit-fixes` 1 and 2):
 * the value label of the extreme bar under a rule, a run label on a zone that lines cross, a rule
 * label among dense dots, and `Lines` end labels that sit clear of every line. Asserted here
 * because happy-dom has no geometry.
 *
 * Self-contained like `charts-labels.layout.test.ts`: the fixture's Tailwind entry is compiled into
 * a temp directory and its bundle is inlined in memory.
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
  scratch = mkdtempSync(join(tmpdir(), 'charts-expr10-labels-'))
  const cssOut = join(scratch, 'charts-expr10-labels.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-expr10-labels.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-expr10-labels: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-expr10-labels-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-expr10-labels: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-expr10-labels</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="e10-end"] svg')
  await page.settle()
  return page
}

type Rect = { l: number; t: number; r: number; b: number }

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

const inside = (box: Rect, plot: Rect): boolean =>
  box.l >= plot.l - 0.5 && box.r <= plot.r + 0.5 && box.t >= plot.t - 2 && box.b <= plot.b + 2

layout('labels that name the answer', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test("the extreme bar's value label survives a rule through the bar", async () => {
        const page = await open(viewport)
        const { plot, found } = await texts(page, 'e10-bar', '^51%$')
        expect(found.length, 'the peak label is drawn').toBe(1)
        expect(inside(found[0]!, plot)).toBe(true)
      })

      test('every run label of a zone that lines cross is drawn', async () => {
        const page = await open(viewport)
        const { plot, found } = await texts(page, 'e10-zone', '^\\d h$')
        const drawn = found.map((f) => f.text).toSorted()
        // A caption is never struck through (cycle 13): one that finds no clean spot is dropped. The phone's plot
        // takes the whole frame (no y gutter), so the last zone's caption finds its spot too.
        expect(drawn).toEqual(['5 h', '6 h', '7 h', '8 h', '9 h'])
        for (const f of found) expect(inside(f, plot), f.text).toBe(true)
      })

      test('a rule label among dense dots is drawn', async () => {
        const page = await open(viewport)
        const { plot, found } = await texts(page, 'e10-today', '^Today$')
        expect(found.length, 'the rule label is drawn').toBe(1)
        expect(inside(found[0]!, plot)).toBe(true)
      })

      test('end labels sit clear of every line', async () => {
        const page = await open(viewport)
        const { found } = await texts(page, 'e10-end', '^(CPU|Memory|Disk)$')
        expect(found.map((f) => f.text).toSorted()).toEqual(['CPU', 'Disk', 'Memory'])
        const points = await linePoints(page, 'e10-end')
        expect(points.length, 'the lines are sampled').toBeGreaterThan(0)
        for (const c of found) {
          // The label's own line ends beside it: the box is the glyph band, a pixel of air in.
          const hit = points.filter(
            (p) => p.x > c.l + 1 && p.x < c.r - 1 && p.y > c.t + 2 && p.y < c.b - 2,
          )
          expect(hit.length, c.text).toBe(0)
        }
      })
    })
  }
})
