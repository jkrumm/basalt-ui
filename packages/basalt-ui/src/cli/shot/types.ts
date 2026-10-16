export const SCHEMES = ['light', 'dark'] as const
export const VIEWPORTS = ['desktop', 'mobile'] as const
export const STATES = ['rest', 'hover', 'focus', 'tooltip', 'empty', 'loading', 'error'] as const
/** The states a page opts into with `data-shot-states`; reached through the `shot-state` URL param. */
export const URL_STATES = ['empty', 'loading', 'error'] as const

export type Scheme = (typeof SCHEMES)[number]
export type Viewport = (typeof VIEWPORTS)[number]
export type ShotState = (typeof STATES)[number]

export const VIEWPORT_SPECS: Record<Viewport, { width: number; height: number; mobile: boolean }> =
  {
    desktop: { width: 1440, height: 900, mobile: false },
    mobile: { width: 390, height: 844, mobile: true },
  }

export type Sides = { top: number; right: number; bottom: number; left: number }

export type ContrastFailure = {
  text: string
  ratio: number
  fg: string
  bg: string
  fontSize: number
}

/** What the in-page measurer returns for one anchor. */
export type Measurement = {
  box: { width: number; height: number }
  padding: Sides
  gap: { row: number; column: number }
  radius: number
  borderWidth: number
  fontSizes: number[]
  nested: { path: string; radius: number; padding: Sides }[]
  emptyRatio: number
  /** `min` is null when the anchor holds no text. */
  contrast: { min: number | null; failures: ContrastFailure[] }
}

export type AnchorMetrics = Measurement & {
  route: string
  name: string
  scheme: Scheme
  viewport: Viewport
}

export type ShotRecord = {
  route: string
  name: string
  scheme: Scheme
  viewport: Viewport
  state: ShotState
  file: string | null
  status: 'ok' | 'not-declared' | 'error'
  note?: string
}

export type ShotMetrics = {
  version: 1
  generatedAt: string
  base: string
  routes: string[]
  viewports: Viewport[]
  schemes: Scheme[]
  states: ShotState[]
  anchors: AnchorMetrics[]
  shots: ShotRecord[]
}
