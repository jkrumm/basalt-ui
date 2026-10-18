export const SCHEMES = ['light', 'dark'] as const
export const VIEWPORTS = ['desktop', 'mobile'] as const
export const STATES = ['rest', 'hover', 'focus', 'tooltip', 'empty', 'loading', 'error'] as const
/** The states a page opts into with `data-shot-states`; reached through the `shot-state` URL param. */
export const URL_STATES = ['empty', 'loading', 'error'] as const

/** Where shot keeps `last.json`, `history.json` and the default out dir. */
export const SHOT_HOME = '.basalt/shots'

/** The note of a URL-state shot skipped because the route declares no `data-shot-states` at all (`shot detect` reads it). */
export const NO_STATES_NOTE = 'page declares no data-shot-states'

/** The `name` of a route's full-page shot: not a valid `data-shot` value. */
export const PAGE_ANCHOR = '_page'

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
  /** px, or `'full'` for a radius that rounds the box completely (`50%`, `9999px`). */
  radius: number | 'full'
  borderWidth: number
  fontSizes: number[]
  nested: { path: string; radius: number | 'full'; padding: Sides }[]
  emptyRatio: number
  /** `min` is null when the anchor holds no text. */
  contrast: {
    min: number | null
    failures: ContrastFailure[]
    /** Set when some text sat on no opaque ancestor background and white was assumed. */
    backdrop?: 'assumed-white'
  }
}

export type AnchorMetrics = Measurement & {
  route: string
  name: string
  scheme: Scheme
  viewport: Viewport
  /** The anchor's contact sheet (`png/…__sheet.png`): every state × scheme × viewport on one image. Absent when it could not be written. */
  sheet?: string
}

export type ShotRecord = {
  route: string
  name: string
  scheme: Scheme
  viewport: Viewport
  state: ShotState
  file: string | null
  /** `absent`: the anchor declared itself missing in this state (`data-shot-absent`): not a defect. */
  status: 'ok' | 'not-declared' | 'absent' | 'skipped' | 'error'
  note?: string
  /** The anchor renders a basalt state surface (a ChartCard, StatCard or chart state): set on the `not-declared` shots of a route that declares no `data-shot-states`. */
  stateful?: true
}

/** The theme's resolved steps (px) for one scheme × viewport; a missing custom property is omitted. */
export type Scale = {
  scheme: Scheme
  viewport: Viewport
  spacing: Record<string, number>
  radius: Record<string, number>
  fontSizes: Record<string, number>
}

export type ShotMetrics = {
  version: 1
  generatedAt: string
  base: string
  routes: string[]
  viewports: Viewport[]
  schemes: Scheme[]
  states: ShotState[]
  scale: Scale[]
  /** Why `scale` is empty or partial; absent when it was read. */
  scaleError?: string
  anchors: AnchorMetrics[]
  shots: ShotRecord[]
}
