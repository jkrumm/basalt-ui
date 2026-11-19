/**
 * `IntervalTrack` at expression cycle 11's shapes, in real Chrome at 390 and 1800 px: no span label is
 * ellipsised (it is placed whole or dropped); every span draws at least 5.5 px, one-day marks
 * included; three coincident points in one row each keep their own mark; and the focus ring clears
 * every label, row label and tick. The page is self-contained, as `charts-interval-track.layout.test.ts`.
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
/** The narrowest a drawn span may be, px: the 6 px minimum less a rounding allowance. */
const MIN_MARK_PX = 5.5

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-interval-track-expr11-'))
  const cssOut = join(scratch, 'charts-interval-track.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-interval-track.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-interval-track-expr11: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-interval-track-expr11-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(
      `charts-interval-track-expr11: the fixture did not build:\n${build.logs.join('\n')}`,
    )
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-interval-track-expr11</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="expr11-card"] svg rect[data-ts-key^="focus-ring"]')
  await page.settle()
  return page
}

type Box = { l: number; t: number; r: number; b: number; w: number; h: number; text: string }
/** The focus ring as its stroke band: the outer edge 1.5 px out, the inner edge 2.5 px in. */
type Ring = { outer: Box; inner: Box }

type Probe = {
  /** Every span rect, drawn. */
  spans: Box[]
  /** Every span label the lane pass placed. */
  labels: Box[]
  /** Every text in the engine's svg: labels, row labels and x ticks. */
  texts: Box[]
  /** The focus ring's stroke band. */
  ring: Ring | null
  /** Every other drawn shape: anything that is not a span, a veil, a row extent or the grid. */
  others: Box[]
}

const probe = (page: LayoutPage): Promise<Probe> =>
  page.raw.evaluate(() => {
    const box = (el: Element, pad = 0): Box => {
      const r = el.getBoundingClientRect()
      return {
        l: r.left - pad,
        t: r.top - pad,
        r: r.right + pad,
        b: r.bottom + pad,
        w: r.width,
        h: r.height,
        text: el.textContent ?? '',
      }
    }
    const svg = document.querySelector('[data-testid="expr11-card"] svg')!
    const spans = [...svg.querySelectorAll('rect[data-ts-key^="span:"]')].map((el) => box(el))
    const labelEls = new Set(
      [...svg.querySelectorAll('[data-ts-key^="labels"]')].flatMap((el) =>
        el.tagName.toLowerCase() === 'text' ? [el] : [...el.querySelectorAll('text')],
      ),
    )
    const labels = [...labelEls].map((el) => box(el))
    const texts = [...svg.querySelectorAll('text')]
      .filter((el) => (el.textContent ?? '') !== '')
      .map((el) => box(el))
    const ringEl = svg.querySelector('rect[data-ts-key^="focus-ring"]')
    const ring = ringEl ? { outer: box(ringEl, 1.5), inner: box(ringEl, -2.5) } : null
    const others = [...svg.querySelectorAll('rect, circle, path')]
      .filter((el) => {
        const key = el.getAttribute('data-ts-key') ?? ''
        return (
          !/^(span:|dim|row-extent|grid|focus-ring)/.test(key) &&
          !el.closest('[data-ts-key^="labels"]')
        )
      })
      .map((el) => box(el))
    return { spans, labels, texts, ring, others }
  })

const meets = (a: Box, b: Box): boolean =>
  a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5
/** A box inside the ring's interior, clear of its stroke. */
const within = (outer: Box, b: Box): boolean =>
  b.l >= outer.l && b.r <= outer.r && b.t >= outer.t && b.b <= outer.b
/** A box that crosses the stroke: it meets the band and is not wholly inside the ring. */
const crossesRing = (ring: Ring, b: Box): boolean => meets(ring.outer, b) && !within(ring.inner, b)

layout('interval track, expression cycle 11 shapes', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('no span label is ellipsised: each is whole or dropped', async () => {
        const { labels } = await probe(await open(viewport))
        for (const l of labels) expect(l.text.endsWith('\u2026'), `"${l.text}" is cut`).toBe(false)
        expect(labels.length).toBeGreaterThan(0)
      })

      test('every span draws at least the minimum width, one-day marks included', async () => {
        const { spans } = await probe(await open(viewport))
        expect(spans.length).toBeGreaterThanOrEqual(8)
        for (const s of spans)
          expect(s.w, `a span is ${s.w} px`).toBeGreaterThanOrEqual(MIN_MARK_PX)
      })

      test('three coincident points in one row each keep their own mark', async () => {
        const { spans } = await probe(await open(viewport))
        // Points of one instant share a left edge; the three Filed marks are the only such group.
        const groups = new Map<number, Box[]>()
        for (const s of spans)
          groups.set(Math.round(s.l), [...(groups.get(Math.round(s.l)) ?? []), s])
        const stacked = [...groups.values()].find((g) => g.length === 3)
        expect(stacked, 'three marks share one instant').toBeDefined()
        const tops = new Set((stacked ?? []).map((s) => Math.round(s.t)))
        expect(tops.size).toBe(3)
        for (const s of stacked ?? []) expect(s.h).toBeGreaterThanOrEqual(4)
      })

      test('the focus ring clears every label, row label, tick and other mark', async () => {
        const { ring, texts, others } = await probe(await open(viewport))
        expect(ring, 'the focused mark draws a ring').not.toBeNull()
        if (!ring) return
        for (const t of texts)
          expect(crossesRing(ring, t), `the ring crosses "${t.text}"`).toBe(false)
        for (const o of others)
          expect(crossesRing(ring, o), 'the ring crosses another mark').toBe(false)
      })
    })
  }
})
