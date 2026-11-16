/**
 * The chart kit fixes of expression cycle 3 (`v3-expr-3-kit-fixes`) in real Chrome at 1800 and 390:
 * a reference caption clear of every bar, a legend row inside the chart box, every bar and the x
 * axis inside the default box at 390, a dot on the plot floor drawn whole, and a focused row below
 * the fold of its scroll region brought into view. Asserted here because happy-dom has no geometry.
 *
 * The page is self-contained like `charts-card.layout.test.ts`: the fixture's Tailwind entry is
 * compiled into a temp directory and its bundle is inlined in memory.
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
  scratch = mkdtempSync(join(tmpdir(), 'charts-kit-fixes-'))
  const cssOut = join(scratch, 'charts-kit-fixes.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-kit-fixes.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-kit-fixes: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-kit-fixes-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-kit-fixes: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-kit-fixes</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="kf-ref"] svg')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

type Rect = { l: number; t: number; r: number; b: number }

/** The bars of a card as screen rects (a bar is a filled `path` or `rect` of the `bars` mark). */
const barRects = (page: LayoutPage, id: string): Promise<Rect[]> =>
  page.raw.evaluate((testid) => {
    const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
    const marks = [...svg.querySelectorAll('g[data-ts-key="bars"] > rect')]
    return marks.map((m) => {
      const r = m.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    })
  }, id)

const captionRect = (page: LayoutPage, id: string, text: string): Promise<Rect | null> =>
  page.raw.evaluate(
    ({ testid, label }) => {
      const hit = [...document.querySelectorAll(`[data-testid="${testid}"] svg text`)].find(
        (t) => t.textContent === label,
      )
      if (!hit) return null
      const r = hit.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    },
    { testid: id, label: text },
  )

const meets = (a: Rect, b: Rect): boolean => !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)

const rectOf = (page: LayoutPage, selector: string): Promise<Rect> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return { l: r.left, t: r.top, r: r.right, b: r.bottom }
  }, selector)

layout('chart kit fixes', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('a reference caption keeps clear of every bar: it flips to a clear spot or drops', async () => {
        const page = await open(viewport)
        for (const id of ['kf-ref', 'kf-ref-start']) {
          const bars = await barRects(page, id)
          expect(bars.length, `${id} bars`).toBeGreaterThan(0)
          const caption = await captionRect(page, id, 'Need 7h')
          if (caption !== null) for (const bar of bars) expect(meets(caption, bar), id).toBe(false)
        }
        // Where the start is clear the caption keeps its line's name.
        expect(await captionRect(page, 'kf-ref-start', 'Need 7h')).not.toBeNull()
      })

      test('the legend row sits inside the chart box, whole', async () => {
        const page = await open(viewport)
        for (const id of ['kf-legend', 'kf-legend-free', 'kf-neg']) {
          const box = await rectOf(page, `[data-testid="${id}"] [data-slot="chart-box"]`)
          const legend = await rectOf(
            page,
            `[data-testid="${id}"] [data-slot="chart-box"] [data-basalt-chart-legend]`,
          )
          expect(legend.b, `${id} legend bottom`).toBeLessThanOrEqual(box.b + 0.5)
          expect(legend.t, `${id} legend top`).toBeGreaterThanOrEqual(box.t - 0.5)
        }
      })

      test('every bar and the x axis fit inside the default box', async () => {
        const page = await open(viewport)
        for (const id of ['kf-legend', 'kf-legend-free', 'kf-neg']) {
          const box = await rectOf(page, `[data-testid="${id}"] [data-slot="chart-box"]`)
          const bars = await barRects(page, id)
          expect(bars.length, `${id} bars`).toBeGreaterThan(0)
          for (const bar of bars) {
            expect(bar.b, `${id} bar bottom`).toBeLessThanOrEqual(box.b + 0.5)
            expect(bar.t, `${id} bar top`).toBeGreaterThanOrEqual(box.t - 0.5)
          }
          const ticks = await page.raw.evaluate(
            (testid) =>
              [...document.querySelectorAll(`[data-testid="${testid}"] svg text`)].filter((t) =>
                /^\d+ \w+$|^\w+ \d+$/.test(t.textContent ?? ''),
              ).length,
            id,
          )
          expect(ticks, `${id} x ticks`).toBeGreaterThan(0)
        }
      })

      test('a dot on the plot floor draws whole', async () => {
        const page = await open(viewport)
        const circle = await page.raw.evaluate(() => {
          const svg = document.querySelector('[data-testid="kf-dot"] svg.ts-chart')!
          const clip = svg.querySelector('clipPath rect') as SVGRectElement
          // The clip is in the marks group's user space: carry its bottom edge to the screen.
          const m = (svg.querySelector('g[data-ts-key="marks"]') as SVGGElement).getScreenCTM()!
          const clipBottom = m.f + m.d * (clip.y.baseVal.value + clip.height.baseVal.value)
          const all = [...svg.querySelectorAll('circle')].map((c) => c.getBoundingClientRect())
          // The lowest dot is the one at value 0.
          const low = all.reduce((a, b) => (b.bottom > a.bottom ? b : a))
          return { dotBottom: low.bottom, clipBottom, dots: all.length }
        })
        expect(circle.dots).toBeGreaterThan(0)
        expect(circle.dotBottom).toBeLessThanOrEqual(circle.clipBottom + 0.5)
      })
    })
  }

  test('a focused row below the fold of its scroll region is scrolled into view', async () => {
    const page = await open(PHONE)
    const before = await page.raw.evaluate(
      () => document.querySelector('[data-testid="kf-focus-list"]')!.scrollTop,
    )
    expect(before).toBe(0)
    await page.raw.click('[data-testid="kf-focus-set"]')
    await page.settle()
    const seen = await page.raw.evaluate(() => {
      const list = document.querySelector('[data-testid="kf-focus-list"]')!.getBoundingClientRect()
      const row = document.querySelector('[data-row="11"]')!.getBoundingClientRect()
      return { rowBottom: row.bottom, rowTop: row.top, listBottom: list.bottom, listTop: list.top }
    })
    expect(seen.rowBottom).toBeLessThanOrEqual(seen.listBottom + 0.5)
    expect(seen.rowTop).toBeGreaterThanOrEqual(seen.listTop - 0.5)
  })
})
