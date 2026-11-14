/**
 * A waterfall drawn on an HTML track through the geometry seam (`v3-expr-2-seam-tracks`), in real
 * Chrome at 390 and 1800 px, both schemes for the paint checks. Asserted here because happy-dom has
 * no geometry: every shown tick label is one line inside the track, the end tick sits flush with
 * the track's end, no two shown tick labels touch, no drawn gridline crosses a row label, every row
 * label stays inside its track, the legend row draws its four swatch shapes, the wider page shows
 * more ticks, and nothing pushes the page sideways.
 *
 * The page is self-contained: `fixture/charts-seam-track.css` is compiled with the Tailwind CLI into
 * a temp directory and `fixture/charts-seam-track-fixture.tsx` is bundled in memory.
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
const WIDE_1800: Viewport = { name: 'wide desktop', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [PHONE, WIDE_1800]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-seam-track-'))
  const cssOut = join(scratch, 'charts-seam-track.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-seam-track.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-seam-track: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-seam-track-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-seam-track: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-seam-track</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="st-card"] [data-track]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

type R = { l: number; t: number; r: number; b: number; h: number }

type Probe = {
  axis: R
  ticks: (R & { text: string; fontSize: number })[]
  rows: { track: R; labels: (R & { text: string })[]; lines: R[] }[]
  swatches: string[]
}

/** Every shown box in the fixture: the axis and its ticks, each row's track, labels and lines. */
const probe = (page: LayoutPage): Promise<Probe> =>
  page.raw.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }
    }
    const shown = (el: Element) => getComputedStyle(el).display !== 'none'
    const root = document.querySelector('[data-testid="st-card"]')!
    const axisEl = root.querySelector('[data-axis]')!
    return {
      axis: box(axisEl),
      ticks: [...axisEl.querySelectorAll('[data-tick]')].filter(shown).map((el) => ({
        ...box(el),
        text: el.textContent ?? '',
        fontSize: Number.parseFloat(getComputedStyle(el).fontSize),
      })),
      rows: [...root.querySelectorAll('[data-track]')].map((track) => ({
        track: box(track),
        labels: [...track.querySelectorAll('[data-row-label]')].map((el) => ({
          ...box(el),
          text: el.textContent ?? '',
        })),
        lines: [...track.querySelectorAll('[data-gridline]')].filter(shown).map(box),
      })),
      swatches: [...root.querySelectorAll('[data-slot="chart-legend"] span[aria-hidden="true"]')]
        .filter(shown)
        .map((el) => {
          const s = getComputedStyle(el)
          const round = s.borderTopLeftRadius === '50%'
          const open = Number.parseFloat(s.borderTopWidth) > 0
          return round ? (open ? 'ring' : 'dot') : open ? 'hollow' : 'bar'
        }),
    }
  })

layout('seam track', () => {
  const counts: Record<string, number> = {}

  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('every shown tick is one line inside the track, the end tick flush with its end', async () => {
        const page = await open(viewport)
        const { axis, ticks } = await probe(page)
        counts[viewport.name] = ticks.length
        expect(ticks.length).toBeGreaterThanOrEqual(2)
        for (const t of ticks) {
          expect(t.h, `"${t.text}" wraps`).toBeLessThan(t.fontSize * 2)
          expect(t.l).toBeGreaterThanOrEqual(axis.l - 0.5)
          expect(t.r).toBeLessThanOrEqual(axis.r + 0.5)
        }
        const end = ticks.at(-1)!
        expect(end.text).toBe('9 s')
        expect(end.r).toBeCloseTo(axis.r, 0)
        expect(ticks[0]!.l).toBeCloseTo(axis.l, 0)
      })

      test('no two shown tick labels touch', async () => {
        const page = await open(viewport)
        const { ticks } = await probe(page)
        const sorted = ticks.toSorted((a, b) => a.l - b.l)
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i]!.l, `${sorted[i - 1]!.text} | ${sorted[i]!.text}`).toBeGreaterThan(
            sorted[i - 1]!.r,
          )
        }
      })

      test('no drawn gridline crosses a row label, and every row label stays in its track', async () => {
        const page = await open(viewport)
        const { rows } = await probe(page)
        const labelled = rows.filter((row) => row.labels.length > 0)
        expect(labelled.length).toBeGreaterThan(0)
        for (const row of rows) {
          for (const label of row.labels) {
            expect(label.l).toBeGreaterThanOrEqual(row.track.l - 0.5)
            expect(label.r).toBeLessThanOrEqual(row.track.r + 0.5)
            for (const line of row.lines) {
              const crosses = line.r > label.l && line.l < label.r
              expect(crosses, `a gridline at ${line.l} crosses "${label.text}"`).toBe(false)
            }
          }
        }
        // The rows still draw gridlines where no label sits.
        expect(rows.some((row) => row.lines.length > 0)).toBe(true)
      })

      test('the legend row draws the bar, hollow, dot and ring swatch shapes', async () => {
        const page = await open(viewport)
        const { swatches } = await probe(page)
        expect([...new Set(swatches)].toSorted()).toEqual(['bar', 'dot', 'hollow', 'ring'])
      })

      test('nothing pushes the page sideways', async () => {
        const page = await open(viewport)
        const over = await page.raw.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(over).toBeLessThanOrEqual(0.5)
      })
    })
  }

  test('the wide page shows more ticks than the phone', async () => {
    for (const viewport of VIEWPORTS) {
      const page = await open(viewport)
      counts[viewport.name] = (await probe(page)).ticks.length
    }
    expect(counts[WIDE_1800.name]!).toBeGreaterThan(counts[PHONE.name]!)
  })
})
