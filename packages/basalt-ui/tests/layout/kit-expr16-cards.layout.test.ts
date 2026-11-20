/**
 * Expression cycle 16 cards kit fixes (`v3-expr-16-kit-fixes`): kit-drawn text is never ellipsised at 390 (1b: a
 * StatCell or StatGroup error cause and a delta pill's base label wrap whole), a short column of cards
 * beside a taller one leaves no band between them (5: n76's BarList and DataPanel), a
 * non-zero BarList part keeps a visible width (9d), a delta pill is not followed by an ellipsis (9e) and a
 * phone card's id is mono (10b). Fixtures: `fixture/kit-expr16-cards-*-fixture.tsx`.
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
const WIDE: Viewport = { name: 'wide', width: 1800, height: 1200 }
const NARROW_WIDE: Viewport = { name: 'half page', width: 1580, height: 1200 }

type Name = 'text' | 'stretch' | 'phone' | 'delta'
const docs: Partial<Record<Name, Expr12Document>> = {}
beforeAll(async () => {
  for (const name of ['text', 'stretch', 'phone', 'delta'] as const)
    docs[name] = await buildExpr12Document(name, 'expr16-cards')
})
afterAll(() => {
  for (const doc of Object.values(docs)) doc.cleanup()
})

async function open(name: Name, viewport: Viewport, wait: string): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, docs[name]?.path ?? '', 'reduce', 'fine')
  await page.raw.waitForSelector(wait)
  await page.settle()
  return page
}

type Clip = { text: string; scrollWidth: number; clientWidth: number }

const clips = (page: LayoutPage, selector: string): Promise<Clip[]> =>
  page.raw.evaluate(
    (sel: string) =>
      [...document.querySelectorAll<HTMLElement>(sel)].map((el) => ({
        text: el.textContent ?? '',
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      })),
    selector,
  )

/** Every text is drawn whole: nothing of it is clipped by its own box. */
const expectWhole = (found: Clip[], count: number): void => {
  expect(found.length).toBe(count)
  for (const clip of found) expect(clip.scrollWidth).toBeLessThanOrEqual(clip.clientWidth)
}

layout('kit-drawn text at 390 is never ellipsised', () => {
  test('a StatCell error cause in a group of cards wraps inside its cell', async () => {
    const page = await open('text', PHONE, '[data-testid="k16-errors"] [data-slot="stat-error"]')
    expectWhole(await clips(page, '[data-testid="k16-errors"] [data-slot="stat-error"] p'), 4)
  })

  test('a StatCell error cause in a strip wraps inside its cell', async () => {
    const page = await open('text', PHONE, '[data-testid="k16-strip"] [data-slot="stat-error"]')
    expectWhole(await clips(page, '[data-testid="k16-strip"] [data-slot="stat-error"] p'), 3)
  })

  test('a delta pill keeps its base label whole beside a pill that leaves it no room', async () => {
    const page = await open('text', PHONE, '[data-testid="k16-delta"] [data-slot="stat-base"] p')
    expectWhole(await clips(page, '[data-testid="k16-delta"] [data-slot="stat-base"] p'), 2)
  })
})

type Stretch = {
  barBottom: number
  panelTop: number
  panelBottom: number
  columnBottom: number
  failed: number[]
}

const measure = async (): Promise<Stretch> => {
  const page = await open('stretch', WIDE, '[data-testid="k16-column"] [data-slot="bar-list"]')
  return page.raw.evaluate(() => {
    const column = document.querySelector('[data-testid="k16-column"]')!
    const bar = column.querySelector('[data-slot="bar-list"] [data-slot="card"]')!
    const panel = column.querySelector('[data-slot="data-panel"] [data-slot="card"]')!
    return {
      barBottom: bar.getBoundingClientRect().bottom,
      panelTop: panel.getBoundingClientRect().top,
      panelBottom: panel.getBoundingClientRect().bottom,
      columnBottom: column.firstElementChild!.getBoundingClientRect().bottom,
      failed: [
        ...column.querySelectorAll('[data-slot="bar-list-segment"][data-series="failed"]'),
      ].map((el) => el.getBoundingClientRect().width),
    }
  })
}

layout('a short column of cards beside a taller one', () => {
  test('two cards in a column beside a taller card leave no band between them', async () => {
    const m = await measure()
    expect(m.panelTop - m.barBottom).toBeLessThanOrEqual(13)
    expect(Math.abs(m.panelBottom - m.columnBottom)).toBeLessThanOrEqual(1)
  })

  test('a non-zero BarList part keeps a width the eye reads as a mark', async () => {
    const m = await measure()
    expect(m.failed.length).toBe(4)
    for (const width of m.failed) expect(width).toBeGreaterThanOrEqual(5)
  })
})

layout('a delta pill in a table cell', () => {
  test('is not followed by an ellipsis when it is wider than its column', async () => {
    const page = await open('delta', NARROW_WIDE, '[data-testid="k16-delta-table"] tbody tr')
    const overflow = await page.raw.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="k16-delta-table"] [data-slot="table-cell"][data-kind="delta"]',
        ),
      ].map((cell) => getComputedStyle(cell).textOverflow),
    )
    expect(overflow.length).toBe(4)
    for (const value of overflow) expect(value).not.toBe('ellipsis')
  })
})

layout('a phone card', () => {
  test('draws its id on the title line in the mono face', async () => {
    const page = await open('phone', PHONE, '[data-testid="k16-phone"] tbody tr')
    const face = await page.raw.evaluate(() => {
      const id = document.querySelector<HTMLElement>(
        '[data-testid="k16-phone"] tbody [data-slot="table-cell"][data-label="Id"] [data-slot="table-entity-name"]',
      )!
      return { text: id.textContent, family: getComputedStyle(id).fontFamily }
    })
    expect(face.text).toBe('#2417')
    expect(face.family).toMatch(/mono/i)
  })
})
