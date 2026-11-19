/**
 * The `DataTable` header's controls in real Chrome (issue 2418): every header shows its sort mark, its filter
 * button (a filterable column) and its column menu at rest on a fine pointer, so the head keeps one geometry at
 * rest, on hover and with an active filter. Geometry jsdom cannot hold: the header cells' boxes at 1800 and 390.
 *
 * Self-contained like `table-v0`: `fixture/table-header.css` is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined beside it, and `fixture/table-header-fixture.tsx`
 * is bundled in memory.
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
const WIDE: Viewport = { name: 'wide', width: 1800, height: 1000 }
const VIEWPORTS: Viewport[] = [WIDE, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TOLERANCE = 0.5
const TABLE = '[data-testid="th-table"]'

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-header-'))
  const cssOut = join(scratch, 'table-header.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-header.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-header: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-header-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-header: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-header</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${TABLE} [data-slot="table-root"]`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

/** A header cell by its label: the one `thead th` whose text is exactly `label`. */
const headCell = (page: LayoutPage, label: RegExp) =>
  page.raw.locator(`${TABLE} thead th`).filter({ hasText: label })

type Head = { name: string; left: number; width: number; pinned: boolean }

/**
 * Every header cell's box. `width` is the rendered box. `left` is `offsetLeft`, the column's place in the table; a
 * pinned identity column is `position: sticky`, so a hover that scrolls the scroller sideways moves its `left` while
 * its place in the table stays put. That column is compared on width only.
 */
function measureHead(page: LayoutPage): Promise<Head[]> {
  return page.raw.evaluate((table) => {
    return [...document.querySelectorAll<HTMLElement>(`${table} thead th`)].map((th) => ({
      name: th.textContent?.trim() ?? '',
      left: th.offsetLeft,
      width: th.getBoundingClientRect().width,
      pinned: th.hasAttribute('data-pin'),
    }))
  }, TABLE)
}

function diffs(rest: Head[], state: Head[], label: string): string[] {
  if (state.length !== rest.length)
    return [`${label}: ${state.length} header cells, ${rest.length} at rest`]
  return rest.flatMap((h, i) => {
    const s = state[i]!
    const checks = h.pinned ? (['width'] as const) : (['left', 'width'] as const)
    return checks.flatMap((k) =>
      Math.abs(h[k] - s[k]) > TOLERANCE ? [`${label} ${h.name} ${k}: ${h[k]} -> ${s[k]}`] : [],
    )
  })
}

layout('DataTable header controls', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('the header cells keep one geometry at rest, on hover and with an active filter', async () => {
        const page = await open(viewport)
        const rest = await measureHead(page)
        expect(rest.map((h) => h.name)).toEqual(['Name', 'State', 'Amount (EUR)', 'Due', 'Qty'])
        expect(rest.filter((h) => h.width > 0)).toHaveLength(rest.length)

        await headCell(page, /^State$/).hover()
        await page.settle()
        const hoverState = await measureHead(page)
        await headCell(page, /^Amount \(EUR\)$/).hover()
        await page.settle()
        const hoverAmount = await measureHead(page)

        await page.raw.getByRole('button', { name: 'Filter State', exact: true }).click()
        await page.raw
          .getByRole('dialog', { name: 'Filter State', exact: true })
          .getByRole('checkbox')
          .first()
          .click()
        await page.raw.keyboard.press('Escape')
        await page.settle()
        const filter = page.raw.getByRole('button', { name: /^State filtered: / })
        await filter.waitFor()
        expect(await filter.getAttribute('data-active')).not.toBeNull()
        const filtered = await measureHead(page)

        expect([
          ...diffs(rest, hoverState, 'hover State'),
          ...diffs(rest, hoverAmount, 'hover Amount'),
          ...diffs(rest, filtered, 'filter State'),
        ]).toEqual([])
      })

      test('at rest the Amount header shows its sort mark, filter button and column menu', async () => {
        const page = await open(viewport)
        const amount = headCell(page, /^Amount \(EUR\)$/)
        const controls: [string, ReturnType<typeof amount.locator>][] = [
          ['sort mark', amount.locator('[data-slot="table-sort-mark"]')],
          ['filter', amount.getByRole('button', { name: 'Filter Amount (EUR)', exact: true })],
          [
            'column menu',
            amount.getByRole('button', { name: 'Amount (EUR) column actions', exact: true }),
          ],
        ]
        for (const [label, control] of controls) {
          const box = await control.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return {
              width: r.width,
              height: r.height,
              opacity: Number(getComputedStyle(el).opacity),
            }
          })
          expect({ label, width: box.width > 0, height: box.height > 0 }).toEqual({
            label,
            width: true,
            height: true,
          })
          expect({ label, opacity: box.opacity > 0 }).toEqual({ label, opacity: true })
        }
      })
    })
  }
})
