/**
 * The v3 contrast gates (docs/v3/ARCHITECTURE.md section 5 "Gates", tokens-visual 3.3-3.5): PAIRS is
 * the table of foreground-on-background rows, `checkGates` measures every row in both schemes, and a
 * failure names the gate, the scheme, the ratio and the fix. `emit.ts` refuses a failing config
 * rather than shipping a silent bad accent.
 *
 * Gates read the derived hex, not the CSS: an alpha role is composited over its surface with the
 * same per-channel mix `color-mix(in srgb, ink N%, transparent)` paints.
 */
import { chartPairs } from './chart-vars'
import { INK_MIX_PCT, mixHex, STATUS_BACKGROUND_LABELS, statusBackgrounds } from './derive'
import type { ColorNameV3, DerivedV3 } from './derive'
import { contrastRatio } from './hct'
import { hexToOklab } from './oklab'

export type GateScheme = 'light' | 'dark'
const SCHEMES: readonly GateScheme[] = ['light', 'dark']

type Surface = 'canvas' | 'inset' | 'card' | 'raised'
const SURFACES: readonly Surface[] = ['canvas', 'inset', 'card', 'raised']

export type PairRow = {
  /** `<role>-on-<surface>`, the word a failure leads with. */
  readonly gate: string
  /** What the gate is measured against: a surface or composite name. */
  readonly surface: string
  readonly min: number
  /** Decimals when printing the measured value (the floor prints with one, or three for a step). */
  readonly digits: number
  readonly fix: string
  /** A `*-foreground` role painted on its fill (d33). */
  readonly foreground?: true
  /** Gated in this scheme only; both when absent. */
  readonly only?: GateScheme
  readonly measure: (derived: DerivedV3, scheme: GateScheme) => number
}

export type GateFailure = {
  readonly gate: string
  readonly scheme: GateScheme
  readonly surface: string
  readonly value: number
  readonly min: number
  readonly message: string
}

const FIX_FILL = 'Raise --vibrancy or pick another hue.'
const FIX_NEUTRAL = 'Pick another --neutral.'

const SHORT: Partial<Record<ColorNameV3, string>> = {
  'brand-fill': 'fill',
  'ink-muted': 'muted',
  'ink-faint': 'faint',
}
const short = (name: ColorNameV3): string => SHORT[name] ?? name

const hex = (derived: DerivedV3, name: ColorNameV3, scheme: GateScheme): string =>
  derived.colors[name][scheme]

const surfaces = (derived: DerivedV3, scheme: GateScheme): Record<Surface, string> => ({
  canvas: hex(derived, 'canvas', scheme),
  inset: hex(derived, 'inset', scheme),
  card: hex(derived, 'card', scheme),
  raised: hex(derived, 'raised', scheme),
})

function contrast(fg: ColorNameV3, bg: Surface | ColorNameV3, min: number, fix: string): PairRow {
  return {
    gate: `${short(fg)}-on-${short(bg)}`,
    surface: bg,
    min,
    digits: 2,
    fix,
    measure: (d, s) => contrastRatio(hex(d, fg, s), hex(d, bg, s)),
  }
}

function buildPairs(): PairRow[] {
  const rows: PairRow[] = []
  const text: readonly Surface[] = ['canvas', 'inset', 'card']

  // Inks and brand ink >= 4.5 on canvas, inset, card; faint is excluded from raised (3.91).
  for (const fg of ['ink', 'ink-muted', 'ink-faint', 'brand'] as const)
    for (const bg of text) rows.push(contrast(fg, bg, 4.5, FIX_NEUTRAL))
  for (const fg of ['ink', 'ink-muted'] as const)
    rows.push(contrast(fg, 'raised', 4.5, FIX_NEUTRAL))

  // The fill is legal on canvas and inset only: on card it is 2.76 by design (T19), so it is not a pair.
  for (const bg of ['canvas', 'inset'] as const) rows.push(contrast('brand-fill', bg, 3, FIX_FILL))

  // Foreground is a paired token (d33): the label is measured against the fill it sits on.
  rows.push({ ...contrast('on-brand', 'brand-fill', 4.5, FIX_FILL), foreground: true })
  rows.push({
    gate: 'primary-foreground-on-primary',
    surface: 'ink',
    min: 4.5,
    digits: 2,
    fix: FIX_NEUTRAL,
    foreground: true,
    measure: (d, s) => contrastRatio(hex(d, 'canvas', s), hex(d, 'ink', s)),
  })

  // Status inks on every surface, the row mixes and their own tint.
  for (const tone of ['good', 'warn', 'bad', 'info'] as const)
    for (const label of STATUS_BACKGROUND_LABELS)
      rows.push({
        gate: `${tone}-on-${label}`,
        surface: label,
        min: 4.5,
        digits: 2,
        fix: FIX_NEUTRAL,
        measure: (d, s) => {
          const ink = hex(d, tone, s)
          const bg = statusBackgrounds({
            side: s,
            surfaces: surfaces(d, s),
            ink: hex(d, 'ink', s),
            tone: ink,
          }).find((b) => b.surface === label)
          return contrastRatio(ink, bg!.hex)
        },
      })

  // The input boundary (S3): ink alpha over the surface vs the surface, >= 3:1.
  for (const bg of SURFACES)
    rows.push({
      gate: `input-on-${bg}`,
      surface: bg,
      min: 3,
      digits: 2,
      fix: 'Raise INK_MIX_PCT.input in derive.ts.',
      measure: (d, s) => {
        const base = surfaces(d, s)[bg]
        return contrastRatio(mixHex(base, hex(d, 'ink', s), INK_MIX_PCT.input[s] / 100), base)
      },
    })

  // Card vs inset step >= .03 OKLCH L: the surface law reads against the parent (3.3).
  rows.push({
    gate: 'card-step',
    surface: 'inset',
    min: 0.03,
    digits: 3,
    fix: FIX_NEUTRAL,
    measure: (d, s) => Math.abs(hexToOklab(hex(d, 'inset', s)).L - hexToOklab(hex(d, 'card', s)).L),
  })
  return rows
}

/** Every gate, once, the Viz rows from `chart-vars.ts` last. A row applies to both schemes. */
export const PAIRS: readonly PairRow[] = [...buildPairs(), ...chartPairs()]

function format(value: number, digits: number): string {
  const scale = 10 ** digits
  // Floor, so a failing 2.996 never prints as the 3.0 it missed.
  return (Math.floor(value * scale) / scale).toFixed(digits)
}

function failureMessage(row: PairRow, scheme: GateScheme, value: number, accent: string): string {
  return `${row.gate} ${scheme} ${format(value, row.digits)} < ${row.min.toFixed(row.digits === 3 ? 3 : 1)} for --accent ${accent}. ${row.fix}`
}

/** Ink must lead the canvas in the scheme's direction: dark text on light, light on dark. */
function polarityFailures(derived: DerivedV3): GateFailure[] {
  const failures: GateFailure[] = []
  for (const scheme of SCHEMES) {
    const sign = scheme === 'light' ? -1 : 1
    const l = (name: ColorNameV3): number => hexToOklab(hex(derived, name, scheme)).L
    const lead = sign * (l('ink') - l('canvas'))
    if (lead <= 0) {
      const message = `polarity ${scheme} ink ${lead.toFixed(3)} <= 0 for --accent ${derived.accent}. ${FIX_NEUTRAL}`
      failures.push({ gate: 'polarity', scheme, surface: 'canvas', value: lead, min: 0, message })
    }
  }
  return failures
}

/** Measure every gate; the list is empty when the config is shippable. */
export function checkGates(derived: DerivedV3): GateFailure[] {
  const failures: GateFailure[] = []
  for (const row of PAIRS)
    for (const scheme of row.only ? [row.only] : SCHEMES) {
      const value = row.measure(derived, scheme)
      if (value >= row.min) continue
      failures.push({
        gate: row.gate,
        scheme,
        surface: row.surface,
        value,
        min: row.min,
        message: failureMessage(row, scheme, value, derived.accent),
      })
    }
  return [...failures, ...polarityFailures(derived)]
}

export class GateError extends Error {
  readonly failures: readonly GateFailure[]
  constructor(failures: readonly GateFailure[]) {
    super(failures.map((f) => f.message).join('\n'))
    this.name = 'GateError'
    this.failures = failures
  }
}

/** @throws GateError naming every failing gate; the emitter's refusal. */
export function assertGates(derived: DerivedV3): void {
  const failures = checkGates(derived)
  if (failures.length > 0) throw new GateError(failures)
}
