/**
 * The table's phone projection at 390 (`phone: 'cards'`, the default): a list row. The title over up to
 * two muted meta values with no header prefix, the answering meter at the right edge centred over both
 * lines, every other column behind the tap; `phone: 'fields'` still prints each value with its header.
 * Fixture: `fixture/kit-expr14-phone-list-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('phone-list', 'expr14')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  if (!doc) throw new Error('fixture not built')
  const page = await openFixture(EMPTY_SPEC, PHONE, doc.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="pl-list"] tbody tr')
  await page.settle()
  return page
}

type Box = { left: number; right: number; top: number; bottom: number }
type Row = {
  row: Box
  title: Box & { text: string }
  metas: (Box & { text: string; before: string; headerText: boolean })[]
  value: Box & { hasMeter: boolean }
  drawn: number
  alpha: Box | null
}

const centre = (b: Box): number => (b.top + b.bottom) / 2

const rowOf = (page: LayoutPage): Promise<Row> =>
  page.raw.evaluate(() => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    const tr = document.querySelector('[data-testid="pl-list"] tbody tr')!
    const cells = [...tr.querySelectorAll<HTMLElement>('[data-slot="table-cell"]')]
    const shown = cells.filter((cell) => getComputedStyle(cell).display !== 'none')
    const title = tr.querySelector<HTMLElement>('[data-place="title"]')!
    const value = tr.querySelector<HTMLElement>('[data-phone-value]')!
    return {
      row: box(tr),
      title: { ...box(title), text: title.textContent ?? '' },
      metas: [...tr.querySelectorAll<HTMLElement>('[data-phone-meta]')].map((cell) => ({
        ...box(cell),
        text: cell.textContent ?? '',
        before: getComputedStyle(cell, '::before').content,
        headerText: ['Alpha', 'Beta', 'Gamma'].some((h) => (cell.textContent ?? '').includes(h)),
      })),
      value: { ...box(value), hasMeter: value.querySelector('[data-slot="meter"]') !== null },
      drawn: shown.length,
      alpha: (() => {
        const hidden = tr.querySelector('[data-col="c"]')
        return hidden && getComputedStyle(hidden).display !== 'none' ? box(hidden) : null
      })(),
    }
  })

layout('phone: cards is a list row at 390', () => {
  test('the title sits above two muted values that carry no header text', async () => {
    const r = await rowOf(await open())
    expect(r.metas.length).toBe(2)
    for (const meta of r.metas) {
      expect(meta.top).toBeGreaterThanOrEqual(r.title.bottom - 1)
      expect(meta.headerText).toBe(false)
      expect(meta.before.includes(':')).toBe(false)
    }
    expect(r.title.right).toBeLessThanOrEqual(r.value.left)
  })

  test('only the title, two values and the answer are drawn; the third figure is not', async () => {
    const r = await rowOf(await open())
    expect(r.drawn).toBe(4)
    expect(r.alpha).toBeNull()
  })

  test('the answering meter ends 16 px from the row edge and sits within the row, centred', async () => {
    const r = await rowOf(await open())
    expect(r.value.hasMeter).toBe(true)
    expect(Math.abs(r.row.right - r.value.right - 16)).toBeLessThanOrEqual(1)
    expect(r.value.top).toBeGreaterThanOrEqual(r.row.top)
    expect(r.value.bottom).toBeLessThanOrEqual(r.row.bottom)
    expect(Math.abs(centre(r.value) - centre(r.row))).toBeLessThanOrEqual(2)
  })

  test('a row is at least 56 px tall and holds the title on one line', async () => {
    const r = await rowOf(await open())
    expect(r.row.bottom - r.row.top).toBeGreaterThanOrEqual(56)
    expect(r.title.bottom - r.title.top).toBeLessThan(28)
    for (const meta of r.metas) expect(meta.bottom - meta.top).toBeLessThan(28)
  })

  test('a tap on the row opens the record, which lists the columns the row leaves out', async () => {
    const page = await open()
    await page.raw.click('[data-testid="pl-list"] tbody tr [data-place="title"]')
    await page.raw.waitForSelector('[role="dialog"]')
    const text = await page.raw.evaluate(
      () => document.querySelector('[role="dialog"]')?.textContent ?? '',
    )
    expect(text).toContain('Gamma')
    expect(text).toContain('Load')
  })
})

layout('phone: fields keeps the label-and-value grid at 390', () => {
  test('every value is printed with its column header', async () => {
    const page = await open()
    const labels = await page.raw.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="pl-fields"] tbody tr:first-child [data-slot="table-cell"][data-label]',
        ),
      ].map((cell) => ({
        display: getComputedStyle(cell).display,
        before: getComputedStyle(cell, '::before').content,
      })),
    )
    expect(labels.length).toBe(4)
    for (const label of labels) expect(label.display).toBe('block')
    expect(labels.map((l) => l.before)).toEqual(['"Alpha: "', '"Beta: "', '"Gamma: "', '"Load: "'])
  })
})
