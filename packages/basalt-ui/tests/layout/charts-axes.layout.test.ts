/**
 * The three chart-axis props of `v3-expr-3-kit-fixes`, in real Chrome at 390 px: band `x.ticks` keeps
 * the first and the last label with no two overlapping, a rule `at: 'start'` falls between two bars,
 * a capping `y.domain` function spreads the normal dots and draws one off-scale caret on the top edge, and
 * `y.format` writes the tick text. Asserted here because happy-dom has no geometry.
 *
 * The page is self-contained: `fixture/charts-axes.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/charts-axes-fixture.tsx` is bundled in memory.
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
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-axes-'))
  const cssOut = join(scratch, 'charts-axes.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-axes.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`charts-axes: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-axes-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-axes: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-axes</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce')
  await page.raw.waitForSelector('[data-testid="ax-format"] svg')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

type Box = { l: number; r: number; t: number; b: number; text: string }

/** The boxes of every element matching `selector` inside the chart box `id`, left to right. */
const boxes = (page: LayoutPage, id: string, selector: string): Promise<Box[]> =>
  page.raw.evaluate(
    ({ testid, sel }) =>
      [...document.querySelectorAll(`[data-testid="${testid}"] ${sel}`)]
        .map((el) => {
          const r = el.getBoundingClientRect()
          return { l: r.left, r: r.right, t: r.top, b: r.bottom, text: el.textContent ?? '' }
        })
        .toSorted((a, b) => a.l - b.l),
    { testid: id, sel: selector },
  )

layout('chart axes', () => {
  test('band x with ticks: 3 shows the first and the last stage with no two labels touching', async () => {
    const page = await open(PHONE)
    const labels = await boxes(page, 'ax-band', 'text[data-ts-key^="x-tick-label"]')
    expect(labels.map((l) => l.text)).toEqual([
      'Planning the change',
      'Reading the files',
      'Verifying the patch',
    ])
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i]!.l, `${labels[i - 1]!.text} | ${labels[i]!.text}`).toBeGreaterThan(
        labels[i - 1]!.r,
      )
    }
    const [svg] = await boxes(page, 'ax-band', 'svg')
    expect(labels[0]!.l).toBeGreaterThanOrEqual(svg!.l - 0.5)
    expect(labels.at(-1)!.r).toBeLessThanOrEqual(svg!.r + 0.5)
  })

  test('a rule at: start sits in the gap before its band, between two bars', async () => {
    const page = await open(PHONE)
    const bars = await boxes(page, 'ax-edge', 'rect[data-ts-key^="bars:"]')
    const [rule] = await boxes(page, 'ax-edge', 'line[data-ts-key^="xref-0:"]')
    expect(bars).toHaveLength(5)
    // The rule is `at: 'start'` of the fourth band: past the third bar's right edge, before the fourth's left.
    expect(rule!.l).toBeGreaterThan(bars[2]!.r)
    expect(rule!.l).toBeLessThan(bars[3]!.l)
  })

  test('a capping y.domain spreads the normal dots and draws one caret on the top edge', async () => {
    const page = await open(PHONE)
    // The plot spans the first gridline (the ceiling) to the last (zero).
    const grid = await boxes(page, 'ax-clamp', 'line[data-ts-key^="y-grid"]')
    const plot = { t: Math.min(...grid.map((g) => g.t)), b: Math.max(...grid.map((g) => g.t)) }
    const dots = await boxes(page, 'ax-clamp', 'circle')
    expect(dots).toHaveLength(32)
    const centre = (d: Box): number => (d.t + d.b) / 2
    const normal = dots.slice(0, -1).map(centre)
    const height = plot.b - plot.t
    expect((Math.max(...normal) - Math.min(...normal)) / height).toBeGreaterThan(0.5)
    // The 40x outlier is drawn on the top edge, not above the plot.
    const outlier = dots.find((d) => d.l === Math.max(...dots.map((x) => x.l)))!
    expect(centre(outlier)).toBeCloseTo(plot.t, 0)
    const carets = await boxes(page, 'ax-clamp', 'text[data-ts-key^="off-scale-v-top"]')
    expect(carets).toHaveLength(1)
    expect(carets[0]!.text).toBe('▲')
    expect(carets[0]!.t).toBeGreaterThanOrEqual(plot.t - 1)
    expect(carets[0]!.t - plot.t).toBeLessThan(height * 0.15)
  })

  test('y.format writes the tick text, comma and all', async () => {
    const page = await open(PHONE)
    const ticks = (await boxes(page, 'ax-format', 'text[data-ts-key^="y-tick-label"]')).map(
      (t) => t.text,
    )
    expect(ticks.length).toBeGreaterThanOrEqual(2)
    for (const text of ticks) expect(text).toMatch(/^\d+,\d$/)
  })

  test('nothing pushes the page sideways', async () => {
    const page = await open(PHONE)
    const over = await page.raw.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(over).toBeLessThanOrEqual(0.5)
  })
})
