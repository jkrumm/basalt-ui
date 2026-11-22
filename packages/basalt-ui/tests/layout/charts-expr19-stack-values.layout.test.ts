/**
 * Stacked-bar values in real Chrome at 1800 and 390 (expression cycle 19, n93 and n97): a `y.domain`
 * function caps a stack by its totals, so over 90 days only the 269-minute day draws a caret and the
 * 14 days after it draw none; the caret's label is the stack total in the value ink; and a series with
 * `valuesAt: 'segment'` writes its count inside its own segment, never at the stack's top.
 *
 * The page is self-contained like `charts-bar-values.layout.test.ts`.
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

const NAME = 'charts-expr19-stack-values'
const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [WIDE, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
/** How far a label standing in a bar may reach past each side of it, px (`OVERHANG` in `core/bar-values.ts`). */
const OVERHANG = 6

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), `${NAME}-`))
  const cssOut = join(scratch, `${NAME}.generated.css`)
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, `${NAME}.css`), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`${NAME}: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, `${NAME}-fixture.tsx`)],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`${NAME}: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>${NAME}</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="n97"] [data-ts-key^="bar-segment-values-"]')
  await page.settle()
  return page
}

type Box = { left: number; top: number; right: number; bottom: number }
type Text = { key: string; text: string; fill: string; box: Box }
type Drawn = {
  carets: Text[]
  capValues: Text[]
  segments: Text[]
  bars: { key: string; box: Box }[]
}

/** The carets, the caret labels, the segment labels and the bar rects of one chart, in page px. */
const drawn = (page: LayoutPage, id: string): Promise<Drawn> =>
  page.raw.evaluate((testId) => {
    const svg = document.querySelector<SVGSVGElement>(`[data-testid="${testId}"] svg.ts-chart`)!
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
    const texts = (selector: string) =>
      [...svg.querySelectorAll<SVGTextElement>(`${selector} text`)].map((el) => ({
        key: el.getAttribute('data-ts-key') ?? '',
        text: el.textContent ?? '',
        fill: el.getAttribute('fill') ?? '',
        box: box(el.getBoundingClientRect()),
      }))
    return {
      carets: texts('[data-ts-key="stack-cap-top"]'),
      capValues: texts('[data-ts-key="stack-cap-value"]'),
      segments: texts('[data-ts-key^="bar-segment-values-"]'),
      bars: [...svg.querySelectorAll<SVGRectElement>('[data-ts-key="bars"] rect')].map((el) => ({
        key: el.getAttribute('data-ts-key') ?? '',
        box: box(el.getBoundingClientRect()),
      })),
    }
  }, id)

/** The x key a text mark's key ends on (`string:3:Jun`). */
const xKey = (key: string): string => /(string:\d+:[^:]+)$/.exec(key)?.[1] ?? key

layout('stacked-bar values', () => {
  for (const viewport of VIEWPORTS) {
    describe(viewport.name, () => {
      test('90 days: one caret, on the 269-minute day, its label the total in the value ink', async () => {
        const page = await open(viewport)
        const { carets, capValues } = await drawn(page, 'n93-90')
        expect(carets).toHaveLength(1)
        expect(capValues.map((v) => v.text)).toEqual(['269'])
        expect(capValues[0]?.fill).toBe('var(--basalt-ink-muted)')
      })

      test('the 14 days after it: no caret, the cap reads the stack totals', async () => {
        const page = await open(viewport)
        const { carets, capValues } = await drawn(page, 'n93-14')
        expect(carets).toHaveLength(0)
        expect(capValues).toHaveLength(0)
      })

      test('n97: each unrated count sits inside its own segment', async () => {
        const page = await open(viewport)
        const { segments, bars } = await drawn(page, 'n97')
        expect(segments.map((s) => s.text).toSorted()).toEqual(['110', '122', '148'])
        for (const s of segments) {
          const bar = bars.find((b) => b.key.endsWith(`:string:7:unrated:${xKey(s.key)}`))
          expect(bar, s.text).toBeDefined()
          expect(s.box.top, s.text).toBeGreaterThanOrEqual(bar!.box.top - 0.5)
          expect(s.box.bottom, s.text).toBeLessThanOrEqual(bar!.box.bottom + 0.5)
          expect(s.box.left, s.text).toBeGreaterThanOrEqual(bar!.box.left - OVERHANG - 0.5)
          expect(s.box.right, s.text).toBeLessThanOrEqual(bar!.box.right + OVERHANG + 0.5)
        }
      })
    })
  }

  test('n93 at 1800: the clamped vigorous segment carries its true 238 inside the drawn part', async () => {
    const page = await open(WIDE)
    const { segments } = await drawn(page, 'n93-90')
    expect(segments.map((s) => s.text)).toContain('238')
  })
})
