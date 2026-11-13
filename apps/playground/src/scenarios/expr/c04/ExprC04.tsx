/**
 * c04 — Agent run durations.
 *
 *   Question: What is a typical run, how bad is the tail, and how many runs hit the timeout?
 *   Decision: Raise the timeout, or fix the slow tail.
 *
 * One card. The facts row carries the three answers (median, 95th percentile against the limit,
 * timeouts and their share); the histogram marks the median, the p95 and the limit on the seconds
 * axis itself, and the runs cut off at the timeout are their own labelled bar just right of the
 * limit. Hovering or focusing a band dims the rest and swaps the facts for that band's count and
 * share; leaving restores the three answers.
 */
import { Box, Stack } from '@mantine/core'
import { rect } from '@tanstack/charts/rect'
import { ruleX } from '@tanstack/charts/rule'
import { text } from '@tanstack/charts/text'
import { useSyncExternalStore } from 'react'
import { PageBar } from 'basalt-ui'
import { CartesianChart, ChartCard, chartCursor } from 'basalt-ui/charts'
import type {
  ChartFact,
  ChartSeries,
  ChartTooltipRow,
  ResponsiveChartHeight,
} from 'basalt-ui/charts'
import { duration, integer, percent } from 'basalt-ui/format'
import { VX } from 'basalt-ui/tokens'
import { chartStateFor, noop, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { BIN_S, RUNS, TIMEOUT_S, WINDOW_LABEL, bin, summarize } from './c04-data'
import type { Bin } from './c04-data'

const SUMMARY = summarize(RUNS)
const BINS = bin(RUNS)
const NO_BINS = bin([])

const CURSOR_GROUP = 'c04-runs'
/** The card's placeholder and the chart share one height, so loading ends where the loaded card does. */
const HEIGHT: ResponsiveChartHeight = { base: 280, regular: 320, wide: 360 }
const X_MAX = TIMEOUT_S + BIN_S
const Y_STEP = 30
const Y_MAX =
  Math.ceil((Math.max(...BINS.map((b) => b.finished ?? b.timedOut ?? 0)) * 1.1) / Y_STEP) * Y_STEP
const Y_TICKS = Array.from({ length: Y_MAX / Y_STEP + 1 }, (_, i) => i * Y_STEP)
const BAR_GAP_S = 0.4
/** A non-zero band never paints thinner than this. */
const MIN_BAR_PX = 3
const FILL = 0.85
const DIMMED = 0.3

const EMPTY_COPY = `No runs finished ${WINDOW_LABEL}. Start an agent run, or check the run log connection, and durations appear here.`
const retry = (): string => retryCopy('run log')
const runs = (n: number): string => `${integer(n)} ${n === 1 ? 'run' : 'runs'}`
const seconds = (s: number): string => duration(s, { style: 'compact' })
const share = (ratio: number, digits = 0): string => percent(ratio, { input: 'ratio', digits })

const SERIES: ChartSeries<Bin>[] = [
  {
    key: 'finished',
    label: 'Finished',
    color: VX.accent,
    getValue: (d) => d.finished,
    formatValue: runs,
  },
  {
    key: 'timed-out',
    label: 'Timed out',
    color: VX.status.bad,
    getValue: (d) => d.timedOut,
    formatValue: runs,
  },
]

const cumulativeRow = (d: Bin): ChartTooltipRow[] => [
  { label: 'Cumulative', value: `${share(d.cumulative)} of runs` },
]

/** The card's facts at rest: the three answers. */
function restFacts(): ChartFact[] {
  const headroom = TIMEOUT_S - SUMMARY.p95
  return [
    { value: seconds(SUMMARY.median), unit: 'median run' },
    {
      value: seconds(SUMMARY.p95),
      unit: '95th percentile',
      comparison:
        headroom > 0 ? `${Math.round(headroom)} s under the ${TIMEOUT_S} s limit` : 'at the limit',
      tone: 'muted',
    },
    {
      value: runs(SUMMARY.timeouts),
      unit: 'timed out',
      comparison: `${share(SUMMARY.timeoutShare, 1)} of ${integer(SUMMARY.count)}`,
      tone: SUMMARY.timeouts > 0 ? 'bad' : 'muted',
    },
  ]
}

/** The hovered or focused bar's readout, in the same three slots so the row keeps its height. */
function barFacts(d: Bin): ChartFact[] {
  const count = d.finished ?? d.timedOut ?? 0
  const own = SUMMARY.count === 0 ? 0 : count / SUMMARY.count
  return [
    { value: runs(count), unit: d.title },
    { value: share(own, 1), unit: 'of all runs' },
    { value: share(d.cumulative, 1), unit: 'cumulative' },
  ]
}

// cycle-expression-1: the kit has no hover-linked readout, so the card reads the shared cursor itself and maps its x back to a bar.
function useHoveredBin(bins: readonly Bin[]): Bin | undefined {
  const cursor = chartCursor(CURSOR_GROUP)
  const state = useSyncExternalStore(cursor.subscribe, cursor.getState, () => null)
  const x = state?.anchor === 'value' ? state.value.x : undefined
  if (typeof x !== 'number') return undefined
  return bins.reduce<Bin | undefined>(
    (best, b) => (best === undefined || Math.abs(b.x - x) < Math.abs(best.x - x) ? b : best),
    undefined,
  )
}

/** A vertical rule at `x` seconds. */
const rule = (x: number, stroke: string, strokeDasharray?: string) =>
  ruleX([x], {
    x: (v) => v,
    stroke,
    strokeWidth: 1,
    ...(strokeDasharray !== undefined && { strokeDasharray }),
  })

const durationLabel = (s: number): string => `${s} s`

export function ExprC04Scenario({ shotState }: ScenarioProps) {
  const bins = shotState === 'empty' ? NO_BINS : BINS
  const hovered = useHoveredBin(bins)
  const facts = hovered === undefined || shotState !== undefined ? restFacts() : barFacts(hovered)

  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar title={`Agent run durations · ${WINDOW_LABEL}`} />
      <Box data-shot="run-duration-distribution">
        <ChartCard
          title={`Runs per ${BIN_S} s band`}
          facts={facts}
          info={`Each bar counts the runs, ${WINDOW_LABEL}, whose duration fell in that ${BIN_S} s band. The red bar holds the runs stopped at the ${TIMEOUT_S} s timeout. The solid line is the median, the dashed line the 95th percentile.`}
          state={chartStateFor(shotState, { empty: EMPTY_COPY, error: retry() })}
          placeholderHeight={HEIGHT}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <CartesianChart
              data={bins}
              ariaLabel={`Runs by duration in ${BIN_S} second bands, ${WINDOW_LABEL}. The median is ${seconds(SUMMARY.median)}, the 95th percentile ${seconds(SUMMARY.p95)}, and ${runs(SUMMARY.timeouts)} hit the ${TIMEOUT_S} second timeout.`}
              x={(d) => d.x}
              xDomain={[0, X_MAX]}
              formatX={durationLabel}
              y={{
                domain: [0, Y_MAX],
                ticks: Y_TICKS,
                format: (v) => (v === Y_MAX ? `${v} runs` : String(v)),
              }}
              height={HEIGHT}
              legend={false}
              cursorGroup={CURSOR_GROUP}
              series={SERIES}
              tooltip={{ formatHeader: (_, d) => d.title, rows: cumulativeRow }}
              marks={(plot) => {
                // cycle-expression-1: no histogram kind or per-bar colour, so every bar is a hand-placed rect on a numeric seconds axis, with a minimum painted height so a 1-run band stays visible.
                const minCount = (MIN_BAR_PX * Y_MAX) / plot.plotHeight
                const bars = plot.visible.flatMap((s) => {
                  const rows = plot.rows(s.key).filter((r) => r.y !== null)
                  const draw = (subset: typeof rows, fillOpacity: number) =>
                    rect(subset, {
                      x1: (r) => r.datum.from + BAR_GAP_S,
                      x2: (r) => r.datum.to - BAR_GAP_S,
                      y1: () => 0,
                      y2: (r) => (r.y === 0 ? 0 : Math.max(r.y ?? 0, minCount)),
                      fill: s.color,
                      fillOpacity,
                    })
                  if (hovered === undefined) return [draw(rows, FILL)]
                  return [
                    draw(
                      rows.filter((r) => r.datum !== hovered),
                      DIMMED,
                    ),
                    draw(
                      rows.filter((r) => r.datum === hovered),
                      1,
                    ),
                  ]
                })
                // cycle-expression-1: no vertical reference lines (`refLines` are horizontal), so the median, p95 and limit are hand-drawn rules and their labels are text marks.
                const labels = [
                  {
                    x: SUMMARY.median,
                    text: `Median ${seconds(SUMMARY.median)}`,
                    anchor: 'start' as const,
                  },
                  { x: SUMMARY.p95, text: `p95 ${seconds(SUMMARY.p95)}`, anchor: 'end' as const },
                ]
                const timeoutBar = BINS.at(-1)
                const timeoutLabel =
                  timeoutBar?.timedOut == null || SUMMARY.count === 0
                    ? []
                    : [
                        {
                          x: X_MAX,
                          y: timeoutBar.timedOut,
                          text: `${integer(timeoutBar.timedOut)} timed out`,
                        },
                      ]
                return [
                  ...bars,
                  rule(SUMMARY.median, VX.ink2),
                  rule(SUMMARY.p95, VX.ink2, VX.dashArray),
                  rule(TIMEOUT_S, VX.status.bad, VX.dashArray),
                  text(labels, {
                    x: (d) => d.x,
                    y: () => Y_MAX,
                    text: (d) => d.text,
                    anchor: (d) => d.anchor,
                    dx: (d) => (d.anchor === 'start' ? 5 : -5),
                    dy: 12,
                    fontSize: VX.axisFont,
                    fill: VX.ink2,
                  }),
                  text(timeoutLabel, {
                    x: (d) => d.x,
                    y: (d) => d.y,
                    text: (d) => d.text,
                    anchor: 'end',
                    dy: -6,
                    fontSize: VX.axisFont,
                    fill: VX.status.bad,
                  }),
                ]
              }}
            />
          </Box>
        </ChartCard>
      </Box>
    </Stack>
  )
}
