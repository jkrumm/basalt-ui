/**
 * `IntervalTrack` (Issue 2306) in real Chrome at 390 and 1800 px: the labels the lane pass places
 * are one line each, inside the plot, never on one another, and the wide page places more of them
 * than the phone (the rest are cut or dropped, never pushed off); the row labels stay left of the
 * plot and apart; the x ticks are whole hours; nothing pushes the page sideways.
 *
 * The page is self-contained: `fixture/charts-interval-track.css` is compiled with the Tailwind CLI
 * into a temp directory and `fixture/charts-interval-track-fixture.tsx` is bundled in memory.
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
/** Spans with a label in the fixture: every one but none. */
const LABELLED = 24

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-interval-track-'))
  const cssOut = join(scratch, 'charts-interval-track.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-interval-track.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-interval-track: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-interval-track-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-interval-track: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-interval-track</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="it-card"] svg rect[data-ts-key^="span:"]')
  await page.settle()
  return page
}

type R = { l: number; t: number; r: number; b: number; h: number; text: string }

type Probe = {
  svg: R
  /** The plot's left edge: the leftmost span or row extent. */
  plotLeft: number
  labels: R[]
  rows: R[]
  ticks: R[]
}

const probe = (page: LayoutPage): Promise<Probe> =>
  page.raw.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return {
        l: r.left,
        t: r.top,
        r: r.right,
        b: r.bottom,
        h: r.height,
        text: el.textContent ?? '',
      }
    }
    const svg = document.querySelector('[data-testid="it-card"] svg')!
    const svgBox = box(svg)
    const marks = [
      ...svg.querySelectorAll('rect[data-ts-key^="span:"], rect[data-ts-key^="row-extent"]'),
    ]
    const labelEls = new Set(
      [...svg.querySelectorAll('[data-ts-key^="labels"]')].flatMap((el) =>
        el.tagName.toLowerCase() === 'text' ? [el] : [...el.querySelectorAll('text')],
      ),
    )
    const labels = [...labelEls].map(box)
    const texts = [...svg.querySelectorAll('text')].map(box)
    const labelSet = new Set(labels.map((l) => `${l.l}|${l.t}|${l.text}`))
    const rest = texts.filter((t) => !labelSet.has(`${t.l}|${t.t}|${t.text}`) && t.text !== '')
    const plotLeft = Math.min(...marks.map((m) => m.getBoundingClientRect().left))
    return {
      svg: svgBox,
      plotLeft,
      labels,
      rows: rest.filter((t) => /^(Mon|Tue|Wed|Thu|Fri)/.test(t.text)),
      ticks: rest.filter((t) => /^\d\d:\d\d$/.test(t.text)),
    }
  })

const meets = (a: R, b: R): boolean =>
  a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5

layout('interval track', () => {
  const counts: Record<string, number> = {}

  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('every placed label is one line inside the plot, and no two touch', async () => {
        const page = await open(viewport)
        const { svg, plotLeft, labels } = await probe(page)
        counts[viewport.name] = labels.length
        expect(labels.length).toBeGreaterThan(0)
        for (const l of labels) {
          expect(l.h, `"${l.text}" wraps`).toBeLessThan(24)
          expect(l.l, `"${l.text}" starts left of the plot`).toBeGreaterThanOrEqual(plotLeft - 0.5)
          expect(l.r, `"${l.text}" overruns the chart`).toBeLessThanOrEqual(svg.r + 0.5)
        }
        for (let i = 0; i < labels.length; i++)
          for (let j = i + 1; j < labels.length; j++)
            expect(
              meets(labels[i]!, labels[j]!),
              `"${labels[i]!.text}" meets "${labels[j]!.text}"`,
            ).toBe(false)
      })

      test('the row labels sit left of the plot and apart', async () => {
        const page = await open(viewport)
        const { plotLeft, rows } = await probe(page)
        expect(rows.map((r) => r.text.slice(0, 3))).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
        for (const r of rows) expect(r.r).toBeLessThanOrEqual(plotLeft + 0.5)
        for (let i = 1; i < rows.length; i++)
          expect(rows[i]!.t).toBeGreaterThanOrEqual(rows[i - 1]!.b - 0.5)
      })

      test('the x ticks are whole hours and do not touch', async () => {
        const page = await open(viewport)
        const { ticks } = await probe(page)
        expect(ticks.length).toBeGreaterThanOrEqual(2)
        for (const t of ticks) expect(t.text.endsWith(':00')).toBe(true)
        const sorted = ticks.toSorted((a, b) => a.l - b.l)
        for (let i = 1; i < sorted.length; i++)
          expect(sorted[i]!.l).toBeGreaterThan(sorted[i - 1]!.r)
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

  test('the wide page places more labels than the phone, and the phone drops some', async () => {
    for (const viewport of VIEWPORTS)
      counts[viewport.name] = (await probe(await open(viewport))).labels.length
    expect(counts[WIDE_1800.name]!).toBeGreaterThan(counts[PHONE.name]!)
    expect(counts[PHONE.name]!).toBeLessThan(LABELLED)
  })
})
