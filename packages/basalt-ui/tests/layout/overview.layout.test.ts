/**
 * The playground overview route (docs/v3/issues/g1/v3-playground-overview.json) in real Chrome at
 * 1440, 768, 390 and 320: no horizontal overflow, the strip, both widget cards, the chart card and
 * the data panel render, exactly one card shows the override cue, and `Filters (n)` replaces the
 * pill row below `@regular`. axe finds nothing serious or critical.
 *
 * Self-contained like `controls-filter-set`: `overview.css` is compiled with the Tailwind CLI into a
 * temp directory and the fixture is bundled in memory (the playground's `?inline` token import is
 * stubbed; the tokens come from the compiled sheet). Screenshots at 1800x1200 and 390x844 are
 * written when `OVERVIEW_SHOTS` names a directory; they are not part of the gate.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  PHONE_SMALL,
  TABLET_768,
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

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const SHOTS = process.env['OVERVIEW_SHOTS']

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'overview-'))
  const cssOut = join(scratch, 'overview.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(import.meta.dirname, 'overview.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`overview: tailwind failed:\n${css.stderr.toString()}`)

  const stub = join(scratch, 'v3-tokens-stub.ts')
  await Bun.write(stub, 'export function useV3Tokens(): void {}\n')
  const build = await Bun.build({
    entrypoints: [join(import.meta.dirname, 'overview-fixture.jsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [
      {
        name: 'stub-v3-tokens',
        setup(b) {
          b.onResolve({ filter: /demo\/v3-tokens$/ }, () => ({ path: stub }))
        },
      },
    ],
  })
  if (!build.success) throw new Error(`overview: fixture did not build:\n${build.logs.join('\n')}`)
  const client = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>overview</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(client)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    viewport,
    documentPath,
    'reduce',
    viewport.width <= 390 ? 'coarse' : 'fine',
  )
  await page.raw.waitForSelector('[data-testid="ov-root"] [data-slot="stat-card"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.raw.waitForTimeout(300)
  }
  await page.settle()
  return page
}

const count = (page: LayoutPage, selector: string): Promise<number> =>
  page.raw.evaluate((sel) => document.querySelectorAll(sel).length, selector)

layout('playground overview route', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('no horizontal overflow, every region renders', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'overview', viewport)
        for (const slot of ['stat-group', 'stat-card', 'data-panel', 'bar-list', 'event-list']) {
          expect(await count(page, `[data-slot="${slot}"]`), `${slot} renders`).toBeGreaterThan(0)
        }
        expect(await count(page, '[data-testid="ov-chart"]'), 'chart card renders').toBe(1)
      })

      test('exactly one card shows the override cue', async () => {
        const page = await open(viewport)
        expect(await count(page, '[data-testid="ov-override"] [data-slot="override-badge"]')).toBe(
          1,
        )
        expect(await count(page, '[data-testid="ov-bound"] [data-slot="override-badge"]')).toBe(0)
      })

      test('Filters (n) replaces the pills below @regular, the pills show above', async () => {
        const page = await open(viewport)
        const phone = await page.raw.evaluate(() => {
          const row = document.querySelector<HTMLElement>(
            '[data-testid="ov-filters"] [data-slot="filter-pills"]',
          )
          return row !== null && getComputedStyle(row).display === 'none'
        })
        const countVisible = await page.raw.evaluate(() => {
          const el = document.querySelector<HTMLElement>(
            '[data-testid="ov-filters"] [data-slot="filter-count"]',
          )
          return el !== null && el.getBoundingClientRect().width > 0
        })
        expect(countVisible, `count visible at ${viewport.width}`).toBe(phone)
        if (viewport.width <= 390) expect(phone, 'phone shows the sheet button').toBe(true)
      })

      test('axe finds nothing serious or critical', async () => {
        const page = await open(viewport)
        await page.raw.evaluate(axeSource)
        const violations = await page.raw.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: { run: () => Promise<{ violations: { id: string; impact: string }[] }> }
            }
          ).axe
          const result = await axe.run()
          return result.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => v.id)
        })
        expect(violations).toEqual([])
      })
    })
  }

  if (SHOTS) {
    test('screenshots', async () => {
      mkdirSync(SHOTS, { recursive: true })
      for (const scheme of ['light', 'dark'] as const) {
        for (const viewport of [{ name: 'desktop', width: 1800, height: 1200 }, PHONE]) {
          const page = await open(viewport, scheme === 'dark' ? 'dark' : undefined)
          await page.raw.screenshot({
            path: join(SHOTS, `overview-${viewport.width}-${scheme}.png`),
          })
        }
      }
    })
  }
})
