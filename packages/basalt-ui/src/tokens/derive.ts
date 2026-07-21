/**
 * "One accent color in -> calculated palette out" derivation engine — ported from the
 * `apps/playground/src/poc/derive.ts` proof of concept (browser-validated and calibration-checked
 * there; see that file's history for the reproduction table this derivation was scored against).
 * Every constant below (tones, chromas, hue offsets, hover deltas) is a calibrated law, not a taste
 * call — do not re-tune without re-running that calibration.
 *
 * `palette.ts` derives the shipped default palette from `deriveTokens(DEFAULT_DERIVE_CONFIG)` at
 * module load. Retuning the shipped identity means editing `DEFAULT_DERIVE_CONFIG` or the
 * constants below, never hand-editing a hex in `palette.ts`.
 */
import { contrastRatio, hctToHex, hexToHct, yToTone } from './hct'
import type { ColorPair } from './index'

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
const FILL_HOVER_TONE_DELTA = 4.8
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

const SURFACE_TONE: Record<Side, Record<SurfaceKey, number>> = {
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

// Ink ramp tone stops (achromatic). NOT shifted by lightLevel/darkLevel — text tone stays stable
// while surfaces move around it.
export type InkKey = 'ink' | 'ink2' | 'muted' | 'faint'

const INK_TONE: Record<Side, Record<InkKey, number>> = {
  light: { ink: 15.16, ink2: 27.09, muted: 34.88, faint: 48.44 },
  dark: { ink: 90.94, ink2: 88.12, muted: 84.91, faint: 66.24 },
}

// ── Status/semantic — three baked hues, each with its own calibrated tone+chroma stop per scheme.
export type StatusKey = 'good' | 'warn' | 'bad'

const STATUS_HUE: Record<StatusKey, number> = { good: 151.975, warn: 76.64, bad: 29.905 }
const STATUS_STOP: Record<StatusKey, Record<Side, { tone: number; chroma: number }>> = {
  good: { light: { tone: 45.75, chroma: 37.75 }, dark: { tone: 70.23, chroma: 53.23 } },
  warn: { light: { tone: 54.64, chroma: 61.12 }, dark: { tone: 72.34, chroma: 62.55 } },
  bad: { light: { tone: 43.86, chroma: 54.46 }, dark: { tone: 58.58, chroma: 53.79 } },
}

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

/** Derive the full palette from a seed accent + neutral family + surface levels.
 * Public level-based entry: maps the -5..5 sliders onto `DeriveParams` (vibrancy x0.72 center,
 * surface +2 baseline) and delegates to `deriveTokensRaw`. */
export function deriveTokens(config: DeriveConfig): DerivedPalette {
  assertValidAccentHex(config.accent)
  return deriveTokensRaw(config, {
    chromaMult: vibrancyChromaMult(config.vibrancy),
    accentToneShift: config.accentBrightness * ACCENT_BRIGHTNESS_TONE_STEP,
    lightSurfaceShift: SURFACE_LEVEL_TONE_STEP * config.lightLevel + SURFACE_BASELINE_TONE_SHIFT,
    darkSurfaceShift: SURFACE_LEVEL_TONE_STEP * config.darkLevel + SURFACE_BASELINE_TONE_SHIFT,
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
  for (const key of Object.keys(SURFACE_TONE.light) as SurfaceKey[]) {
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

  const status = {} as Record<StatusKey, ColorPair>
  for (const key of Object.keys(STATUS_HUE) as StatusKey[]) {
    const hue = STATUS_HUE[key]
    status[key] = {
      light: hctToHex({
        hue,
        chroma: STATUS_STOP[key].light.chroma,
        tone: STATUS_STOP[key].light.tone,
      }),
      dark: hctToHex({
        hue,
        chroma: STATUS_STOP[key].dark.chroma,
        tone: STATUS_STOP[key].dark.tone,
      }),
    }
  }

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
