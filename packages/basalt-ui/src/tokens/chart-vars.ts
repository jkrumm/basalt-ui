/**
 * The Viz family of tokens-visual 3.2 (`line dim-bar grid crosshair chart-1..5 seq-1..5`), derived
 * from the same config as the rest of `tokens.css`, and the gates that stop a retune from shipping an
 * unreadable ramp. `deriveV3` calls {@link deriveChartVars} with its seed; `gates.ts` runs
 * {@link chartPairs} with every other pair, so the emitter refuses a failing config with the gate,
 * the scheme and the ratio.
 *
 * - `chart-1` is the brand fill. `chart-2..5` keep the 2.x fills (orange, teal, grape, green) as their
 *   first choice; each is re-lit off the fill band, per scheme, until it clears 3:1 on canvas and
 *   inset AND sits {@link CHART_CVD_MIN} apart from every earlier series under protanopia and
 *   deuteranopia. A family within {@link CHART_HUE_GAP} degrees of the seed or of an earlier series
 *   is skipped, so an orange accent never gets an orange `chart-2` told apart by lightness alone.
 * - `seq-1..5` share the seed hue and run pale-to-strong: falling lightness in light, rising in dark.
 * - `dim-bar` sits under the "now" mark: quieter than the line, >= 2.0 on inset (tokens-visual 3.2;
 *   the highlighted bar is the 3:1 mark).
 * - `grid` and `crosshair` are ink alphas (`INK_MIX_PCT` in `derive.ts`, mixed by `table.ts`), so
 *   they carry no hex and need no gate here.
 *
 * Pure and leaf: values from `hct`/`oklab` only, so `derive.ts` and `gates.ts` can both import it.
 * `derive.ts` keeps `COLOR_NAMES_V3` a literal (a computed module constant survives tree-shaking);
 * `chart-vars.test.ts` pins {@link VIZ_COLOR_NAMES} against it.
 */
import type { ColorPair } from './core'
import type { ColorNameV3, DerivedV3, FillFamily } from './derive'
import type { GateScheme, PairRow } from './gates'
import { contrastRatio, hctToHex } from './hct'
import { deltaEOkCvd, hexToOklab } from './oklab'

type Side = 'light' | 'dark'
const SIDES: readonly Side[] = ['light', 'dark']

/** The opaque Viz roles, in table order: each is a `{ light, dark }` hex pair. */
export const VIZ_COLOR_NAMES = [
  'line',
  'dim-bar',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'seq-1',
  'seq-2',
  'seq-3',
  'seq-4',
  'seq-5',
] as const
export type VizColorName = (typeof VIZ_COLOR_NAMES)[number]

/** Floor for every data mark (`line`, `chart-N`, `seq-5`): WCAG 1.4.11 non-text. */
export const CHART_MARK_MIN = 3
/** A dim bar is context, not the mark: tokens-visual 3.2 sets it at 2.0 on inset. */
export const DIM_BAR_MIN = 2
/** seq-1 on the dark inset (static-framework-free F-S5): the pale end must still read. */
export const SEQ_PALE_MIN = 1.3
/** Lightness step between adjacent seq steps, OKLab L (static-framework-free row 10). */
export const SEQ_STEP_MIN = 0.05
/** Worst-of-protan/deutan OKLab ΔE×100 between any two chart series: 2.x `series-palette`'s
 * `CVD_ADJACENT_MIN`, applied to every pair (the token layer imports nothing from `guard`, so the
 * value is restated and `chart-vars.test.ts` pins it against guard's). */
export const CHART_CVD_MIN = 8
/** Minimum HCT hue distance between two chart series, and between a series and the seed. */
export const CHART_HUE_GAP = 30

/** Preference order for `chart-2..5`: the 2.x four first, then the other chromatic fills. Gray is
 * not a series colour and violet repeats grape's hue. */
const CHART_FAMILY_ORDER = [
  'orange',
  'teal',
  'grape',
  'green',
  'red',
  'yellow',
  'cyan',
  'indigo',
  'pink',
  'lime',
] as const satisfies readonly FillFamily[]
// The 2.x fill chroma was scaled by the old vibrancy centre (x.864); chart-N keep that scale.
const CHART_CHROMA_SCALE = 0.864
// Tone offsets off the fill band, nearest first: a series moves only as far as separation needs.
const CHART_TONE_OFFSETS: readonly number[] = [
  0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10, 12, -12, 14, -14, 16, -16, 18, -18, 20, -20, 22, -22, 24,
  -24, 26, -26, 28, -28,
]

const SEQ_TONE: Record<Side, readonly number[]> = {
  light: [90, 78, 66, 54, 42],
  dark: [28, 38, 50, 64, 78],
}
const SEQ_CHROMA_SHARE = [0.3, 0.5, 0.7, 0.85, 1] as const
const LINE_TONE: Record<Side, number> = { light: 50, dark: 62 }
const DIM_BAR_TONE: Record<Side, number> = { light: 68, dark: 38 }
const VIZ_CHROMA = 2

/** What the Viz roles are derived from: `deriveV3`'s seed, already resolved. */
export type ChartSeed = {
  /** HCT hue of the accent seed. */
  hue: number
  /** The brand fill's chroma at this vibrancy; seq-5 carries all of it. */
  fillChroma: number
  /** The fill band tone (white label at 4.5:1). */
  bandTone: number
  /** `1.2^vibrancy`. */
  mult: number
  /** The neutral ramp's hue and chroma scale: `line` and `dim-bar` are neutral. */
  neutral: { hue: number; chromaScale: number }
  /** `chart-1`. */
  brandFill: ColorPair
  /** The surfaces a mark is gated on. */
  surfaces: Record<Side, { canvas: string; inset: string }>
  /** A 2.x categorical fill: its baked hue and band-clamped chroma. */
  fill: (family: FillFamily) => { hue: number; chroma: number }
}

const hueGap = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** Worst of the two dichromacies; the separation every chart pair is gated on. */
export function cvdSeparation(a: string, b: string): number {
  return Math.min(deltaEOkCvd(a, b, 'protan'), deltaEOkCvd(a, b, 'deutan'))
}

type Candidate = { family: FillFamily; hue: number; pair: ColorPair; score: number }

/** One family re-lit for each scheme: the nearest legal tone that separates from `placed`. */
function relight(
  seed: ChartSeed,
  family: FillFamily,
  placed: readonly ColorPair[],
): Candidate | null {
  const { hue, chroma } = seed.fill(family)
  const pair = {} as ColorPair
  let score = Infinity
  for (const side of SIDES) {
    const { canvas, inset } = seed.surfaces[side]
    let best: { hex: string; sep: number } | null = null
    for (const offset of CHART_TONE_OFFSETS) {
      const hex = hctToHex({
        hue,
        chroma: chroma * CHART_CHROMA_SCALE * seed.mult,
        tone: seed.bandTone + offset,
      })
      if (Math.min(contrastRatio(hex, canvas), contrastRatio(hex, inset)) < CHART_MARK_MIN) continue
      const sep = Math.min(...placed.map((p) => cvdSeparation(hex, p[side])))
      if (best === null || sep > best.sep) best = { hex, sep }
      if (sep >= CHART_CVD_MIN) break
    }
    if (best === null) return null
    pair[side] = best.hex
    score = Math.min(score, best.sep)
  }
  return { family, hue, pair, score }
}

/** chart-1..5: the brand fill, then four families placed in order (module doc). */
function deriveCategorical(seed: ChartSeed): ColorPair[] {
  const placed: ColorPair[] = [seed.brandFill]
  const hues: number[] = [seed.hue]
  const used = new Set<FillFamily>()
  for (let slot = 0; slot < 4; slot++) {
    const first = CHART_FAMILY_ORDER[slot]!
    let best: Candidate | null = null
    for (const family of [first, ...CHART_FAMILY_ORDER.filter((f) => f !== first)]) {
      if (used.has(family)) continue
      if (hues.some((h) => hueGap(h, seed.fill(family).hue) < CHART_HUE_GAP)) continue
      const candidate = relight(seed, family, placed)
      if (candidate === null) continue
      if (best === null || candidate.score > best.score) best = candidate
      if (candidate.score >= CHART_CVD_MIN) break
    }
    // Every family excluded or out of contrast: unreachable for a seed that passes the brand gates.
    if (best === null) throw new Error(`chart-${slot + 2}: no fill family clears the mark floor`)
    used.add(best.family)
    placed.push(best.pair)
    hues.push(best.hue)
  }
  return placed
}

/**
 * The opaque Viz roles for one seed. Pure and deterministic; it never validates (that is
 * {@link chartPairs}), so a failing seed still derives and the emitter names the gate.
 */
export function deriveChartVars(seed: ChartSeed): Record<VizColorName, ColorPair> {
  const pair = (make: (side: Side) => string): ColorPair => ({
    light: make('light'),
    dark: make('dark'),
  })
  const neutral = (tone: number): string =>
    hctToHex({ hue: seed.neutral.hue, chroma: VIZ_CHROMA * seed.neutral.chromaScale, tone })

  const out = {} as Record<VizColorName, ColorPair>
  out.line = pair((side) => neutral(LINE_TONE[side]))
  out['dim-bar'] = pair((side) => neutral(DIM_BAR_TONE[side]))
  deriveCategorical(seed).forEach((p, i) => {
    out[`chart-${i + 1}` as VizColorName] = p
  })
  SEQ_CHROMA_SHARE.forEach((share, i) => {
    out[`seq-${i + 1}` as VizColorName] = pair((side) =>
      hctToHex({ hue: seed.hue, chroma: seed.fillChroma * share, tone: SEQ_TONE[side][i]! }),
    )
  })
  return out
}

/** The Viz pairs of a derived palette: the read seam for the JSON emit and the tests. */
export function chartVars(derived: DerivedV3): Record<VizColorName, ColorPair> {
  return Object.fromEntries(VIZ_COLOR_NAMES.map((n) => [n, derived.colors[n]])) as Record<
    VizColorName,
    ColorPair
  >
}

// ── Gates ──────────────────────────────────────────────────────────────────────────────────────

const FIX_FILL = 'Raise --vibrancy or pick another hue.'
const FIX_HUE = 'Pick another hue.'
const FIX_RAMP = 'The ramp is table data: edit the tone or share in chart-vars.ts.'

const hex = (d: DerivedV3, name: ColorNameV3, s: GateScheme): string => d.colors[name][s]

function mark(fg: VizColorName, bg: 'canvas' | 'inset', min: number, fix: string): PairRow {
  return {
    gate: `${fg}-on-${bg}`,
    surface: bg,
    min,
    digits: 2,
    fix,
    measure: (d, s) => contrastRatio(hex(d, fg, s), hex(d, bg, s)),
  }
}

/** Every Viz gate; `gates.ts` appends them to PAIRS. A function, not a module constant, so the
 * rows are built only where gates run, never in a bundle that only derives. */
export function chartPairs(): PairRow[] {
  const rows: PairRow[] = []
  const charts = [1, 2, 3, 4, 5].map((n) => `chart-${n}` as VizColorName)
  for (const bg of ['canvas', 'inset'] as const) {
    rows.push(mark('line', bg, CHART_MARK_MIN, FIX_RAMP))
    for (const c of charts) rows.push(mark(c, bg, CHART_MARK_MIN, FIX_FILL))
    rows.push(mark('seq-5', bg, CHART_MARK_MIN, FIX_RAMP))
  }
  rows.push(mark('dim-bar', 'inset', DIM_BAR_MIN, FIX_RAMP))
  // Light seq-1 is the pale end of the ramp by design and is not a pair.
  rows.push({ ...mark('seq-1', 'inset', SEQ_PALE_MIN, FIX_RAMP), only: 'dark' })

  // Lightness falls with value in light and rises in dark, by at least a step.
  for (let n = 1; n < 5; n++) {
    const lo = `seq-${n}` as VizColorName
    const hi = `seq-${n + 1}` as VizColorName
    rows.push({
      gate: `${hi}-step`,
      surface: lo,
      min: SEQ_STEP_MIN,
      digits: 3,
      fix: FIX_RAMP,
      measure: (d, s) =>
        (s === 'light' ? -1 : 1) * (hexToOklab(hex(d, hi, s)).L - hexToOklab(hex(d, lo, s)).L),
    })
  }

  for (let i = 0; i < charts.length; i++)
    for (let j = i + 1; j < charts.length; j++) {
      const a = charts[i]!
      const b = charts[j]!
      rows.push({
        gate: `${a}-cvd-${b}`,
        surface: b,
        min: CHART_CVD_MIN,
        digits: 2,
        fix: FIX_HUE,
        measure: (d, s) => cvdSeparation(hex(d, a, s), hex(d, b, s)),
      })
    }
  return rows
}
