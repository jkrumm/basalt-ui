/**
 * "One accent color in -> calculated palette out" derivation engine. Every constant below (tones,
 * chromas, hue offsets, hover deltas) is a law pinned by a test in this folder, not a taste call:
 * change one together with the test that pins it.
 *
 * Two derivations live here. `deriveTokens` is the 2.x palette: `palette.ts` derives the shipped
 * default from `deriveTokens(DEFAULT_DERIVE_CONFIG)` at module load, and retuning that identity
 * means editing `DEFAULT_DERIVE_CONFIG` or the constants below, never a hex in `palette.ts`.
 * `deriveV3` (bottom of the file) is the v3 palette that `table.ts` reads: one seed hue, one
 * vibrancy step, four surfaces, three inks, and a refusal in `gates.ts` instead of a silent bad
 * accent. Nothing in the v3 half imports `palette.ts` or `core.ts`.
 */
import { deriveChartVars } from './chart-vars'
import { contrastRatio, hctToHex, hexToHct, yToTone } from './hct'
import { deriveStatusHexes, solveStatusV3, STATUS_HUE, STATUS_STOP } from './status-text'
import type { ColorPair } from './core'

export type DeriveConfig = {
  /**
   * Seed hex — the one color a consumer picks. Drives the entire accent family + `onAccent`.
   *
   * The seed contributes its HUE and nothing else: the derivation laws normalize its chroma
   * (`max(seed, 40)`) and pin its tone to the Y=0.165 fill band, so a lighter/darker or more/less
   * saturated seed produces the SAME palette as long as the hue matches. That is deliberate —
   * contrast stays derivation-guaranteed instead of seed-dependent. `vibrancy` and
   * `accentBrightness` below are the ONLY expressive controls layered on top of those laws.
   */
  accent: string
  /** Which low-chroma neutral family backs every surface + ink stop. */
  neutral: 'zinc' | 'neutral' | 'stone' | 'slate'
  /** -5..5 — shifts the LIGHT scheme's surface tone stops by `2 x level + 2`. Positive =
   * lighter. The `+2` baseline bakes the preferred "one level lighter" default into level 0. */
  lightLevel: number
  /** -5..5 — shifts the DARK scheme's surface tone stops by `2 x level + 2`. Positive = lighter.
   * Same baked `+2` baseline as `lightLevel`. */
  darkLevel: number
  /**
   * -5..5 (default 0) — scales the derived chroma of the accent family AND the 12 categorical
   * fills via `0.72 x 1.2^level` (level 0 = the preferred x0.72 baseline, one vibrancy step above
   * the original x0.6 muted center; level -5 ~= x0.29, the calibrated x1.0 spec saturation is
   * crossed at ~+2 (0.72 x 1.2^2 ~= 1.037), +5 ~= x1.79). Gamut mapping in `hctToHex` absorbs any
   * overshoot. Neutral surfaces/ink (and the status hues) are NOT affected.
   */
  vibrancy: number
  /**
   * -5..5 (default 0) — shifts the accent-family tones by `+5 x level` (fill, fill hover, dark
   * ink accent, dark accent hover; hover deltas stay relative). The 12 categorical fills stay
   * pinned on the fill band — chart colors must remain uniform. `onAccent` is still decided by
   * the contrast law (3.0:1 white floor): white survives up to about +2 for typical seeds; from
   * ~+3 the fill is light enough that the safety flip to dark ink engages.
   */
  accentBrightness: number
}

/** The default derive config — the shipped palette's baseline (all four knobs at level 0). */
export const DEFAULT_DERIVE_CONFIG: DeriveConfig = {
  accent: '#0077bd',
  neutral: 'zinc',
  lightLevel: 0,
  darkLevel: 0,
  vibrancy: 0,
  accentBrightness: 0,
}

const DERIVE_CONFIG_KEYS = Object.keys(DEFAULT_DERIVE_CONFIG) as (keyof DeriveConfig)[]

/**
 * Resolve a partial derive config against {@link DEFAULT_DERIVE_CONFIG} — the single place a
 * consumer-supplied `{ derive }` option (`createBasaltTheme`'s second argument) becomes a full,
 * six-knob `DeriveConfig`. Omitted knobs fall back to the shipped default for that knob.
 */
export function resolveDeriveConfig(partial?: Partial<DeriveConfig>): DeriveConfig {
  return { ...DEFAULT_DERIVE_CONFIG, ...partial }
}

/**
 * Whether a resolved config is identical to {@link DEFAULT_DERIVE_CONFIG} — the gate
 * `createBasaltTheme` and `BasaltProvider` use to stay on the pre-baked static path (zero extra
 * derivation work) instead of re-deriving the palette.
 */
export function isDefaultDeriveConfig(config: DeriveConfig): boolean {
  return DERIVE_CONFIG_KEYS.every((key) => config[key] === DEFAULT_DERIVE_CONFIG[key])
}

type Side = 'light' | 'dark'

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

const ACCENT_HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Validate a `DeriveConfig.accent` seed hex (`#rgb`/`#rrggbb`, case-insensitive) — the public-API
 * boundary every consumer-facing config eventually passes through `deriveTokens` below. Malformed
 * input throws rather than silently producing NaN math further down the derivation pipeline;
 * `hct.ts`'s hot conversion paths stay unvalidated by design. */
function assertValidAccentHex(accent: string): void {
  if (!ACCENT_HEX_RE.test(accent)) {
    throw new Error(
      `Invalid DeriveConfig.accent: expected a #rgb or #rrggbb hex color, got "${accent}"`,
    )
  }
}

// ── Fill band (shared by the accent fill AND the 12 categorical fills) ─────────────────────────
// Law: every filled surface sits at relative luminance ~0.165 so a white label clears 4.5:1 on it
// AND the fill clears 3:1 against the page — regardless of hue. `toneToY`/`yToTone` in hct.ts make
// the WCAG relative-luminance axis and the HCT tone axis (L*) the SAME axis (both are the
// linear-light Y from the sRGB->XYZ step), so this is a formula, not a calibrated constant.
//
// `accentBrightness` shifts the ACCENT fill's tone off that band centre (the 12 categorical fills
// never take the shift — they stay pinned). An unclamped shift breaks the "clears 3:1 against the
// page" half of the law at the extremes (e.g. +5 sits at ~1.9:1 against the light page) — see
// `clampFillTone` below, which the accent fill (and its hover, derived from the clamped tone) runs
// through before `deriveTokensRaw` returns. The 12 categorical fills take no shift, so they never
// need the clamp.
const FILL_LUMINANCE = 0.165

// ── Accent family ────────────────────────────────────────────────────────────────────────────
// Fill hover: fillTone - FILL_HOVER_TONE_DELTA, fillChroma + FILL_HOVER_CHROMA_DELTA.
const FILL_HOVER_TONE_DELTA = 10
const FILL_HOVER_CHROMA_DELTA = -3.6
// Dark-mode accent-as-INK: lighter tone, chroma pulled back off the fill's saturation so it reads
// as an ink color rather than a second fill.
const ACCENT_INK_DARK_TONE = 78
const ACCENT_INK_DARK_CHROMA = 36
// Dark-mode accent hover: darkens + boosts chroma off the dark ink baseline.
const ACCENT_HOVER_DARK_TONE_DELTA = 12.8
const ACCENT_HOVER_DARK_CHROMA_DELTA = 18
// `onAccent`: a near-black ink at the seed's hue, used only when white fails the floor below.
const ON_ACCENT_DARK_TONE = 10
const ON_ACCENT_DARK_CHROMA = 8
// White floor is 3.0:1 — the WCAG 1.4.11 non-text/UI-component (and large-text) level, which is
// what button labels on filled controls target (Mantine's autoContrast aims at effectively the
// same bar). 4.5 was too strict: at brightness +1/+2 (fill tone ~52.6/57.6) white sits at
// ~3.4-4.4:1 and would flip dark even though white labels still read fine there. The dark-ink
// flip remains only as a safety for genuinely light fills (e.g. a yellow-ish seed at high
// vibrancy).
const ON_ACCENT_WHITE_CONTRAST_MIN = 3.0

// Fill-vs-page floor is also 3.0:1 (WCAG 1.4.11 non-text/UI-component) — a DIFFERENT pairing than
// `ON_ACCENT_WHITE_CONTRAST_MIN` above (fill vs. its own label, not fill vs. the page it sits on).
// `clampFillTone` below enforces it against BOTH schemes' derived page background.
const FILL_PAGE_CONTRAST_MIN = 3.0
// Step size (in tone/L*) the clamp backs off by per iteration — fine enough that the clamped fill
// never overshoots past clearing both floors by more than a fraction of a tone.
const FILL_CLAMP_STEP = 0.5

/**
 * Step `rawTone` back toward `bandTone` (the fill band's centre — the law's fixed point, never
 * stepped past) in {@link FILL_CLAMP_STEP} increments until the resulting fill hex clears
 * {@link FILL_PAGE_CONTRAST_MIN} against BOTH `pageBg.light` and `pageBg.dark` — or until it
 * reaches `bandTone` itself, in which case it stops there even if the floor still isn't cleared
 * (an extreme surface config can theoretically make the band centre itself fail one page; there is
 * no further room to give). A no-op when `rawTone === bandTone` (the default-config path), so the
 * shipped identity never runs the search.
 */
function clampFillTone(
  rawTone: number,
  bandTone: number,
  hue: number,
  chroma: number,
  pageBg: Record<Side, string>,
): number {
  if (rawTone === bandTone) return rawTone
  const towardCenter = rawTone > bandTone ? -FILL_CLAMP_STEP : FILL_CLAMP_STEP
  const clearsBothPages = (tone: number): boolean => {
    const hex = hctToHex({ hue, chroma, tone })
    return (
      contrastRatio(hex, pageBg.light) >= FILL_PAGE_CONTRAST_MIN &&
      contrastRatio(hex, pageBg.dark) >= FILL_PAGE_CONTRAST_MIN
    )
  }
  let tone = rawTone
  while (!clearsBothPages(tone) && tone !== bandTone) {
    tone =
      towardCenter < 0
        ? Math.max(bandTone, tone + towardCenter)
        : Math.min(bandTone, tone + towardCenter)
  }
  return tone
}

// ── Expressive knobs (the ONLY seed-independent saturation/brightness controls) ───────────────
// `vibrancy` level -> chroma multiplier: 0.72 x 1.2^level (level -5 ~= x0.29, 0 = x0.72,
// +5 ~= x1.79; the calibrated x1.0 spec saturation is crossed at ~+2). Level 0 is the shipped
// default — one vibrancy step above the original x0.6 muted center.
const VIBRANCY_CENTER_CHROMA_MULT = 0.72
const VIBRANCY_STEP_MULT = 1.2
const vibrancyChromaMult = (level: number): number =>
  VIBRANCY_CENTER_CHROMA_MULT * VIBRANCY_STEP_MULT ** level
// `accentBrightness` level -> tone shift per unit, applied to the accent family only (never the
// 12 categorical fills). At the default fill band (~47.6) the -5..5 range spans ~22.6..72.6.
const ACCENT_BRIGHTNESS_TONE_STEP = 5
// Surface levels: tone shift per scheme = 2 x level + 2. The +2 baseline bakes the preferred
// "one level lighter than the original hand-tuned surfaces" default into level 0; the slider
// range is -5..5 around that center (extremes clamp at pure white/black via `hctToHex`).
const SURFACE_LEVEL_TONE_STEP = 2
const SURFACE_BASELINE_TONE_SHIFT = 2

// ── The 12 categorical fills — baked hue + chroma, a separate hue-fixed family. Retuning the
// accent seed does NOT move these — they are only re-lit onto the same fill-luminance band every
// scheme.
export type FillFamily =
  | 'gray'
  | 'red'
  | 'pink'
  | 'grape'
  | 'violet'
  | 'indigo'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'lime'
  | 'yellow'
  | 'orange'

const FILL_HUE: Record<FillFamily, number> = {
  gray: 290.81,
  red: 28.33,
  pink: 5.0,
  grape: 327.38,
  violet: 327.38,
  indigo: 303.5,
  cyan: 255.96,
  teal: 185.37,
  green: 139.74,
  lime: 116.65,
  yellow: 80.94,
  orange: 66.54,
}
const FILL_CHROMA: Record<FillFamily, number> = {
  gray: 4.72,
  red: 64.31,
  pink: 66.76,
  grape: 65.38,
  violet: 65.38,
  indigo: 73.89,
  cyan: 35.19,
  teal: 32.0,
  green: 60.84,
  lime: 51.45,
  yellow: 54.14,
  orange: 55.69,
}
// The "clamp into a band so all 12 feel even" law — a no-op against the current data (already
// 4.7-73.9), kept as a real clamp so a wildly saturated/desaturated future family can't blow the
// band out.
const FILL_CHROMA_MIN = 4
const FILL_CHROMA_MAX = 90
const FILL_ORDER: readonly FillFamily[] = [
  'gray',
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
]

// ── Neutral system — one (hue, chroma) per preset. 'zinc' is calibrated against the framework's
// original hand-tuned surface + ink hexes; 'neutral'/'stone'/'slate' are achromatic/warm/cool
// alternates with no current data to calibrate against.
const NEUTRAL_PRESETS: Record<DeriveConfig['neutral'], { hue: number; chroma: number }> = {
  zinc: { hue: 290.7, chroma: 2 },
  neutral: { hue: 0, chroma: 0 },
  stone: { hue: 70, chroma: 4 },
  slate: { hue: 260, chroma: 5 },
}

// Surface tone stops. `lightLevel`/`darkLevel` shift these +-2 tones/unit.
export type SurfaceKey =
  | 'bg'
  | 'panel'
  | 'panelHover'
  | 'elevated'
  | 'subtle'
  | 'field'
  | 'border'
  | 'hairline'
  | RowSurfaceKey

/** The row surfaces: the panel mixed toward the ink, not a tone stop of their own. */
export type RowSurfaceKey = 'rowHover' | 'rowSelected'

const SURFACE_TONE: Record<Side, Record<Exclude<SurfaceKey, RowSurfaceKey>, number>> = {
  light: {
    bg: 93.45,
    panel: 96.21,
    panelHover: 98.27,
    elevated: 98.27,
    subtle: 94.15,
    field: 100,
    border: 87.86,
    hairline: 90.94,
  },
  dark: {
    bg: 13.82,
    panel: 15.75,
    panelHover: 21.42,
    elevated: 21.42,
    subtle: 18.69,
    field: 13.82,
    border: 26.89,
    hairline: 31.29,
  },
}

// Ink share of a row surface, per scheme. Hover must clear the `panelHover` step's contrast against the
// panel (the dark step is the larger, 5.7 tones vs 2.1); selected sits one step above. Light stays
// shallow so tertiary text and status text keep their margin on a selected row.
const ROW_INK_MIX: Record<RowSurfaceKey, Record<Side, number>> = {
  rowHover: { light: 0.05, dark: 0.07 },
  rowSelected: { light: 0.075, dark: 0.09 },
}

/** `a` toward `b` by `t` per sRGB channel — the hex twin of `color-mix(in srgb, b t%, a)`. */
export function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number): number =>
    Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) * (1 - t) + channel(b, i) * t))
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

// Ink ramp tone stops (achromatic). NOT shifted by lightLevel/darkLevel — text tone stays stable
// while surfaces move around it.
export type InkKey = 'ink' | 'ink2' | 'muted' | 'faint'

const INK_TONE: Record<Side, Record<InkKey, number>> = {
  // light `faint` is tone 44.5 so tertiary text clears WCAG AA (4.5:1) on every text surface
  // (bg / panel / subtle / field); 48.44 landed at 4.23–4.31:1 on bg and subtle.
  light: { ink: 15.16, ink2: 27.09, muted: 34.88, faint: 44.5 },
  dark: { ink: 90.94, ink2: 88.12, muted: 84.91, faint: 68.5 },
}

// ── Status/semantic — three baked hues, each with its own calibrated tone+chroma stop per scheme.
export type StatusKey = 'good' | 'warn' | 'bad'

/**
 * Continuous derivation parameters — the derivation CORE's inputs, decoupled from the -5..5
 * slider levels. `deriveTokens` maps levels onto these (with the re-centered baselines baked in).
 */
export type DeriveParams = {
  /** Chroma multiplier for the accent family + 12 categorical fills. 1 = calibrated chroma. */
  chromaMult: number
  /** Tone shift applied to the accent family only. 0 = calibrated tones. */
  accentToneShift: number
  /** Tone shift for the LIGHT scheme's surface stops. 0 = calibrated stops. */
  lightSurfaceShift: number
  /** Tone shift for the DARK scheme's surface stops. 0 = calibrated stops. */
  darkSurfaceShift: number
}

/** The full derived token set, grouped by family — the shape `palette.ts` builds ACCENT/FILL/
 * SURFACE/INK/STATUS from. */
export type DerivedPalette = {
  accent: ColorPair
  accentHover: ColorPair
  accentFill: ColorPair
  accentFillHover: ColorPair
  onAccent: ColorPair
  fill: Record<FillFamily, ColorPair>
  surface: Record<SurfaceKey, ColorPair>
  ink: Record<InkKey, ColorPair>
  status: Record<StatusKey, ColorPair>
}

/** The accepted `lightLevel` / `darkLevel` range; `deriveTokens` clamps to it. */
export const DERIVE_LEVEL_RANGE = { min: -5, max: 5 } as const

function clampLevel(level: number): number {
  return Number.isFinite(level) ? clamp(level, DERIVE_LEVEL_RANGE.min, DERIVE_LEVEL_RANGE.max) : 0
}

/** Derive the full palette from a seed accent + neutral family + surface levels.
 * Public level-based entry: maps the -5..5 sliders onto `DeriveParams` (vibrancy x0.72 center,
 * surface +2 baseline) and delegates to `deriveTokensRaw`.
 *
 * `lightLevel` / `darkLevel` are clamped to {@link DERIVE_LEVEL_RANGE} (non-finite → 0).
 * @throws Error when no status tone clears 4.5:1 on every text surface — unreachable for clamped
 * levels (the test grid proves it); only a raw shift outside the slider range gets there.
 */
export function deriveTokens(config: DeriveConfig): DerivedPalette {
  assertValidAccentHex(config.accent)
  return deriveTokensRaw(config, {
    chromaMult: vibrancyChromaMult(config.vibrancy),
    accentToneShift: config.accentBrightness * ACCENT_BRIGHTNESS_TONE_STEP,
    lightSurfaceShift:
      SURFACE_LEVEL_TONE_STEP * clampLevel(config.lightLevel) + SURFACE_BASELINE_TONE_SHIFT,
    darkSurfaceShift:
      SURFACE_LEVEL_TONE_STEP * clampLevel(config.darkLevel) + SURFACE_BASELINE_TONE_SHIFT,
  })
}

/** Derivation core over continuous params — see `DeriveParams` for the calibration contract. */
export function deriveTokensRaw(
  config: Pick<DeriveConfig, 'accent' | 'neutral'>,
  params: DeriveParams,
): DerivedPalette {
  const seed = hexToHct(config.accent)
  const { chromaMult, accentToneShift } = params
  // The band tone stays the categorical fills' home; only the accent family takes the shift.
  const bandTone = yToTone(FILL_LUMINANCE)
  const fillChroma = Math.max(seed.chroma, 40) * chromaMult

  const neutral = NEUTRAL_PRESETS[config.neutral]
  const surfaceShift: Record<Side, number> = {
    light: params.lightSurfaceShift,
    dark: params.darkSurfaceShift,
  }
  // The two derived page backgrounds the fill-contrast clamp checks against — same formula the
  // SURFACE.bg loop below uses, computed up front since the clamp must run before the accent fill.
  const pageBg: Record<Side, string> = {
    light: hctToHex({
      hue: neutral.hue,
      chroma: neutral.chroma,
      tone: clamp(SURFACE_TONE.light.bg + surfaceShift.light, 0, 100),
    }),
    dark: hctToHex({
      hue: neutral.hue,
      chroma: neutral.chroma,
      tone: clamp(SURFACE_TONE.dark.bg + surfaceShift.dark, 0, 100),
    }),
  }
  const fillTone = clampFillTone(bandTone + accentToneShift, bandTone, seed.hue, fillChroma, pageBg)

  const accentFill = hctToHex({ hue: seed.hue, chroma: fillChroma, tone: fillTone })
  const accentFillHover = hctToHex({
    hue: seed.hue,
    chroma: fillChroma + FILL_HOVER_CHROMA_DELTA * chromaMult,
    tone: fillTone - FILL_HOVER_TONE_DELTA,
  })
  const accentInkDark = hctToHex({
    hue: seed.hue,
    chroma: ACCENT_INK_DARK_CHROMA * chromaMult,
    tone: ACCENT_INK_DARK_TONE + accentToneShift,
  })
  const accentHoverDark = hctToHex({
    hue: seed.hue,
    chroma: (ACCENT_INK_DARK_CHROMA + ACCENT_HOVER_DARK_CHROMA_DELTA) * chromaMult,
    tone: ACCENT_INK_DARK_TONE + accentToneShift - ACCENT_HOVER_DARK_TONE_DELTA,
  })
  // Contrast law: white wins whenever it clears the 3.0:1 UI-component floor on the (possibly
  // brightness-shifted) fill — see ON_ACCENT_WHITE_CONTRAST_MIN — otherwise a near-black ink at
  // the seed hue.
  const onAccent =
    contrastRatio(accentFill, '#ffffff') >= ON_ACCENT_WHITE_CONTRAST_MIN
      ? '#ffffff'
      : hctToHex({ hue: seed.hue, chroma: ON_ACCENT_DARK_CHROMA, tone: ON_ACCENT_DARK_TONE })

  const fill = {} as Record<FillFamily, ColorPair>
  for (const family of FILL_ORDER) {
    const chroma = clamp(FILL_CHROMA[family], FILL_CHROMA_MIN, FILL_CHROMA_MAX) * chromaMult
    const hex = hctToHex({ hue: FILL_HUE[family], chroma, tone: bandTone })
    fill[family] = { light: hex, dark: hex }
  }

  const surface = {} as Record<SurfaceKey, ColorPair>
  for (const key of Object.keys(SURFACE_TONE.light) as Exclude<SurfaceKey, RowSurfaceKey>[]) {
    surface[key] = {
      light: hctToHex({
        hue: neutral.hue,
        chroma: neutral.chroma,
        tone: clamp(SURFACE_TONE.light[key] + surfaceShift.light, 0, 100),
      }),
      dark: hctToHex({
        hue: neutral.hue,
        chroma: neutral.chroma,
        tone: clamp(SURFACE_TONE.dark[key] + surfaceShift.dark, 0, 100),
      }),
    }
  }

  const ink = {} as Record<InkKey, ColorPair>
  for (const key of Object.keys(INK_TONE.light) as InkKey[]) {
    ink[key] = {
      light: hctToHex({ hue: neutral.hue, chroma: neutral.chroma, tone: INK_TONE.light[key] }),
      dark: hctToHex({ hue: neutral.hue, chroma: neutral.chroma, tone: INK_TONE.dark[key] }),
    }
  }

  // Row hover/selected: the panel one ink step along, so both read in both schemes (`panelHover`
  // is LIGHTER than `panel` in light and vanishes on it). `row-surfaces.test.ts` pins the floor.
  for (const key of Object.keys(ROW_INK_MIX) as RowSurfaceKey[]) {
    surface[key] = {
      light: mixHex(surface.panel.light, ink.ink.light, ROW_INK_MIX[key].light),
      dark: mixHex(surface.panel.dark, ink.ink.dark, ROW_INK_MIX[key].dark),
    }
  }

  const status = deriveStatusHexes(surface)

  return {
    accent: { light: accentFill, dark: accentInkDark },
    accentHover: { light: accentFillHover, dark: accentHoverDark },
    accentFill: { light: accentFill, dark: accentFill },
    accentFillHover: { light: accentFillHover, dark: accentFillHover },
    onAccent: { light: onAccent, dark: onAccent },
    fill,
    surface,
    ink,
    status,
  }
}

// ══ v3 ═══════════════════════════════════════════════════════════════════════════════════════════
// docs/v3/concepts/tokens-visual.md 3.3-3.5, re-anchored on the 2.x palette after the owner review of
// 2026-11-11: the v3 roles are the 2.x derivation (`deriveTokens` at the 2.x defaults) mapped onto
// the v3 names, so a v3 page and a 2.x shell are one family. Only the roles 2.x never had are solved
// here (the brand ink and every status ink walk to their floor on the v3 backgrounds), and
// `gates.ts` proves the result instead of the knobs clamping it. There is no brightness knob:
// positive steps drop the label under 4.5 and negative ones clamp to one value (3.4).

/** The v3 neutral presets: the 2.x families. `stone` is the opt-in warm ramp. */
export type NeutralV3 = DeriveConfig['neutral']

export type DeriveV3Config = {
  /** Seed hex. Contributes the hue and nothing else. */
  accent: string
  neutral: NeutralV3
  /** -4..5 ({@link VIBRANCY_RANGE_V3}), 0 = the 2.x default. Scales the accent and categorical chroma as 2.x `vibrancy` does. */
  vibrancy: number
}

/** The 2.x identity: `#0077bd`, zinc, default vibrancy (owner review 2026-11-11). Literals, not
 * reads of {@link DEFAULT_DERIVE_CONFIG}: a module-level property read survives tree-shaking and
 * lands in the 2.x provider bundle. `anchor-2x.test.ts` pins the two equal. */
export const DEFAULT_DERIVE_V3_CONFIG: DeriveV3Config = {
  accent: '#0077bd',
  neutral: 'zinc',
  vibrancy: 0,
}

type SurfaceStop2x = Exclude<SurfaceKey, RowSurfaceKey>

/**
 * Which 2.x surface stop each v3 surface is, per scheme. Canvas is the 2.x page, so the shell and a
 * v3 page share one ground; inset is the 2.x field (white in light, recessed in dark: the reading
 * surface); raised is the 2.x elevated control surface. The card shell is the 2.x panel in light,
 * the surface the factory console raises its cards on (1.07:1 on the canvas; the subtle band sat
 * 1.02:1 on it, so a light card read as the page), and the 2.x subtle band in dark (DPO 5c).
 */
export const SURFACE_FROM_2X = {
  canvas: { light: 'bg', dark: 'bg' },
  inset: { light: 'field', dark: 'field' },
  card: { light: 'panel', dark: 'subtle' },
  raised: { light: 'elevated', dark: 'elevated' },
} as const satisfies Record<string, Record<Side, SurfaceStop2x>>

/** Which 2.x ink each v3 ink is: `ink2` folds into `ink`, as the table's `from` lists say. */
export const INK_FROM_2X = {
  ink: 'ink',
  'ink-muted': 'muted',
  'ink-faint': 'faint',
} as const satisfies Record<string, InkKey>

/** The 2.x range less its bottom step: at -5 (x0.29) the categorical series no longer separate
 * under protanopia and deuteranopia (`chart-N-cvd-*`), so the emitter would refuse the default seed. */
export const VIBRANCY_RANGE_V3 = { min: -4, max: 5 } as const

/** The v3 colour roles the table lists with a `{ light, dark }` pair. */
export const COLOR_NAMES_V3 = [
  'canvas',
  'inset',
  'card',
  'raised',
  'ink',
  'ink-muted',
  'ink-faint',
  'brand',
  'brand-fill',
  'on-brand',
  'good',
  'warn',
  'bad',
  'info',
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
export type ColorNameV3 = (typeof COLOR_NAMES_V3)[number]

export type DerivedV3 = {
  /** The seed, lower-cased: what a gate failure names. */
  accent: string
  colors: Record<ColorNameV3, ColorPair>
}

/** Ink share of every pre-mixed alpha role, per scheme (`color-mix(in srgb, ink N%, transparent)`).
 * `hairline` is the 2.x divider (ink 9% light; 8% white dark, which 9% of the 2.x dark ink matches
 * on the 2.x page); `hover` and `selected` are the 2.x `ROW_INK_MIX`. `input` is a deliberate
 * heavier line, not a scaled hairline: the S3 spike measured the hairline at 1.19:1 light and
 * 1.24:1 dark against a 3.00:1 bar (docs/v3/spikes/token-surfaces.md). */
export const INK_MIX_PCT = {
  hairline: { light: 9, dark: 9 },
  hover: { light: 5, dark: 7 },
  selected: { light: 7.5, dark: 9 },
  input: { light: 52, dark: 44 },
  grid: { light: 10, dark: 10 },
  crosshair: { light: 40, dark: 40 },
  scrim: { light: 45, dark: 60 },
} as const satisfies Record<string, Record<Side, number>>

/** Status tint share, per scheme: 16% dark, 12% light (3.5). */
export const TINT_PCT = { light: 12, dark: 16 } as const satisfies Record<Side, number>

// The brand ink starts at the 2.x accent ink (the fill tone in light, T78 in dark) and walks off it
// until it clears this on canvas, inset and card; a hair over the 4.5 gate so a 0.1-tone step never
// lands on the line. The 2.x light accent ink measures 4.36 on the 2.x page, under the v3 gate.
const BRAND_INK_SOLVE_MIN = 4.55
const BRAND_INK_TONE_STEP = 0.1
const INFO_LIGHT_STOP_TONE = 40

function clampVibrancy(level: number): number {
  return Number.isFinite(level) ? clamp(level, VIBRANCY_RANGE_V3.min, VIBRANCY_RANGE_V3.max) : 0
}

export type TextSurfaceV3 = 'canvas' | 'inset' | 'card' | 'raised'
const TEXT_SURFACES_V3: readonly TextSurfaceV3[] = ['canvas', 'inset', 'card', 'raised']

/** Names of every background a v3 status ink is painted on, in `statusBackgrounds` order. A
 * literal on purpose: a computed module-level constant is a side effect the provider bundle keeps. */
export const STATUS_BACKGROUND_LABELS: readonly string[] = [
  'canvas',
  'inset',
  'card',
  'raised',
  'hover-canvas',
  'selected-canvas',
  'hover-inset',
  'selected-inset',
  'hover-card',
  'selected-card',
  'tint-canvas',
  'tint-inset',
  'tint-card',
  'tint-raised',
]

/**
 * Every background a v3 status ink is painted on, for one scheme: the four surfaces, the row
 * hover and selected mixes over canvas/inset/card, and (for `tone`, the candidate ink) its own
 * tint over each surface. One definition, shared by the solver here and the PAIRS in `gates.ts`,
 * labelled so a gate failure names the surface.
 */
export function statusBackgrounds(args: {
  side: Side
  surfaces: Record<TextSurfaceV3, string>
  ink: string
  tone: string
}): { surface: string; hex: string }[] {
  const { side, surfaces, ink, tone } = args
  const list = TEXT_SURFACES_V3.map((s) => ({ surface: s as string, hex: surfaces[s] }))
  for (const s of ['canvas', 'inset', 'card'] as const) {
    list.push({
      surface: `hover-${s}`,
      hex: mixHex(surfaces[s], ink, INK_MIX_PCT.hover[side] / 100),
    })
    list.push({
      surface: `selected-${s}`,
      hex: mixHex(surfaces[s], ink, INK_MIX_PCT.selected[side] / 100),
    })
  }
  for (const s of TEXT_SURFACES_V3) {
    list.push({ surface: `tint-${s}`, hex: mixHex(surfaces[s], tone, TINT_PCT[side] / 100) })
  }
  return list
}

/**
 * Derive the v3 palette. Pure and deterministic; it never validates contrast (that is
 * `checkGates`), but its solved roles (brand ink, status inks) throw when no tone can reach their
 * floor on a surface set.
 * @throws Error on a malformed `accent`, or when a solved role cannot reach its floor.
 */
export function deriveV3(config: DeriveV3Config = DEFAULT_DERIVE_V3_CONFIG): DerivedV3 {
  assertValidAccentHex(config.accent)
  const vibrancy = clampVibrancy(config.vibrancy)
  const base = deriveTokens({
    ...DEFAULT_DERIVE_CONFIG,
    accent: config.accent,
    neutral: config.neutral,
    vibrancy,
  })
  const seed = hexToHct(config.accent)
  const mult = vibrancyChromaMult(vibrancy)
  const bandTone = yToTone(FILL_LUMINANCE)
  // The 2.x fill chroma (`deriveTokensRaw`), restated rather than shared so the 2.x provider
  // bundle stays byte-identical: the seq ramp and the light brand ink start from it.
  const fillChroma = Math.max(seed.chroma, 40) * mult

  const pair = (make: (side: Side) => string): ColorPair => ({
    light: make('light'),
    dark: make('dark'),
  })

  const colors = {} as Record<ColorNameV3, ColorPair>
  for (const [key, from] of Object.entries(SURFACE_FROM_2X))
    colors[key as keyof typeof SURFACE_FROM_2X] = {
      light: base.surface[from.light].light,
      dark: base.surface[from.dark].dark,
    }
  for (const [key, from] of Object.entries(INK_FROM_2X))
    colors[key as keyof typeof INK_FROM_2X] = base.ink[from]

  colors['brand-fill'] = base.accentFill
  colors['on-brand'] = base.onAccent
  colors.brand = pair((side) => {
    const dark = side === 'dark'
    const chroma = dark ? ACCENT_INK_DARK_CHROMA * mult : fillChroma
    const step = dark ? BRAND_INK_TONE_STEP : -BRAND_INK_TONE_STEP
    const backgrounds = [colors.canvas[side], colors.inset[side], colors.card[side]]
    for (
      let tone = dark ? ACCENT_INK_DARK_TONE : bandTone;
      tone >= 0 && tone <= 100;
      tone += step
    ) {
      const hex = hctToHex({ hue: seed.hue, chroma, tone })
      if (backgrounds.every((bg) => contrastRatio(hex, bg) >= BRAND_INK_SOLVE_MIN)) return hex
    }
    throw new Error(`brand ink: no ${side} tone reaches ${BRAND_INK_SOLVE_MIN}:1 on every surface`)
  })

  const stops = {
    ...STATUS_STOP,
    info: {
      light: { tone: INFO_LIGHT_STOP_TONE, chroma: fillChroma },
      dark: { tone: ACCENT_INK_DARK_TONE, chroma: ACCENT_INK_DARK_CHROMA * mult },
    },
  }
  for (const key of ['good', 'warn', 'bad', 'info'] as const) {
    const hue = key === 'info' ? seed.hue : STATUS_HUE[key]
    colors[key] = pair((side) =>
      solveStatusV3({
        label: key,
        side,
        hue,
        stop: stops[key][side],
        backgroundsOf: (tone) =>
          statusBackgrounds({
            side,
            tone,
            ink: colors.ink[side],
            surfaces: {
              canvas: colors.canvas[side],
              inset: colors.inset[side],
              card: colors.card[side],
              raised: colors.raised[side],
            },
          }).map((b) => b.hex),
      }),
    )
  }

  Object.assign(
    colors,
    deriveChartVars({
      hue: seed.hue,
      fillChroma,
      bandTone,
      mult,
      neutral: NEUTRAL_PRESETS[config.neutral],
      brandFill: colors['brand-fill'],
      surfaces: {
        light: { canvas: colors.canvas.light, inset: colors.inset.light },
        dark: { canvas: colors.canvas.dark, inset: colors.inset.dark },
      },
      fill: (family) => ({
        hue: FILL_HUE[family],
        chroma: clamp(FILL_CHROMA[family], FILL_CHROMA_MIN, FILL_CHROMA_MAX),
      }),
    }),
  )

  return { accent: config.accent.toLowerCase(), colors }
}
