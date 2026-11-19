/**
 * Nested rows as data: three levels in tree order, sort within a level, a filter keeps the path
 * above a match, a closed row hides what is below it, and a cycle or an unknown parent is a root.
 */
import { describe, expect, test } from 'bun:test'
import { parentsOf } from '../../common/nest'
import { treeItems } from './tree-row-model'

type Row = { id: string; parent?: string }

const ROWS: Row[] = [
  { id: 'a' },
  { id: 'b', parent: 'a' },
  { id: 'c', parent: 'b' },
  { id: 'd', parent: 'a' },
  { id: 'e' },
]

const model = (rows: readonly Row[]) => rows.map((original) => ({ id: original.id, original }))

const items = (
  matched: readonly Row[],
  opts: { collapsed?: string[]; narrowed?: boolean; all?: readonly Row[] } = {},
) =>
  treeItems({
    matched: model(matched),
    all: opts.all ?? ROWS,
    getRowId: (r) => r.id,
    parentOf: (r) => r.parent,
    collapsed: opts.collapsed,
    narrowed: opts.narrowed ?? false,
  })

describe('treeItems', () => {
  test('three levels in tree order, each with its level, size and position', () => {
    const out = items(ROWS)
    expect(out.map((i) => `${i.row.id}:${i.tree.level}`)).toEqual([
      'a:1',
      'b:2',
      'c:3',
      'd:2',
      'e:1',
    ])
    const b = out.find((i) => i.row.id === 'b')!.tree
    expect(b).toMatchObject({ parentId: 'a', parent: true, open: true, setSize: 2, posInSet: 1 })
    expect(out.find((i) => i.row.id === 'c')!.tree.parent).toBe(false)
  })

  test('siblings follow the engine order, so a sort orders each level', () => {
    // The engine sorted descending by id: e, d, c, b, a.
    const out = items(ROWS.toReversed())
    expect(out.map((i) => i.row.id)).toEqual(['e', 'a', 'd', 'b', 'c'])
  })

  test('a filter keeps the match with the rows above it as context, every path open', () => {
    const out = items([ROWS[2]!], { narrowed: true, collapsed: ['a'] })
    expect(out.map((i) => i.row.id)).toEqual(['a', 'b', 'c'])
    expect(out.map((i) => i.tree.context)).toEqual([true, true, false])
  })

  test('a closed row hides the rows below it and keeps itself', () => {
    const out = items(ROWS, { collapsed: ['b'] })
    expect(out.map((i) => i.row.id)).toEqual(['a', 'b', 'd', 'e'])
    expect(out.find((i) => i.row.id === 'b')!.tree.open).toBe(false)
  })
})

describe('parentsOf', () => {
  test('an unknown parent, the row itself or a cycle makes a root', () => {
    const rows: Row[] = [
      { id: 'x', parent: 'nope' },
      { id: 'y', parent: 'y' },
      { id: 'p', parent: 'q' },
      { id: 'q', parent: 'p' },
    ]
    const parents = parentsOf(
      rows,
      (r) => r.id,
      (r) => r.parent,
    )
    expect(parents.get('x')).toBeUndefined()
    expect(parents.get('y')).toBeUndefined()
    // The cycle is cut once: one of the two is a root, the other sits under it.
    const roots = ['p', 'q'].filter((id) => parents.get(id) === undefined)
    expect(roots.length).toBe(1)
    const out = items(rows.slice(2), { all: rows.slice(2) })
    expect(out.length).toBe(2)
  })
})
