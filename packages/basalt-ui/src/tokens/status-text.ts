/**
 * Status text solver — the `--vx-status-good|warn|bad` solids are painted as TEXT (`DeltaBadge`,
 * a toned breakdown row), so each must clear WCAG AA on every text surface of the palette it ships
 * in. The calibrated stops below are kept unchanged when they already clear every surface (the
 * default config); otherwise each walks along its lightness axis only — light darkens, dark
 * lightens, hue preserved (chroma may clip at the gamut edge) — to the first tone that does.
 */
import type { ColorPair } from './core'
import type { StatusKey, SurfaceKey } from './derive'
import { contrastRatio, hctToHex } from './hct'

type Side = 'light' | 'dark'
type Stop = { readonly tone: number; readonly chroma: number }

export const STATUS_HUE: Readonly<Record<StatusKey, number>> = {
  good: 151.975,
  warn: 76.64,
  bad: 29.905,
}

export const STATUS_STOP: Readonly<Record<StatusKey, Readonly<Record<Side, Stop>>>> = {
  good: { light: { tone: 45.75, chroma: 37.75 }, dark: { tone: 70.23, chroma: 53.23 } },
  warn: { light: { tone: 46, chroma: 61.12 }, dark: { tone: 72.34, chroma: 62.55 } },
  bad: { light: { tone: 43.86, chroma: 54.46 }, dark: { tone: 66.5, chroma: 53.79 } },
}

/** The surfaces status text is painted on — exhaustive, so a new `SurfaceKey` must pick a side. */
export const STATUS_TEXT_SURFACES: Readonly<Record<SurfaceKey, boolean>> = {
  bg: true,
  panel: true,
  panelHover: true,
  elevated: true,
  subtle: true,
  field: true,
  border: false,
  hairline: false,
  rowHover: false,
  rowSelected: false,
}

export const STATUS_TEXT_CONTRAST_MIN = 4.5
export const STATUS_TONE_STEP = 0.25

const TEXT_SURFACE_KEYS = (Object.keys(STATUS_TEXT_SURFACES) as SurfaceKey[]).filter(
  (key) => STATUS_TEXT_SURFACES[key],
)
const STATUS_KEYS = Object.keys(STATUS_HUE) as StatusKey[]

/** The hex at the `step`-th tone from `stop` along the side's lightness axis (0 = the stop). */
export function statusHexAtStep(key: StatusKey, side: Side, step: number): string {
  const stop = STATUS_STOP[key][side]
  const direction = side === 'light' ? -1 : 1
  return hctToHex({
    hue: STATUS_HUE[key],
    chroma: stop.chroma,
    tone: stop.tone + direction * step * STATUS_TONE_STEP,
  })
}

function clearsEverySurface(hex: string, side: Side, surfaces: Record<SurfaceKey, ColorPair>) {
  return TEXT_SURFACE_KEYS.every(
    (key) => contrastRatio(hex, surfaces[key][side]) >= STATUS_TEXT_CONTRAST_MIN,
  )
}

function solve(key: StatusKey, side: Side, surfaces: Record<SurfaceKey, ColorPair>): string {
  const { tone } = STATUS_STOP[key][side]
  const maxSteps = Math.floor((side === 'light' ? tone : 100 - tone) / STATUS_TONE_STEP)
  for (let step = 0; step <= maxSteps; step++) {
    const hex = statusHexAtStep(key, side, step)
    if (clearsEverySurface(hex, side, surfaces)) return hex
  }
  throw new Error(
    `status text: no ${side} ${key} tone reaches ${STATUS_TEXT_CONTRAST_MIN}:1 on every surface`,
  )
}

/** The three status solids for a derived palette's surfaces. */
export function deriveStatusHexes(
  surfaces: Record<SurfaceKey, ColorPair>,
): Record<StatusKey, ColorPair> {
  const status = {} as Record<StatusKey, ColorPair>
  for (const key of STATUS_KEYS) {
    status[key] = { light: solve(key, 'light', surfaces), dark: solve(key, 'dark', surfaces) }
  }
  return status
}
