/**
 * Expression cycle 7's contract fields (`v3-expr-7-contract` (b) and (c)) in real Chrome at 1800 and
 * 390. (b): an entity column's main text and a footer fact value set with `mono` draw in the mono
 * face with tabular numerals inside their card, the same text without it stays sans, and the flag
 * moves no card. (c): a stacked `BarList` of twelve long names keeps every name whole at both widths,
 * draws each row's parts inside its track in the series' colors, and shows its legend.
 *
 * The page is self-contained like `charts-expr6-contract.layout.test.ts`.
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
const WHEN = '21 Oct 03:12'
const SLOTS = ['figure', 'card', 'table'] as const

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-expr7-contract-'))
  const cssOut = join(scratch, 'charts-expr7-contract.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-expr7-contract.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-expr7-contract: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-expr7-contract-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-expr7-contract: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-expr7-contract</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="stacked"] [data-slot="bar-list-segment"]')
  await page.settle()
  return page
}

type Face = {
  family: string
  numeric: string
  /** How far the text's box reaches past its card's right edge (px, <= 0 inside). */
  overhang: number
}

/** The face of every visible footer value that reads the time, and every entity name, of a test id. */
const facesOf = (page: LayoutPage, id: string): Promise<Face[]> =>
  page.raw.evaluate(
    ({ id, when }) => {
      const root = document.querySelector(`[data-testid="${id}"]`)!
      const edge = root.getBoundingClientRect().right
      const leaves = [...root.querySelectorAll<HTMLElement>('dd, [data-slot="table-entity-name"]')]
        .filter((el) => el.tagName !== 'DD' || el.textContent === when)
        .filter((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)
      return leaves.map((el) => {
        const style = getComputedStyle(el)
        return {
          family: style.fontFamily,
          numeric: style.fontVariantNumeric,
          overhang: el.getBoundingClientRect().right - edge,
        }
      })
    },
    { id, when: WHEN },
  )

const heightOf = (page: LayoutPage, id: string): Promise<number> =>
  page.raw.evaluate(
    (sel) => document.querySelector(sel)!.getBoundingClientRect().height,
    `[data-testid="${id}"]`,
  )

type StackedRow = {
  label: string
  /** The label's full text width minus its box: > 0 means the name is cut. */
  cut: number
  segments: number
  /** The parts' summed width minus the track's width: > 0.5 means a part overflows. */
  spill: number
  colors: string[]
}

const stackedRows = (page: LayoutPage): Promise<StackedRow[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll('[data-testid="stacked"] [data-slot="bar-list-row"]')].map(
      (row) => {
        const label = row.querySelector<HTMLElement>('[data-slot="bar-list-label"]')!
        const track = row.querySelector<HTMLElement>('[data-slot="bar-list-track"]')!
        const parts = [...row.querySelectorAll<HTMLElement>('[data-slot="bar-list-segment"]')]
        const left = track.getBoundingClientRect().left
        const right = Math.max(left, ...parts.map((p) => p.getBoundingClientRect().right))
        return {
          label: label.textContent ?? '',
          cut: label.scrollWidth - label.clientWidth,
          segments: parts.length,
          spill: right - track.getBoundingClientRect().right,
          colors: parts.map((p) => getComputedStyle(p).backgroundColor),
        }
      },
    ),
  )

layout('mono entity names and footer values, expression cycle 7', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('a flagged slot draws in the mono face with tabular numerals, inside its card', async () => {
        const page = await open(viewport)
        for (const slot of SLOTS) {
          const faces = await facesOf(page, `${slot}-mono`)
          expect(faces.length, slot).toBeGreaterThan(0)
          for (const face of faces) {
            expect(face.family, slot).toContain('JetBrains Mono')
            expect(face.numeric, slot).toContain('tabular-nums')
            expect(face.overhang, slot).toBeLessThanOrEqual(0.5)
          }
        }
      })

      test('the same slot without the flag stays in the sans face', async () => {
        const page = await open(viewport)
        for (const slot of SLOTS) {
          const faces = await facesOf(page, `${slot}-sans`)
          expect(faces.length, slot).toBeGreaterThan(0)
          for (const face of faces) expect(face.family, slot).not.toContain('JetBrains Mono')
        }
      })

      test('the flag moves no card or row: each mono card is as tall as its sans twin', async () => {
        const page = await open(viewport)
        for (const slot of SLOTS) {
          const mono = await heightOf(page, `${slot}-mono`)
          const sans = await heightOf(page, `${slot}-sans`)
          expect(mono, slot).toBeCloseTo(sans, 0)
        }
      })
    })
  }
})

layout('a stacked BarList keeps every name, expression cycle 7', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('all twelve long names are drawn whole', async () => {
        const page = await open(viewport)
        const rows = await stackedRows(page)
        expect(rows).toHaveLength(12)
        for (const row of rows) expect(row.cut, row.label).toBeLessThanOrEqual(0)
      })

      test("each row's parts stack inside its track in four series colors; the zero row draws none", async () => {
        const page = await open(viewport)
        const rows = await stackedRows(page)
        for (const row of rows.slice(0, 11)) {
          expect(row.segments, row.label).toBe(4)
          expect(row.spill, row.label).toBeLessThanOrEqual(0.5)
          expect(new Set(row.colors).size, row.label).toBe(4)
        }
        expect(rows[11]!.segments).toBe(0)
      })

      test('the legend names the four series and the page does not scroll sideways', async () => {
        const page = await open(viewport)
        const legend = await page.raw.evaluate(() =>
          [
            ...document.querySelectorAll(
              '[data-testid="stacked"] [data-slot="data-panel-legend"] li',
            ),
          ].map((li) => li.textContent),
        )
        expect(legend).toEqual(['Production', 'Evals', 'Development', 'Other'])
        const overflow = await page.raw.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(0)
      })
    })
  }
})
