/**
 * The table at rest in real Chrome (docs/v3/issues/bench/bench-table-rest.json): a header at rest is
 * its icon and its label, a sorted and a filtered column each show their one mark, in light and dark;
 * on a fill page at 1800 the head, the row lines, a group row and the footer reach the scroller's edge
 * through the filler; a grid wider than its port scrolls sideways under its pinned column; an inline
 * select rests as its value and draws its control on the row's hover with a fine pointer only.
 *
 * Self-contained like `table-view`: the fixture CSS is compiled with the Tailwind CLI into a temp
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
const WIDE: Viewport = { name: 'wide', width: 1800, height: 1200 }

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-rest-'))
  const cssOut = join(scratch, 'table-rest.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-rest.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`table-rest: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-rest-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-rest: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-rest</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

const frame = (page: LayoutPage): Promise<unknown> =>
  page.raw.evaluate(
    () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  )

async function open(
  scheme: 'light' | 'dark' = 'light',
  pointer: 'fine' | 'coarse' = 'fine',
): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-testid="tr-grid"] tbody tr[role="row"]')
  if (scheme === 'dark')
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.settle()
  await frame(page)
  return page
}

type Head = {
  name: string
  buttons: number
  icons: number
  sort: string[]
  filter: number
  glyphs: number
}

/** Each header of a table: its buttons, its kind icon, its state marks and every drawn glyph. */
const heads = (page: LayoutPage, testId: string): Promise<Head[]> =>
  page.raw.evaluate((testId) => {
    const shown = (el: Element): boolean => {
      const box = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return (
        box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0'
      )
    }
    return [
      ...document.querySelectorAll(`[data-testid="${testId}"] thead th[role="columnheader"]`),
    ].map((th) => ({
      name: th.textContent?.trim() ?? '',
      buttons: [...th.querySelectorAll('button')].filter(shown).length,
      icons: [...th.querySelectorAll('[data-slot="table-kind-icon"]')].filter(shown).length,
      sort: [...th.querySelectorAll('[data-slot="table-sort-mark"]')]
        .filter(shown)
        .map((mark) => mark.getAttribute('data-direction') ?? ''),
      filter: [...th.querySelectorAll('[data-slot="table-filter-mark"]')].filter(shown).length,
      glyphs: [...th.querySelectorAll('svg')].filter(shown).length,
    }))
  }, testId)

type Edge = { what: string; right: number; hit: boolean; line: string; ground: string }

/**
 * Every head, body, group and footer row of a table: how far its box runs past the port's end edge
 * (0 when it reaches it), whether the point just inside that edge belongs to the row, and the line
 * and ground its filler cell draws there.
 */
const edges = (page: LayoutPage, testId: string): Promise<{ port: number; rows: Edge[] }> =>
  page.raw.evaluate((testId) => {
    const root = document.querySelector(`[data-testid="${testId}"] [data-slot="table-root"]`)!
    const port = root.querySelector('[data-slot="table-scroller"]')!.getBoundingClientRect()
    const rows = [...root.querySelectorAll('tr')].map((tr) => {
      const box = tr.getBoundingClientRect()
      const after = getComputedStyle(tr, '::after')
      const hit = document.elementFromPoint(port.right - 2, box.top + box.height / 2)
      const group =
        tr.closest('tbody') !== null && tr.querySelector('[data-slot="table-group"]') !== null
      return {
        what: tr.closest('thead')
          ? 'head'
          : tr.closest('tfoot')
            ? 'foot'
            : group
              ? 'group'
              : 'body',
        right: Math.round(port.right - box.right),
        hit: hit !== null && tr.contains(hit),
        line: after.borderBottomWidth,
        ground: getComputedStyle(tr).backgroundColor,
      }
    })
    return { port: Math.round(port.width), rows }
  }, testId)

type Control = { border: string; ground: string; chevron: string; expanded: string | null }
const control = (page: LayoutPage, row: number): Promise<Control> =>
  page.raw.evaluate((row) => {
    const trigger = document.querySelectorAll<HTMLElement>(
      '[data-testid="tr-state"] [data-slot="table-select-cell"] [data-slot="select-trigger"]',
    )[row]!
    const style = getComputedStyle(trigger)
    const chevron = trigger.querySelector('svg:last-child')
    return {
      border: style.borderTopColor,
      ground: style.backgroundColor,
      chevron: chevron === null ? '' : getComputedStyle(chevron).opacity,
      expanded: trigger.getAttribute('aria-expanded'),
    }
  }, row)
const clear = (color: string): boolean => /rgba\(0, 0, 0, 0\)|transparent|\/ 0\)$/.test(color)

layout('DataTable at rest', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: a header at rest is its label, no icon; a sorted and a filtered column show their one mark`, async () => {
      const page = await open(scheme)
      for (const head of await heads(page, 'tr-plain')) {
        expect(head).toMatchObject({ buttons: 1, icons: 0, sort: [], filter: 0, glyphs: 0 })
      }
      await page.raw.evaluate(() =>
        (window as unknown as { basaltTableState: () => void }).basaltTableState(),
      )
      await frame(page)
      const state = await heads(page, 'tr-state')
      const byName = (name: string): Head | undefined => state.find((h) => h.name.startsWith(name))
      expect(byName('Amount')).toMatchObject({
        buttons: 1,
        icons: 0,
        sort: ['asc'],
        filter: 0,
        glyphs: 1,
      })
      expect(byName('State')).toMatchObject({
        buttons: 1,
        icons: 0,
        sort: [],
        filter: 1,
        glyphs: 1,
      })
      for (const head of state.filter((h) => !/^(Amount|State)/.test(h.name)))
        expect(head).toMatchObject({ sort: [], filter: 0, glyphs: 0 })
    })
  }

  for (const testId of ['tr-state', 'tr-group']) {
    test(`${testId}: at 1800 the head, the row lines, the group rows and the footer reach the port's edge`, async () => {
      const page = await open()
      const { port, rows } = await edges(page, testId)
      expect(port).toBeGreaterThan(1700)
      expect(rows.some((r) => r.what === 'foot')).toBe(true)
      if (testId === 'tr-group') expect(rows.filter((r) => r.what === 'group').length).toBe(3)
      for (const row of rows) {
        expect(row.right).toBe(0)
        expect(row.hit).toBe(true)
      }
      // The filler continues each line: body rows (but the body's last) and the footer draw one.
      const body = rows.filter((r) => r.what === 'body')
      for (const row of body.slice(0, -1)) expect(row.line).toBe('1px')
      expect(rows.find((r) => r.what === 'foot')?.line).toBe('1px')
      // The reading look draws a group row quiet: no tint, the row's own rule only (bench-table-reading).
      for (const row of rows.filter((r) => r.what === 'group'))
        expect(row.ground).toBe('rgba(0, 0, 0, 0)')
    })
  }

  test('the text-like columns share the free width past any cap; figures and dates keep theirs', async () => {
    const page = await open()
    const cols = await page.raw.evaluate(() =>
      [...document.querySelectorAll('[data-testid="tr-plain"] col')].map((col) => ({
        fill: col.hasAttribute('data-fill'),
        flex: col.hasAttribute('data-flex'),
        width: Math.round(col.getBoundingClientRect().width),
      })),
    )
    const [name, note, state, amount, due, fill] = cols
    // The reading look has no cap: Account (the title, 344 px at 40 ch) and Note (408 px at 48 ch) grow past it
    // and leave the filler no width, so the table ends at the container's edge.
    expect(name?.flex).toBe(true)
    expect(note?.flex).toBe(true)
    expect(name?.width).toBeGreaterThan(344)
    expect(note?.width).toBeGreaterThan(408)
    for (const fixed of [state, amount, due]) expect(fixed?.flex).toBe(false)
    expect(fill?.fill).toBe(true)
    expect(fill?.width).toBeLessThanOrEqual(1)
  })

  test('below its full tier the hidden columns leave the free width to the title', async () => {
    const page = await open()
    const read = await page.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="tr-reduced"] [data-slot="table-root"]')!
      const cols = [...root.querySelectorAll('col')].map((col) =>
        Math.round(col.getBoundingClientRect().width),
      )
      return {
        fullAt: Number(root.getAttribute('data-full-at')),
        port: Math.round(root.getBoundingClientRect().width),
        cols,
      }
    })
    // The table is reduced here: the Note column (priority 3) draws no width.
    expect(read.port).toBeLessThan(read.fullAt)
    expect(read.cols[1]).toBe(0)
    // Account, the one column that grows, takes the width Note would have held: the row fills the port
    // with no filler left, and the title is past its 168 px floor.
    expect(read.cols[0]).toBeGreaterThan(168)
    expect(read.cols[0]! + read.cols[2]! + read.cols[3]!).toBe(read.port)
  })

  test('a grid wider than its port scrolls sideways under its pinned column', async () => {
    const page = await open()
    const read = (by: number) =>
      page.raw.evaluate(async (by) => {
        const port = document.querySelector<HTMLElement>(
          '[data-testid="tr-grid"] [data-slot="table-scroller"]',
        )!
        port.scrollLeft = by
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done(null))),
        )
        const left = port.getBoundingClientRect().left
        const at = (sel: string): number =>
          Math.round(
            (port.querySelector(`tbody tr ${sel}`)?.getBoundingClientRect().left ?? NaN) - left,
          )
        return {
          overflow: port.scrollWidth - port.clientWidth,
          scrolled: Math.round(port.scrollLeft),
          identity: at('[data-identity]'),
          next: at('[data-col="note"]'),
        }
      }, by)
    const rest = await read(0)
    expect(rest.overflow).toBeGreaterThan(0)
    const moved = await read(200)
    expect(moved.scrolled).toBe(200)
    expect(moved.identity).toBe(rest.identity)
    expect(moved.next).toBe(rest.next - 200)
  })

  test('an inline select rests as its value and draws its control on the row hover and while open', async () => {
    const page = await open()
    const rest = await control(page, 0)
    expect(clear(rest.border)).toBe(true)
    expect(clear(rest.ground)).toBe(true)
    expect(rest.chevron).toBe('0')
    await page.raw.hover('[data-testid="tr-state"] tbody tr[role="row"] [data-identity]')
    await frame(page)
    const hovered = await control(page, 0)
    expect(clear(hovered.border)).toBe(false)
    expect(hovered.chevron).toBe('1')
    // The other rows stay at rest.
    expect(clear((await control(page, 1)).border)).toBe(true)
    await page.raw.click(
      '[data-testid="tr-state"] [data-slot="table-select-cell"] [data-slot="select-trigger"]',
    )
    await page.raw.mouse.move(0, 0)
    await frame(page)
    const opened = await control(page, 0)
    expect(opened.expanded).toBe('true')
    expect(clear(opened.border)).toBe(false)
  })

  test('on a coarse pointer the select rests as its value under a touch and opens on a tap', async () => {
    const page = await open('light', 'coarse')
    const rest = await control(page, 0)
    expect(clear(rest.border)).toBe(true)
    await page.raw.tap(
      '[data-testid="tr-state"] [data-slot="table-select-cell"] [data-slot="select-trigger"]',
    )
    await frame(page)
    expect((await control(page, 0)).expanded).toBe('true')
  })
})
