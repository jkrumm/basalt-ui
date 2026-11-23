export const SCHEMES = ['light', 'dark'] as const
export const STATES = [
  'rest',
  'hover',
  'focus',
  'keys',
  'tooltip',
  'empty',
  'loading',
  'error',
] as const
/** The states a page reaches with `?shot-state=<phase>`: an anchor declares them with `data-phase` or `data-shot-states`, and the page obeys through `shotState` (`basalt-ui/data`) on its query result. */
export const URL_STATES = ['empty', 'loading', 'error'] as const

/**
 * The open-overlay `data-slot`s (a dialog, an alert dialog, a sheet, a peek panel): each is a component of its own, and a
 * card inside one stays an anchor too. `readFactsInPage` tells them from the rest by the shape of the name (`peek`, or
 * `*-content`), because it runs in the page and cannot read this list.
 */
export const OVERLAY_SLOTS = ['dialog-content', 'alert-dialog-content', 'sheet-content', 'peek']

/** The public `data-slot`s that are anchors on their own: no consumer attribute needed. */
export const ANCHOR_SLOTS = [
  'stat-card',
  'chart-card',
  'data-table',
  'section',
  'card',
  'board',
  ...OVERLAY_SLOTS,
]

/** What the manifest declares nothing for: a wide desktop and a phone. */
export const DEFAULT_VIEWPORTS = ['1800x1200', '390x844']

/** Where shot keeps `last.json`'s sibling `.basalt/last-shot.json`. */
export const LAST_SHOT = '.basalt/last-shot.json'

/** The note of a URL-state shot skipped because no anchor on the route declares a phase. */
export const NO_STATES_NOTE = 'page declares no data-phase or data-shot-states'

/** The `name` of a route's full-page shot: not a valid anchor name. */
export const PAGE_ANCHOR = '_page'

export type Scheme = (typeof SCHEMES)[number]
export type ShotState = (typeof STATES)[number]
/** A viewport's label: the manifest's `WxH` string. */
export type Viewport = string
export type ViewportSpec = { label: Viewport; width: number; height: number; mobile: boolean }

/** `1440x900` as a spec; null for anything else. Under 600 px wide is a phone: touch, no hover. */
export function parseViewport(text: string): ViewportSpec | null {
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(text.trim())
  if (!m) return null
  const [width, height] = [Number(m[1]), Number(m[2])]
  return { label: `${width}x${height}`, width, height, mobile: width < 600 }
}

export type Sides = { top: number; right: number; bottom: number; left: number }

/** What the in-page measurer returns for one anchor. */
export type Measurement = {
  box: { width: number; height: number }
  padding: Sides
  gap: { row: number; column: number }
  /** px, or `'full'` for a radius that rounds the box completely (`50%`, `9999px`). */
  radius: number | 'full'
  borderWidth: number
  fontSizes: number[]
  /** Each nested surface; `parent` is the index of its nearest nested ancestor (null: it sits on the anchor). Absent in metrics written before the index. */
  nested: { path: string; radius: number | 'full'; padding: Sides; parent?: number | null }[]
  emptyRatio: number
  /** Controls under the hit floor, as `path WxH`. */
  small?: string[]
  /** Text boxes that cover each other, as `pathA × pathB`. */
  overlaps?: string[]
  /** Table columns the plan hides on a table wide enough to be a table, as `<table label>: <column id>`. */
  hiddenColumns?: string[]
  /** Table columns no phone card shows: they sit in the detail without asking for `card: 'detail'`. */
  cardLeftColumns?: string[]
  /** Frames the rest shot draws in their empty phase (`data-phase="empty"`), as `<slot> <label>`: a stat cell showing its empty text over loaded data reads here. */
  emptyAtRest?: string[]
}

export type AnchorMetrics = Measurement & {
  route: string
  name: string
  scheme: Scheme
  viewport: Viewport
  /** The anchor's contact sheet (`png/…__sheet.png`): every state × scheme × viewport on one image. */
  sheet?: string
}

/** What the `keys` state read: the host it focused, the key its role takes, and the page after each press. */
export type KeyLog = {
  host: string
  key: 'ArrowRight' | 'ArrowLeft' | 'ArrowDown'
  presses: { live: string; focused: string }[]
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
  /** A declared state whose crop is byte-identical to the ready crop: the page ignored `?shot-state`. */
  ignored?: true
  /** The `keys` state's presses: kept on a failed frame too, so the defect shows what was read before it. */
  keys?: KeyLog
}

/** The page-level reading of one route × scheme × viewport. */
export type PageMetrics = {
  route: string
  scheme: Scheme
  viewport: Viewport
  /** px the document is wider than the viewport. */
  overflowX: number
}

/** The theme's resolved steps (px) for one scheme × viewport; a missing custom property is omitted. */
export type Scale = {
  /** The route the steps were read on; absent: they stand for every route. */
  route?: string
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
  pages?: PageMetrics[]
  shots: ShotRecord[]
}

/** The two named viewports `scripts/evidence` drives through `openContext`. */
export const VIEWPORT_SPECS = {
  desktop: { label: '1440x900', width: 1440, height: 900, mobile: false },
  mobile: { label: '390x844', width: 390, height: 844, mobile: true },
} satisfies Record<string, ViewportSpec>
