/**
 * Spike S2 and the virtual body in real Chrome (docs/v3/issues/g3/v3-table-t4-virtual.json): a
 * 10k-row `DataTable` with `virtual={VirtualList}`, spacer `<tr>` rows in the same table, a sticky
 * head and the focused row pinned through `keepIndex`. Pass: the head moves at most 1 px against the
 * scroller between scroll positions, under 100 body rows are mounted, `aria-rowcount` is every row,
 * and focus stays on its row after a scroll and after a sort moves that row to index 0. Chrome only;
 * Firefox and Safari stay open.
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
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TOTAL = 10_000
const PORT = '[data-testid="tv-main"] [data-slot="virtual-list"]'

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-virtual-'))
  const cssOut = join(scratch, 'table-virtual.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-virtual.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-virtual: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-virtual-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-virtual: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-virtual</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function frames(page: LayoutPage): Promise<void> {
  await page.raw.evaluate(
    () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  )
  await page.settle()
}

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${PORT} tbody tr[role="row"]`)
  await frames(page)
  return page
}

async function scrollTo(page: LayoutPage, top: number): Promise<void> {
  await page.raw.evaluate(
    ({ sel, top }) => {
      const port = document.querySelector<HTMLElement>(sel)!
      port.scrollTop = top === -1 ? port.scrollHeight : top
    },
    { sel: PORT, top },
  )
  await frames(page)
}

/** The head's top against the scroller's top, and what the window holds. */
const probe = (page: LayoutPage) =>
  page.raw.evaluate((sel) => {
    const port = document.querySelector<HTMLElement>(sel)!
    // The sticky boxes are the header cells (`ui/table` pins each `th`), not the `thead`.
    const head = port.querySelector('thead th')!
    const rows = [...port.querySelectorAll<HTMLElement>('tbody tr[role="row"]')]
    const active = document.activeElement
    return {
      headOffset: head.getBoundingClientRect().top - port.getBoundingClientRect().top,
      mounted: rows.length,
      rowcount: port.querySelector('table')?.getAttribute('aria-rowcount') ?? null,
      scrollTop: port.scrollTop,
      firstIndex: rows[0]?.getAttribute('aria-rowindex') ?? null,
      focused:
        active instanceof HTMLElement && active.tagName === 'TR'
          ? (active.querySelector('[data-kind="entity"]')?.textContent ?? '')
          : `<${active?.tagName ?? 'none'}>`,
      focusedIndex: active?.getAttribute('aria-rowindex') ?? null,
    }
  }, PORT)

layout('DataTable virtual (S2, Chrome)', () => {
  test('a 10k table mounts a window, counts every row and keeps the page from scrolling sideways', async () => {
    const page = await open()
    const p = await probe(page)
    expect(p.mounted).toBeGreaterThan(5)
    expect(p.mounted).toBeLessThan(100)
    expect(p.rowcount).toBe(String(TOTAL + 1))
    expect(p.firstIndex).toBe('2')
    expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the virtual table', DESKTOP_1440)
  })

  test('the head moves at most 1 px against the scroller between scroll positions', async () => {
    const page = await open()
    const offsets: number[] = []
    const mounted: number[] = []
    for (const top of [0, 333, 40_000, 200_000, -1, 1_234]) {
      await scrollTo(page, top)
      const p = await probe(page)
      offsets.push(p.headOffset)
      mounted.push(p.mounted)
    }
    const spread = Math.max(...offsets) - Math.min(...offsets)
    console.log(
      `S2 head offsets ${offsets.map((o) => o.toFixed(2)).join(', ')} (spread ${spread.toFixed(2)} px)`,
    )
    expect(spread).toBeLessThanOrEqual(1)
    for (const n of mounted) expect(n).toBeLessThan(100)
  })

  test('focus stays on its row after a scroll takes the row out of view', async () => {
    const page = await open()
    await page.raw.focus(`${PORT} tbody tr[tabindex="0"]`)
    for (let i = 0; i < 3; i++) await page.raw.keyboard.press('ArrowDown')
    await frames(page)
    expect((await probe(page)).focused).toBe('Booking 00003')
    await scrollTo(page, 150_000)
    const p = await probe(page)
    expect(p.scrollTop).toBeGreaterThan(100_000)
    expect(p.focused).toBe('Booking 00003')
    expect(p.mounted).toBeLessThan(100)
  })

  test('focus stays on its row after a sort moves it to index 0', async () => {
    const page = await open()
    await page.raw.focus(`${PORT} tbody tr[tabindex="0"]`)
    await page.raw.keyboard.press('End')
    await frames(page)
    const before = await probe(page)
    expect(before.focused).toBe('Booking 09999')
    expect(before.scrollTop).toBeGreaterThan(100_000)
    await page.raw.evaluate(() =>
      (window as unknown as { basaltSort: (id: string, desc: boolean) => void }).basaltSort(
        'amount',
        true,
      ),
    )
    await frames(page)
    const after = await probe(page)
    // The request changed: the window is back at the first row, which is now the focused one.
    expect(after.scrollTop).toBe(0)
    expect(after.focused).toBe('Booking 09999')
    expect(after.focusedIndex).toBe('2')
    expect(after.mounted).toBeLessThan(100)
    // The roving keys still walk from it.
    await page.raw.keyboard.press('ArrowDown')
    await frames(page)
    expect((await probe(page)).focused).toBe('Booking 09998')
  })
})
