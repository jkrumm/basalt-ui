import { describe, expect, test } from 'bun:test'

import { failedFirst, parseFailedFiles } from './unit-order'

const groups = [
  ['a.test.ts'],
  ['b.test.ts', 'c.test.ts'],
  ['d.test.ts'],
  ['e.test.ts', 'f.test.ts'],
]

describe('failedFirst', () => {
  test('no failure keeps the order', () => {
    expect(failedFirst(groups, new Set())).toEqual(groups)
  })

  test('the groups holding a failed file lead, each part keeps its order', () => {
    expect(failedFirst(groups, new Set(['f.test.ts', 'c.test.ts']))).toEqual([
      ['b.test.ts', 'c.test.ts'],
      ['e.test.ts', 'f.test.ts'],
      ['a.test.ts'],
      ['d.test.ts'],
    ])
  })

  test('a failed file that no longer exists moves nothing', () => {
    expect(failedFirst(groups, new Set(['gone.test.ts']))).toEqual(groups)
  })

  test('every group still runs once', () => {
    const order = failedFirst(groups, new Set(['d.test.ts']))
    expect(order.flat().toSorted()).toEqual(groups.flat().toSorted())
  })
})

describe('parseFailedFiles', () => {
  test('reads a list of files', () => {
    expect(parseFailedFiles('["a.test.ts","b.test.ts"]')).toEqual(
      new Set(['a.test.ts', 'b.test.ts']),
    )
  })

  test('anything else is no memory', () => {
    expect(parseFailedFiles('')).toEqual(new Set())
    expect(parseFailedFiles('{"a":1}')).toEqual(new Set())
    expect(parseFailedFiles('[1,"a.test.ts",null]')).toEqual(new Set(['a.test.ts']))
  })
})
