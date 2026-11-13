/**
 * c01 — pipeline pace against the best run.
 *
 *   Question: Is this run on pace against the best run, and which stage costs or saves time?
 *
 * The lead card answers both. The headline is the pace in seconds ahead of or behind the best run,
 * with the per-stage sum beside it; under it a bar per stage on one time axis, each with its best
 * split as a tick and as a figure. A finished stage is its base, then the time lost (red, above
 * the tick) or saved (green, the gap to the tick); the running stage is the live blue up to now
 * with a marker, red once past its tick; a stage not started is the ghost of its best split. Every
 * bar carries its figure and the legend names every mark. Pointing at a stage, or Tab then the
 * arrow keys, dims the rest and turns the headline into that stage's reading. Beside it, the run
 * laid end to end against the best finish is the pace as one shape, and a table holds every split.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { dot } from '@tanstack/charts/dot'
import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { Badge, Box, Button, SimpleGrid, Stack, VisuallyHidden } from '@mantine/core'
import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { DeltaBadge, EmptyState, Meter, Section } from 'basalt-ui'
import { CartesianChart, ChartCard, chartCursor } from 'basalt-ui/charts'
import type {
  ChartFact,
  ChartMarks,
  ChartSeries,
  ChartTooltipRow,
  PlotContext,
} from 'basalt-ui/charts'
import { durationClock } from 'basalt-ui/format'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { CONTAINER_KEYS, VX, alpha } from 'basalt-ui/tokens'
import { cardStateProps, chartStateFor, noop, queryFor, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import {
  PACE,
  RUN_LABEL,
  RUN_START_LABEL,
  labelOf,
  pathOf,
  segmentsOf,
  signedClock,
  sumOf,
  verdictOf,
} from './pace-data'
import type { Pace, SegmentKind, StageRow } from './pace-data'

const SOURCE = 'pipeline run feed'
const ERROR_COPY = retryCopy(SOURCE)
const EMPTY_COPY =
  'No run in progress. Pace appears once a run starts and finishes its first stage.'
const CURSOR_GROUP = 'c01-pace'

/** One footprint for the plot in every state: the chart draws its own loading, empty and error. */
const CHART_HEIGHT = { base: 260, regular: 300 } as const

/** The grid cell sets the row height; the card fills it. */
const FILL: CSSProperties = { height: '100%' }

/** Bar and best-tick half widths, in stage-index units (one stage is one unit wide). */
const BAR_HALF = 0.2
const TICK_HALF = 0.34
const COLUMN_HALF = 0.46
const Y_STEP = 120
/** Room above the tallest bar for the best line, the figure and the live marker. */
const Y_HEADROOM = 100
/** Opacity of a stage that is not the one under the cursor. */
const DIM = 0.3
/** A lost or saved span is never thinner than this many px, so an 11 s gap stays a visible bar. */
const MIN_SPAN_PX = VX.lineWidth * 2
/** The plot height assumed until the engine reports the measured one (the chart's own `base`). */
const FIRST_PASS_PLOT_PX = CHART_HEIGHT.base

/** The time axis: whole steps up to the tallest bar plus room for its labels. */
const Y_TOP =
  Math.ceil(
    (Math.max(...PACE.rows.map((r) => Math.max(r.best, r.actual ?? 0))) + Y_HEADROOM) / Y_STEP,
  ) * Y_STEP
const Y_TICKS = Array.from({ length: Y_TOP / Y_STEP + 1 }, (_, i) => i * Y_STEP)

const axisLabel = (row: StageRow): string =>
  row.status === 'done' ? row.name : `${row.name} · ${row.status}`

const FILL_OF: Record<SegmentKind, string> = {
  base: alpha(VX.ink, 0.22),
  live: VX.accentFill,
  lost: VX.status.bad,
  saved: VX.status.good,
  ghost: alpha(VX.ink, 0.08),
}
const KEY_OF: Record<SegmentKind, string> = {
  base: 'This run',
  live: 'Live stage',
  lost: 'Time lost',
  saved: 'Time saved',
  ghost: 'Best split still to run',
}

/** The series: this run and the best split carry the data; the other marks are legend-only keys. */
const SERIES: ChartSeries<StageRow>[] = (() => {
  const present = new Set(PACE.rows.flatMap((r) => segmentsOf(r).map((s) => s.kind)))
  const keys = (['live', 'lost', 'saved', 'ghost'] as const).filter((k) => present.has(k))
  return [
    {
      key: 'actual',
      label: KEY_OF.base,
      color: FILL_OF.base,
      mark: 'bar',
      getValue: (d) => d.actual,
      formatValue: durationClock,
    },
    {
      key: 'best',
      label: 'Best split',
      color: VX.ink,
      mark: 'line',
      getValue: (d) => d.best,
      formatValue: durationClock,
    },
    ...keys.map((k): ChartSeries<StageRow> => ({
      key: k,
      label: KEY_OF[k],
      color: FILL_OF[k],
      mark: 'bar',
      getValue: () => null,
    })),
  ]
})()

type Span = { x: number; from: number; to: number }
type Mark = ChartMarks[number]

/** A stage is dimmed when another one is under the cursor or the keyboard. */
const isDimmed = (focus: number | null, row: StageRow): boolean =>
  focus !== null && focus !== row.index

/** The top of a stage's tallest mark, where its labels start. */
const topOf = (r: StageRow): number => Math.max(r.best, r.actual ?? 0)

/** Seconds on the y scale that span `px` on screen, from the measured plot (or the first-pass guess). */
const pxToSeconds = (plot: PlotContext<StageRow, number>, px: number): number => {
  const range = plot.yDomain[1] - plot.yDomain[0]
  const plotPx =
    Number.isFinite(plot.plotHeight) && plot.plotHeight > 0 ? plot.plotHeight : FIRST_PASS_PLOT_PX
  return (range / plotPx) * px
}

/**
 * The plot's marks for the stage under the cursor (`null`: none, nothing dimmed). Spans of one
 * kind and one dim state share a mark, so the whole plot is a handful of marks.
 */
// cycle-expression-1: no per-stage bar-with-reference kind; the bars, best ticks, live marker, focus column and value labels are composed from engine marks by hand
function paceMarks(focus: number | null) {
  return (plot: PlotContext<StageRow, number>): ChartMarks => {
    const out: Mark[] = []
    const minSpan = pxToSeconds(plot, MIN_SPAN_PX)
    const tickHalf = pxToSeconds(plot, VX.lineWidth) / 2

    const focused = plot.data.filter((r) => focus === r.index)
    if (focused.length > 0) {
      out.push(
        decorative(
          rect(focused, {
            id: 'focus-column',
            x1: (r: StageRow) => r.index - COLUMN_HALF,
            x2: (r: StageRow) => r.index + COLUMN_HALF,
            y1: () => 0,
            y2: () => Y_TOP,
            fill: alpha(VX.ink, 0.07),
          }),
        ),
      )
    }

    const spans = new Map<string, { kind: SegmentKind; dim: boolean; spans: Span[] }>()
    for (const row of plot.data) {
      const dim = isDimmed(focus, row)
      for (const seg of segmentsOf(row)) {
        const key = `${seg.kind}-${dim}`
        const group = spans.get(key) ?? { kind: seg.kind, dim, spans: [] }
        const thin = seg.kind === 'lost' || seg.kind === 'saved'
        group.spans.push({
          x: row.index,
          from: seg.from,
          to: thin ? Math.max(seg.to, seg.from + minSpan) : seg.to,
        })
        spans.set(key, group)
      }
    }
    for (const [key, group] of spans) {
      out.push(
        decorative(
          rect(group.spans, {
            id: `bar-${key}`,
            x1: (s: Span) => s.x - BAR_HALF,
            x2: (s: Span) => s.x + BAR_HALF,
            y1: (s: Span) => s.from,
            y2: (s: Span) => s.to,
            fill: FILL_OF[group.kind],
            fillOpacity: group.dim ? DIM : 1,
          }),
        ),
      )
    }

    for (const dim of [false, true]) {
      const rows = plot.data.filter((r) => isDimmed(focus, r) === dim)
      if (rows.length === 0) continue
      // The tick sits on top of the bars, wider than they are, so it reads even where it meets a seam.
      out.push(
        decorative(
          rect(rows, {
            id: `best-${dim}`,
            x1: (r: StageRow) => r.index - TICK_HALF,
            x2: (r: StageRow) => r.index + TICK_HALF,
            y1: (r: StageRow) => r.best - tickHalf,
            y2: (r: StageRow) => r.best + tickHalf,
            fill: VX.ink,
            fillOpacity: dim ? DIM : 1,
          }),
        ),
      )
      // Labels stand above the stage's tallest mark, best line over figure; the live stage lifts both
      // so the marker never sits on its figure.
      for (const live of [false, true]) {
        const group = rows.filter((r) => (r.status === 'running') === live)
        if (group.length === 0) continue
        const lift = live ? VX.dotR * 2 + 4 : 0
        const common = {
          x: (r: StageRow) => r.index,
          y: topOf,
          anchor: 'middle' as const,
          fontVariantNumeric: 'tabular-nums',
        }
        out.push(
          decorative(
            text(group, {
              ...common,
              id: `best-label-${dim}-${live}`,
              dy: -(VX.text.xs + 14 + lift),
              text: (r: StageRow) => `best ${durationClock(r.best)}`,
              fill: dim ? VX.faint : VX.muted,
              fontSize: VX.text.micro,
            }),
          ),
          decorative(
            text(group, {
              ...common,
              id: `figure-${dim}-${live}`,
              dy: -(10 + lift),
              text: labelOf,
              fill: dim ? VX.faint : VX.ink,
              fontSize: VX.text.xs,
            }),
          ),
        )
      }
    }

    const live = plot.data.filter((r) => r.status === 'running')
    if (live.length > 0) {
      out.push(
        decorative(
          dot(live, {
            id: 'live-marker',
            x: (r: StageRow) => r.index,
            y: (r: StageRow) => r.actual ?? 0,
            r: VX.dotR,
            fill: VX.accentFill,
            stroke: VX.dotStroke,
            strokeWidth: 2,
            fillOpacity: focus !== null && !live.some((r) => r.index === focus) ? DIM : 1,
          }),
        ),
      )
    }
    return out
  }
}

/** The headline for the whole run, or for the one stage under the cursor. */
function factOf(pace: Pace, row: StageRow | undefined): ChartFact {
  if (row === undefined) {
    const { live } = pace
    const sum = `= ${sumOf(pace)}`
    if (live === 0) {
      return { value: durationClock(0), unit: 'on best pace', period: sum, tone: 'muted' }
    }
    return {
      value: signedClock(live),
      unit: live > 0 ? 'behind best' : 'ahead of best',
      period: sum,
      tone: live > 0 ? 'bad' : 'good',
    }
  }
  const best = `best ${durationClock(row.best)}`
  if (row.status === 'waiting') {
    return { value: '—', unit: `${row.name} has not started`, period: best, tone: 'muted' }
  }
  if (row.status === 'running') {
    return row.over > 0
      ? {
          value: signedClock(row.over),
          unit: `past best in ${row.name}, live`,
          period: best,
          tone: 'bad',
        }
      : {
          value: durationClock(row.actual ?? 0),
          unit: `into ${row.name}, live`,
          period: best,
          tone: 'muted',
        }
  }
  const delta = row.delta ?? 0
  const split = `split ${durationClock(row.actual ?? 0)}`
  if (delta === 0) {
    return {
      value: durationClock(0),
      unit: `${row.name} on its best split`,
      period: split,
      tone: 'muted',
    }
  }
  return {
    value: signedClock(delta),
    unit: `${delta > 0 ? 'lost' : 'saved'} in ${row.name}`,
    period: [split, best],
    tone: delta > 0 ? 'bad' : 'good',
  }
}

/** The headline as one sentence, for the live region. */
const sentenceOf = (fact: ChartFact): string =>
  [
    typeof fact.value === 'string' ? fact.value : '',
    fact.unit ?? '',
    ...(Array.isArray(fact.period) ? fact.period : [fact.period ?? '']),
  ]
    .filter((p) => p !== '')
    .join(', ')

const tooltipRows = (d: StageRow): ChartTooltipRow[] => {
  if (d.delta !== null) return [{ label: 'Against best', value: signedClock(d.delta) }]
  if (d.status === 'running') {
    return [
      { label: 'Running', value: d.over > 0 ? `${signedClock(d.over)} past best` : 'under best' },
    ]
  }
  return [{ label: 'Status', value: 'Not started' }]
}

const col = createColumnHelper<StageRow>()

const COLUMNS = [
  col.accessor('name', {
    header: 'Stage',
    cell: (c) => (c.row.original.status === 'running' ? `${c.getValue()} · live` : c.getValue()),
    meta: { kind: 'text', priority: 1 },
  }),
  col.accessor('best', {
    header: 'Best',
    cell: (c) => durationClock(c.getValue()),
    meta: { kind: 'number', priority: 1 },
  }),
  col.accessor((r) => r.actual, {
    id: 'actual',
    header: 'Run',
    cell: (c) => (c.getValue() === null ? '—' : durationClock(c.getValue() ?? 0)),
    meta: { kind: 'number', priority: 1 },
  }),
  col.accessor((r) => (r.status === 'running' ? r.over : r.delta), {
    id: 'delta',
    header: 'Delta',
    cell: (c) => {
      const value = c.getValue()
      if (value === null || (value === 0 && c.row.original.status !== 'done')) return '—'
      return (
        <DeltaBadge value={value} polarity="up-bad" format={(v) => durationClock(Math.abs(v))} />
      )
    },
    sortFn: 'basic',
    meta: { kind: 'number', priority: 1 },
  }),
]

/** The header a state other than rest shows: same rows as the loaded header, so the card keeps its height. */
// cycle-expression-1: ChartCard keeps its facts and subtitle rows only while pending, so empty and error paint a placeholder header by hand to hold the loaded height
function stateHeader(shotState: ScenarioProps['shotState']): {
  facts: ChartFact
  subtitle: string
} {
  const none = { value: '—', tone: 'muted' as const }
  if (shotState === 'empty') {
    return {
      facts: { ...none, unit: 'no run to compare' },
      subtitle: 'Waiting for a run to start.',
    }
  }
  if (shotState === 'error') {
    return {
      facts: { ...none, unit: 'pace unavailable' },
      subtitle: 'The run feed is not answering.',
    }
  }
  return { facts: { ...none, unit: ' ' }, subtitle: ' ' }
}

const STEP_KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

export function ExprC01Scenario({ shotState }: ScenarioProps) {
  const cursor = chartCursor(CURSOR_GROUP)
  const cursorState = useSyncExternalStore(cursor.subscribe, cursor.getState, () => null)
  const at = cursorState?.value?.x
  const pointed = typeof at === 'number' ? Math.round(at) : null
  const [stepped, setStepped] = useState<number | null>(null)
  const last = PACE.rows.length - 1
  const focusIndex = pointed ?? stepped
  const focus = PACE.rows.find((r) => r.index === focusIndex)

  // One tab stop for the plot: Left and Right step the stage, Escape and blur return to the total.
  // cycle-expression-1: the chart host exposes no keyboard step of its own that app code can drive, so the plot gets a tab stop and its own arrow handling
  const onKeyDown = (event: KeyboardEvent): void => {
    const step = STEP_KEYS[event.key]
    if (step !== undefined) {
      event.preventDefault()
      setStepped((i) => Math.min(last, Math.max(0, (i ?? PACE.running?.index ?? 0) + step)))
    } else if (event.key === 'Escape') {
      setStepped(null)
    }
  }

  const atRest = shotState === undefined
  const fact = atRest ? factOf(PACE, focus) : stateHeader(shotState).facts
  const subtitle = atRest ? verdictOf(PACE) : stateHeader(shotState).subtitle
  const chartState = chartStateFor(shotState, {
    empty: EMPTY_COPY,
    error: ERROR_COPY,
  })
  const rows = shotState === 'empty' ? [] : PACE.rows
  const query = queryFor(shotState, ERROR_COPY)
  const path = pathOf(PACE)
  const meterMax = Math.ceil(Math.max(path.projected, PACE.bestTotal) / 60) * 60
  const meterCard = cardStateProps(shotState, ERROR_COPY, 'content', EMPTY_COPY)

  return (
    <SimpleGrid
      type="container"
      cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}
      data-shot-states="empty loading error"
    >
      <Box data-shot="pace-by-stage" h="100%">
        <ChartCard
          style={FILL}
          title="Stage time against the best run, m:ss"
          subtitle={subtitle}
          facts={fact}
          info={`${RUN_LABEL}, started ${RUN_START_LABEL} UTC. Each bar is the time of one stage; the tick is its best split. Red is time lost past the tick, green the gap saved before it, blue a stage still running.`}
          {...(atRest && {
            actions: (
              <Badge color="gray" variant="light">
                {PACE.running === undefined ? 'Finished' : `Live · ${RUN_LABEL}`}
              </Badge>
            ),
          })}
          {...(shotState === 'error' && {
            actions: (
              <Button variant="default" onClick={noop}>
                Retry
              </Button>
            ),
          })}
        >
          <Box
            data-shot-hover
            data-shot-tooltip
            role="group"
            aria-label="Stages, use the left and right arrow keys to step through them"
            // cycle-expression-1: no kit keyboard seam for a chart's stages, so the lint waiver below grants the plot its tab stop
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the one tab stop of the plot
            tabIndex={atRest ? 0 : -1}
            onKeyDown={onKeyDown}
            onFocus={() => setStepped((i) => i ?? PACE.running?.index ?? 0)}
            onBlur={() => setStepped(null)}
          >
            <CartesianChart<StageRow, number>
              data={PACE.rows}
              ariaLabel={`Time per stage against the best split, ${RUN_LABEL}, in minutes and seconds`}
              x={(d) => d.index}
              xDomain={[-0.5, PACE.rows.length - 0.5]}
              xTicks={PACE.rows.map((r) => r.index)}
              formatX={(i) => {
                const row = PACE.rows[Math.round(i)]
                return row === undefined ? '' : axisLabel(row)
              }}
              y={{ domain: [0, Y_TOP], ticks: Y_TICKS, format: durationClock }}
              series={SERIES}
              marks={paceMarks(focusIndex)}
              legend={{ placement: 'bottom', toggle: false }}
              cursorGroup={CURSOR_GROUP}
              tooltip={{ formatHeader: (_, d) => d.name, rows: tooltipRows }}
              height={CHART_HEIGHT}
              {...(chartState !== undefined && { state: chartState })}
            />
            {/* cycle-expression-1: the chart host has no per-bar readout region of its own for a cursor-driven headline, so the same sentence is announced from here */}
            <VisuallyHidden aria-live="polite">{atRest ? sentenceOf(fact) : ''}</VisuallyHidden>
          </Box>
        </ChartCard>
      </Box>
      <Stack gap="sm">
        <Box data-shot="pace-path">
          <ChartCard
            title="Run against the best finish, m:ss"
            facts={{
              value: durationClock(path.projected),
              unit: 'projected finish',
              period: `best run ${durationClock(PACE.bestTotal)}`,
              tone: path.projected > PACE.bestTotal ? 'bad' : 'good',
            }}
            info="The stages laid end to end: what each has taken so far, then the best splits still to run in a lighter fill. The tick is the best run's finish."
            {...meterCard}
          >
            <Meter
              label="Run laid end to end against the best run's finish"
              max={meterMax}
              format={durationClock}
              segments={path.parts}
              ticks={[
                { at: PACE.bestTotal, label: 'Best run', caption: durationClock(PACE.bestTotal) },
              ]}
              forecastCaption="Best splits still to run"
              loading={shotState === 'loading'}
            />
          </ChartCard>
        </Box>
        <Box data-shot="splits">
          <Section title="Splits against the best run, m:ss">
            <BasaltDataTable
              data={rows}
              columns={COLUMNS}
              rowLabel={(r) => r.name}
              skeletonRows={PACE.rows.length}
              emptyState={
                <EmptyState title="No splits yet" description={EMPTY_COPY} tier="section" />
              }
              {...(query !== undefined && { query })}
            />
          </Section>
        </Box>
      </Stack>
    </SimpleGrid>
  )
}
