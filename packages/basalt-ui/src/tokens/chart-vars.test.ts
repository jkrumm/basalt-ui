/**
 * The Viz roles and their gates (tokens-visual 3.2 Viz row; static-framework-free row 10, F-S5),
 * over the default seed and a hue-268 seed at vibrancy 0, +1, +2. The ratios are measured here with
 * the WCAG and CVD helpers directly, not read back from the gate rows, so a gate that measured the
 * wrong pair would still be caught.
 */
import { describe, expect, test } from 'bun:test'
import { CVD_ADJACENT_MIN } from '../guard/palette'
import {
  CHART_CVD_MIN,
  CHART_HUE_GAP,
  CHART_MARK_MIN,
  chartPairs,
  chartVars,
  cvdSeparation,
  DIM_BAR_MIN,
  SEQ_PALE_MIN,
  SEQ_STEP_MIN,
  VIZ_COLOR_NAMES,
} from './chart-vars'
import { COLOR_NAMES_V3, DEFAULT_DERIVE_V3_CONFIG, deriveV3 } from './derive'
import type { DerivedV3 } from './derive'
import { emitDerived, emitTokensCss, emitVxTypes, tokenNames } from './emit'
import { checkGates, GateError } from './gates'
import { contrastRatio, hctToHex, hexToHct } from './hct'
import { hexToOklab } from './oklab'
import { TOKENS } from './table'

const HUE_268 = hctToHex({ hue: 268, chroma: 48, tone: 50 })
const SEEDS = [DEFAULT_DERIVE_V3_CONFIG.accent, HUE_268] as const
const VIBRANCY = [0, 1, 2] as const
const SIDES = ['light', 'dark'] as const
const CHARTS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const
const SEQ = ['seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5'] as const
const VIZ_GATES = new Set(chartPairs().map((r) => r.gate))

const hueGap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

const grid = SEEDS.flatMap((accent) =>
  VIBRANCY.map((vibrancy) => ({
    label: `${accent} vibrancy ${vibrancy}`,
    accent,
    derived: deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent, vibrancy }),
  })),
)

describe('the Viz roles, both seeds, light and dark', () => {
  for (const { label, accent, derived } of grid) {
    const c = derived.colors
    describe(label, () => {
      test('no Viz gate fails', () => {
        const failures = checkGates(derived).filter((f) => VIZ_GATES.has(f.gate))
        expect(failures.map((f) => f.message)).toEqual([])
      })

      test('every chart-N, seq-5 and the line clear 3:1 on canvas and inset', () => {
        for (const side of SIDES)
          for (const bg of ['canvas', 'inset'] as const)
            for (const fg of [...CHARTS, 'seq-5', 'line'] as const)
              expect(contrastRatio(c[fg][side], c[bg][side])).toBeGreaterThanOrEqual(CHART_MARK_MIN)
      })

      test('dim-bar clears 2.0 on inset and stays quieter than the line', () => {
        for (const side of SIDES) {
          const dim = contrastRatio(c['dim-bar'][side], c.inset[side])
          expect(dim).toBeGreaterThanOrEqual(DIM_BAR_MIN)
          expect(dim).toBeLessThan(contrastRatio(c.line[side], c.inset[side]))
        }
      })

      test('seq-1..5 run monotonic in lightness, a step apart: falling in light, rising in dark', () => {
        for (const side of SIDES) {
          const l = SEQ.map((n) => hexToOklab(c[n][side]).L)
          for (let i = 1; i < l.length; i++) {
            const step = side === 'light' ? l[i - 1]! - l[i]! : l[i]! - l[i - 1]!
            expect(step).toBeGreaterThanOrEqual(SEQ_STEP_MIN)
          }
        }
      })

      test('F-S5: seq-1 clears 1.3:1 on the dark inset without leaving the accent hue', () => {
        expect(contrastRatio(c['seq-1'].dark, c.inset.dark)).toBeGreaterThanOrEqual(SEQ_PALE_MIN)
        const seedHue = hexToHct(accent).hue
        for (const side of SIDES)
          for (const n of SEQ) expect(hueGap(hexToHct(c[n][side]).hue, seedHue)).toBeLessThan(8)
      })

      test('chart-1..5 are pairwise distinct under protanopia and deuteranopia', () => {
        for (const side of SIDES)
          for (let i = 0; i < CHARTS.length; i++)
            for (let j = i + 1; j < CHARTS.length; j++)
              expect(
                cvdSeparation(c[CHARTS[i]!][side], c[CHARTS[j]!][side]),
              ).toBeGreaterThanOrEqual(CHART_CVD_MIN)
      })

      test('chart-1 is the brand fill', () => {
        expect(c['chart-1']).toEqual(c['brand-fill'])
      })
    })
  }

  test('the CVD floor is the 2.x series-palette floor', () => {
    expect(CHART_CVD_MIN).toBe(CVD_ADJACENT_MIN)
  })

  test('derivation is deterministic', () => {
    expect(deriveV3()).toEqual(deriveV3())
  })
})

describe('the categorical solver', () => {
  test('an accent on a 2.x chart hue never gets a series of its own hue', () => {
    for (const hue of [66.54, 139.74, 185.37, 327.38]) {
      const accent = hctToHex({ hue, chroma: 48, tone: 50 })
      const derived = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent })
      // HCT hue of a re-lit hex drifts a few degrees off the family's baked hue.
      for (const n of CHARTS.slice(1))
        expect(hueGap(hexToHct(derived.colors[n].light).hue, hue)).toBeGreaterThan(
          CHART_HUE_GAP - 5,
        )
      expect(checkGates(derived)).toEqual([])
    }
  })

  test('a seed sweep at vibrancy -2, 0, +2 passes every Viz gate', () => {
    for (let hue = 0; hue < 360; hue += 15)
      for (const vibrancy of [-2, 0, 2]) {
        const accent = hctToHex({ hue, chroma: 48, tone: 50 })
        const derived = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent, vibrancy })
        const failures = checkGates(derived).filter((f) => VIZ_GATES.has(f.gate))
        expect(failures.map((f) => f.message)).toEqual([])
      }
  })
})

describe('the names', () => {
  test('VIZ_COLOR_NAMES are the opaque Viz rows of the table, in order, and colour roles', () => {
    const viz = TOKENS.filter((t) => t.family === 'viz').map((t) => t.name)
    expect(viz.filter((n) => n !== 'grid' && n !== 'crosshair')).toEqual([...VIZ_COLOR_NAMES])
    for (const n of VIZ_COLOR_NAMES) expect(COLOR_NAMES_V3).toContain(n)
  })

  test('chartVars reads exactly the Viz pairs of a derived palette', () => {
    const derived = deriveV3()
    const vars = chartVars(derived)
    expect(Object.keys(vars)).toEqual([...VIZ_COLOR_NAMES])
    for (const n of VIZ_COLOR_NAMES) expect(vars[n]).toEqual(derived.colors[n])
  })

  test('the public --vx-* name count stays at or under the 90 ceiling', () => {
    expect(tokenNames().length).toBeLessThanOrEqual(90)
  })
})

describe('emit', () => {
  const OPTIONS = { version: '3.0.0' } as const
  const count = (text: string, needle: string): number => text.split(needle).length - 1
  const blockAfter = (css: string, head: string): string => {
    const at = css.indexOf(head)
    expect(at).toBeGreaterThanOrEqual(0)
    const rest = css.slice(at + head.length)
    return rest.slice(0, rest.indexOf('}'))
  }

  for (const { label, derived } of grid) {
    test(`${label}: chart-N and seq-N appear once per scheme block with the derived values`, () => {
      const css = emitDerived(derived, OPTIONS)
      const blocks = {
        light: blockAfter(css, ":root,\n:root[data-theme='light'] {"),
        dark: blockAfter(css, ":root[data-theme='dark'] {"),
      }
      for (const side of SIDES)
        for (const n of [...CHARTS, ...SEQ]) {
          expect(count(blocks[side], `--vx-${n}:`)).toBe(1)
          expect(blocks[side]).toContain(`--vx-${n}: ${derived.colors[n][side]};`)
        }
    })
  }

  test('chart-N and seq-N appear in the VX types exactly once each', () => {
    const source = emitVxTypes(OPTIONS)
    for (const n of [...CHARTS, ...SEQ]) {
      expect(count(source, `'var(--vx-${n})'`)).toBe(1)
      expect(count(source, `| '--vx-${n}'`)).toBe(1)
    }
  })

  test('the default emit carries the default derived values', () => {
    const css = emitTokensCss(OPTIONS)
    const { colors } = deriveV3()
    for (const n of [...CHARTS, ...SEQ]) expect(css).toContain(`--vx-${n}: ${colors[n].light};`)
  })

  test('a palette with seq-1 under 1.3:1 on the dark inset makes the emitter throw naming gate and ratio', () => {
    const derived = deriveV3()
    const faint: DerivedV3 = {
      ...derived,
      colors: {
        ...derived.colors,
        'seq-1': { light: derived.colors['seq-1'].light, dark: derived.colors.inset.dark },
      },
    }
    let error: unknown
    try {
      emitDerived(faint, OPTIONS)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(GateError)
    const failure = (error as GateError).failures.find((f) => f.gate === 'seq-1-on-inset')
    expect(failure).toMatchObject({ scheme: 'dark', surface: 'inset', min: SEQ_PALE_MIN })
    expect((error as Error).message).toMatch(
      /^seq-1-on-inset dark 1\.00 < 1\.3 for --accent #0077bd\. The ramp is table data/m,
    )
  })
})
