/**
 * P6 (docs/v3/concepts/primitives-distribution.md section 4, row 35): `DatePicker` and
 * `DateRangePicker` in real Chrome at 1440, 768, 390 and 320. Asserted here because happy-dom has no
 * geometry and no real keyboard focus: the calendar opens inside the viewport and the page does not
 * scroll sideways, axe finds nothing serious or critical with it open, arrow keys move by day, a
 * click on the 20th reports the 20th, and a range reports only once both ends are picked.
 *
 * The page is self-contained: `fixture/ui-date.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-date-fixture.tsx` is bundled in memory, both inlined into a document
 * served beside the shared fixture, so no shared fixture file carries a line for this suite.
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
  PHONE_SMALL,
  TABLET_768,
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

const CALENDAR = '[data-slot="popover-content"]'

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-date-'))
  const cssOut = join(scratch, 'ui-date.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-date.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`ui-date: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-date-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-date: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-date</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('#ud-day')
  await page.settle()
  return page
}

async function show(page: LayoutPage, trigger: string): Promise<void> {
  await page.raw.click(trigger)
  await page.raw.waitForSelector(CALENDAR)
  await page.settle()
}

const text = (page: LayoutPage, testid: string): Promise<string> =>
  page.raw.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`)!.textContent ?? '',
    testid,
  )

const focusedDay = (page: LayoutPage): Promise<string | null> =>
  page.raw.evaluate(
    () => document.activeElement?.closest('[data-day]')?.getAttribute('data-day') ?? null,
  )

layout('DatePicker and DateRangePicker', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const trigger of ['#ud-day', '#ud-range']) {
        test(`${trigger}: the calendar opens inside the viewport and the page does not scroll sideways`, async () => {
          const page = await open(viewport)
          await show(page, trigger)
          const { rect, innerWidth, innerHeight, scrollWidth } = await page.raw.evaluate((sel) => {
            const r = document.querySelector(sel)!.getBoundingClientRect()
            return {
              rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              scrollWidth: document.documentElement.scrollWidth,
            }
          }, CALENDAR)
          expect(rect.left).toBeGreaterThanOrEqual(-0.5)
          expect(rect.right).toBeLessThanOrEqual(innerWidth + 0.5)
          expect(rect.top).toBeGreaterThanOrEqual(-0.5)
          expect(rect.bottom).toBeLessThanOrEqual(innerHeight + 0.5)
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
        })

        test(`${trigger}: axe finds nothing serious or critical with the popover open`, async () => {
          const page = await open(viewport)
          await show(page, trigger)
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
      }

      test('arrow keys move focus by day and Escape closes with focus back on the trigger', async () => {
        const page = await open(viewport)
        await show(page, '#ud-day')
        expect(await focusedDay(page)).toBe('2026-11-15')
        await page.raw.keyboard.press('ArrowRight')
        expect(await focusedDay(page)).toBe('2026-11-16')
        await page.raw.keyboard.press('ArrowDown')
        expect(await focusedDay(page)).toBe('2026-11-23')
        await page.raw.keyboard.press('ArrowLeft')
        expect(await focusedDay(page)).toBe('2026-11-22')
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector(CALENDAR, { state: 'detached' })
        expect(await page.raw.evaluate(() => document.activeElement?.id)).toBe('ud-day')
      })

      test('clicking the 20th reports the 20th, shows it, and closes the calendar', async () => {
        const page = await open(viewport)
        await show(page, '#ud-day')
        await page.raw.click('[data-day="2026-11-20"] button')
        await page.raw.waitForSelector(CALENDAR, { state: 'detached' })
        expect(await text(page, 'ud-day-out')).toBe('2026-11-20')
        expect(await text(page, 'ud-day-out')).not.toContain('19')
        expect(
          await page.raw.evaluate(() => document.getElementById('ud-day')!.textContent),
        ).toContain('Nov 20')
      })

      test('a range reports nothing after the first click and one range after the second', async () => {
        const page = await open(viewport)
        await show(page, '#ud-range')
        await page.raw.click('[data-day="2026-11-10"] button')
        await page.settle()
        expect(await text(page, 'ud-range-out')).toBe('none')
        await page.raw.click('[data-day="2026-11-20"] button')
        await page.raw.waitForSelector(CALENDAR, { state: 'detached' })
        expect(await text(page, 'ud-range-out')).toBe('2026-11-10..2026-11-20')
      })
    })
  }
})
