/**
 * `TableToolbar` in real Chrome at container widths 1440, 768, 390, 360 and 320, with long labels
 * (docs/v3/issues/g3/v3-table-t3-toolbar.json): no overflow outside the scroll tier, the filter
 * door follows the toolbar's own container (`+ Filter` from 480 px, the `Filters (n)` sheet below),
 * the sheet and the popover open and stay axe clean, a cell filter is plain text in the card tier,
 * and the controls keep their 44 px coarse hit floor.
 *
 * Self-contained like `table-v0`: the fixture CSS is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined beside it, and the fixture bundles in
 * memory.
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
const PHONE_360: Viewport = { name: 'Android 360', width: 360, height: 780 }
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_360, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
/** The toolbar's own container width under which the filters fold into the sheet. */
const FOLD_BELOW = 480
const TOOLBAR = '[data-testid="tt-main"] [data-slot="table-toolbar"]'

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-toolbar-'))
  const cssOut = join(scratch, 'table-toolbar.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-toolbar.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-toolbar: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-toolbar-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-toolbar: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-toolbar</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: 'fine' | 'coarse' = 'fine'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector(`${TOOLBAR} input[type="search"]`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

type Box = { display: string; width: number; height: number }

const boxOf = (page: LayoutPage, selector: string): Promise<Box | null> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { display: getComputedStyle(el).display, width: r.width, height: r.height }
  }, selector)

async function expectAxeClean(page: LayoutPage): Promise<void> {
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
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`)
  })
  expect(violations).toEqual([])
}

layout('TableToolbar', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('the page has no sideways scroll and the toolbar holds every control inside itself', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the toolbar', viewport)
        const outside = await page.raw.evaluate((sel) => {
          const bar = document.querySelector<HTMLElement>(sel)!
          const edge = bar.getBoundingClientRect()
          return [...bar.querySelectorAll<HTMLElement>('button, input')].flatMap((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0) return []
            return r.left < edge.left - 0.5 || r.right > edge.right + 0.5
              ? [`${el.getAttribute('aria-label') ?? el.textContent}: ${r.left}..${r.right}`]
              : []
          })
        }, TOOLBAR)
        expect(outside).toEqual([])
      })

      test('the tables do not overflow their scrollers (long labels included)', async () => {
        const page = await open(viewport)
        const wide = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-slot="table-scroller"]')].flatMap(
            (el) =>
              el.scrollWidth > el.clientWidth + 1 ? [`${el.scrollWidth} > ${el.clientWidth}`] : [],
          ),
        )
        expect(wide).toEqual([])
      })

      test('the filter door follows the toolbar container: + Filter from 480, Filters (n) below', async () => {
        const page = await open(viewport)
        const width = (await boxOf(page, TOOLBAR))?.width ?? 0
        const add = await boxOf(page, `${TOOLBAR} [data-slot="table-filter-add"]`)
        const sheet = await boxOf(page, `${TOOLBAR} [data-slot="table-filters-sheet"]`)
        const folded = width < FOLD_BELOW
        expect(add?.display === 'none', `+ Filter at ${width}px`).toBe(folded)
        expect(sheet?.display === 'none', `Filters (n) at ${width}px`).toBe(!folded)
        if (folded) {
          const text = await page.raw.evaluate(
            (sel) => document.querySelector(sel)?.textContent ?? '',
            `${TOOLBAR} [data-slot="table-filters-sheet"]`,
          )
          expect(text).toBe('Filters (2)')
        }
      })

      test('the overlay of the visible door opens and axe finds nothing serious or critical', async () => {
        const page = await open(viewport)
        const width = (await boxOf(page, TOOLBAR))?.width ?? 0
        const door = width < FOLD_BELOW ? 'table-filters-sheet' : 'table-filter-add'
        await page.raw.click(`${TOOLBAR} [data-slot="${door}"] button`)
        await page.raw.waitForSelector('[role="dialog"]')
        await page.settle()
        const dialogs = await page.count('[role="dialog"]')
        expect(dialogs).toBe(1)
        if (door === 'table-filters-sheet') {
          expect(await page.count('[data-slot="sheet-content"]')).toBe(1)
        } else {
          expect(await page.count('[data-slot="popover-content"]')).toBe(1)
        }
        await expectAxeClean(page)
      })

      test('axe finds nothing serious or critical with the toolbar at rest', async () => {
        const page = await open(viewport)
        await expectAxeClean(page)
      })

      test('a cell filter is plain text in the card tier and a control above it', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() => {
          const root = document.querySelector<HTMLElement>(
            '[data-testid="tt-cell"] [data-slot="table-root"]',
          )!
          const control = root.querySelector<HTMLElement>('[data-cell-filter]')!
          const plain = root.querySelector<HTMLElement>('[data-slot="table-cell-plain"]')!
          const below = root.getAttribute('data-below')
          const width = root.getBoundingClientRect().width
          const card =
            root.getAttribute('data-phone') === 'cards' &&
            (below === 'always' || width < Number(below))
          return {
            card,
            control: getComputedStyle(control).display,
            plain: getComputedStyle(plain).display,
          }
        })
        expect(info.control === 'none', `control, card tier ${info.card}`).toBe(info.card)
        expect(info.plain === 'none', `plain text, card tier ${info.card}`).toBe(!info.card)
      })
    })
  }

  describe('coarse pointer', () => {
    for (const viewport of [PHONE, PHONE_SMALL]) {
      test(`${viewport.name}: every toolbar control has a 44 px hit height`, async () => {
        const page = await open(viewport, 'coarse')
        const short = await page.raw.evaluate((sel) => {
          const bar = document.querySelector<HTMLElement>(sel)!
          return [...bar.querySelectorAll<HTMLElement>('button, input')].flatMap((el) => {
            const r = el.getBoundingClientRect()
            if (r.width === 0) return []
            // A small control keeps a 44 px `::after` hit area centred on its box.
            const after = getComputedStyle(el, '::after')
            const hit = Math.max(r.height, Number.parseFloat(after.height) || 0)
            return hit < 44 - 0.5
              ? [`${el.getAttribute('aria-label') ?? el.textContent}: ${hit}`]
              : []
          })
        }, TOOLBAR)
        expect(short).toEqual([])
      })
    }
  })
})
