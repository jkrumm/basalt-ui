/**
 * Expression cycle 13 kit fixes, the DataPanel group (`v3-expr-13-kit-fixes`, findings .6 .21 .30 .39 .42
 * .61): a `rows` body declared as N data rows plus the head row shows its N cards whole at 390 px and fills
 * the desktop box at 1800 with no blank band and no cut; a loading frame ends where the loaded one does.
 * Fixture: `fixture/kit-expr13-panel-fixture.tsx`.
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
  doc = await buildExpr12Document('panel', 'expr13')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x13-sites-four"] tbody tr')
  await page.settle()
  return page
}

type Frame = {
  height: number
  rows: number
  shown: number
  cut: number
  /** Space between the box's foot and the last whole row (or card). */
  blank: number
}

const frame = (page: LayoutPage, testid: string): Promise<Frame> =>
  page.raw.evaluate((id) => {
    const root = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    const box = root.querySelector<HTMLElement>('[data-slot="card-phase"]')!
    const b = box.getBoundingClientRect()
    const rows = [...box.querySelectorAll<HTMLElement>('tbody [data-slot="table-row"]')]
    const inside = rows.filter((r) => r.getBoundingClientRect().bottom <= b.bottom + 1)
    const cut = rows.filter((r) => {
      const rect = r.getBoundingClientRect()
      return rect.top < b.bottom - 1 && rect.bottom > b.bottom + 1
    })
    const lastBottom = inside.reduce((m, r) => Math.max(m, r.getBoundingClientRect().bottom), b.top)
    return {
      height: b.height,
      rows: rows.length,
      shown: inside.length,
      cut: cut.length,
      blank: b.bottom - lastBottom,
    }
  }, testid)

layout('a meter table declared N + 1 rows shows every card whole at 390', () => {
  test('three cards in a rows-4 box are all whole and the box ends at the last one', async () => {
    const page = await open(PHONE)
    const f = await frame(page, 'x13-sites-three')
    expect(f.rows).toBe(3)
    expect(f.shown).toBe(3)
    expect(f.cut).toBe(0)
    expect(f.blank).toBeLessThanOrEqual(1)
  })

  test('four cards in a rows-5 box are all whole and the box ends at the last one', async () => {
    const page = await open(PHONE)
    const f = await frame(page, 'x13-sites-four')
    expect(f.rows).toBe(4)
    expect(f.shown).toBe(4)
    expect(f.cut).toBe(0)
    expect(f.blank).toBeLessThanOrEqual(1)
  })

  test('the scenario declaration of N + 2 rows still shows all four cards whole', async () => {
    const page = await open(PHONE)
    const f = await frame(page, 'x13-sites-n57')
    expect(f.shown).toBe(4)
    expect(f.cut).toBe(0)
  })
})

layout('a meter table declared N + 1 rows has no blank band and no cut at 1800', () => {
  test('three data rows in a rows-4 box: the box ends at the last row', async () => {
    const page = await open(WIDE)
    const f = await frame(page, 'x13-sites-three')
    expect(f.shown).toBe(3)
    expect(f.cut).toBe(0)
    expect(f.blank).toBeLessThanOrEqual(1)
  })

  test('four data rows in a rows-5 box: the box ends at the last row', async () => {
    const page = await open(WIDE)
    const f = await frame(page, 'x13-sites-four')
    expect(f.shown).toBe(4)
    expect(f.cut).toBe(0)
    expect(f.blank).toBeLessThanOrEqual(1)
  })

  test('the scenario declaration of N + 2 rows leaves at most one row blank', async () => {
    const page = await open(WIDE)
    const f = await frame(page, 'x13-sites-n57')
    expect(f.shown).toBe(4)
    expect(f.cut).toBe(0)
    expect(f.blank).toBeLessThanOrEqual(40)
  })
})

layout('a loading frame of a rows body ends where the loaded frame does', () => {
  test('at 390 the first loading frame is no shorter than the loaded one and at most one card taller', async () => {
    const page = await open(PHONE)
    const loaded = await frame(page, 'x13-sites-four')
    const loading = await frame(page, 'x13-sites-loading')
    const gap = loading.height - loaded.height
    expect(gap).toBeGreaterThanOrEqual(-1)
    expect(gap).toBeLessThanOrEqual(108)
  })

  test('at 1800 the loading frame is the same height as the loaded one', async () => {
    const page = await open(WIDE)
    const loaded = await frame(page, 'x13-sites-four')
    const loading = await frame(page, 'x13-sites-loading')
    expect(Math.abs(loading.height - loaded.height)).toBeLessThanOrEqual(1)
  })

  test('at 390 a loaded panel keeps its loaded height through loading, error and empty', async () => {
    const page = await open(PHONE)
    const loaded = await frame(page, 'x13-switch')
    expect(loaded.shown).toBe(4)
    for (const state of ['loading', 'error', 'empty', 'ready']) {
      await page.raw.evaluate(
        (s) => (window as unknown as { x13Set: (s: string) => void }).x13Set(s),
        state,
      )
      await page.settle()
      const f = await frame(page, 'x13-switch')
      expect(Math.abs(f.height - loaded.height), state).toBeLessThanOrEqual(12)
    }
  })
})
