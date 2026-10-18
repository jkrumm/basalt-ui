/**
 * `series-palette` — the series file's palette is computed, never eyeballed. Each of the six checks
 * has a crafted palette that fails it exactly once; the good palette passes all of them.
 */
import { describe, expect, it } from 'bun:test'

import { DEFAULT_DERIVE_CONFIG, deriveTokens } from '../tokens/derive'
import { DEFAULT_GUARD_CONFIG, GRACE_PERIOD_KINDS } from './index'
import { auditSeriesGroups, parseSeriesGroups } from './palette'
import { checkSeriesPalette } from './series-file'

const { panel } = deriveTokens(DEFAULT_DERIVE_CONFIG).surface
const SURFACES = { light: panel.light, dark: panel.dark }

const GOOD = {
  blue: ['#3770c3', '#609cdd'],
  orange: ['#905110', '#df7a30'],
  green: ['#1c9858', '#71d97e'],
  magenta: ['#9d4e9e', '#eaa0e5'],
} as const

// Nine hues, each pair ≥ 17 apart and each neighbour ≥ 9 apart under both dichromacies, in both
// schemes — so the only thing wrong with the group is that it has nine members.
const NINE: Pairs = {
  s0: ['#bb7048', '#e5ac4f'],
  s1: ['#6a73fb', '#51abf8'],
  s2: ['#1c548d', '#c275a4'],
  s3: ['#536304', '#53ed7f'],
  s4: ['#7f26a9', '#66a55a'],
  s5: ['#992f45', '#4ce2f0'],
  s6: ['#cb4ab3', '#9b72fe'],
  s7: ['#04a322', '#eb6211'],
  s8: ['#0196b0', '#f6aeee'],
}

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

const issues = (src: string) => auditSeriesGroups(parseSeriesGroups(src), SURFACES)
/** `check:scheme:key,key` per issue — the whole failure surface of a crafted palette, in one array. */
const found = (src: string) => issues(src).map((i) => `${i.check}:${i.scheme}:${i.keys.join(',')}`)

describe('parseSeriesGroups', () => {
  it('reads one group per defineSeries call, keys in source order, with line numbers', () => {
    const groups = parseSeriesGroups(source(GOOD, { a: ['#111111', '#eeeeee'] }))
    expect(groups.map((g) => g.entries.map((e) => e.key))).toEqual([
      ['blue', 'orange', 'green', 'magenta'],
      ['a'],
    ])
    expect(groups[0]?.entries[0]).toMatchObject({ light: '#3770c3', dark: '#609cdd', line: 2 })
  })

  it('ignores entries that are not string-literal pairs', () => {
    const src = `defineSeries({ a: { light: '#3770c3', dark: '#609cdd' }, b: p(BP.gray) })`
    expect(parseSeriesGroups(src)[0]?.entries.map((e) => e.key)).toEqual(['a'])
  })

  it('reads dark-first entries', () => {
    const src = `defineSeries({ a: { dark: '#609cdd', light: '#3770c3' } })`
    expect(parseSeriesGroups(src)[0]?.entries[0]).toMatchObject({
      light: '#3770c3',
      dark: '#609cdd',
    })
  })
})

describe('auditSeriesGroups', () => {
  it('passes the good palette, in either hex case', () => {
    expect(found(source(GOOD))).toEqual([])
    expect(found(source({ ...GOOD, blue: ['#3770C3', '#609CDD'] }))).toEqual([])
  })

  it('1 lightness (light): a too-dark value fails once', () => {
    expect(found(source({ ...GOOD, blue: ['#10306a', GOOD.blue[1]] }))).toEqual([
      'lightness:light:blue',
    ])
  })

  it('1 lightness (dark): below 0.58 fails once (still above the 3:1 floor)', () => {
    expect(found(source({ ...GOOD, blue: [GOOD.blue[0], '#4d7ab6'] }))).toEqual([
      'lightness:dark:blue',
    ])
  })

  it('1 lightness (dark): above 0.88 fails once', () => {
    expect(found(source({ blue: GOOD.blue, lemon: ['#8a7a00', '#f0e060'] }))).toEqual([
      'lightness:dark:lemon',
    ])
  })

  it('2 chroma: a washed-out categorical hue fails once', () => {
    expect(found(source({ ...GOOD, green: ['#4f8a62', GOOD.green[1]] }))).toEqual([
      'chroma:light:green',
    ])
  })

  it('2 chroma: the reserved `other` key may be neutral', () => {
    expect(
      found(source({ blue: GOOD.blue, orange: GOOD.orange, other: ['#8c8c92', '#d0d0d8'] })),
    ).toEqual([])
  })

  it('3 cvd: neighbours that merge under deuteranopia fail (normal vision still passes)', () => {
    const out = issues(
      source({ red: ['#c0392b', GOOD.blue[1]], green: ['#5a8a1e', GOOD.green[1]] }),
    )
    expect(out.map((i) => i.check)).toEqual(['cvd'])
    expect(out[0]).toMatchObject({ scheme: 'light', keys: ['red', 'green'], threshold: 8 })
  })

  it('4 separation: a near-duplicate hue fails once, in the scheme it is near', () => {
    expect(found(source({ ...GOOD, blue2: ['#3573d4', '#ffd23f'] }))).toEqual([
      'separation:light:blue,blue2',
    ])
  })

  it('5 contrast: a light blue too pale for the surface fails once', () => {
    expect(found(source({ ...GOOD, blue: ['#7aa6e8', GOOD.blue[1]] }))).toEqual([
      'contrast:light:blue',
    ])
  })

  it('5 contrast (dark): a dark-scheme value below 3:1 fails, with its lightness', () => {
    expect(found(source({ ...GOOD, blue: [GOOD.blue[0], '#3f6aa8'] }))).toEqual([
      'lightness:dark:blue',
      'contrast:dark:blue',
    ])
  })

  it('6 order: nine distinct, well-separated series fail once, on the ninth', () => {
    expect(found(source(NINE))).toEqual(['order:light:s8'])
  })

  it('6 order: eight are fine', () => {
    const { s8: _dropped, ...eight } = NINE
    expect(found(source(eight))).toEqual([])
  })

  it('6 order: a duplicate colour (cycling) fails once per scheme it repeats in', () => {
    expect(found(source({ ...GOOD, again: GOOD.magenta }))).toEqual([
      'order:light:magenta,again',
      'order:dark:magenta,again',
    ])
  })

  it('8 format: an alpha hex or a colour name is reported, not silently passed', () => {
    expect(found(source({ ...GOOD, blue: ['#3770c3cc', GOOD.blue[1]] }))).toEqual([
      'format:light:blue',
    ])
    expect(found(source({ ...GOOD, blue: [GOOD.blue[0], 'rebeccapurple'] }))).toEqual([
      'format:dark:blue',
    ])
  })

  it('names keys, scheme, measured number and threshold in the message', () => {
    const [issue] = issues(source({ ...GOOD, blue: ['#10306a', GOOD.blue[1]] }))
    expect(issue).toMatchObject({ check: 'lightness', scheme: 'light', keys: ['blue'] })
    expect(issue?.message).toMatch(/blue.*light.*0\.\d+.*0\.43/)
  })
})

describe('checkSeriesPalette — the guard Finding', () => {
  const bad = source({ ...GOOD, blue: ['#10306a', GOOD.blue[1]] })
  const check = (cfg = DEFAULT_GUARD_CONFIG, src = bad) =>
    checkSeriesPalette(src, 'src/lib/series.ts', cfg, SURFACES)

  it('is promoted out of the grace table: error by default', () => {
    expect(Object.hasOwn(GRACE_PERIOD_KINDS, 'series-palette')).toBe(false)
    const [f] = check()
    expect(f).toMatchObject({
      kind: 'series-palette',
      severity: 'error',
      relPath: 'src/lib/series.ts',
    })
    expect(f?.line).toBe(2)
  })

  it('basalt.severity turns it down', () => {
    const cfg = { ...DEFAULT_GUARD_CONFIG, severity: { 'series-palette': 'warn' as const } }
    expect(check(cfg)[0]?.severity).toBe('warn')
  })

  it('exemptRules silences it per path', () => {
    const cfg = {
      ...DEFAULT_GUARD_CONFIG,
      exemptRules: { 'series-palette': ['src/lib/series.ts'] },
    }
    expect(check(cfg)).toEqual([])
  })

  it('a good palette yields nothing', () => {
    expect(check(DEFAULT_GUARD_CONFIG, source(GOOD))).toEqual([])
  })
})
