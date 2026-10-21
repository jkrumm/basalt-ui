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
    route: '/data?shot-state=loading',
    anchor: 'table',
    select: 'tbody tr',
    rowLike: true,
    note: 'BasaltDataTable skeleton row, behind the `shot-state=loading` search param',
  },
  'page-header': {
    route: '/dashboard',
    selector: '.mantine-AppShell-header',
    note: 'the shell header row that carries the PageBar',
  },
  // ── Beyond the default list: ids the Keel capture added, mapped to basalt's closest current equivalent.
  'metric-card-gauge': { missing: 'StatCard has no ring-gauge variant' },
  'metric-card-bar': { missing: 'StatCard has no segmented progress-bar variant' },
  'pipeline-column': { missing: 'basalt has no kanban or pipeline component' },
  'deal-card': { missing: 'basalt has no deal or link-card component' },
  'schedule-item': { missing: 'no meeting-list component or demo exists' },
  'filter-toolbar': {
    route: '/data',
    anchor: 'table',
    select: '.mantine-Group-root:has(.mantine-TextInput-root)',
    note: 'BasaltDataTable toolbar (global search + facets)',
  },
  'record-header': {
    missing: 'no record-header block (avatar + facts); the playground has no record detail page',
  },
  'stat-strip': {
    route: '/dashboard',
    anchor: 'dashboard',
    select: 'div:has(> .mantine-Card-root)',
    note: 'StatGroup grid of KPI StatCards',
  },
  'stat-cell': {
    route: '/dashboard',
    anchor: 'dashboard',
    select: '.mantine-Card-root',
    note: 'first StatCard of the StatGroup',
  },
  'side-panel-card': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-Card-root',
    note: 'SettingsSection card (header + rows); the closest panel card without a record page',
  },
  'segmented-control': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-SegmentedControl-root',
    note: 'Mantine SegmentedControl on the Components → Surfaces tab',
  },
  'tab-bar': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-Tabs-list',
    note: 'Mantine Tabs list on the Components → Surfaces tab',
  },
  'status-pill': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-Badge-root',
    note: 'first Mantine Badge on the Components → Surfaces tab',
  },
  'button-primary': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-Button-root[data-variant="filled"]',
    note: 'filled Button',
  },
  'button-secondary': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-Button-root[data-variant="default"]',
    note: 'default-variant Button',
  },
  'button-ghost': {
    route: '/components',
    anchor: 'surfaces',
    select: '.mantine-Button-root[data-variant="subtle"]',
    note: 'subtle-variant Button',
  },
} as const satisfies Record<string, PatternMapping>

export type PatternId = keyof typeof PATTERNS

const isPatternId = (id: string): id is PatternId => Object.hasOwn(PATTERNS, id)

/** Ids every board shows, in order — the table's own keys; the capture worker may add more. */
export const EXPECTED_IDS: readonly PatternId[] = Object.keys(PATTERNS).filter(isPatternId)

/** The mapping for any id; one the basalt side has not mapped (or an inherited name like `constructor`) is `missing`. */
export function mappingFor(id: string): PatternMapping {
  return isPatternId(id) ? PATTERNS[id] : { missing: 'no basalt mapping for this pattern yet' }
}
