/**
 * Declared grouping in real Chrome at 1440, 768 and 390 (docs/v3/issues/g3/v3-table-t4-virtual.json):
 * every group row has one fixed height (the data row height in the table tiers), a collapse hides
 * exactly its group's rows and keeps the group row's height, the page never scrolls sideways, and
 * the grouped table stays axe clean. At 390 the table is in the card tier and a group row is the
 * section header above its cards.
 *
 * Self-contained like `table-toolbar`: the fixture CSS is compiled with the Tailwind CLI into a temp
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
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE]
const ROOT = '[data-testid="tg-main"] [data-slot="table-root"]'

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-group-'))
  const cssOut = join(scratch, 'table-group.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-group.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`table-group: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-group-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-group: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-group</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${ROOT} tbody tr[data-group]`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

type Rows = {
  groups: number[]
  rows: number[]
  groupCount: number
  rowCount: number
  cards: boolean
}

const measure = (page: LayoutPage): Promise<Rows> =>
  page.raw.evaluate((sel) => {
    const root = document.querySelector<HTMLElement>(sel)!
    const height = (el: Element): number => Math.round(el.getBoundingClientRect().height * 10) / 10
    const groups = [...root.querySelectorAll('tbody tr[data-group]')]
    const rows = [...root.querySelectorAll('tbody tr:not([data-group])')]
    const head = root.querySelector('thead')!
    return {
      groups: groups.map(height),
      rows: rows.map(height),
      groupCount: groups.length,
      rowCount: rows.length,
      // The card tier hides the head visually (never `display: none`).
      cards: head.getBoundingClientRect().height <= 1,
    }
  }, ROOT)

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

layout('DataTable group', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('every group row has one fixed height; in the table tiers it is the row height', async () => {
        const page = await open(viewport)
        const m = await measure(page)
        expect(m.groupCount).toBe(3)
        expect(m.rowCount).toBe(12)
        const first = m.groups[0]!
        expect(first).toBeGreaterThan(0)
        for (const h of m.groups) expect(Math.abs(h - first)).toBeLessThanOrEqual(0.5)
        if (!m.cards) {
          // One line at the table's row height: a virtual window keeps one row size.
          for (const h of m.rows) expect(Math.abs(h - first)).toBeLessThanOrEqual(0.5)
        }
        expect(m.cards).toBe(viewport.width < 480)
      })

      test('collapse hides exactly its rows and keeps the group row height', async () => {
        const page = await open(viewport)
        const before = await measure(page)
        await page.raw.click(`${ROOT} tbody tr[data-group] [data-slot="table-group"] button`)
        await page.settle()
        const after = await measure(page)
        expect(after.groupCount).toBe(3)
        expect(after.rowCount).toBe(8)
        const expanded = await page.raw.getAttribute(
          `${ROOT} tbody tr[data-group] [data-slot="table-group"] button`,
          'aria-expanded',
        )
        expect(expanded).toBe('false')
        for (const h of after.groups)
          expect(Math.abs(h - before.groups[0]!)).toBeLessThanOrEqual(0.5)
      })

      test('the page has no sideways scroll and the grouped table is axe clean', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the grouped table', viewport)
        await expectAxeClean(page)
      })
    })
  }
})
