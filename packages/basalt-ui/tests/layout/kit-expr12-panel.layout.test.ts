/**
 * Expression cycle 12 kit fixes, the DataPanel group (`v3-expr-12-kit-fixes` 1 and 2): a table in a
 * half-width DataPanel keeps the columns that fit, and a body sized in rows shows every phone card,
 * its loading frame ending where the loaded frame does. Fixture: `fixture/kit-expr12-panel-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1400 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('panel')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x12-half"] tbody tr')
  await page.settle()
  return page
}

type Visible = { id: string; shown: boolean }

const priority3 = (page: LayoutPage, testid: string): Promise<Visible[]> =>
  page.raw
    .evaluate((id) => {
      const root = document.querySelector(`[data-testid="${id}"] [data-slot="table-root"]`)!
      const header = root.querySelector<HTMLElement>('[data-slot="table-header"]')!
      return {
        cards: getComputedStyle(header).position === 'absolute',
        cells: [...root.querySelectorAll<HTMLElement>('thead th[data-priority="3"]')].map((th) => ({
          id: th.textContent ?? '',
          shown: getComputedStyle(th).display !== 'none',
        })),
      }
    }, testid)
    .then((r) => (r.cards ? [] : r.cells))

layout('a table in a half-width panel keeps the columns that fit', () => {
  test('five columns of 664 px keep their priority 3 columns in a 750 px panel', async () => {
    const page = await open(WIDE)
    const cells = await priority3(page, 'x12-half')
    expect(cells.length).toBe(2)
    expect(cells.every((cell) => cell.shown)).toBe(true)
  })

  test('columns that sum above the cell hide their priority 3 columns', async () => {
    const page = await open(WIDE)
    const cells = await priority3(page, 'x12-over')
    expect(cells.length).toBe(4)
    expect(cells.every((cell) => !cell.shown)).toBe(true)
  })
})

type Frame = { top: number; bottom: number; cards: number; shownCards: number; cut: number }

const frame = (page: LayoutPage, state: string): Promise<Frame> =>
  page.raw.evaluate((s) => {
    const root = document.querySelector<HTMLElement>(
      `[data-testid="x12-${s === 'switch' ? 'switch' : `bills-${s}`}"]`,
    )!
    const box = root.querySelector<HTMLElement>('[data-slot="card-phase"]')!
    const b = box.getBoundingClientRect()
    const rows = [...box.querySelectorAll<HTMLElement>('tbody [data-slot="table-row"]')]
    const inside = rows.filter((r) => r.getBoundingClientRect().bottom <= b.bottom + 1)
    const cut = rows.filter((r) => {
      const rect = r.getBoundingClientRect()
      return rect.top < b.bottom - 1 && rect.bottom > b.bottom + 1
    })
    return {
      top: b.top,
      bottom: b.bottom,
      cards: rows.length,
      shownCards: inside.length,
      cut: cut.length,
    }
  }, state)

layout('a DataPanel sized in rows fits its phone cards', () => {
  test('at 390 every bill is a whole card, the box ends at the last one', async () => {
    const page = await open(PHONE)
    const f = await frame(page, 'ready')
    expect(f.cards).toBe(4)
    expect(f.shownCards).toBe(4)
    expect(f.cut).toBe(0)
  })

  test('at 390 a first loading frame is at most one card taller than the loaded one, never shorter', async () => {
    const page = await open(PHONE)
    const loaded = await frame(page, 'ready')
    const first = await frame(page, 'loading')
    const gap = first.bottom - first.top - (loaded.bottom - loaded.top)
    expect(gap).toBeGreaterThanOrEqual(-12)
    expect(gap).toBeLessThanOrEqual(100)
  })

  test('at 390 one panel keeps its loaded height through loading, error and empty', async () => {
    const page = await open(PHONE)
    const read = () => frame(page, 'switch')
    const loaded = await read()
    const height = loaded.bottom - loaded.top
    expect(loaded.cards).toBe(4)
    for (const state of ['loading', 'error', 'empty', 'ready']) {
      await page.raw.evaluate(
        (s) => (window as unknown as { x12Set: (s: string) => void }).x12Set(s),
        state,
      )
      await page.settle()
      const f = await read()
      expect(Math.abs(f.bottom - f.top - height), state).toBeLessThanOrEqual(12)
    }
  })

  test('at 1800 the box reserves at most one row beyond the four bills', async () => {
    const page = await open(WIDE)
    const f = await frame(page, 'ready')
    const lastRow = await page.raw.evaluate(() => {
      const rows = document.querySelectorAll(
        '[data-testid="x12-bills-ready"] tbody [data-slot="table-row"]',
      )
      return rows[rows.length - 1]!.getBoundingClientRect().bottom
    })
    expect(f.cards).toBe(4)
    expect(f.bottom - lastRow).toBeLessThanOrEqual(40)
    const loaded = f.bottom - f.top
    for (const state of ['loading', 'empty', 'error']) {
      const g = await frame(page, state)
      expect(Math.abs(g.bottom - g.top - loaded), state).toBeLessThanOrEqual(1)
    }
  })
})
