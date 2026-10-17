/**
 * `series-palette` — the series file's palette is computed, never eyeballed. Each of the six checks
 * has a crafted palette that fails it exactly once; the good palette passes all of them.
 */
import { describe, expect, it } from 'bun:test'

import { DEFAULT_GUARD_CONFIG, checkSeriesPalette, GRACE_PERIOD_KINDS } from './index'
import { auditSeriesGroups, parseSeriesGroups } from './palette'

const GOOD = {
  blue: ['#3770c3', '#609cdd'],
  orange: ['#905110', '#df7a30'],
  green: ['#1c9858', '#71d97e'],
  magenta: ['#9d4e9e', '#eaa0e5'],
} as const

type Pairs = Record<string, readonly [string, string]>

const source = (...groups: Pairs[]): string =>
  groups
    .map(
      (g) =>
        `const S = defineSeries({\n${Object.entries(g)
          .map(([k, [light, dark]]) => `  ${k}: { light: '${light}', dark: '${dark}' },`)
          .join('\n')}\n})\n`,
    )
    .join('\n')

const checks = (src: string) => auditSeriesGroups(parseSeriesGroups(src)).map((i) => i.check)

describe('parseSeriesGroups', () => {
  it('reads one group per defineSeries call, keys in source order, with line numbers', () => {
    const groups = parseSeriesGroups(source(GOOD, { a: ['#111111', '#eeeeee'] }))
    expect(groups.map((g) => g.entries.map((e) => e.key))).toEqual([
      ['blue', 'orange', 'green', 'magenta'],
      ['a'],
    ])
    expect(groups[0]?.entries[0]).toMatchObject({ light: '#3770c3', dark: '#609cdd', line: 2 })
  })

  it('ignores entries that are not literal hex pairs', () => {
    const src = `defineSeries({ a: { light: '#2f6fd0', dark: '#6aa0f0' }, b: p(BP.gray) })`
    expect(parseSeriesGroups(src)[0]?.entries.map((e) => e.key)).toEqual(['a'])
  })
})

describe('auditSeriesGroups', () => {
  it('passes the good palette', () => {
    expect(auditSeriesGroups(parseSeriesGroups(source(GOOD)))).toEqual([])
  })

  it('1 lightness: a too-dark light value fails once', () => {
    expect(checks(source({ ...GOOD, blue: ['#10306a', GOOD.blue[1]] }))).toEqual(['lightness'])
  })

  it('2 chroma: a washed-out categorical hue fails once', () => {
    expect(checks(source({ ...GOOD, green: ['#4f8a62', GOOD.green[1]] }))).toEqual(['chroma'])
  })

  it('2 chroma: the reserved `other` key may be neutral', () => {
    expect(
      checks(source({ blue: GOOD.blue, orange: GOOD.orange, other: ['#8c8c92', '#d0d0d8'] })),
    ).toEqual([])
  })

  it('3 cvd: neighbours that merge under deuteranopia fail (normal vision still passes)', () => {
    const out = auditSeriesGroups(
      parseSeriesGroups(
        source({ red: ['#c0392b', GOOD.blue[1]], green: ['#5a8a1e', GOOD.green[1]] }),
      ),
    )
    expect(out.map((i) => i.check)).toEqual(['cvd'])
    expect(out[0]).toMatchObject({ scheme: 'light', keys: ['red', 'green'], threshold: 8 })
  })

  it('4 separation: two near-identical hues fail once', () => {
    const out = checks(
      source({ blue: GOOD.blue, green: GOOD.green, blue2: ['#3573d4', '#6fa4f2'] }),
    )
    expect(out).toContain('separation')
  })

  it('5 contrast: a light blue too pale for the surface fails once', () => {
    expect(checks(source({ ...GOOD, blue: ['#7aa6e8', GOOD.blue[1]] }))).toEqual(['contrast'])
  })

  it('6 order: a 9th series fails once', () => {
    const nine: Pairs = {}
    for (let i = 0; i < 9; i++) nine[`s${i}`] = GOOD.blue
    expect(checks(source(nine))).toContain('order')
  })

  it('6 order: a duplicate colour (cycling) fails', () => {
    expect(checks(source({ ...GOOD, again: GOOD.blue }))).toContain('order')
  })

  it('names keys, scheme, measured number and threshold in the message', () => {
    const [issue] = auditSeriesGroups(
      parseSeriesGroups(source({ ...GOOD, blue: ['#10306a', GOOD.blue[1]] })),
    )
    expect(issue).toMatchObject({ check: 'lightness', scheme: 'light', keys: ['blue'] })
    expect(issue?.message).toMatch(/blue.*light.*0\.\d+.*0\.43/)
  })
})

describe('checkSeriesPalette — the guard Finding', () => {
  const bad = source({ ...GOOD, blue: ['#10306a', GOOD.blue[1]] })

  it('ships as a grace kind: warn by default', () => {
    expect(Object.hasOwn(GRACE_PERIOD_KINDS, 'series-palette')).toBe(true)
    const [f] = checkSeriesPalette(bad, 'src/lib/series.ts', DEFAULT_GUARD_CONFIG)
    expect(f).toMatchObject({
      kind: 'series-palette',
      severity: 'warn',
      relPath: 'src/lib/series.ts',
    })
    expect(f?.line).toBe(2)
  })

  it('basalt.severity turns it up', () => {
    const cfg = { ...DEFAULT_GUARD_CONFIG, severity: { 'series-palette': 'error' as const } }
    expect(checkSeriesPalette(bad, 'src/lib/series.ts', cfg)[0]?.severity).toBe('error')
  })

  it('exemptRules silences it per path', () => {
    const cfg = {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'series-palette': ['src/lib/series.ts'] },
    }
    expect(checkSeriesPalette(bad, 'src/lib/series.ts', cfg)).toEqual([])
  })

  it('a good palette yields nothing', () => {
    expect(checkSeriesPalette(source(GOOD), 'src/lib/series.ts', DEFAULT_GUARD_CONFIG)).toEqual([])
  })
})
