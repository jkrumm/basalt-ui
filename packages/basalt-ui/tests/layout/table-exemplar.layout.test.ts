/**
 * The table exemplar's phone contract in real Chrome at 390 and 360
 * (docs/v3/issues/g3/v3-table-t5-exemplar.json): the rows are list rows (`phone: 'fields'` keeps the
 * label-and-value grid), every column's data is drawn or reachable, and the three ways a row can be
 * acted on (`detail`, `onRowActivate`, neither) each do what they say. One fixture per case, eight columns of different kinds, two of them priority 3.
 *
 * Self-contained like `table-selection`: the fixture CSS is compiled with the Tailwind CLI into a
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const PHONE_360: Viewport = { name: 'Android 360', width: 360, height: 780 }
const VIEWPORTS: Viewport[] = [PHONE, PHONE_360]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const PROBES = ['te-detail', 'te-activate', 'te-none'] as const
const FIELDS = 'te-fields'
const COLUMNS = 8
const FIRST_CELL = (probe: string): string =>
  `[data-testid="${probe}"] tbody tr:first-child td:first-child`

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-exemplar-'))
  const cssOut = join(scratch, 'table-exemplar.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-exemplar.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-exemplar: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-exemplar-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-exemplar: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-exemplar</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'coarse')
  await page.raw.waitForSelector(`[data-testid="${PROBES[0]}"] tbody tr`)
  await page.settle()
  return page
}

const logOf = (page: LayoutPage): Promise<string[]> =>
  page.raw.evaluate(() => [...(window as unknown as { basaltLog: string[] }).basaltLog])

/** The first row of a probe: one entry per cell, with its text and whether it paints a box (a hidden cell paints none). */
const cellsOf = (page: LayoutPage, probe: string) =>
  page.raw.evaluate((id) => {
    const row = document.querySelector(`[data-testid="${id}"] tbody tr`)!
    const box = row.getBoundingClientRect()
    return [...row.querySelectorAll<HTMLElement>('td')].map((td) => {
      const r = td.getBoundingClientRect()
      return {
        text: (td.textContent ?? '').trim(),
        painted: r.width > 0 && r.height > 0,
        inside: r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5,
      }
    })
  }, probe)

layout('Table exemplar at the phone widths', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('the page has no sideways scroll', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the tables', viewport)
      })

      test('the rows are cards: cells are blocks and the head is clipped, not display none', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() => {
          const root = document.querySelector('[data-testid="te-fields"]')!
          return {
            cell: getComputedStyle(root.querySelector('tbody td')!).display,
            head: getComputedStyle(root.querySelector('thead')!).display,
          }
        })
        expect(info.cell).toBe('block')
        expect(info.head).not.toBe('none')
      })

      test('a text meta value of a card names its column: the header reads before it, one line', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() => {
          const cell = document.querySelector<HTMLElement>(
            '[data-testid="te-fields"] tbody tr:first-child td[data-label="Owner"]',
          )!
          const before = getComputedStyle(cell, '::before')
          return {
            label: cell.getAttribute('data-label'),
            content: before.content,
            display: before.display,
            color: before.color,
            own: getComputedStyle(cell).color,
          }
        })
        expect(info.label).toBe('Owner')
        expect(info.content).toBe('"Owner: "')
        expect(info.display).toBe('inline')
        expect(info.color).not.toBe(info.own)
      })

      test('a number, a date and a boolean in the meta name their column and read from the start', async () => {
        const page = await open(viewport)
        const cells = await page.raw.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              '[data-testid="te-fields"] tbody tr:first-child td',
            ),
          ].map((td) => ({
            label: td.getAttribute('data-label'),
            before: getComputedStyle(td, '::before').content,
            align: getComputedStyle(td).textAlign,
          })),
        )
        for (const header of ['Items', 'Booked', 'Open']) {
          const cell = cells.find((entry) => entry.label === header)
          expect(cell, `${header} is labelled`).toBeDefined()
          expect(cell!.before).toBe(`"${header}: "`)
          expect(cell!.align).toBe('start')
        }
        // the title cell stays unlabelled
        expect(cells[0]!.label).toBeNull()
      })

      test('a money value in the card names its column and never stands alone at the right', async () => {
        const page = await open(viewport)
        const cells = await page.raw.evaluate(() => {
          const row = document.querySelector('[data-testid="te-fields"] tbody tr:first-child')!
          return [...row.querySelectorAll<HTMLElement>('td')].map((td) => {
            return {
              label: td.getAttribute('data-label'),
              before: getComputedStyle(td, '::before').content,
              after: getComputedStyle(td, '::after').content,
              align: getComputedStyle(td).textAlign,
            }
          })
        })
        const money = cells.find((entry) => entry.label === 'Amount')
        expect(money, 'Amount is labelled').toBeDefined()
        expect(money!.before).toBe('"Amount: "')
        expect(money!.after).toBe('" EUR"')
        expect(money!.align).toBe('start')
        // no card value is aligned right on a line of its own
        for (const cell of cells.filter((entry) => entry.label !== null))
          expect(cell.align, `${cell.label} reads from the start`).toBe('start')
      })

      test(`${FIELDS}: every column of a row is drawn, with its data`, async () => {
        const page = await open(viewport)
        const cells = await cellsOf(page, FIELDS)
        expect(cells).toHaveLength(COLUMNS)
        for (const [index, cell] of cells.entries()) {
          expect(cell.painted, `column ${index} paints no box`).toBe(true)
          expect(cell.text, `column ${index} has no text`).not.toBe('')
        }
      })

      // A fields row is as tall as its stacked cells: the row's `h-(--table-row-h)` utility sits above
      // the tier sheet, so the sheet's `height: auto` is `!important`.
      test(`${FIELDS}: every cell of a card sits inside its card`, async () => {
        const page = await open(viewport)
        const cells = await cellsOf(page, FIELDS)
        expect(cells.filter((cell) => !cell.inside)).toEqual([])
      })

      for (const probe of PROBES) {
        test(`${probe}: the list row draws its title, muted values and answer inside the row`, async () => {
          const page = await open(viewport)
          const cells = (await cellsOf(page, probe)).filter((cell) => cell.painted)
          expect(cells).toHaveLength(4)
          for (const cell of cells) {
            expect(cell.text, 'a drawn cell has no text').not.toBe('')
            expect(cell.inside).toBe(true)
          }
        })
      }
    })
  }

  describe('acting on a row', () => {
    test('detail: a tap hands the host the row detail', async () => {
      const page = await open(PHONE)
      await page.raw.click(FIRST_CELL('te-detail'))
      await page.settle()
      expect(await logOf(page)).toEqual(['detail:te-detail rows'])
    })

    test('onRowActivate: a tap calls the app with the row', async () => {
      const page = await open(PHONE)
      await page.raw.click(FIRST_CELL('te-activate'))
      await page.settle()
      expect(await logOf(page)).toEqual(['row:r0'])
    })

    test('neither: a tap does nothing, and the row is not a button', async () => {
      const page = await open(PHONE)
      await page.raw.click(FIRST_CELL('te-none'))
      await page.settle()
      expect(await logOf(page)).toEqual([])
      expect(await page.count('[data-testid="te-none"] tbody tr[role="button"]')).toBe(0)
    })
  })
})
