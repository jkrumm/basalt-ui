import { describe, expect, test } from 'bun:test'
import { FLAG_ROWS, REWRITE_ROWS } from '../report.ts'
import { CASES } from './cases.ts'
import { transformCards } from './transform.ts'

const run = (source: string) => transformCards(source, { file: 'case.tsx' })

describe('every row id has a case', () => {
  test.each([...REWRITE_ROWS])('rewrite row %s has an in/out pair', (id) => {
    expect(CASES.some((c) => c.kind === 'rewrite' && id in c.rewritten)).toBe(true)
  })
  test.each([...FLAG_ROWS])('flag row %s has a flagged case', (id) => {
    expect(CASES.some((c) => c.kind === 'flag' && c.flagged.includes(id))).toBe(true)
  })
  test('the cases name no id that is not a row', () => {
    const known = new Set<string>([...REWRITE_ROWS, ...FLAG_ROWS])
    for (const c of CASES)
      for (const id of [...Object.keys(c.rewritten), ...c.flagged]) expect(known.has(id)).toBe(true)
  })
})

describe('cases', () => {
  test.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const result = run(c.in)
    expect(result.text).toBe(c.out)
    expect(Object.fromEntries(Object.entries(result.rewritten).filter(([, n]) => n > 0))).toEqual(
      c.rewritten,
    )
    expect(result.flagged.map((f) => f.row).sort()).toEqual([...c.flagged].sort())
    for (const f of result.flagged) {
      expect(f.file).toBe('case.tsx')
      expect(f.line).toBeGreaterThan(0)
    }
  })

  test.each(CASES.map((c) => [c.name, c] as const))('%s: a second run changes nothing', (_n, c) => {
    const again = run(c.out)
    expect(again.text).toBe(c.out)
    expect(Object.values(again.rewritten).every((n) => n === 0)).toBe(true)
  })

  test('a flag case is left byte for byte', () => {
    for (const c of CASES.filter((c) => c.kind === 'flag')) expect(c.out).toBe(c.in)
  })

  test('a flagged row id is never counted as rewritten', () => {
    for (const c of CASES) for (const id of c.flagged) expect(c.rewritten[id]).toBeUndefined()
  })
})

describe('traps', () => {
  test('a file without a ChartCard import from basalt-ui is returned untouched', () => {
    const source =
      "import { ChartCard } from './mine'\nexport const a = <ChartCard state={{ pending: true }} />\n"
    expect(run(source)).toMatchObject({ text: source, flagged: [] })
  })

  test('an aliased import is found by its local name', () => {
    const { text, rewritten } = run(
      "import { ChartCard as Card } from 'basalt-ui/charts'\nexport const a = <Card state={{ pending: true }} />\n",
    )
    expect(text).toContain('<Card phase="loading" />')
    expect(rewritten['cc-pending-loading']).toBe(1)
  })

  test('RefetchDim stays imported while something else in the file uses it', () => {
    const { text } = run(
      [
        "import { ChartCard } from 'basalt-ui/charts'",
        "import { RefetchDim } from './refetch-dim'",
        'export const a = (',
        '  <>',
        '    <ChartCard title="a"><RefetchDim active><Bars height={1} /></RefetchDim></ChartCard>',
        '    <RefetchDim active><p /></RefetchDim>',
        '  </>',
        ')',
        '',
      ].join('\n'),
    )
    expect(text).toContain("import { RefetchDim } from './refetch-dim'")
  })

  test('a box name already in the body does not shadow: the slot is renamed', () => {
    const { text } = run(
      'import { ChartCard } from \'basalt-ui/charts\'\nexport const a = <ChartCard title="a"><Bars data={box} /></ChartCard>\n',
    )
    expect(text).toContain('(slot) =>')
    expect(text).toContain('height={slot.height}')
  })

  test('a facts array holding a spread is flagged, never emitted as figure={...x}', () => {
    const source =
      'import { ChartCard } from \'basalt-ui/charts\'\nexport const a = <ChartCard title="a" facts={[...extra]}><Bars data={rows} /></ChartCard>\n'
    const { text, flagged } = run(source)
    expect(text).not.toContain('figure=')
    expect(flagged.map((f) => f.row)).toEqual(['cc-expression'])
  })
})
