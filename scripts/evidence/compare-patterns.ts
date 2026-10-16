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

/** Ids every board shows, in order; the capture worker may add more. */
export const EXPECTED_IDS = [
  'metric-card',
  'decision-card',
  'entity-card',
  'table-header',
  'table-row',
  'kanban-column',
  'kanban-card',
  'timeline-event',
  'activity-item',
  'form-field',
  'nav-item',
  'empty-state',
  'loading-state',
  'page-header',
] as const

export type FoundMapping = {
  /** Playground path, query string allowed. */
  route: string
  note: string
  /** `data-compare` value to look up when it differs from the pattern id (one tag, several patterns). */
  anchor?: string
  /** CSS selector resolved inside the tagged element (e.g. the header row of a tagged table). */
  select?: string
  /** Shell chrome the playground cannot tag: a raw selector replaces the `data-compare` lookup. */
  selector?: string
  /** localStorage entries set before the visit (a tab the store mirrors there). */
  storage?: Record<string, string>
}
export type MissingMapping = { missing: string }
export type PatternMapping = FoundMapping | MissingMapping

export const isMissing = (m: PatternMapping): m is MissingMapping => 'missing' in m

export const PATTERNS: Record<(typeof EXPECTED_IDS)[number], PatternMapping> = {
  'metric-card': {
    route: '/dashboard',
    note: 'StatCard, first KPI of the dashboard row (title, value, delta, bleed sparkline)',
  },
  'decision-card': { missing: 'no decision-card component or demo exists' },
  'entity-card': {
    missing: 'no entity-card component; the only Card in the playground is a bare surface',
  },
  'table-header': {
    route: '/data',
    anchor: 'table',
    select: 'thead tr',
    note: 'BasaltDataTable header row',
  },
  'table-row': {
    route: '/data',
    anchor: 'table',
    select: 'tbody tr',
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
    storage: { 'basalt:components-view': '{"v":1,"value":{"tab":"activity"}}' },
    note: 'Mantine Timeline item on the Components → Activity tab',
  },
  'form-field': {
    route: '/forms',
    note: 'FormRow with a TextInput (first field of the project form)',
  },
  'nav-item': {
    route: '/dashboard',
    selector: '.mantine-AppShell-navbar a.mantine-NavLink-root',
    note: 'first sidebar NavLink (desktop sidebar only; mobile uses the bottom bar)',
  },
  'empty-state': {
    route: '/components',
    note: 'EmptyState (section tier) on the Components → Surfaces tab',
  },
  'loading-state': {
    missing: 'the table skeleton only renders behind a manual isLoading toggle, never at rest',
  },
  'page-header': {
    route: '/dashboard',
    selector: '.mantine-AppShell-header',
    note: 'the shell header row that carries the PageBar',
  },
}
