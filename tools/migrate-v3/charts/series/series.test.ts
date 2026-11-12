import { describe, expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCharts } from '../index.ts'
import { CASES } from './cases.ts'
import { SERIES_FLAG_ROWS, SERIES_REWRITE_ROWS } from './rows.ts'
import { transformSeries } from './transform.ts'

const run = (source: string) => transformSeries(source, { file: 'case.tsx' })

describe('every row id has a case', () => {
  test.each([...SERIES_REWRITE_ROWS])('rewrite row %s has an in/out pair', (id) => {
    expect(CASES.some((c) => c.kind === 'rewrite' && id in c.rewritten)).toBe(true)
  })
  test.each([...SERIES_FLAG_ROWS])('flag row %s has a flagged case', (id) => {
    expect(CASES.some((c) => c.kind === 'flag' && c.flagged.includes(id))).toBe(true)
  })
  test('the cases name no id that is not a row', () => {
    const known = new Set<string>([...SERIES_REWRITE_ROWS, ...SERIES_FLAG_ROWS])
    for (const c of CASES)
      for (const id of [...Object.keys(c.rewritten), ...c.flagged]) expect(known.has(id)).toBe(true)
  })
  test('no id is both a rewrite and a flag row', () => {
    const flags = new Set<string>(SERIES_FLAG_ROWS)
    for (const id of SERIES_REWRITE_ROWS) expect(flags.has(id)).toBe(false)
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

  test('a flag case is left byte for byte and rewrites nothing', () => {
    for (const c of CASES.filter((c) => c.kind === 'flag')) {
      expect(c.out).toBe(c.in)
      expect(Object.values(run(c.in).rewritten).every((n) => n === 0)).toBe(true)
    }
  })

  test('a flagged row id is never counted as rewritten', () => {
    for (const c of CASES)
      for (const id of c.flagged)
        if (id !== 'series-review') expect(c.rewritten[id]).toBeUndefined()
  })

  test('every flag-only row id is asserted flagged with its line', () => {
    for (const id of SERIES_FLAG_ROWS) {
      const c = CASES.find((k) => k.kind === 'flag' && k.flagged.includes(id))!
      const flagged = run(c.in).flagged.filter((f) => f.row === id)
      expect(flagged.length).toBeGreaterThan(0)
      expect(flagged.every((f) => f.line >= 1 && f.reason.length > 0)).toBe(true)
    }
  })
})

describe('traps', () => {
  test('a file that does not import basalt-ui is returned untouched', () => {
    const source =
      "import { Lines } from './mine'\nexport const a = <Lines series={[{ key: 'a', label: 'A', color: c, formatValue: f, dashed: true }]} />\n"
    expect(run(source)).toMatchObject({ text: source, flagged: [] })
  })

  test('an object without key, label and color is not a series', () => {
    const source =
      "import { Lines } from 'basalt-ui/charts'\nexport const a = <Lines style={{ strokeWidth: 3, dashed: true }} />\n"
    expect(run(source).text).toBe(source)
  })

  test('refLine and zone edge dashed stay: only series objects take dash', () => {
    const source =
      "import { Lines } from 'basalt-ui/charts'\nexport const a = <Lines refLines={[{ value: 1, color: c, dashed: true }]} />\n"
    expect(run(source).text).toBe(source)
  })

  test('SVG strokeWidth attributes are not series fields', () => {
    const source =
      "import { Lines } from 'basalt-ui/charts'\nexport const a = <path strokeWidth={2} />\n"
    expect(run(source).text).toBe(source)
  })

  test('a series that already carries the v3 name is flagged, not duplicated', () => {
    const { text, flagged } = run(
      "import { Lines } from 'basalt-ui/charts'\nexport const a = <Lines series={[{ key: 'a', label: 'A', color: c, formatValue: f, format: g }]} />\n",
    )
    expect(text).not.toContain('format: f')
    expect(flagged.map((f) => f.row)).toEqual(['series-review'])
  })

  test('strokeWidth and strokeOpacity that disagree are flagged', () => {
    const { text, flagged } = run(
      "import { Lines } from 'basalt-ui/charts'\nexport const a = <Lines series={[{ key: 'a', label: 'A', color: c, strokeWidth: 3, strokeOpacity: 0.5 }]} />\n",
    )
    expect(text).toContain('strokeWidth: 3')
    expect(flagged.map((f) => f.row)).toEqual(['series-review'])
  })

  test('an aliased StackedArea import is replaced by Lines', () => {
    const { text } = run(
      "import { StackedArea as Mix } from 'basalt-ui/charts'\nexport const a = <Mix ariaLabel=\"m\" series={[{ key: 'a', label: 'A', color: c, getValue: g }]} />\n",
    )
    expect(text).toContain("import { Lines } from 'basalt-ui/charts'")
    expect(text).toContain('<Lines ')
  })

  test('a StackedArea import alone in its declaration goes whole when Lines is imported elsewhere', () => {
    const { text } = run(
      "import { Lines } from 'basalt-ui/charts'\nimport { StackedArea } from 'basalt-ui'\nexport const a = <><Lines series={s} /><StackedArea ariaLabel=\"m\" series={[{ key: 'a', label: 'A', color: c, getValue: g }]} /></>\n",
    )
    expect(text).not.toContain("from 'basalt-ui'\n")
    expect(text).not.toContain('StackedArea')
  })

  test('a dropped last property on one line leaves valid code: the insert and the cut meet', () => {
    const { text } = run(
      "import { StackedArea } from 'basalt-ui/charts'\nexport const a = <StackedArea ariaLabel=\"m\" series={[{ key: 'a', label: 'A', color: c, getValue: g, strokeWidth: 1, strokeOpacity: 0.5 }]} />\n",
    )
    expect(text).toContain(
      "{ key: 'a', label: 'A', color: c, getValue: g, weight: 'quiet', mark: 'line', stack: 'area', area: 'fade' }",
    )
  })

  test('a dropped last property of a 1.x bar leaves valid code', () => {
    const { text } = run(
      "import { Bars } from 'basalt-ui/charts'\nexport const a = <Bars data={r} chartId=\"a\" getX={x} getValue={v} positiveBars={[{ key: 'a', label: 'A', color: c, dashed: false }]} />\n",
    )
    expect(text).toContain("{ key: 'a', label: 'A', color: c, mark: 'bar', y: (d) => v(d, 'a') }")
  })

  test('a multi-line band keeps its layout when items are appended without a trailing comma', () => {
    const { text } = run(
      "import { StackedArea } from 'basalt-ui/charts'\nexport const a = (\n  <StackedArea\n    ariaLabel=\"m\"\n    series={[\n      {\n        key: 'a',\n        label: 'A',\n        color: c,\n        getValue: g\n      },\n    ]}\n  />\n)\n",
    )
    expect(text).toContain(
      "        getValue: g,\n        mark: 'line',\n        stack: 'area',\n        area: 'fade'\n      },",
    )
  })

  test('StackedArea next to an existing Lines import leaves one Lines import', () => {
    const { text } = run(
      "import { Lines, StackedArea } from 'basalt-ui/charts'\nexport const a = <><Lines series={s} /><StackedArea ariaLabel=\"m\" series={[{ key: 'a', label: 'A', color: c, getValue: g }]} /></>\n",
    )
    expect(text).toContain("import { Lines } from 'basalt-ui/charts'")
    expect(text).not.toContain('StackedArea')
  })

  test('a StackedArea band with fillOpacity is flagged and the site stays whole, renames included', () => {
    const source =
      "import { StackedArea } from 'basalt-ui/charts'\nexport const a = <StackedArea ariaLabel=\"m\" series={[{ key: 'a', label: 'A', color: c, getValue: g, fillOpacity: 0.5, formatValue: f }]} />\n"
    const { text, flagged, rewritten } = run(source)
    expect(text).toBe(source)
    expect(flagged.map((f) => f.row)).toEqual(['series-review'])
    expect(rewritten['sf-format']).toBe(0)
  })

  test('a blocked StackedArea next to a rewritten one keeps its import and gains Lines', () => {
    const { text } = run(
      "import { StackedArea } from 'basalt-ui/charts'\nexport const a = <><StackedArea ariaLabel=\"m\" series={[{ key: 'a', label: 'A', color: c, getValue: g }]} /><StackedArea ariaLabel=\"n\" series={s} /></>\n",
    )
    expect(text).toContain('<Lines ariaLabel="m"')
    expect(text).toContain('<StackedArea ariaLabel="n"')
    expect(text).toMatch(/import \{ StackedArea, Lines \} from 'basalt-ui\/charts'/)
  })

  test('Meter zones with a gap are flagged and left', () => {
    const source =
      "import { Meter } from 'basalt-ui/charts'\nexport const a = <Meter label=\"l\" max={10} zones={[{ from: 0, to: 3, label: 'a' }, { from: 4, to: 10, label: 'b' }]} />\n"
    const { text, flagged } = run(source)
    expect(text).toBe(source)
    expect(flagged.map((f) => f.row)).toEqual(['series-review'])
  })

  test('1.x Bars with negativeBars is flagged and left whole', () => {
    const source =
      "import { Bars } from 'basalt-ui/charts'\nexport const a = <Bars data={r} chartId=\"a\" getX={x} getValue={v} positiveBars={[{ key: 'a', label: 'A', color: c }]} negativeBars={[]} />\n"
    const { text, flagged } = run(source)
    expect(text).toBe(source)
    expect(flagged.map((f) => f.row)).toEqual(['series-review'])
  })
})

describe('fixtures/bars-1x-check', () => {
  const FIXTURE = join(import.meta.dir, '..', 'fixtures', 'bars-1x-check')

  const tree = (dir: string, base = dir): Record<string, string> =>
    Object.fromEntries(
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory()
          ? Object.entries(tree(path, base))
          : [[path.slice(base.length + 1), readFileSync(path, 'utf8')]]
      }),
    )

  test('the charts run on before writes a tree equal to after', () => {
    const work = mkdtempSync(join(tmpdir(), 'bars-1x-'))
    cpSync(join(FIXTURE, 'before'), work, { recursive: true })
    const summary = runCharts({ dir: work, write: true })
    expect(summary.rewritten['bars-1x']).toBeGreaterThan(0)
    expect(tree(work)).toEqual(tree(join(FIXTURE, 'after')))
  })

  test('the output is stable under a second run', () => {
    const work = mkdtempSync(join(tmpdir(), 'bars-1x-'))
    cpSync(join(FIXTURE, 'after'), work, { recursive: true })
    const summary = runCharts({ dir: work, write: true })
    expect(summary.changedFiles).toBe(0)
    expect(tree(work)).toEqual(tree(join(FIXTURE, 'after')))
  })
})
