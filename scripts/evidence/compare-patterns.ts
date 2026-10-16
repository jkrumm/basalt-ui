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

const SIDEBAR_LINK = '.mantine-AppShell-navbar a.mantine-NavLink-root'
const BOTTOM_BAR_LINK = '.mantine-AppShell-footer a'

/** The single source of the id vocabulary: ids and their order are this table's keys. */
export const PATTERNS = {
  'metric-card': {
    route: '/dashboard',
    anchor: 'dashboard',
    select: '.mantine-Card-root',
    note: 'StatCard, first KPI of the dashboard row (title, value, delta)',
  },
  'decision-card': { missing: 'no decision-card component or demo exists' },
  'entity-card': {
    missing: 'no entity-card component; the only Card in the playground is a bare surface',
  },
  'table-header': {
    route: '/data',
    anchor: 'table',
    select: 'thead tr',
    rowLike: true,
    note: 'BasaltDataTable header row',
  },
  'table-row': {
    route: '/data',
    anchor: 'table',
    select: 'tbody tr',
    rowLike: true,
    note: 'BasaltDataTable first body row',
  },
  'kanban-column': { missing: 'basalt has no kanban or board component' },
  'kanban-card': { missing: 'basalt has no kanban or board component' },
  'timeline-event': {
    missing: 'no record-timeline component; the activity Timeline is measured as activity-item',
  },
  'activity-item': {
    route: '/components',
    anchor: 'activity',
    select: '.mantine-Timeline-item',
    rowLike: true,
    storage: { 'basalt:components-view': '{"v":1,"value":{"tab":"activity"}}' },
    note: 'Mantine Timeline item on the Components → Activity tab',
  },
  'form-field': {
    route: '/forms',
    anchor: 'form',
    select: ':scope > *',
    note: 'FormRow with a TextInput (first field of the project form)',
  },
  'nav-item': {
    route: '/dashboard',
    selector: SIDEBAR_LINK,
    mobileSelector: BOTTOM_BAR_LINK,
    rowLike: true,
    note:
      'first sidebar NavLink (the active destination); on a phone the bottom bar IS the nav — ' +
      'basalt has no burger drawer, only a More sheet for overflow — so its first tab is measured',
  },
  'nav-item-idle': {
    route: '/dashboard',
    selector: `${SIDEBAR_LINK}:not([aria-current])`,
    mobileSelector: `${BOTTOM_BAR_LINK}:not([aria-current])`,
    rowLike: true,
    note: 'first inactive sidebar NavLink (bottom-bar tab on a phone)',
  },
  'empty-state': {
    route: '/components',
    anchor: 'surfaces',
    select: ':scope > .mantine-Card-root:nth-last-child(2) .mantine-Stack-root',
    note: 'EmptyState (section tier) on the Components → Surfaces tab',
  },
  'loading-state': {
    route: '/data',
    anchor: 'table',
    select: 'tbody tr',
    rowLike: true,
    before: { click: '[data-compare="table"] .mantine-Switch-root' },
    note: 'BasaltDataTable skeleton row, behind the isLoading toggle',
  },
  'page-header': {
    route: '/dashboard',
    selector: '.mantine-AppShell-header',
    note: 'the shell header row that carries the PageBar',
  },
} as const satisfies Record<string, PatternMapping>

/** Ids every board shows, in order; the capture worker may add more. */
export const EXPECTED_IDS: readonly string[] = Object.keys(PATTERNS)

/** The mapping for any id; one the basalt side has not mapped yet is `missing`, never a crash. */
export function mappingFor(id: string): PatternMapping {
  const table: Record<string, PatternMapping> = PATTERNS
  return table[id] ?? { missing: 'no basalt mapping for this pattern yet' }
}
