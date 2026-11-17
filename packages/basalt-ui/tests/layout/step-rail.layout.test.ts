/**
 * `StepRail` in real Chrome at 1440 and 390. Geometry happy-dom cannot hold: the bar sits on the
 * label's line in a wide container and drops under it in a narrow one (the container decides, not
 * the viewport), a bar's width is its duration over the longest, a long label truncates and never
 * widens the rail, a null duration draws no bar, and the page has no sideways scroll.
 *
 * Self-contained like `cards-lists`: `fixture/step-rail.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/step-rail-fixture.tsx` is bundled in memory, both inlined into a
 * document served beside the shared fixture.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TOLERANCE = 0.5

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'step-rail-'))
  const cssOut = join(scratch, 'step-rail.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'step-rail.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`step-rail: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'step-rail-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`step-rail: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>step-rail</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="step-rail"]')
  await page.settle()
  return page
}

type Rect = { top: number; bottom: number; left: number; right: number; width: number }

const rectOf = (page: LayoutPage, selector: string): Promise<Rect> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`no element for ${sel}`)
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width }
  }, selector)

const row = (box: string, id: string, slot: string): string =>
  `[data-testid="${box}"] [data-step-id="${id}"] [data-slot="${slot}"]`

layout('StepRail', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      // The wide box is `max-w-full`: on a phone it is no wider than the narrow one.
      test.skipIf(viewport.width < 640)(
        'the bar shares the label line in a wide container',
        async () => {
          const page = await open(viewport)
          const label = await rectOf(page, row('sr-wide', 'build', 'step-rail-label'))
          const bar = await rectOf(page, row('sr-wide', 'build', 'step-rail-bar'))
          expect(Math.abs(bar.top - label.top)).toBeLessThan(label.bottom - label.top)
        },
      )

      test('the bar drops under the label in a narrow container, whatever the viewport', async () => {
        const page = await open(viewport)
        const label = await rectOf(page, row('sr-narrow', 'build', 'step-rail-label'))
        const bar = await rectOf(page, row('sr-narrow', 'build', 'step-rail-bar'))
        expect(bar.top).toBeGreaterThanOrEqual(label.bottom - TOLERANCE)
      })

      test('a bar is its duration over the longest, and a null duration draws none', async () => {
        const page = await open(viewport)
        for (const box of ['sr-wide', 'sr-narrow']) {
          const build = await rectOf(page, row(box, 'build', 'step-rail-fill'))
          const probe = await rectOf(page, row(box, 'probe', 'step-rail-fill'))
          const long = await rectOf(page, row(box, 'long', 'step-rail-fill'))
          expect(probe.width / build.width).toBeCloseTo(0.5, 1)
          expect(long.width / build.width).toBeCloseTo(0.25, 1)
          expect(await page.count(row(box, 'queued', 'step-rail-bar'))).toBe(0)
        }
      })

      test('a long label truncates and never widens the rail', async () => {
        const page = await open(viewport)
        const rail = await rectOf(page, '[data-testid="sr-narrow"] [data-slot="step-rail"]')
        const label = await rectOf(page, row('sr-narrow', 'long', 'step-rail-label'))
        const time = await rectOf(page, row('sr-narrow', 'long', 'step-rail-time'))
        expect(label.right).toBeLessThanOrEqual(rail.right + TOLERANCE)
        expect(time.right).toBeLessThanOrEqual(rail.right + TOLERANCE)
        const truncated = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-slot="step-rail-label"]')].some(
            (el) => el.scrollWidth > el.clientWidth,
          ),
        )
        expect(truncated).toBe(true)
      })

      test('the page has no sideways scroll', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the step rails', viewport)
      })

      test('axe finds nothing serious or critical', async () => {
        const page = await open(viewport)
        await page.raw.addScriptTag({ content: axeSource })
        const violations = await page.raw.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: () => Promise<{
                  violations: { id: string; impact: string; nodes: { html: string }[] }[]
                }>
              }
            }
          ).axe
          const result = await axe.run()
          return result.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
        })
        expect(violations).toEqual([])
      })
    })
  }
})
