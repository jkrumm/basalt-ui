import { describe, expect, test } from 'bun:test'

import { failedItemsFirst, parseFailures } from './failed-first'

const layout = [
  'bun test v1.4.2',
  '',
  'packages/basalt-ui/src/a.layout.test.ts:',
  'log from a',
  '',
  'packages/basalt-ui/src/b.layout.test.ts:',
  '(fail) Toolbar > expanded 1440 > axe finds nothing in dark [315.23ms]',
  '(pass) another [1ms]',
  '',
  'packages/basalt-ui/src/c.layout.test.ts:',
  '\u001b[31m(fail)\u001b[0m shell > narrow [2ms]',
  'Bailed out after 1 failure',
].join('\n')

describe('parseFailures', () => {
  test('a failing test belongs to the file header printed before it', () => {
    expect(parseFailures(layout, 'file')).toEqual([
      'packages/basalt-ui/src/b.layout.test.ts',
      'packages/basalt-ui/src/c.layout.test.ts',
    ])
  })

  test('a fail line before any header names no file', () => {
    expect(parseFailures('(fail) alone [1ms]', 'file')).toEqual([])
  })

  test('a matrix cell names its route, a describe chain before it is skipped', () => {
    const matrix = [
      '(fail) /table 1800 x 1200 light pseudo=false [4000ms]',
      '(fail) quality matrix (sampled) > /scenarios/expr-n87 390 x 844 dark pseudo=true [9ms]',
      '(fail) hover changes the readout, never the chart or its card > / 390 x 844 [9ms]',
      '(fail) known findings > every entry still matches a failing item [1ms]',
    ].join('\n')
    expect(parseFailures(matrix, 'route')).toEqual(['/table', '/scenarios/expr-n87', '/'])
  })

  test('a green output remembers nothing', () => {
    expect(parseFailures('(pass) a [1ms]\n 3 pass\n 0 fail', 'file')).toEqual([])
  })
})

describe('failedItemsFirst', () => {
  const items = ['./a.test.ts', 'b.test.ts', './c.test.ts']

  test('no memory keeps the order', () => {
    expect(failedItemsFirst(items, new Set())).toEqual(items)
  })

  test('the remembered items lead, with or without a ./, each part keeps its order', () => {
    expect(failedItemsFirst(items, new Set(['c.test.ts', 'a.test.ts']))).toEqual([
      './a.test.ts',
      './c.test.ts',
      'b.test.ts',
    ])
  })

  test('an item that is gone moves nothing, and every item still runs once', () => {
    const order = failedItemsFirst(items, new Set(['gone.test.ts', 'b.test.ts']))
    expect(order.toSorted()).toEqual(items.toSorted())
    expect(order[0]).toBe('b.test.ts')
  })
})
