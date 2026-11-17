/**
 * The table-fit amendments (docs/v3/spikes/table-fit.md, S3 and S4): the wider `spark` and `delta`,
 * the `entity` `width: 'content'` option, and a named card slot placed before declaration order.
 */
import { describe, expect, test } from 'bun:test'
import { col, specOf } from './kinds'
import { KIND_DEFAULTS } from './kinds-spec'
import { CONTENT_MAX_CH, CONTENT_MIN_CH, CH_PX, CELL_PAD_PX, planTable, widthPx } from './plan'

type Row = { name: string; sub: string; per: number; month: number; trend: number[]; d: number }
const c = col<Row>()
const quiet = { warn: () => {} }

describe('kind widths', () => {
  test('spark is 22ch and delta 14ch', () => {
    expect(KIND_DEFAULTS.spark.width).toEqual({ ch: 22, flex: false })
    expect(KIND_DEFAULTS.delta.width).toEqual({ ch: 14, flex: false })
  })

  test('relativeTime holds its longest English phrase, `30 minutes ago`', () => {
    const width = KIND_DEFAULTS.relativeTime.width
    expect(width).toEqual({ ch: 14, flex: false })
    expect('30 minutes ago'.length).toBeLessThanOrEqual(14)
  })
})

describe("entity width: 'content'", () => {
  const entity = c.entity('name', { width: 'content', sub: (r) => r.sub })

  test('without a loaded width the column takes its floor and is no longer flexible', () => {
    const plan = planTable([entity], quiet)
    expect(plan.columns[0]?.widthPx).toBe(CONTENT_MIN_CH * CH_PX + CELL_PAD_PX)
  })

  test('is as wide as the widest value, name or sub line, inside the floor and the cap', () => {
    const at = (ch: number) =>
      planTable([entity], { ...quiet, contentCh: { name: ch } }).columns[0]?.widthPx
    expect(at(26)).toBe(widthPx({ ch: 26, flex: false }))
    expect(at(3)).toBe(widthPx({ ch: CONTENT_MIN_CH, flex: false }))
    expect(at(90)).toBe(widthPx({ ch: CONTENT_MAX_CH, flex: false }))
  })

  test('measures the longer of the name and the sub line', () => {
    const measure = specOf(entity).content?.measure
    expect(measure?.({ name: 'Acme', sub: 'Household and groceries' } as Row)).toBe(23)
    expect(measure?.({ name: 'A long merchant name', sub: 'x' } as Row)).toBe(20)
  })

  test('a plain entity stays flexible and unmeasured', () => {
    expect(specOf(c.entity('name')).content).toBeUndefined()
    expect(planTable([c.entity('name')], quiet).columns[0]?.widthPx).toBe(
      widthPx({ ch: 18, flex: true }),
    )
  })
})

describe('card slot order', () => {
  test("a column that names 'value' wins it over an earlier column of the same kind", () => {
    const plan = planTable(
      [
        c.entity('name'),
        c.number('per', { header: 'Units' }),
        c.number('month', { card: 'value' }),
      ],
      quiet,
    )
    expect(plan.columns.map((column) => column.place)).toEqual(['title', 'meta', 'value'])
  })

  test('without a named slot declaration order still decides', () => {
    const plan = planTable([c.entity('name'), c.number('per'), c.number('month')], quiet)
    expect(plan.columns.map((column) => column.place)).toEqual(['title', 'value', 'meta'])
  })
})

describe('text width: short values size the column', () => {
  const text = col<{ ref: string; long: string }>().text('ref', { header: 'Issue' })
  const widthAt = (ch: number | undefined) =>
    planTable([text], {
      ...quiet,
      ...(ch !== undefined && { contentCh: { ref: ch } }),
    }).columns[0]
  const headerFloor = widthPx({ ch: 'Issue'.length + 5, flex: false })

  test('without loaded values the column keeps its kind width and stays flexible', () => {
    expect(widthAt(undefined)?.widthPx).toBe(widthPx({ ch: 16, flex: true }))
    expect(widthAt(undefined)?.flex).toBe(true)
  })

  test('a short widest value sizes the column to it, never under its header', () => {
    expect(widthAt(4)?.widthPx).toBe(headerFloor)
    expect(widthAt(4)?.flex).toBe(false)
    expect(widthAt(20)?.widthPx).toBe(widthPx({ ch: 20, flex: false }))
  })

  test('a value past the short cap leaves the column flexible', () => {
    expect(widthAt(25)?.flex).toBe(true)
    expect(widthAt(25)?.widthPx).toBe(widthPx({ ch: 16, flex: true }))
  })

  test('measures the label drawn, not the stored value', () => {
    const labelled = col<{ ref: string }>().text('ref', { labels: { f: 'Factory' } })
    expect(specOf(labelled).content?.measure({ ref: 'f' })).toBe(7)
    expect(specOf(labelled).content?.measure({ ref: undefined as unknown as string })).toBe(1)
  })

  test('an entity column is flexible unless it asks for its content', () => {
    expect(planTable([c.entity('name')], quiet).columns[0]?.flex).toBe(true)
    expect(planTable([c.entity('name', { width: 'content' })], quiet).columns[0]?.flex).toBe(false)
  })
})
