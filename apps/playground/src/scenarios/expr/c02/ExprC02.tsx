/**
 * c02 — webhook deliveries. An on-call engineer asks: which endpoint is failing, since when, and is
 * it a volume problem or a failure problem?
 *
 * One grid, one tab stop: each endpoint is a pair of rows over the same 24 hours, the failure rate on
 * top and its attempts below, endpoints most urgent first. A dark top row is a failure problem, a
 * dark bottom row a volume problem; the onset cell of each carries its hour. The card's facts state
 * the two headline figures against their lines, and the table under it states each endpoint's
 * verdict in words, so no reading needs a hover.
 */
import { Badge, Box, Stack, Text } from '@mantine/core'
import { EmptyState, Section } from 'basalt-ui'
import { ChartCard, Heatmap } from 'basalt-ui/charts'
import type { ChartFact, HeatmapState } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { VX } from 'basalt-ui/tokens'
import { chartStateFor, noop, queryFor, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import {
  CELLS,
  DEGRADED_COUNT,
  ENDPOINTS,
  ENDPOINT_ORDER,
  FAILING_COUNT,
  FAIL_RATE_PCT,
  HOUR_KEYS,
  MIN_SAMPLE,
  RECENT_HOURS,
  VOLUME_RATIO,
  WARN_RATE_PCT,
  failureRatePct,
  fmtClock,
  fmtSpan,
  fmtStamp,
  volumeRatio,
} from './webhook-data'
import type { Cell, EndpointRow } from './webhook-data'

const fmtPct = (v: number): string => `${Math.round(v)}%`
const fmtRatio = (v: number): string => `${v.toFixed(1)}×`
const fmtCount = (v: number): string => v.toLocaleString('en-GB')
/** The hour of an instant as two digits: the glyph an onset cell wears. */
const hourGlyph = (ms: number): string => fmtClock(ms).slice(0, 2)

const NO_DELIVERIES =
  'No deliveries were attempted in the last 24 h. Check that the endpoints subscribe to events.'
const DELIVERY_LOG = 'delivery log'

/** Two grid rows per endpoint: its failure rate, then its attempts. */
type Kind = 'failure' | 'volume'
type GridCell = { row: string; col: string; kind: Kind; cell: Cell; endpoint: EndpointRow }

const ENDPOINT_BY_NAME = new Map(ENDPOINTS.map((e) => [e.name, e]))
const rowKey = (name: string, kind: Kind): string => `${name}:${kind}`
const ROWS = ENDPOINT_ORDER.flatMap((name) => [rowKey(name, 'failure'), rowKey(name, 'volume')])

const GRID: readonly GridCell[] = CELLS.flatMap((cell) => {
  const endpoint = ENDPOINT_BY_NAME.get(cell.endpoint)
  if (endpoint === undefined) return []
  const col = String(cell.hourMs)
  return (['failure', 'volume'] as const).map((kind) => ({
    row: rowKey(cell.endpoint, kind),
    col,
    kind,
    cell,
    endpoint,
  }))
})

/**
 * Failure rows: neutral steps below the fail line, a status fill at and above it (the cell says
 * failing, not just a darker red), the ramp only between. Volume rows: one volume hue in four steps,
 * so the traffic shape reads. Quiet steps are graded so 0% and 3% differ.
 */
const SCALE_STATES: readonly HeatmapState<string>[] = [
  { key: 'clean', label: 'No failures', color: VX.neutral, fillOpacity: 0.08 },
  { key: 'low', label: `Under ${WARN_RATE_PCT}% failed`, color: VX.neutral, fillOpacity: 0.3 },
  {
    key: 'sparse',
    label: `Under ${MIN_SAMPLE} attempts, rate not shown`,
    color: VX.neutral,
    fillOpacity: 0.16,
    glyph: '·',
  },
  { key: 'none', label: 'No attempts', color: VX.faint, fillOpacity: 0.5, glyph: '–' },
  { key: 'failing', label: `Failing, ${FAIL_RATE_PCT}% or more`, tone: 'bad', legend: false },
  {
    key: 'v1',
    label: 'Attempts under 0.75× median',
    color: VX.accent,
    fillOpacity: 0.1,
    legend: false,
  },
  { key: 'v2', label: 'Attempts near median', color: VX.accent, fillOpacity: 0.2, legend: false },
  {
    key: 'v3',
    label: `Attempts under ${VOLUME_RATIO}× median (darker is more)`,
    color: VX.accent,
    fillOpacity: 0.34,
  },
  {
    key: 'high',
    label: `Attempts ${VOLUME_RATIO}× median or more`,
    color: VX.accent,
    fillOpacity: 0.8,
  },
]

/** One state per onset, its glyph the onset hour; only the first of each kind is legended. */
const ONSET_STATES: readonly HeatmapState<string>[] = [
  ...ENDPOINTS.filter((e) => e.failSinceMs !== undefined).map((e, i): HeatmapState<string> => ({
    key: `onset:${e.name}`,
    label: 'Failing since the marked hour (UTC)',
    tone: 'bad',
    glyph: hourGlyph(e.failSinceMs ?? 0),
    ...(i > 0 && { legend: false as const }),
  })),
  ...ENDPOINTS.filter((e) => e.spikeSinceMs !== undefined).map((e, i): HeatmapState<string> => ({
    key: `spike:${e.name}`,
    label: 'Volume spike since the marked hour (UTC)',
    color: VX.accent,
    glyph: hourGlyph(e.spikeSinceMs ?? 0),
    ...(i > 0 && { legend: false as const }),
  })),
]
const STATES: readonly HeatmapState<string>[] = [...SCALE_STATES, ...ONSET_STATES]

function volumeStep(ratio: number): string {
  if (ratio >= VOLUME_RATIO) return 'high'
  if (ratio >= 1.5) return 'v3'
  return ratio >= 0.75 ? 'v2' : 'v1'
}

function stateOf(g: GridCell): string | undefined {
  const { cell, endpoint } = g
  if (cell.attempts === 0) return 'none'
  if (g.kind === 'volume') {
    if (endpoint.spikeSinceMs === cell.hourMs) return `spike:${endpoint.name}`
    return volumeStep(volumeRatio(cell) ?? 0)
  }
  if (cell.attempts < MIN_SAMPLE) return 'sparse'
  if (endpoint.failSinceMs === cell.hourMs) return `onset:${endpoint.name}`
  const rate = failureRatePct(cell) ?? 0
  if (rate >= FAIL_RATE_PCT) return 'failing'
  if (rate >= WARN_RATE_PCT) return undefined
  return cell.failures === 0 ? 'clean' : 'low'
}

// The ramp is the failure rate between the warn and fail lines; a volume cell is always a named state.
const valueOf = (g: GridCell): number | null =>
  g.kind === 'failure' ? failureRatePct(g.cell) : null

// cycle-expression-1: Heatmap has no row grouping, so a pair is one named failure row over an unnamed attempts row; the subtitle says which is which.
const formatRow = (key: string): string =>
  key.endsWith(':volume') ? '' : (key.split(':')[0] ?? key)

// cycle-expression-1: Heatmap has no tick placement control (the kit thins the 24 hour ticks itself), so an onset hour's own tick is not guaranteed; the hour is the onset cell's glyph instead.
const formatCol = (col: string): string => fmtClock(Number(col))

// cycle-expression-1: Heatmap's tooltip takes rows but no readout I can place beside the headline and no linked highlight or dimming, so both rows of a pair carry the same full reading.
function tooltipRows(g: GridCell) {
  const rate = failureRatePct(g.cell)
  const ratio = volumeRatio(g.cell)
  return [
    { label: 'Hour', value: fmtStamp(g.cell.hourMs) },
    {
      label: 'Attempts',
      value:
        ratio === null
          ? fmtCount(g.cell.attempts)
          : `${fmtCount(g.cell.attempts)} (${fmtRatio(ratio)} median)`,
    },
    { label: 'Failed', value: fmtCount(g.cell.failures) },
    { label: 'Failure rate', value: rate === null ? 'too few attempts' : fmtPct(rate) },
  ]
}

const HEATMAP_HEIGHT = { base: 380, regular: 400, wide: 420 } as const

/** The two headline figures, each against its line: the failing endpoint, then the volume spike. */
function headlineFacts(): ChartFact[] {
  const facts: ChartFact[] = []
  const failing = ENDPOINTS.find((e) => e.status === 'Failing')
  if (failing?.recentRatePct != null && failing.failSinceMs !== undefined) {
    facts.push({
      value: fmtPct(failing.recentRatePct),
      unit: `of ${failing.name} deliveries failed since ${fmtClock(failing.failSinceMs)} UTC (fail line ${FAIL_RATE_PCT}%)`,
      comparison:
        failing.baselineRatePct === null
          ? undefined
          : `vs ${fmtPct(failing.baselineRatePct)} before`,
      tone: 'bad',
    })
  }
  const heavy = ENDPOINTS.find((e) => e.problem === 'volume')
  if (heavy?.spikeSinceMs !== undefined) {
    facts.push({
      // cycle-expression-1: a fact's tone has no accent ink, so the volume figure is coloured by hand to match the blue volume cells.
      value: (
        <Text span inherit c={VX.accent}>
          {fmtRatio(heavy.recentVolumeRatio)}
        </Text>
      ),
      unit: `${heavy.name} attempts vs 24 h median since ${fmtClock(heavy.spikeSinceMs)} UTC (volume line ${VOLUME_RATIO}×)`,
    })
  }
  return facts
}

/** The same two-fact shape while loading, so the header keeps its height. */
const LOADING_FACTS: ChartFact[] = [
  { value: '—', unit: 'of deliveries failed' },
  { value: '—', unit: 'attempts vs 24 h median' },
]

const LOADING_STATE = (): string => 'clean'
const NO_VALUE = (): null => null

const columns = (() => {
  const col = createColumnHelper<EndpointRow>()
  return [
    col.accessor('name', { header: 'Endpoint', meta: { kind: 'entity', priority: 1 } }),
    col.accessor('status', {
      header: 'Status',
      // One status hue: only a failing endpoint is red; the word carries the rest.
      meta: { kind: 'status', priority: 2, statusColor: (s) => (s === 'Failing' ? 'red' : 'gray') },
    }),
    col.accessor('recentRatePct', {
      header: `Failure rate, last ${RECENT_HOURS} h (%)`,
      cell: (c) => {
        const v = c.getValue()
        return v === null ? '—' : fmtPct(v)
      },
      meta: { kind: 'number', priority: 3 },
    }),
    col.accessor('baselineRatePct', {
      header: 'Before (%)',
      cell: (c) => {
        const v = c.getValue()
        return v === null ? '—' : fmtPct(v)
      },
      meta: { kind: 'number', priority: 5 },
    }),
    col.accessor('recentVolumeRatio', {
      header: `Attempts, last ${RECENT_HOURS} h (× median)`,
      cell: (c) => fmtRatio(c.getValue()),
      meta: { kind: 'number', priority: 4 },
    }),
    col.accessor('problem', {
      header: 'Problem',
      cell: (c) => {
        const row = c.row.original
        if (row.problem === 'volume') {
          return `Volume: attempts ${fmtRatio(row.recentVolumeRatio)} median, over the ${VOLUME_RATIO}× line`
        }
        if (row.problem === 'failures') {
          return `Failures: attempts ${fmtRatio(row.recentVolumeRatio)} median, under the ${VOLUME_RATIO}× line`
        }
        return '—'
      },
      meta: { kind: 'text', priority: 6 },
    }),
    col.accessor('problemSinceMs', {
      header: 'Since',
      cell: (c) => {
        const v = c.getValue()
        return v === undefined ? '—' : `${fmtClock(v)} UTC · ${fmtSpan(v)}`
      },
      meta: { kind: 'text', priority: 7 },
    }),
  ]
})()

const TABLE_ROWS = [...ENDPOINTS]
const NO_ROWS: EndpointRow[] = []

const STATUS_CHIP = `${FAILING_COUNT} failing · ${DEGRADED_COUNT} degraded`

export function ExprC02Scenario({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retryCopy(DELIVERY_LOG))
  const loading = shotState === 'loading'
  const hasState = shotState === 'empty' || shotState === 'error'
  // cycle-expression-1: ChartCard's pending ghost and Heatmap's own are bars, not a grid, so loading draws the real grid, every cell one quiet state, dimmed and inert, at the loaded footprint.
  const cardState = loading
    ? undefined
    : chartStateFor(shotState, { empty: NO_DELIVERIES, error: retryCopy(DELIVERY_LOG) })
  const facts = loading ? LOADING_FACTS : headlineFacts()

  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <Box data-shot="delivery-grid">
        <ChartCard
          title="Webhook deliveries by endpoint, last 24 h"
          subtitle="Each endpoint: failure rate above, attempts below. Hours in UTC."
          state={cardState}
          placeholderHeight={HEATMAP_HEIGHT}
          stateNoun="deliveries"
          stale={loading}
          {...(shotState === undefined && {
            actions: (
              <Badge color="red" variant="light">
                {STATUS_CHIP}
              </Badge>
            ),
          })}
          {...(facts.length > 0 && { facts })}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box
            data-shot-hover
            data-shot-tooltip
            {...(loading && { opacity: 0.45, inert: true, 'aria-busy': true })}
          >
            <Heatmap<GridCell, string>
              ariaLabel="Webhook deliveries for 8 endpoints over the last 24 hours, most urgent first. Each endpoint has a failure-rate row and an attempts row."
              data={GRID}
              getRow={(g) => g.row}
              getCol={(g) => g.col}
              getValue={loading ? NO_VALUE : valueOf}
              getState={loading ? LOADING_STATE : stateOf}
              states={STATES}
              rows={ROWS}
              cols={HOUR_KEYS}
              formatRow={formatRow}
              formatCol={formatCol}
              color={VX.badSolid}
              domain={[0, FAIL_RATE_PCT]}
              formatValue={fmtPct}
              formatLegend={(v) => (v >= FAIL_RATE_PCT ? `${v}% fail line` : `${v}%`)}
              legend={{ label: 'Failure rate, 2.5 points per step' }}
              tooltip={{ rows: tooltipRows, valueLabel: 'Failure rate' }}
              height={HEATMAP_HEIGHT}
            />
          </Box>
        </ChartCard>
      </Box>
      {hasState ? null : (
        <Box data-shot="endpoints" data-shot-absent="empty error">
          <Section title={`Endpoints, last ${RECENT_HOURS} h`}>
            <BasaltDataTable
              data={shotState === undefined ? TABLE_ROWS : NO_ROWS}
              columns={columns}
              enableSorting={false}
              skeletonRows={TABLE_ROWS.length}
              {...(query !== undefined && { query })}
              emptyState={
                <EmptyState tier="section" title="No endpoints" description={NO_DELIVERIES} />
              }
            />
          </Section>
        </Box>
      )}
    </Stack>
  )
}
