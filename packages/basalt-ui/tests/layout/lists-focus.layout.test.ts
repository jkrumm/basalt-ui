/**
 * A `DataTable` and a `BarList` joined to a chart's shared focus (`useChartFocus`), in real Chrome:
 * pointing at a table row or a BarList row focuses its datum (the chart's live region names it),
 * hovering a chart bar marks both rows, and the keyboard works both ways (chart arrows mark the rows,
 * the table's row focus and the BarList's arrow keys set the index). At 390 px the table's card
 * projection still marks the focused card.
 *
 * The page is self-contained: `fixture/lists-focus.css` is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined and `fixture/lists-focus-fixture.tsx` is
 * bundled in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RELEASE_MS } from '../../src/core/focus-release'
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
const DESKTOP: Viewport = { name: 'desktop', width: 1280, height: 1600 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'lists-focus-'))
  const cssOut = join(scratch, 'lists-focus.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'lists-focus.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`lists-focus: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'lists-focus-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`lists-focus: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>lists-focus</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style><style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="lf-chart"] svg')
  await page.raw.waitForSelector('[data-testid="lf-table"] tbody tr')
  await page.settle()
  return page
}

const TABLE_ROWS = '[data-testid="lf-table"] tbody tr'
const BAR_ROWS = '[data-testid="lf-bars"] [data-slot="bar-list-row"]'
const LIVE = '[data-chart-focus-live]'

const index = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(
    () => (document.querySelector('[data-testid="lf-root"]') as HTMLElement).dataset['focusIndex']!,
  )

const marked = (page: LayoutPage, selector: string): Promise<boolean[]> =>
  page.raw.evaluate(
    (sel) => [...document.querySelectorAll(sel)].map((el) => el.hasAttribute('data-focused')),
    selector,
  )

const live = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate((sel) => document.querySelector(sel)?.textContent ?? '', LIVE)

/** The centre of the nth element, scrolled into view. */
const centre = (page: LayoutPage, selector: string, n: number) =>
  page.raw.evaluate(
    ([sel, i]) => {
      const el = document.querySelectorAll(sel as string)[i as number]!
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    },
    [selector, n],
  )

layout('lists joined to a chart focus', () => {
  describe(`${DESKTOP.name} ${DESKTOP.width}`, () => {
    test('hovering a table row focuses its datum and the chart follows', async () => {
      const page = await open(DESKTOP)
      const at = await centre(page, TABLE_ROWS, 2)
      await page.raw.mouse.move(at.x, at.y)
      await page.settle()
      expect(await index(page)).toBe('2')
      expect(await live(page)).toContain('linewatch')
      expect(await marked(page, TABLE_ROWS)).toEqual([false, false, true, false, false])
      expect(await marked(page, BAR_ROWS)).toEqual([false, false, true, false, false])
    })

    test('hovering a BarList row focuses its datum and marks the table row', async () => {
      const page = await open(DESKTOP)
      const at = await centre(page, BAR_ROWS, 1)
      await page.raw.mouse.move(at.x, at.y)
      await page.settle()
      expect(await index(page)).toBe('1')
      expect(await live(page)).toContain('rb')
      expect(await marked(page, TABLE_ROWS)).toEqual([false, true, false, false, false])
    })

    test('hovering a chart bar marks the matching table row and BarList row', async () => {
      const page = await open(DESKTOP)
      const bar = await centre(page, '[data-testid="lf-chart"] [data-ts-key^="bars"]:not(g)', 0)
      await page.raw.mouse.move(bar.x - 6, bar.y + 4)
      await page.raw.mouse.move(bar.x, bar.y + 4)
      await page.settle()
      expect(await index(page)).toBe('0')
      expect(await marked(page, TABLE_ROWS)).toEqual([true, false, false, false, false])
      expect(await marked(page, BAR_ROWS)).toEqual([true, false, false, false, false])
    })

    test('the pointer leaving the rows clears the focus', async () => {
      const page = await open(DESKTOP)
      const at = await centre(page, TABLE_ROWS, 1)
      await page.raw.mouse.move(at.x, at.y)
      await page.settle()
      expect(await index(page)).toBe('1')
      await page.raw.mouse.move(2, 2)
      await page.raw.waitForTimeout(RELEASE_MS + 100)
      await page.settle()
      expect(await index(page)).toBe('')
      expect(await marked(page, TABLE_ROWS)).toEqual([false, false, false, false, false])
    })

    test('focusing the chart and pressing ArrowRight marks a row in both lists', async () => {
      const page = await open(DESKTOP)
      await page.raw.focus('[data-testid="lf-chart"] [data-chart-focus]')
      await page.raw.keyboard.press('ArrowRight')
      await page.settle()
      expect(await index(page)).toBe('0')
      await page.raw.keyboard.press('ArrowRight')
      await page.settle()
      expect(await index(page)).toBe('1')
      expect(await marked(page, TABLE_ROWS)).toEqual([false, true, false, false, false])
      expect(await marked(page, BAR_ROWS)).toEqual([false, true, false, false, false])
    })

    test('the table row keyboard sets the index', async () => {
      const page = await open(DESKTOP)
      await page.raw.focus(`${TABLE_ROWS}[tabindex="0"]`)
      await page.settle()
      expect(await index(page)).toBe('0')
      await page.raw.keyboard.press('ArrowDown')
      await page.settle()
      expect(await index(page)).toBe('1')
      expect(await live(page)).toContain('rb')
      expect(await marked(page, BAR_ROWS)).toEqual([false, true, false, false, false])
    })

    test('the BarList is one tab stop and its arrow keys step the focus', async () => {
      const page = await open(DESKTOP)
      await page.raw.focus('[data-testid="lf-bars"] ul')
      await page.raw.keyboard.press('ArrowDown')
      await page.settle()
      expect(await index(page)).toBe('0')
      await page.raw.keyboard.press('ArrowDown')
      await page.raw.keyboard.press('ArrowDown')
      await page.settle()
      expect(await index(page)).toBe('2')
      expect(await marked(page, TABLE_ROWS)).toEqual([false, false, true, false, false])
      await page.raw.keyboard.press('Escape')
      await page.settle()
      expect(await index(page)).toBe('')
    })
  })

  describe(`${PHONE.name} ${PHONE.width}`, () => {
    test("the table's card projection marks the focused card", async () => {
      const page = await open(PHONE)
      const display = await page.computed(TABLE_ROWS, 'display')
      expect(display).toBe('grid')
      await page.raw.focus('[data-testid="lf-chart"] [data-chart-focus]')
      await page.raw.keyboard.press('ArrowRight')
      await page.raw.keyboard.press('ArrowRight')
      await page.settle()
      expect(await marked(page, TABLE_ROWS)).toEqual([false, true, false, false, false])
      const tinted = await page.raw.evaluate(
        (sel) => getComputedStyle(document.querySelectorAll(sel)[1]!).backgroundColor,
        TABLE_ROWS,
      )
      const plain = await page.raw.evaluate(
        (sel) => getComputedStyle(document.querySelectorAll(sel)[3]!).backgroundColor,
        TABLE_ROWS,
      )
      expect(tinted).not.toBe(plain)
    })
  })
})
