/**
 * The axis hover readout never lands on a tick label (`v3-expr-11-kit-fixes`, `expression-11.12`, `.42`,
 * `.55`), in real Chrome at the two review widths: with the pointer on the plot at a grid of positions,
 * the x and y value tags the crosshair draws on the axes do not intersect any tick label still painted,
 * and every tick label is back once the pointer leaves.
 *
 * The page is self-contained: `fixture/charts-expr11-readout.css` is compiled with the Tailwind CLI into
 * a temp directory and `fixture/charts-expr11-readout-fixture.tsx` is bundled in memory.
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
const DESKTOP: Viewport = { name: 'desktop', width: 1800, height: 1200 }
const CHARTS = ['ro-days', 'ro-int', 'ro-pct', 'ro-cur', 'ro-date', 'ro-band'] as const
const X_SHARES = Array.from({ length: 21 }, (_, i) => 0.03 + i * 0.047)
const Y_SHARES = [0.2, 0.5, 0.8]

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-expr11-readout-'))
  const cssOut = join(scratch, 'charts-expr11-readout.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-expr11-readout.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-expr11-readout: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-expr11-readout-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-expr11-readout: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-expr11-readout</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce')
  await page.raw.waitForSelector('[data-testid="ro-band"] svg')
  await page.settle()
  return page
}

type Box = { l: number; r: number; t: number; b: number; text: string }

type Seen = { readouts: Box[]; visibleTicks: Box[]; tickCount: number }

/** The readout tags and the painted tick labels of the chart box `id`, as the page shows them now. */
const seenIn = (page: LayoutPage, id: string): Promise<Seen> =>
  page.raw.evaluate((testid) => {
    const root = document.querySelector(`[data-testid="${testid}"]`)!
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- it runs in the page, so it takes nothing from this module
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, text: el.textContent ?? '' }
    }
    const ticks = [...root.querySelectorAll('text[data-ts-key*="-tick-label:"]')]
    return {
      readouts: [...root.querySelectorAll('.ts-chart__crosshair-label-text')]
        .filter((el) => getComputedStyle(el).visibility !== 'hidden')
        .map(box),
      visibleTicks: ticks.filter((el) => Number(getComputedStyle(el).opacity) > 0.01).map(box),
      tickCount: ticks.length,
    }
  }, id)

/** A text box is its line box; the ink is the glyphs' height inside it, so each side gives up the leading. */
const INK_LEADING = 2

const intersects = (a: Box, b: Box): boolean =>
  a.l < b.r &&
  b.l < a.r &&
  a.t + INK_LEADING < b.b - INK_LEADING &&
  b.t + INK_LEADING < a.b - INK_LEADING

layout('the axis hover readout against the tick labels', () => {
  for (const viewport of [DESKTOP, PHONE]) {
    describe(`${viewport.width}`, () => {
      for (const id of CHARTS) {
        test(`${id}: the readout never intersects a tick label, and the ticks return at rest`, async () => {
          const page = await open(viewport)
          const plot = await page.raw.evaluate((testid) => {
            const svg = document.querySelector(`[data-testid="${testid}"] svg`)!
            svg.scrollIntoView({ block: 'center' })
            const r = svg.getBoundingClientRect()
            return { l: r.left, t: r.top, w: r.width, h: r.height }
          }, id)
          const rest = await seenIn(page, id)
          expect(rest.tickCount).toBeGreaterThan(0)
          let read = 0
          for (const fy of Y_SHARES) {
            for (const fx of X_SHARES) {
              await page.raw.mouse.move(
                plot.l + plot.w * Math.max(0.02, fx - 0.02),
                plot.t + plot.h * fy,
              )
              await page.raw.mouse.move(plot.l + plot.w * fx, plot.t + plot.h * fy)
              await page.raw.evaluate(
                () => new Promise<void>((done) => requestAnimationFrame(() => done())),
              )
              const seen = await seenIn(page, id)
              if (seen.readouts.length > 0) read++
              for (const tag of seen.readouts)
                for (const tick of seen.visibleTicks)
                  expect(
                    intersects(tag, tick),
                    `${id} @${viewport.width} (${fx.toFixed(2)}, ${fy}): readout "${tag.text}" over tick "${tick.text}" ${JSON.stringify([tag, tick])}`,
                  ).toBe(false)
            }
          }
          expect(read, `${id}: the hover shows a readout`).toBeGreaterThan(0)
          await page.raw.mouse.move(2, 2)
          await page.raw.evaluate(
            () => new Promise<void>((done) => requestAnimationFrame(() => done())),
          )
          const after = await seenIn(page, id)
          expect(after.visibleTicks.length).toBe(rest.visibleTicks.length)
          expect(after.readouts.length).toBe(0)
        })
      }
    })
  }
})
