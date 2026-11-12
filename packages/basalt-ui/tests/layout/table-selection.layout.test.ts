/**
 * Selection in real Chrome at container widths 1440, 768 and 390
 * (docs/v3/issues/g3/v3-table-t3b-selection.json): the tick column and the `c.select` editor
 * cell never share a card-tier slot, the bulk bar appears with a tick and fits its container, a
 * pinned cell paints an opaque background at rest, on hover and when its row is selected, and the
 * scroll tier pins the identity column beside the tick and the actions column at the far edge.
 *
 * Self-contained like `table-toolbar`: the fixture CSS is compiled with the Tailwind CLI into a
 * temp directory, the tier sheet `src/table/table.css` is inlined beside it, and the fixture
 * bundles in memory.
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const CARDS = '[data-testid="sel-cards"]'
const SCROLL = '[data-testid="sel-scroll"]'
/** The width of the tick column, which a start-pinned column rides beside. */
const TICK_PX = 40

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-selection-'))
  const cssOut = join(scratch, 'table-selection.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-selection.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-selection: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-selection-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-selection: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-selection</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${CARDS} tbody tr`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

type Rect = { left: number; right: number; top: number; bottom: number }

const rectOf = (page: LayoutPage, selector: string): Promise<Rect | null> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  }, selector)

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5

/** The alpha of a computed color: 1 for an opaque rgb(), the 4th channel or `/ a` otherwise. */
function alphaOf(color: string): number {
  if (color === 'transparent') return 0
  const slash = /\/\s*([\d.]+)(%?)/.exec(color)
  if (slash) return Number(slash[1]) / (slash[2] === '%' ? 100 : 1)
  const rgba = /^rgba\(([^)]*)\)$/.exec(color)
  if (rgba) return Number(rgba[1]!.split(',')[3] ?? 1)
  return 1
}

layout('Selection', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('the page has no sideways scroll', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the tables', viewport)
      })

      test('a tick shows the bulk bar inside its container and clearing removes it', async () => {
        const page = await open(viewport)
        expect(await page.count(`${CARDS} [data-slot="table-bulk"]`)).toBe(0)
        await page.raw.click(
          `${CARDS} tbody tr:first-child [data-slot="table-select"] [role="checkbox"]`,
        )
        await page.settle()
        const bar = await rectOf(page, `${CARDS} [data-slot="table-bulk"]`)
        const root = await rectOf(page, `${CARDS} [data-slot="table-root"]`)
        expect(bar).not.toBeNull()
        expect(bar!.left).toBeGreaterThanOrEqual(root!.left - 0.5)
        expect(bar!.right).toBeLessThanOrEqual(root!.right + 0.5)
        await page.raw.click(`${CARDS} [data-slot="table-bulk"] button:last-child`)
        await page.settle()
        expect(await page.count(`${CARDS} [data-slot="table-bulk"]`)).toBe(0)
      })

      test('the tick, the c.select editor and the row actions never overlap in any tier', async () => {
        const page = await open(viewport)
        const row = `${CARDS} tbody tr:first-child`
        const tick = await rectOf(page, `${row} td[data-kind="tick"]`)
        const edit = await rectOf(page, `${row} td[data-kind="select"]`)
        const actions = await rectOf(page, `${row} td[data-kind="actions"]`)
        expect(tick).not.toBeNull()
        expect(edit).not.toBeNull()
        expect(actions).not.toBeNull()
        expect(overlaps(tick!, edit!)).toBe(false)
        expect(overlaps(tick!, actions!)).toBe(false)
        expect(overlaps(edit!, actions!)).toBe(false)
      })

      test('the identity column cannot be hidden from its menu', async () => {
        const page = await open(viewport)
        const head = `${CARDS} thead th[data-identity]`
        // The head is visually hidden in the card tier; the menu is still in the tree.
        await page.raw.evaluate((sel) => {
          document
            .querySelector<HTMLElement>(`${sel} button[aria-label$="column actions"]`)
            ?.click()
        }, head)
        await page.raw.waitForSelector('[role="menu"]')
        const items = await page.raw.evaluate(() =>
          [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent?.trim()),
        )
        expect(items).not.toContain('Hide column')
        expect(items).toContain('Reset column')
      })
    })
  }

  // A pinned cell scrolls over its neighbours, so it must paint opaque in every row state. The
  // card tier projects rows and pins nothing, so the pins are read on the scroll table at 390 and
  // on the cards table in the full tier (1440).
  for (const viewport of VIEWPORTS) {
    describe(`pins at ${viewport.width}`, () => {
      test('pinned and tick cells are opaque at rest, on hover and when selected', async () => {
        const page = await open(viewport)
        const table = viewport.width >= 1440 ? CARDS : SCROLL
        const cells = [
          `${table} tbody tr:nth-child(2) td[data-kind="tick"]`,
          `${table} tbody tr:nth-child(2) td[data-pin="start"]`,
          `${table} tbody tr:nth-child(2) td[data-pin="end"]`,
        ]
        const paint = async (): Promise<{ alpha: number; image: string }[]> =>
          page.raw
            .evaluate(
              (sels) =>
                sels.map((sel) => {
                  const style = getComputedStyle(document.querySelector<HTMLElement>(sel)!)
                  return { color: style.backgroundColor, image: style.backgroundImage }
                }),
              cells,
            )
            .then((entries) => entries.map((e) => ({ alpha: alphaOf(e.color), image: e.image })))
        for (const entry of await paint()) expect(entry.alpha).toBe(1)

        await page.raw.hover(`${table} tbody tr:nth-child(2)`)
        await page.settle()
        for (const entry of await paint()) {
          expect(entry.alpha).toBe(1)
          expect(entry.image).toContain('linear-gradient')
        }

        await page.raw.click(`${table} tbody tr:nth-child(2) [role="checkbox"]`)
        await page.raw.mouse.move(0, 0)
        await page.settle()
        for (const entry of await paint()) {
          expect(entry.alpha).toBe(1)
          expect(entry.image).toContain('linear-gradient')
        }
      })
    })
  }

  describe('the scroll tier at 390', () => {
    test('identity rides beside the tick at the start edge and actions sit at the end edge', async () => {
      const page = await open(PHONE)
      await page.raw.evaluate((sel) => {
        const scroller = document.querySelector<HTMLElement>(sel)!
        scroller.scrollLeft = scroller.scrollWidth
      }, `${SCROLL} [data-slot="table-scroller"]`)
      await page.settle()
      const scroller = await rectOf(page, `${SCROLL} [data-slot="table-scroller"]`)
      const tick = await rectOf(page, `${SCROLL} tbody tr:first-child td[data-kind="tick"]`)
      const identity = await rectOf(page, `${SCROLL} tbody tr:first-child td[data-pin="start"]`)
      const actions = await rectOf(page, `${SCROLL} tbody tr:first-child td[data-pin="end"]`)
      expect(Math.abs(tick!.left - scroller!.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(identity!.left - (scroller!.left + TICK_PX))).toBeLessThanOrEqual(1)
      expect(Math.abs(actions!.right - scroller!.right)).toBeLessThanOrEqual(1)
    })
  })
})
