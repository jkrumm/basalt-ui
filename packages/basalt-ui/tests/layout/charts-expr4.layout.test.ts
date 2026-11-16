/**
 * The kit fixes of expression cycle 4 (`v3-expr-4-kit-fixes`) in real Chrome at 1800 and 390.
 * Asserted here because happy-dom has no geometry.
 *
 * The page is self-contained like `charts-kit-fixes.layout.test.ts`.
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
  scratch = mkdtempSync(join(tmpdir(), 'charts-expr4-'))
  const cssOut = join(scratch, 'charts-expr4.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-expr4.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-expr4: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-expr4-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-expr4: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-expr4</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="ex-fill"] svg')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

type Rect = { l: number; t: number; r: number; b: number }

const rectOf = (page: LayoutPage, selector: string): Promise<Rect> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return { l: r.left, t: r.top, r: r.right, b: r.bottom }
  }, selector)

layout('chart kit fixes, expression cycle 4', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('a fill chart fills its card box: nothing clipped at 390, no band at 1800', async () => {
        const page = await open(viewport)
        const box = await rectOf(page, '[data-testid="ex-fill"] [data-slot="chart-box"]')
        const svg = await rectOf(page, '[data-testid="ex-fill"] svg.ts-chart')
        const legend = await rectOf(
          page,
          '[data-testid="ex-fill"] [data-slot="chart-box"] [data-basalt-chart-legend]',
        )
        // Nothing of the plot or the legend leaves the clipping box.
        expect(svg.b).toBeLessThanOrEqual(box.b + 0.5)
        expect(legend.b).toBeLessThanOrEqual(box.b + 0.5)
        // The plot takes what the legend leaves: no empty band under the legend.
        expect(box.b - legend.b).toBeLessThanOrEqual(1)
        expect(legend.t - svg.b).toBeLessThanOrEqual(8)
        // The x axis is drawn: a tick label sits inside the box.
        const ticks = await page.raw.evaluate(
          () =>
            [...document.querySelectorAll('[data-testid="ex-fill"] svg text')].filter((t) =>
              /^\d+ \w+$|^\w+ \d+$/.test(t.textContent ?? ''),
            ).length,
        )
        expect(ticks).toBeGreaterThan(0)
      })

      test('a nine-character figure with a 30-character period fits without an ellipsis', async () => {
        const page = await open(viewport)
        const clipped = await page.raw.evaluate(() =>
          [...document.querySelectorAll('[data-testid="ex-figure"] [data-slot="chart-figure"] *')]
            .filter(
              (el) =>
                getComputedStyle(el).position !== 'absolute' && el.scrollWidth > el.clientWidth + 1,
            )
            .map((el) => el.textContent),
        )
        expect(clipped).toEqual([])
        const row = await rectOf(page, '[data-testid="ex-figure"] [data-slot="chart-figure"]')
        const inset = await rectOf(page, '[data-testid="ex-figure"] [data-slot="inset"]')
        expect(row.r).toBeLessThanOrEqual(inset.r + 0.5)
      })

      test('a StatCard and a DataTable are as tall loading as loaded', async () => {
        const page = await open(viewport)
        const height = async (id: string): Promise<number> => {
          const r = await rectOf(page, `[data-testid="${id}"]`)
          return r.b - r.t
        }
        expect(await height('ex-stat-loading')).toBeCloseTo(await height('ex-stat-ready'), 0)
        expect(await height('ex-table-loading')).toBeCloseTo(await height('ex-table-ready'), 0)
      })
    })
  }
})
