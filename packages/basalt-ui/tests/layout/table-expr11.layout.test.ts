/**
 * The table kit fixes of expression cycle 11 (table group): a half-width table keeps its columns
 * while its priority 1 and 2 columns fit (n45, n49), and a meter value shares the row's text line
 * (n47, n49). The full-width title gap of n50 is not covered here: see the report of expression 11. The fixture is `table-expr11-fixture.tsx`, the unit side is `kit-fixes-expr11-table.test.ts`.
 *
 * Self-contained like `table-short-text`: the fixture CSS is compiled with the Tailwind CLI into a temp
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
const DESKTOP_1800: Viewport = { name: 'wide', width: 1800, height: 1200 }
const HALF = '[data-testid="expr11-half"] [data-slot="table-root"]'
const METER = '[data-testid="expr11-meter"] [data-slot="table-root"]'

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-expr11-'))
  const cssOut = join(scratch, 'table-expr11.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-expr11.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-expr11: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-expr11-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-expr11: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-expr11</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1800, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${HALF} tbody tr`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

/**
 * Issue 3162 replaces the cap: the text-like columns of a reading table share the free width, so the table
 * ends at its container's edge and a figure column keeps its fitted width at the end (the gap between the
 * title and a figure used to be bounded at a quarter of the table by a 40ch cap, n50 had 72%).
 */

for (const id of ['expr11-n50', 'expr11-n46']) {
  layout(`${id}: a full-width table fills its container`, () => {
    test('the last column ends at the table edge, the row hairline and head span it', async () => {
      const page = await open()
      const probe = await page.raw.evaluate((testid) => {
        const root = document.querySelector<HTMLElement>(
          `[data-testid="${testid}"] [data-slot="table-root"]`,
        )!
        const table = root.querySelector<HTMLElement>('[data-slot="table"]')!
        const box = table.getBoundingClientRect()
        const ink = (cell: Element): { left: number; right: number } => {
          const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
          const edges = { left: Infinity, right: -Infinity }
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent || node.textContent.trim() === '') continue
            const range = document.createRange()
            range.selectNodeContents(node)
            const rect = range.getBoundingClientRect()
            edges.left = Math.min(edges.left, rect.left)
            edges.right = Math.max(edges.right, rect.right)
          }
          return edges
        }
        const rows = [...root.querySelectorAll('tbody tr')]
        const first = Math.max(...rows.map((row) => ink(row.children[0]!).right))
        const next = Math.min(...rows.map((row) => ink(row.children[1]!).left))
        const head = root.querySelector<HTMLElement>('thead tr')!
        const after = getComputedStyle(head, '::after')
        const bodyAfter = getComputedStyle(root.querySelector('tbody tr')!, '::after')
        return {
          width: box.width,
          gap: next - first,
          rowWidth: head.getBoundingClientRect().width,
          filler: root.hasAttribute('data-fill'),
          headFiller: [after.display, after.backgroundColor],
          hairline: [bodyAfter.display, bodyAfter.borderBottomWidth],
          lastRight:
            Math.max(
              ...[...root.querySelectorAll('thead th')].map(
                (th) => th.getBoundingClientRect().right,
              ),
            ) - box.left,
        }
      }, id)
      expect(probe.width).toBeGreaterThan(1500)
      expect(probe.gap).toBeGreaterThan(0)
      expect(probe.filler).toBe(true)
      // The head row and the rows still span the card; the filler cell paints the head surface and the hairline.
      expect(Math.abs(probe.rowWidth - probe.width)).toBeLessThanOrEqual(2)
      expect(probe.headFiller[0]).toBe('table-cell')
      expect(probe.headFiller[1]).not.toBe('rgba(0, 0, 0, 0)')
      expect(probe.hairline).toEqual(['table-cell', '1px'])
      expect(Math.abs(probe.lastRight - probe.width)).toBeLessThanOrEqual(1)
    })
  })
}

layout('table kit fixes, expression cycle 11', () => {
  test('a table in an empty or failed panel keeps its column header row, at the ready geometry', async () => {
    const page = await open()
    const probe = await page.raw.evaluate(() => {
      const read = (state: string) => {
        const frame = document.querySelector<HTMLElement>(`[data-testid="expr11-frame-${state}"]`)!
        const heads = [...frame.querySelectorAll<HTMLElement>('thead th')].map((th) => {
          const r = th.getBoundingClientRect()
          return {
            left: Math.round(r.left),
            width: Math.round(r.width),
            height: Math.round(r.height),
          }
        })
        const box = frame
          .querySelector<HTMLElement>('[data-slot="card-phase"]')!
          .getBoundingClientRect()
        const arm = frame.querySelector<HTMLElement>(
          'tbody [data-slot="table-empty"], tbody [data-slot="table-error"]',
        )
        const head = frame.querySelector<HTMLElement>('thead')!.getBoundingClientRect()
        return {
          heads,
          boxHeight: Math.round(box.height),
          armTop: arm === null ? null : Math.round(arm.getBoundingClientRect().top - head.bottom),
          armInside: arm === null ? null : arm.getBoundingClientRect().bottom <= box.bottom + 1,
        }
      }
      return { ready: read('ready'), empty: read('empty'), error: read('error') }
    })
    for (const state of ['empty', 'error'] as const) {
      expect(probe[state].heads.length, state).toBe(probe.ready.heads.length)
      expect(probe[state].heads, state).toEqual(probe.ready.heads)
      for (const head of probe[state].heads) expect(head.height, state).toBeGreaterThan(0)
      // The arm sits under the head, whole inside the panel box, and the box keeps the ready height.
      expect(probe[state].armTop, state).toBeGreaterThanOrEqual(0)
      expect(probe[state].armInside, state).toBe(true)
      expect(probe[state].boxHeight, state).toBe(probe.ready.boxHeight)
    }
  })

  test('a 750 px table whose priority 1 and 2 columns fit keeps its columns: no card tier', async () => {
    const page = await open()
    const probe = await page.raw.evaluate((sel) => {
      const root = document.querySelector<HTMLElement>(sel)!
      const header = root.querySelector<HTMLElement>('[data-slot="table-header"]')!
      const cells = [
        ...root.querySelectorAll<HTMLElement>('tbody tr:first-child [data-slot="table-cell"]'),
      ]
      return {
        headerPosition: getComputedStyle(header).position,
        tops: cells.map((cell) => Math.round(cell.getBoundingClientRect().top)),
      }
    }, HALF)
    // In the card tier the head is pulled out of flow and every value stacks: one top per cell.
    expect(probe.headerPosition).not.toBe('absolute')
    expect(new Set(probe.tops).size).toBe(1)
  })

  test('a meter value sits on the row text line, not under its bar', async () => {
    const page = await open()
    const probe = await page.raw.evaluate((sel) => {
      const textBox = (el: Element): { top: number; bottom: number; right: number } => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        const box = { top: Infinity, bottom: -Infinity, right: -Infinity }
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent || node.textContent.trim() === '') continue
          const range = document.createRange()
          range.selectNodeContents(node)
          const rect = range.getBoundingClientRect()
          box.top = Math.min(box.top, rect.top)
          box.bottom = Math.max(box.bottom, rect.bottom)
          box.right = Math.max(box.right, rect.right)
        }
        return box
      }
      const row = document.querySelector<HTMLElement>(sel)!.querySelector('tbody tr')!
      const name = textBox(row.children[0]!)
      const value = row.querySelector<HTMLElement>('[data-readout] > span:last-child')!
      const v = value.getBoundingClientRect()
      return { name: (name.top + name.bottom) / 2, value: (v.top + v.bottom) / 2 }
    }, METER)
    expect(Math.abs(probe.value - probe.name)).toBeLessThanOrEqual(3)
  })
})
