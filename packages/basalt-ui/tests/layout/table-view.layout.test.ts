/**
 * The view lane in real Chrome (docs/v3/issues/bench/bench-table-view.json): in the grid look the
 * leading columns (tick, row number, identity) stay put while the rows scroll sideways under them, in
 * a plain and a virtual table, at 1800 and 390, and the last of them casts the edge shadow only once
 * the scroller has moved; a view's row height moves the body rows through the density steps while
 * the head keeps its height.
 *
 * Self-contained like `table-group`: the fixture CSS is compiled with the Tailwind CLI into a temp
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [WIDE, PHONE]

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-view-'))
  const cssOut = join(scratch, 'table-view.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-view.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`table-view: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-view-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-view: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-view</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="tw-virtual"] tbody tr[role="row"]')
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

type Lead = {
  /** Inline start of each leading cell and of the first scrolled cell, head and first body row, relative to the port. */
  head: number[]
  body: number[]
  scrolledBy: number
  marked: boolean
  shadow: string
}

/** Scrolls the table's port sideways by `by` px and reads where its leading cells sit. */
const scrollAndRead = (page: LayoutPage, testId: string, by: number): Promise<Lead> =>
  page.raw.evaluate(
    async ({ testId, by }) => {
      const root = document.querySelector<HTMLElement>(
        `[data-testid="${testId}"] [data-slot="table-root"]`,
      )!
      const port =
        root.querySelector<HTMLElement>('[data-slot="virtual-list"]') ??
        root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
      port.scrollLeft = by
      port.dispatchEvent(new Event('scroll'))
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done(null))),
      )
      const left = port.getBoundingClientRect().left
      const at = (row: Element | null): number[] =>
        [
          '[data-kind="tick"]',
          '[data-kind="row-number"]',
          '[data-identity]',
          '[data-col="team"]',
        ].map((sel) =>
          Math.round((row?.querySelector(sel)?.getBoundingClientRect().left ?? NaN) - left),
        )
      const edge = root.querySelector('tbody [data-pin-edge]')
      return {
        head: at(root.querySelector('thead tr')),
        body: at(root.querySelector('tbody tr[role="row"]')),
        scrolledBy: Math.round(port.scrollLeft),
        marked: root.hasAttribute('data-scrolled'),
        shadow: edge === null ? '' : getComputedStyle(edge).boxShadow,
      }
    },
    { testId, by },
  )

layout('DataTable view', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const testId of ['tw-grid', 'tw-virtual']) {
        test(`${testId}: tick, row number and identity stay put under a sideways scroll`, async () => {
          const page = await open(viewport)
          const before = await scrollAndRead(page, testId, 0)
          expect(before.marked).toBe(false)
          expect(before.shadow).toBe('none')
          const after = await scrollAndRead(page, testId, 240)
          // The table is wider than the port at both widths, so the port really moved.
          expect(after.scrolledBy).toBeGreaterThan(50)
          for (const [row, base] of [
            [after.head, before.head],
            [after.body, before.body],
          ] as const) {
            // Tick, row number and identity keep their place; the next column slid under them.
            expect(row.slice(0, 3)).toEqual(base.slice(0, 3))
            expect(row[3]).toBe(base[3]! - after.scrolledBy)
          }
          // The leading cells sit side by side: the tick, then the number, then the identity.
          expect(before.body[0]).toBeLessThan(before.body[1]!)
          expect(before.body[1]).toBeLessThan(before.body[2]!)
          expect(after.marked).toBe(true)
          expect(after.shadow).not.toBe('none')
          const back = await scrollAndRead(page, testId, 0)
          expect(back.marked).toBe(false)
        })
      }
    })
  }

  test('a view row height moves the body rows through the density steps; the head keeps its height', async () => {
    const page = await open(WIDE)
    const read = (height: string | null): Promise<{ head: number; row: number }> =>
      page.raw.evaluate(async (height) => {
        const set = (window as unknown as { basaltRowHeight: (h: string | undefined) => void })
          .basaltRowHeight
        set(height ?? undefined)
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done(null))),
        )
        const root = document.querySelector('[data-testid="tw-rows"] [data-slot="table-root"]')!
        const h = (el: Element | null): number =>
          Math.round(el?.getBoundingClientRect().height ?? 0)
        return { head: h(root.querySelector('thead tr')), row: h(root.querySelector('tbody tr')) }
      }, height)
    const base = await read(null)
    const dense = await read('dense')
    const normal = await read('normal')
    const comfortable = await read('comfortable')
    expect([dense.row, normal.row, comfortable.row]).toEqual([32, 40, 48])
    for (const step of [dense, normal, comfortable]) expect(step.head).toBe(base.head)
  })
})
