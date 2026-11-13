/**
 * The geometry seam's fixtures: `useChartFocus` on a `CartesianChart`, a `Heatmap` and a segmented
 * `Meter`; the axis gaps (log x, titles, x reference rules, dot/ring swatches) with direct labels
 * from `chartLabels.place`; and the hand-drawn part-of-whole bar recipe. Deterministic data, series
 * colours from `demoColors` and `VX.*`.
 */
import { SimpleGrid, Stack } from '@mantine/core'
import { dot } from '@tanstack/charts/dot'
import { text } from '@tanstack/charts/text'
import { Meter, Section } from 'basalt-ui'
import type { MeterSegment } from 'basalt-ui'
import { CartesianChart, ChartCard, Heatmap, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { PlotContext, PlotRow } from 'basalt-ui/charts'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { SeamBar } from '../../recipes/seam-bar'
import type { Part } from '../../recipes/seam-bar'
import { demoColors } from '../series'

const GRID_COLS = { base: 1, [CONTAINER_KEYS.regular]: 2 }

// ── 1. useChartFocus on a CartesianChart ────────────────────────────────────────────────────────

type Stage = { name: string; at: number; behind: number }

const STAGES: readonly Stage[] = [
  { name: 'Build', at: 1, behind: 12 },
  { name: 'Lint', at: 2, behind: 4 },
  { name: 'Test', at: 3, behind: 94 },
  { name: 'Package', at: 4, behind: 31 },
  { name: 'Deploy', at: 5, behind: 18 },
]
const STAGES_TOTAL = STAGES.reduce((sum, s) => sum + s.behind, 0)
const REST_OPACITY = 0.25

// #region example:useChartFocus
function PipelinePace() {
  const focus = useChartFocus(STAGES, { announce: (s) => `${s.name}: ${s.behind} s behind best` })
  return (
    <ChartCard
      title="Pipeline pace"
      subtitle="Seconds behind the best run, per stage"
      facts={{
        value: focus.readout(`${STAGES_TOTAL} s`, (s) => `${s.behind} s`),
        period: focus.readout('whole run', (s) => s.name),
      }}
    >
      <CartesianChart<Stage, number>
        data={STAGES}
        ariaLabel="Seconds behind the best run for each of five pipeline stages"
        x={(s) => s.at}
        formatX={(at) => STAGES[at - 1]?.name ?? ''}
        series={[
          {
            key: 'behind',
            label: 'Behind best',
            color: demoColors.sessions,
            getValue: (s) => s.behind,
          },
        ]}
        y={{ title: 'Seconds behind best' }}
        xTitle="Stage"
        xRefLines={[{ x: 3, color: VX.badRef, dashed: true, label: 'Target stage' }]}
        focus={focus}
        marks={(plot) => {
          const rows = plot.rows('behind')
          const rest = (r: PlotRow<Stage, number>): boolean =>
            plot.focused !== null && r.datum !== plot.focused
          const common = { x: 'x', y: 'y', r: VX.dotR, fill: demoColors.sessions } as const
          return [
            dot(
              rows.filter((r) => !rest(r)),
              { ...common, id: 'pace-on' },
            ),
            dot(rows.filter(rest), { ...common, id: 'pace-rest', fillOpacity: REST_OPACITY }),
          ]
        }}
      />
    </ChartCard>
  )
}
// #endregion

// ── 2. Heatmap with focus and annotate ──────────────────────────────────────────────────────────

type FailCell = { service: string; hour: string; rate: number; onset: boolean }

const SERVICES = ['orders', 'billing', 'search', 'auth']
const FAIL_HOURS = Array.from({ length: 12 }, (_, h) => String(h + 8).padStart(2, '0'))

/** Billing degrades from 13:00; the first hour over 5 % carries the onset glyph. */
const FAILURES: readonly FailCell[] = SERVICES.flatMap((service, si) =>
  FAIL_HOURS.map((hour, hi) => {
    const base = 0.4 + ((si * 7 + hi * 3) % 5) * 0.3
    const rate = service === 'billing' && hi >= 5 ? base + (hi - 4) * 2.1 : base
    return {
      service,
      hour,
      rate: Number(rate.toFixed(1)),
      onset: service === 'billing' && hi === 6,
    }
  }),
)

function FailureHeatmap() {
  const focus = useChartFocus(FAILURES, {
    announce: (c) => `${c.service} at ${c.hour}:00: ${c.rate} percent failures`,
    columns: FAIL_HOURS.length,
  })
  const worst = FAILURES.reduce((a, b) => (b.rate > a.rate ? b : a))
  return (
    <ChartCard
      title="Failure rate by service and hour"
      subtitle="Percent of requests, 08:00 to 19:00 UTC"
      facts={{
        value: focus.readout(`${worst.rate} %`, (c) => `${c.rate} %`),
        period: focus.readout(
          `worst, ${worst.service} at ${worst.hour}`,
          (c) => `${c.service} at ${c.hour}`,
        ),
      }}
    >
      <Heatmap<FailCell>
        data={FAILURES}
        ariaLabel="Failure rate per service and hour, with the onset of billing's degradation marked"
        getRow={(c) => c.service}
        getCol={(c) => c.hour}
        getValue={(c) => c.rate}
        rows={SERVICES}
        cols={FAIL_HOURS}
        color={demoColors.churn}
        formatValue={(v) => `${v} %`}
        annotate={(c) => (c.onset ? '!' : null)}
        focus={focus}
        legend={{ label: 'Failures / request' }}
        height={{ base: 200, regular: 220 }}
      />
    </ChartCard>
  )
}

// ── 3. Segmented Meter with focus ───────────────────────────────────────────────────────────────

const CONTEXT_MAX = 200
const CONTEXT_PARTS: readonly MeterSegment[] = [
  { value: 12, label: 'System', color: demoColors.sessions },
  { value: 28, label: 'Tools', color: demoColors.signups },
  { value: 96, label: 'Messages', color: demoColors.revenue },
  { value: 64, label: 'Free', tone: 'muted' },
]

function ContextMeter() {
  const focus = useChartFocus(CONTEXT_PARTS, {
    announce: (p) => `${p.label}: ${p.value}k tokens`,
  })
  return (
    <ChartCard
      title="Context window"
      subtitle="Tokens by part, of 200k"
      facts={{
        value: focus.readout(`${CONTEXT_MAX}k`, (p) => `${p.value}k`),
        period: focus.readout('window', (p) => p.label),
      }}
    >
      <Meter
        label="Context window"
        max={CONTEXT_MAX}
        segments={CONTEXT_PARTS}
        // `md`: the parts are named in the caption row; a 6% part cannot hold an on-fill label.
        size="md"
        focus={focus}
      />
    </ChartCard>
  )
}

// ── 4. Log x, dot and ring swatches, direct labels ──────────────────────────────────────────────

type Model = { name: string; price: number; quality: number; frontier: boolean }

const MODELS: readonly Model[] = [
  { name: 'Nano', price: 0.12, quality: 41, frontier: true },
  { name: 'Mini', price: 0.6, quality: 62, frontier: true },
  { name: 'Standard', price: 3, quality: 78, frontier: true },
  { name: 'Max', price: 40, quality: 91, frontier: true },
  { name: 'Legacy S', price: 1.5, quality: 52, frontier: false },
  { name: 'Legacy L', price: 12, quality: 70, frontier: false },
  { name: 'Preview', price: 25, quality: 74, frontier: false },
]
const DOT_R = VX.dotR

// #region example:chartLabels
/** Direct labels as `text` marks: placed in plot pixels, drawn at each dot with a pixel offset. */
function labelMarks(plot: PlotContext<Model, number>) {
  const [lo, hi] = plot.yDomain
  const rows = plot.visible.flatMap((s) => plot.rows(s.key)).filter((r) => r.y !== null)
  const anchors = rows.map((r) => ({
    x: (plot.xFraction(r.x) ?? 0) * plot.plotWidth,
    y: ((hi - (r.y ?? lo)) / (hi - lo)) * plot.plotHeight,
  }))
  const { placed } = chartLabels.place(
    rows.map((r, i) => ({
      key: r.datum.name,
      text: r.datum.name,
      x: anchors[i]?.x ?? 0,
      y: anchors[i]?.y ?? 0,
      priority: r.datum.frontier ? 1 : 0,
    })),
    { width: plot.plotWidth, height: plot.plotHeight },
    {
      gap: DOT_R + 2,
      obstacles: anchors.map((a) => ({
        left: a.x - DOT_R,
        top: a.y - DOT_R,
        width: 2 * DOT_R,
        height: 2 * DOT_R,
      })),
    },
  )
  const byName = new Map(placed.map((l) => [l.key, l]))
  const offset = (r: PlotRow<Model, number>, axis: 'x' | 'y'): number => {
    const label = byName.get(r.datum.name)
    const anchor = anchors[rows.indexOf(r)]
    if (label === undefined || anchor === undefined) return 0
    return axis === 'x' ? label.textX - anchor.x : label.baselineY - anchor.y
  }
  return text(
    rows.filter((r) => byName.has(r.datum.name)),
    {
      id: 'model-labels',
      x: 'x',
      y: 'y',
      text: (r: PlotRow<Model, number>) => r.datum.name,
      anchor: (r: PlotRow<Model, number>) => byName.get(r.datum.name)?.textAnchor ?? 'start',
      dx: (r: PlotRow<Model, number>) => offset(r, 'x'),
      dy: (r: PlotRow<Model, number>) => offset(r, 'y'),
      fill: VX.muted,
      fontSize: VX.text.micro,
    },
  )
}
// #endregion

function scatterMarks(plot: PlotContext<Model, number>) {
  const frontier = plot.rows('frontier').filter((r) => r.y !== null)
  const beaten = plot.rows('beaten').filter((r) => r.y !== null)
  return [
    dot(frontier, { id: 'frontier', x: 'x', y: 'y', r: DOT_R, fill: demoColors.signups }),
    dot(beaten, {
      id: 'beaten',
      x: 'x',
      y: 'y',
      r: DOT_R,
      fill: 'none',
      stroke: demoColors.churn,
      strokeWidth: 2,
    }),
    labelMarks(plot),
  ]
}

function PriceQuality() {
  return (
    <ChartCard title="Price and quality" subtitle="Frontier models filled, beaten models hollow">
      <CartesianChart<Model, number>
        data={MODELS}
        ariaLabel="Quality against price per million tokens on a log scale, seven models"
        x={(m) => m.price}
        formatX={(v) => `$${v}`}
        xScale="log"
        xDomain={[0.1, 100]}
        xTitle="Price per 1M tokens"
        y={{ title: 'Quality score', domain: [30, 100] }}
        series={[
          {
            key: 'frontier',
            label: 'Frontier',
            color: demoColors.signups,
            mark: 'dot',
            getValue: (m) => (m.frontier ? m.quality : null),
          },
          {
            key: 'beaten',
            label: 'Beaten',
            color: demoColors.churn,
            mark: 'ring',
            getValue: (m) => (m.frontier ? null : m.quality),
          },
        ]}
        marks={scatterMarks}
      />
    </ChartCard>
  )
}

// ── 5. The seam-bar recipe ──────────────────────────────────────────────────────────────────────

const BAR_TRACK = 480
const BAR_PARTS: readonly Part[] = CONTEXT_PARTS.map((p) => ({
  label: p.label,
  value: p.value,
  color: p.color ?? VX.neutral,
}))

function SeamBarCard() {
  return (
    <ChartCard
      title="Context window, hand-drawn"
      subtitle="The seam-bar recipe: HTML parts, one focus"
    >
      <SeamBar parts={BAR_PARTS} track={BAR_TRACK} />
    </ChartCard>
  )
}

export function SeamSection() {
  return (
    <Section
      title="Geometry seam"
      subtitle="One focused datum for the marks, the card fact and the live region; axis gaps and direct labels."
    >
      <Stack gap="sm">
        <SimpleGrid type="container" cols={GRID_COLS}>
          <PipelinePace />
          <FailureHeatmap />
          <ContextMeter />
          <SeamBarCard />
        </SimpleGrid>
        <PriceQuality />
      </Stack>
    </Section>
  )
}
