/**
 * The labels that name the answer in real Chrome at 1800 and 390 (`v3-expr-11-kit-fixes` 4 and 6a):
 * every bar clamped by a bounded axis shows its true value beside its caret, the value clears the
 * caret and the zone label, in both color schemes. Asserted here because happy-dom has no geometry.
 * A value standing on a bar reads at 4.5:1 against the bar's flattened fill, and no value runs over a
 * gridline.
 *
 * Self-contained like `charts-expr10-labels.layout.test.ts`: the fixture's Tailwind entry is compiled
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
const SCHEMES = ['light', 'dark'] as const

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-expr11-labels-'))
  const cssOut = join(scratch, 'charts-expr11-labels.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-expr11-labels.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-expr11-labels: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-expr11-labels-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-expr11-labels: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-expr11-labels</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme: (typeof SCHEMES)[number]): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="e11-cost"] svg')
  await page.raw.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme)
  await page.settle()
  return page
}

type Rect = { l: number; t: number; r: number; b: number }
type Found = { text: string; rect: Rect }

/** The texts of one card whose content matches `source`: their screen rects, fills and the ink behind them. */
const texts = (page: LayoutPage, id: string, source: string): Promise<Found[]> =>
  page.raw.evaluate(
    ({ testid, pattern }) => {
      const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
      const re = new RegExp(pattern)
      return [...svg.querySelectorAll('text')]
        .filter((t) => re.test(t.textContent ?? ''))
        .map((t) => {
          const r = t.getBoundingClientRect()
          return {
            text: t.textContent ?? '',
            rect: { l: r.left, t: r.top, r: r.right, b: r.bottom },
          }
        })
    },
    { testid: id, pattern: source },
  ) as Promise<Found[]>

/** Whether two screen rects share any area. */
const meet = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

type Ink = { text: string; ratio: number; onBar: boolean }

/**
 * The value labels of one card standing on a bar, with the contrast of their computed fill against the
 * bar's fill flattened over the card, and the gridlines they meet. Colors go through a canvas, which
 * resolves any CSS color (the label's is a relative color) to RGB.
 */
const inkOf = (page: LayoutPage, id: string, source: string) =>
  page.raw.evaluate(
    ({ testid, pattern }) => {
      const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const rgb = (css: string, over: string | null): [number, number, number] => {
        ctx.clearRect(0, 0, 1, 1)
        if (over !== null) {
          ctx.fillStyle = over
          ctx.fillRect(0, 0, 1, 1)
        }
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0]
      }
      const lum = ([r, g, b]: [number, number, number]): number => {
        const lin = (v: number): number => {
          const c = v / 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      }
      const card = getComputedStyle(svg).getPropertyValue('--basalt-card').trim()
      const bars = [...svg.querySelectorAll('g.ts-chart__bar-y rect')].map((r) => ({
        rect: r.getBoundingClientRect(),
        fill: rgb(getComputedStyle(r).fill, card),
      }))
      const grid = [...svg.querySelectorAll('g.ts-chart__grid line')].map((l) =>
        l.getBoundingClientRect(),
      )
      const re = new RegExp(pattern)
      return [...svg.querySelectorAll('text')]
        .filter((t) => re.test(t.textContent ?? ''))
        .map((t) => {
          const r = t.getBoundingClientRect()
          // Standing on a bar: the label's middle is inside the bar (a box that grazes its edge is not).
          const cx = (r.left + r.right) / 2
          const cy = (r.top + r.bottom) / 2
          const under = bars.find(
            (b) => b.rect.left < cx && cx < b.rect.right && b.rect.top < cy && cy < b.rect.bottom,
          )
          const ink = rgb(getComputedStyle(t).fill, null)
          const [hi, lo] = under ? [lum(ink), lum(under.fill)].toSorted((a, b) => b - a) : [1, 1]
          return {
            text: t.textContent ?? '',
            onBar: under !== undefined,
            ratio: ((hi as number) + 0.05) / ((lo as number) + 0.05),
            gridline: grid.some(
              (g) => r.left < g.right && g.left < r.right && r.top < g.bottom && g.top < r.bottom,
            ),
          }
        })
    },
    { testid: id, pattern: source },
  ) as Promise<(Ink & { gridline: boolean })[]>

type Part = { kind: string; text: string; rect: Rect }

/**
 * Every part of a card that draws a caption, a rule, a mark or a label, in screen rects: the kit's
 * reference-line, vertical-rule and zone captions, the rules, the bars and dots, the bar value
 * labels and the builder's own text.
 */
const partsOf = (page: LayoutPage, id: string): Promise<Part[]> =>
  page.raw.evaluate((testid) => {
    const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
    const rect = (e: Element) => {
      const r = e.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    }
    const keyOf = (e: Element): string => e.getAttribute('data-ts-key') ?? ''
    const parts: { kind: string; text: string; rect: ReturnType<typeof rect> }[] = []
    for (const t of svg.querySelectorAll('text')) {
      const key = keyOf(t)
      const kind = /^(ref|xref|xzone)-\d+-label/.test(key)
        ? 'caption'
        : /^(text-|bar-values)/.test(key)
          ? 'label'
          : null
      if (kind) parts.push({ kind, text: t.textContent ?? '', rect: rect(t) })
    }
    for (const l of svg.querySelectorAll('line'))
      if (/^x?ref-\d+:/.test(keyOf(l))) parts.push({ kind: 'rule', text: keyOf(l), rect: rect(l) })
    for (const m of svg.querySelectorAll('g.ts-chart__bar-y rect, g.ts-chart__dot circle'))
      parts.push({ kind: 'mark', text: keyOf(m), rect: rect(m) })
    return parts
  }, id) as Promise<Part[]>

/** The pairs of parts of kinds `a` and `b` that share area, as readable strings. */
function meets(parts: readonly Part[], a: string, b: string): string[] {
  const out: string[] = []
  for (const [i, p] of parts.entries())
    for (const [j, q] of parts.entries()) {
      if (p.kind !== a || q.kind !== b || (a === b && j <= i)) continue
      if (meet(p.rect, q.rect)) out.push(`${p.text} meets ${q.text}`)
    }
  return out
}

layout('rule and zone captions sit at their line', () => {
  for (const viewport of VIEWPORTS) {
    for (const id of ['e11-rules', 'e11-speed', 'e11-wiki']) {
      test(`${id} at ${viewport.name}: no caption meets another caption, a rule, a mark or a label`, async () => {
        const page = await open(viewport, 'light')
        const parts = await partsOf(page, id)
        // A caption with no clear spot drops (the line stays, its name is in the legend): the phone's
        // speed card has no room for any of its three.
        if (id !== 'e11-speed' || viewport === WIDE)
          expect(
            parts.filter((p) => p.kind === 'caption').length,
            'captions are drawn',
          ).toBeGreaterThan(0)
        expect(meets(parts, 'caption', 'caption')).toEqual([])
        expect(meets(parts, 'caption', 'rule')).toEqual([])
        expect(meets(parts, 'caption', 'mark')).toEqual([])
        expect(meets(parts, 'caption', 'label')).toEqual([])
      })
    }
  }

  test('the zone caption and the rule caption of one edge share a row, they do not stack', async () => {
    const page = await open(WIDE, 'light')
    const parts = await partsOf(page, 'e11-rules')
    const near = parts.find((p) => p.text === 'Near, 90%+')!
    const limit = parts.find((p) => p.text === 'Limit')!
    expect(Math.abs(near.rect.t - limit.rect.t)).toBeLessThan(2)
    expect(near.rect.r, 'Near stops short of the Limit rule').toBeLessThan(limit.rect.r)
  })
})

layout('clamped bar values name the answer', () => {
  test('on the phone a clamped value stands on its bar: the ink check bites', async () => {
    const page = await open(PHONE, 'light')
    const found = await inkOf(page, 'e11-cloud', '^\\d+ mm$')
    expect(found.some((v) => v.onBar)).toBe(true)
  })

  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      describe(`${viewport.name} ${scheme}`, () => {
        test('each clamped bar shows its true value, and it clears the caret', async () => {
          const page = await open(viewport, scheme)
          for (const value of ['12 mm', '25 mm', '16 mm']) {
            const found = await texts(page, 'e11-cloud', `^${value}$`)
            expect(found.length, `${value} is drawn`).toBe(1)
          }
          const carets = await texts(page, 'e11-cloud', '^[▲▼]$')
          expect(carets.length, 'the carets are drawn').toBeGreaterThan(0)
          for (const value of await texts(page, 'e11-cloud', '^\\d+ mm$')) {
            for (const caret of carets) expect(meet(value.rect, caret.rect), value.text).toBe(false)
          }
        })

        test('a value standing on a bar reads at 4.5:1 on the bar, and a clamped one clears the gridlines', async () => {
          const page = await open(viewport, scheme)
          const found = [
            ...(await inkOf(page, 'e11-cloud', '^\\d+ mm$')),
            ...(await inkOf(page, 'e11-cost', '^\\$\\d+\\.\\d$')),
          ]
          expect(found.length, 'the value labels are drawn').toBeGreaterThan(8)
          for (const value of found) {
            if (value.onBar)
              expect(value.ratio, `${value.text} on its bar`).toBeGreaterThanOrEqual(4.5)
          }
          // A clamped value never runs through the gridline on the plot's edge (the others' placement
          // is the placer's, which does not see gridlines).
          for (const value of found.filter((v) => /^(12|25|16) mm$|^\$63\.1$/.test(v.text)))
            expect(value.gridline, `${value.text} over a gridline`).toBe(false)
        })

        test('a clamped value clears the zone label', async () => {
          const page = await open(viewport, scheme)
          const zone = await texts(page, 'e11-cloud', '^No tests$')
          expect(zone.length, 'the zone label is drawn').toBe(1)
          for (const value of await texts(page, 'e11-cloud', '^\\d+ mm$'))
            expect(meet(value.rect, zone[0]!.rect), value.text).toBe(false)
        })
      })
    }
  }
})
