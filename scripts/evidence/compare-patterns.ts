/**
 * `make compare` — the basalt side of the pattern contract. The Keel side is the committed
 * `docs/waves/design-parity/keel/inventory.json`; the harness never fetches Keel. The ids are the
 * shared vocabulary: the playground tags one representative instance with `data-compare="<anchor>"`,
 * and a pattern with no basalt equivalent says so in `missing` rather than being dropped from the board.
 */

export const METRIC_KEYS = [
  'width',
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'radius',
  'borderWidth',
  'borderRole',
  'backgroundRole',
  'shadow',
  'labelSize',
  'labelWeight',
  'labelLineHeight',
  'labelRole',
  'valueSize',
  'valueWeight',
  'valueLineHeight',
  'valueRole',
  'bodySize',
  'bodyWeight',
  'bodyLineHeight',
  'iconSize',
  'rowHeight',
  'chartHeight',
  'dividerRole',
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]
/** CSS px numbers or role strings; any key may be absent. */
export type Metrics = Partial<Record<MetricKey, number | string>>

export type FoundMapping = {
  /** Playground path, query string allowed. */
  route: string
  note: string
  /** `data-compare` value to look up when it differs from the pattern id (one tag, several patterns). */
  anchor?: string
  /** CSS selector resolved inside the tagged element (`:scope` is the tagged element). */
  select?: string
  /** Shell chrome the playground cannot tag: a raw selector replaces the `data-compare` lookup. */
  selector?: string
  /** `selector` at the mobile viewport, when the desktop chrome is not what a phone shows. */
  mobileSelector?: string
  /** A click on this page-level selector before the measurement (a toggle that reveals the state). */
  before?: { click: string }
  /** localStorage entries set before the visit (a tab the store mirrors there). */
  storage?: Record<string, string>
  /** The pattern is a row: its height is also reported as `rowHeight`. */
  rowLike?: boolean
}
export type MissingMapping = { missing: string }
export type PatternMapping = FoundMapping | MissingMapping

export const isMissing = (m: PatternMapping): m is MissingMapping => 'missing' in m

/** The playground pages these patterns were measured on went with the 2.x view layer. */
const REMOVED =
  'the 2.x playground page this pattern was measured on was deleted with the 2.x view layer'

/** The single source of the id vocabulary: ids and their order are this table's keys. */
export const PATTERNS = {
  'metric-card': { missing: REMOVED },
  'decision-card': { missing: 'no decision-card component or demo exists' },
  'entity-card': {
    missing: 'no entity-card component; the only Card in the playground is a bare surface',
  },
  'table-header': { missing: REMOVED },
  'table-row': { missing: REMOVED },
  'kanban-column': { missing: 'basalt has no kanban or board component' },
  'kanban-card': { missing: 'basalt has no kanban or board component' },
  'timeline-event': {
    missing: 'no record-timeline component; the activity Timeline is measured as activity-item',
  },
  'activity-item': { missing: REMOVED },
  'form-field': { missing: REMOVED },
  'nav-item': { missing: REMOVED },
  'nav-item-idle': { missing: REMOVED },
  'empty-state': { missing: REMOVED },
  'loading-state': { missing: REMOVED },
  'page-header': { missing: REMOVED },
  // ── Beyond the default list: ids the Keel capture added, mapped to basalt's closest current equivalent.
  'metric-card-gauge': { missing: 'StatCard has no ring-gauge variant' },
  'metric-card-bar': { missing: 'StatCard has no segmented progress-bar variant' },
  'pipeline-column': { missing: 'basalt has no kanban or pipeline component' },
  'deal-card': { missing: 'basalt has no deal or link-card component' },
  'schedule-item': { missing: 'no meeting-list component or demo exists' },
  'filter-toolbar': { missing: REMOVED },
  'record-header': {
    missing: 'no record-header block (avatar + facts); the playground has no record detail page',
  },
  'stat-strip': { missing: REMOVED },
  'stat-cell': { missing: REMOVED },
  'side-panel-card': { missing: REMOVED },
  'segmented-control': { missing: REMOVED },
  'tab-bar': { missing: REMOVED },
  'status-pill': { missing: REMOVED },
  'button-primary': { missing: REMOVED },
  'button-secondary': { missing: REMOVED },
  'button-ghost': { missing: REMOVED },
} as const satisfies Record<string, PatternMapping>

export type PatternId = keyof typeof PATTERNS

const isPatternId = (id: string): id is PatternId => Object.hasOwn(PATTERNS, id)

/** Ids every board shows, in order — the table's own keys; the capture worker may add more. */
export const EXPECTED_IDS: readonly PatternId[] = Object.keys(PATTERNS).filter(isPatternId)

/** The mapping for any id; one the basalt side has not mapped (or an inherited name like `constructor`) is `missing`. */
export function mappingFor(id: string): PatternMapping {
  return isPatternId(id) ? PATTERNS[id] : { missing: 'no basalt mapping for this pattern yet' }
}
