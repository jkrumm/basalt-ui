import { describe, expect, test } from 'bun:test'
import { SMOKE, carries, fixtureImports, selectLayout, words } from './layout-select'

const L = 'packages/basalt-ui/tests/layout'
const SRC = 'packages/basalt-ui/src'
const tests = [
  ...SMOKE,
  'event-list',
  'charts',
  'charts-w38-legend',
  'meter-marks',
  'ui-choice',
  'ui-select',
  'shell-chrome',
].map((n) => `${L}/${n}.layout.test.ts`)
const names = (files: string[]) =>
  files.map((f) => f.split('/').pop()?.replace('.layout.test.ts', ''))

describe('words and carries', () => {
  test('PascalCase, kebab and plurals reduce to the same words', () => {
    expect(words('EventList.tsx')).toEqual(['event', 'list'])
    expect(words('event-list')).toEqual(['event', 'list'])
    expect(words('charts')).toEqual(['chart'])
    expect(words('class')).toEqual(['class'])
  })

  test('a key matches whole words in order, never a fragment', () => {
    expect(carries('event-list-w44', ['event', 'list'])).toBe(true)
    expect(carries('charts-w38-legend', ['chart'])).toBe(true)
    expect(carries('ui-select', ['select'])).toBe(true)
    expect(carries('selection', ['select'])).toBe(false)
    expect(carries('list-event', ['event', 'list'])).toBe(false)
  })
})

describe('selectLayout', () => {
  test('a docs, script, unit-test or CLI change selects nothing', () => {
    const changed = [
      'docs/v3/issues/1.md',
      'scripts/merge-guard.ts',
      `${SRC}/charts/Meter.test.tsx`,
      `${SRC}/cli/init.ts`,
      `${SRC}/lint/rules.ts`,
      'packages/basalt-ui/docs/x.md',
    ]
    expect(selectLayout({ changed, tests }).files).toEqual([])
  })

  test('a changed layout test runs itself and nothing else', () => {
    const file = `${L}/event-list.layout.test.ts`
    expect(selectLayout({ changed: [file], tests }).files).toEqual([file])
  })

  test('a src file runs the tests named for it and for its folder', () => {
    expect(names(selectLayout({ changed: [`${SRC}/charts/Meter.tsx`], tests }).files)).toEqual([
      'charts-w38-legend',
      'charts',
      'meter-marks',
    ])
  })

  test('a primitive runs the tests of the fixture that imports it', () => {
    const fixtureSources = new Map([
      [`${L}/fixture/ui-choice-fixture.tsx`, "import { Switch } from '../../../src/ui/switch'"],
    ])
    expect(
      names(selectLayout({ changed: [`${SRC}/ui/switch.tsx`], tests, fixtureSources }).files),
    ).toEqual(['ui-choice'])
  })

  test('a fixture runs the tests named for it', () => {
    expect(
      names(selectLayout({ changed: [`${L}/fixture/ui-select-fixture.tsx`], tests }).files),
    ).toEqual(['ui-select'])
  })

  test('a change a name cannot place runs the smoke set', () => {
    for (const changed of [
      [`${SRC}/theme/derive.ts`],
      [`${SRC}/tokens/index.ts`],
      [`${L}/harness/engine.ts`],
      ['bun.lock'],
      [`${SRC}/ui/unknown-thing.tsx`],
    ]) {
      expect(names(selectLayout({ changed, tests }).files)).toEqual([...SMOKE].toSorted())
    }
  })

  test('a placed change does not also run the smoke set', () => {
    const { files } = selectLayout({ changed: [`${SRC}/charts/Meter.tsx`], tests })
    expect(files.some((f) => f.includes('hit-floor'))).toBe(false)
  })
})

describe('fixtureImports', () => {
  test('keeps direct src modules, drops barrels and anything outside src', () => {
    const source = [
      "import { A } from '../../../src/ui/switch'",
      "import { B } from '../../../src/charts'",
      "import { C } from '../../../src/index'",
      "import { D } from './spec'",
      "import { E } from 'react'",
    ].join('\n')
    expect(fixtureImports(`${L}/fixture/x-fixture.tsx`, source)).toEqual([
      `${SRC}/ui/switch`,
      `${SRC}/charts`,
    ])
  })
})
