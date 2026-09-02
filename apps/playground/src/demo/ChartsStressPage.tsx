/**
 * ChartsStressPage — the combinations most likely to surface bugs (audit-c-charts.md §3, the
 * top-15 missing-combination list). Every block states in its own `info` what it proves; nothing
 * here is a happy-path repeat of `/charts`.
 */
import { useMemo } from 'react'
import { Box, SimpleGrid, Stack, Text } from '@mantine/core'
import {
  Bars,
  BandStrip,
  ChartCard,
  ChartCursorScope,
  CartesianChart,
  Donut,
  fmtCompact,
  fmtCurrency,
  fmtPercent,
  Heatmap,
  LinePath,
  MultiLine,
  StackedArea,
  VX,
  ZonedLine,
} from 'basalt-ui/charts'
import type { BandSpan, BandStripSeries, ChartSeries, DonutDatum } from 'basalt-ui/charts'
import { createLocalStore, field } from 'basalt-ui/state'
import { ViewTabs } from 'basalt-ui/controls'
import { ACTIVITY_HEATMAP, CHANNEL_MIX, SERIES_DATA } from './data'
import type { DayPoint } from './data'
import { demoColor, demoColors } from './series'

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')

// The page-local axis for block (a) — a view axis, not a URL concern (law C3).
const stressStore = createLocalStore({
  key: 'charts-stress',
  fields: { scale: field.enum(['linear', 'log'], 'linear') },
}).labels({ scale: { linear: 'Linear', log: 'Log' } })

// The page-local axis for block (i) — SeriesStyle.curve, toggled live over one series.
const CURVE_VALUES = ['monotone', 'linear', 'step'] as const

const curveStore = createLocalStore({
  key: 'charts-stress-curve',
  fields: { curve: field.enum(CURVE_VALUES, 'monotone') },
}).labels({ curve: { monotone: 'Monotone', linear: 'Linear', step: 'Step' } })

// The page-local axis for block (k) — the chart layer's own `state` prop, toggled through all
// four branches like every other demo `QueryStateLike` on this page, but with NO `QueryState`
// import: `state` is read directly by `MultiLine`/`CartesianChart` (Mantine-free).
const CHART_STATE_VALUES = ['pending', 'error', 'empty', 'data'] as const

const chartStateStore = createLocalStore({
  key: 'charts-stress-state',
  fields: { variant: field.enum(CHART_STATE_VALUES, 'data') },
}).labels({ variant: { pending: 'Pending', error: 'Error', empty: 'Empty', data: 'Data' } })

// ── (a) Grouped bars + a store-bound y.scale + a legend toggle ──────────────────────────────────

function GroupedLogBarsBlock() {
  const [scale] = stressStore.field.scale.use()
  return (
    <ChartCard
      title="(a) Grouped bars — store-bound scale + legend toggle"
      subtitle="Sessions vs. signups, side by side per day"
      info="Grouped bars honour y.scale: 'log' (each bar reads its own scaled height, so the baseline-at-zero problem stacked bars hit on a log axis doesn't apply here). Toggle the axis, then click a legend entry — the remaining bar re-tiles into the freed slot rather than leaving a hole."
      actions={
        <ViewTabs
          field={stressStore.field.scale}
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'log', label: 'Log' },
          ]}
        />
      }
    >
      <Bars<DayPoint>
        data={SERIES_DATA}
        height={260}
        chartId="stress-grouped-bars"
        getX={(d) => d.date}
        getValue={(d, key) =>
          key === 'sessions' ? d.sessions : key === 'signups' ? d.signups * 10 : null
        }
        positiveBars={[
          { key: 'sessions', label: 'Sessions', color: demoColors.sessions },
          { key: 'signups', label: 'Signups ×10', color: demoColors.signups },
        ]}
        barLayout="grouped"
        y={{ scale, format: fmtInt }}
        legend={{ placement: 'bottom' }}
      />
    </ChartCard>
  )
}

// ── (b) 8+ legend entries at a fixed height, forced into a 1-col grid ───────────────────────────

const EIGHT_COLORS = [
  demoColors.sessions,
  demoColors.signups,
  demoColors.revenue,
  demoColors.churn,
  VX.line,
  VX.line2,
  VX.goodSolid,
  VX.warnSolid,
]

const EIGHT_SERIES: ChartSeries<DayPoint>[] = Array.from({ length: 8 }, (_, i) => ({
  key: `series-${i}`,
  label: `Channel ${String.fromCharCode(65 + i)} — a longish descriptive label`,
  color: EIGHT_COLORS[i] ?? VX.line,
  mark: 'line' as const,
  getValue: (d: DayPoint) => d.sessions * (0.4 + i * 0.15),
}))

function EightLegendBlock() {
  return (
    <ChartCard
      title="(b) 8 legend entries at a fixed height=240, 1-col grid"
      subtitle="The plot-starvation case: a wrapped legend eats a fixed-height chart's plot with no floor"
      info="8 legend entries wrap to several rows at any width narrower than one row can hold. ChartFrame subtracts the wrapped legend band from a FIXED height with no floor — watch the plot shrink as the window narrows."
    >
      <MultiLine<DayPoint>
        data={SERIES_DATA}
        height={240}
        chartId="stress-eight-legend"
        getX={(d) => d.date}
        series={EIGHT_SERIES}
      />
    </ChartCard>
  )
}

// ── (c) fill inside a fixed-height flex column, and aspectRatio ─────────────────────────────────

const FILL_SERIES: ChartSeries<DayPoint>[] = [
  {
    key: 'sessions',
    label: 'Sessions',
    color: demoColors.sessions,
    mark: 'line',
    getValue: (d) => d.sessions,
  },
]

function FillChart({ chartId }: { chartId: string }) {
  return (
    <CartesianChart<DayPoint>
      data={SERIES_DATA}
      chartId={chartId}
      getX={(d) => d.date}
      series={FILL_SERIES}
      y={{ format: fmtInt }}
      fill
      legend={{ placement: 'bottom' }}
    >
      {({ visible, xScale, yScale }) =>
        visible.map((s) => (
          <LinePath<DayPoint>
            key={s.key}
            data={SERIES_DATA}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => yScale(s.getValue(d) ?? 0)}
            stroke={s.color}
            strokeWidth={VX.lineWidth}
          />
        ))
      }
    </CartesianChart>
  )
}

function AspectRatioChart({ chartId }: { chartId: string }) {
  return (
    <CartesianChart<DayPoint>
      data={SERIES_DATA}
      chartId={chartId}
      getX={(d) => d.date}
      series={FILL_SERIES}
      y={{ format: fmtInt }}
      aspectRatio={2.4}
      legend={{ placement: 'bottom' }}
    >
      {({ visible, xScale, yScale }) =>
        visible.map((s) => (
          <LinePath<DayPoint>
            key={s.key}
            data={SERIES_DATA}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => yScale(s.getValue(d) ?? 0)}
            stroke={s.color}
            strokeWidth={VX.lineWidth}
          />
        ))
      }
    </CartesianChart>
  )
}

function SizingModesBlock() {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <ChartCard
        title="(c1) CartesianChart fill, in a fixed-height flex column"
        subtitle="The unexercised sizing mode against the unfloored legend band"
        info="fill makes the chart read its parent's MEASURED height rather than a fixed/derived one. The parent Box below is a fixed-height flex column, so the plot fills exactly that box minus the legend band."
      >
        <Box h={220} style={{ display: 'flex', flexDirection: 'column' }}>
          <FillChart chartId="stress-fill" />
        </Box>
      </ChartCard>

      <ChartCard
        title="(c2) CartesianChart aspectRatio={2.4}"
        subtitle="height = containerWidth / aspectRatio"
        info="No fixed height and no fill — the plot's height is DERIVED from the measured container width, so it changes with the card's width alone."
      >
        <AspectRatioChart chartId="stress-aspect" />
      </ChartCard>
    </SimpleGrid>
  )
}

// ── (d) Two same-domain pairs, one pair scoped ───────────────────────────────────────────────────

const SCOPE_A_SERIES: ChartSeries<DayPoint>[] = [
  {
    key: 'revenue',
    label: 'Revenue',
    color: demoColors.revenue,
    mark: 'line',
    getValue: (d) => d.revenue,
  },
]
const SCOPE_B_SERIES: ChartSeries<DayPoint>[] = [
  { key: 'churn', label: 'Churn', color: demoColors.churn, mark: 'line', getValue: (d) => d.churn },
]

function CursorScopeBlock() {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        (d) Two unrelated same-domain-kind pairs. The first pair shares the page's default cursor
        (hover either and its sibling's crosshair moves too — try it alongside block (b) or (c)
        above, all date-keyed). The second pair is wrapped in <code>ChartCursorScope</code>:
        hovering either of the two below moves only each other, isolated from every other chart on
        the page.
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <ChartCard title="Unscoped — Revenue" subtitle="Shares the page cursor">
          <ZonedLine<DayPoint>
            data={SERIES_DATA}
            height={200}
            chartId="stress-unscoped-a"
            getX={(d) => d.date}
            series={SCOPE_A_SERIES}
          />
        </ChartCard>
        <ChartCard title="Unscoped — Churn" subtitle="Shares the page cursor">
          <ZonedLine<DayPoint>
            data={SERIES_DATA}
            height={200}
            chartId="stress-unscoped-b"
            getX={(d) => d.date}
            series={SCOPE_B_SERIES}
          />
        </ChartCard>
      </SimpleGrid>
      <ChartCursorScope>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <ChartCard title="Scoped — Tenant 1" subtitle="Isolated pair, via ChartCursorScope">
            <ZonedLine<DayPoint>
              data={SERIES_DATA}
              height={200}
              chartId="stress-scoped-a"
              getX={(d) => d.date}
              series={SCOPE_A_SERIES}
            />
          </ChartCard>
          <ChartCard title="Scoped — Tenant 2" subtitle="Isolated pair, via ChartCursorScope">
            <ZonedLine<DayPoint>
              data={SERIES_DATA}
              height={200}
              chartId="stress-scoped-b"
              getX={(d) => d.date}
              series={SCOPE_B_SERIES}
            />
          </ChartCard>
        </SimpleGrid>
      </ChartCursorScope>
    </Stack>
  )
}

// ── (e) MultiLine/ZonedLine with a genuine null gap, beside a BandStrip absentFraction ──────────

type GapPoint = { date: string; value: number | null }

const GAP_DATA: GapPoint[] = SERIES_DATA.map((d, i) => ({
  date: d.date,
  value: i === 6 || i === 7 ? null : d.sessions,
}))

const GAP_LINE_SERIES: ChartSeries<GapPoint>[] = [
  {
    key: 'value',
    label: 'Sessions',
    color: demoColors.sessions,
    mark: 'line',
    getValue: (d) => d.value,
  },
]

const GAP_BAND_SERIES: BandStripSeries<GapPoint>[] = [
  {
    key: 'present',
    label: 'Measured',
    color: demoColors.sessions,
    mark: 'bar',
    formatValue: (d) => fmtInt(d.value ?? 0),
  },
  { key: 'absent', label: 'Not measured', color: VX.neutral, mark: 'bar', fillOpacity: 0.5 },
]

function gapBand(d: GapPoint): BandSpan {
  return d.value === null ? { state: 'absent' } : { state: 'present' }
}

function NullGapBlock() {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <ChartCard
        title="(e1) MultiLine — a genuine null gap"
        subtitle="Mar 07–08 report nothing"
        info="value: null at two consecutive points — a real coverage hole, not a straight interpolation across it and not a zero."
      >
        <MultiLine<GapPoint>
          data={GAP_DATA}
          height={220}
          chartId="stress-gap-line"
          getX={(d) => d.date}
          series={GAP_LINE_SERIES}
        />
      </ChartCard>
      <ChartCard
        title="(e2) BandStrip — the same slots, hatched"
        subtitle="absentState marks the identical Mar 07–08 gap"
        info="Same two slots as the line's gap, on the SAME calendar — the strip's hatch and the line's break describe the same absence two different ways, side by side."
      >
        <BandStrip<GapPoint>
          data={GAP_DATA}
          chartId="stress-gap-strip"
          getX={(d) => d.date}
          series={GAP_BAND_SERIES}
          getBand={gapBand}
          absentState="absent"
          height={110}
          legend={{ toggle: false }}
        />
      </ChartCard>
    </SimpleGrid>
  )
}

// ── (f) A wide formatX, and xLabelRotate={45} ────────────────────────────────────────────────────

const WIDE_LABEL_SERIES: ChartSeries<DayPoint>[] = [
  {
    key: 'sessions',
    label: 'Sessions',
    color: demoColors.sessions,
    mark: 'line',
    getValue: (d) => d.sessions,
  },
]

function WideLabelBlock() {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <ChartCard
        title="(f1) A wide formatX ('Mar 08 14:00' style), no xTickValues"
        subtitle="Narrow the window to phone width to see the overlap"
        info="formatX returns a ~13-character label per tick. smartTicks thins by a fixed px-per-tick constant, not by the FORMATTED label's measured width — a custom formatX like this one is the guaranteed overlap case at narrow widths."
      >
        <ZonedLine<DayPoint>
          data={SERIES_DATA}
          height={220}
          chartId="stress-wide-label"
          getX={(d) => d.date}
          formatX={(key) => `${key} 14:00`}
          series={WIDE_LABEL_SERIES}
        />
      </ChartCard>
      <ChartCard
        title="(f2) xLabelRotate={45}"
        subtitle="The declared escape hatch for the case at left"
        info="Tilts every x tick label 45° — the bottom gutter deepens by the rotated label's measured projection, so this is the chart that should NOT overlap at any width."
      >
        <MultiLine<DayPoint>
          data={SERIES_DATA}
          height={220}
          chartId="stress-rotate"
          getX={(d) => d.date}
          formatX={(key) => `${key} 14:00`}
          xLabelRotate={45}
          series={WIDE_LABEL_SERIES}
        />
      </ChartCard>
    </SimpleGrid>
  )
}

// ── (g) StackedArea with a sparse series ─────────────────────────────────────────────────────────

type SparsePoint = { date: string; a: number; b: number | null; c: number }

const SPARSE_DATA: SparsePoint[] = SERIES_DATA.map((d, i) => ({
  date: d.date,
  a: d.sessions * 0.4,
  b: i > 4 && i < 9 ? null : d.sessions * 0.25,
  c: d.sessions * 0.2,
}))

function SparseStackedAreaBlock() {
  return (
    <ChartCard
      title="(g) StackedArea with a sparse series"
      subtitle="Band 'b' reports nothing for Mar 06–09"
      info="One of three stacked bands goes null for four consecutive days — a stack has no additive zero for an absent band, so this is the honesty case: does the total silently dip by exactly band b's missing share, or does the whole stack gap?"
    >
      <StackedArea<SparsePoint>
        data={SPARSE_DATA}
        height={240}
        chartId="stress-sparse-stack"
        getX={(d) => d.date}
        series={[
          {
            key: 'a',
            label: 'Band A',
            color: demoColors.sessions,
            mark: 'area',
            getValue: (d) => d.a,
          },
          {
            key: 'b',
            label: 'Band B (sparse)',
            color: demoColors.signups,
            mark: 'area',
            getValue: (d) => d.b,
          },
          {
            key: 'c',
            label: 'Band C',
            color: demoColors.revenue,
            mark: 'area',
            getValue: (d) => d.c,
          },
        ]}
        y={{ format: fmtInt }}
      />
    </ChartCard>
  )
}

// ── (h) Donut + Heatmap side by side ─────────────────────────────────────────────────────────────

function DonutHeatmapBlock() {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
      <ChartCard
        title="(h1) Donut"
        subtitle="One of the two ChartFrame-direct kinds — never goes through CartesianChart's margin law"
      >
        <Donut
          data={CHANNEL_MIX as DonutDatum[]}
          height={260}
          colorForKey={demoColor}
          seriesLabel={(k) => CHANNEL_MIX.find((c) => c.key === k)?.label ?? k}
          formatValue={fmtInt}
        />
      </ChartCard>
      <ChartCard title="(h2) Heatmap" subtitle="The other ChartFrame-direct kind">
        <Heatmap
          data={ACTIVITY_HEATMAP}
          height={260}
          chartId="stress-heat"
          getRow={(d) => d.day}
          getCol={(d) => d.hour}
          getValue={(d) => d.sessions}
          color={demoColors.sessions}
          formatValue={(v) => `${v} sessions`}
          legend={{ min: 'quiet', max: 'busy' }}
        />
      </ChartCard>
    </SimpleGrid>
  )
}

// ── (i) SeriesStyle.curve — a store-bound ViewTabs over one series ─────────────────────────────

const CURVE_SERIES_BASE: Omit<ChartSeries<DayPoint>, 'curve'> = {
  key: 'sessions',
  label: 'Sessions',
  color: demoColors.sessions,
  mark: 'line',
  getValue: (d) => d.sessions,
}

function CurveBlock() {
  const [curve] = curveStore.field.curve.use()
  const series = useMemo<ChartSeries<DayPoint>[]>(() => [{ ...CURVE_SERIES_BASE, curve }], [curve])
  return (
    <ChartCard
      title="(i) MultiLine — SeriesStyle.curve"
      subtitle="Monotone / linear / step, over the same series"
      info="curve switches the d3 interpolation between plotted points — monotone is smoothed and overshoot-free, linear is honest for samples, step holds the value between points rather than interpolating through values that never existed."
      actions={
        <ViewTabs
          field={curveStore.field.curve}
          options={[
            { value: 'monotone', label: 'Monotone' },
            { value: 'linear', label: 'Linear' },
            { value: 'step', label: 'Step' },
          ]}
        />
      }
    >
      <MultiLine<DayPoint>
        data={SERIES_DATA}
        height={220}
        chartId="stress-curve"
        getX={(d) => d.date}
        series={series}
      />
    </ChartCard>
  )
}

// ── (j) Number formatters as axis/tooltip format ────────────────────────────────────────────────

function AxisFormatBlock() {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
      <ChartCard
        title="(j1) y.format — fmtCompact"
        subtitle="1.2k / 3.4M — Intl compact notation"
        info="The axis formatter for a count whose range spans several digits — no more hand-rolled `${v}k`."
      >
        <MultiLine<DayPoint>
          data={SERIES_DATA}
          height={180}
          chartId="stress-fmt-compact"
          getX={(d) => d.date}
          y={{ format: (v) => fmtCompact(v) }}
          series={[
            {
              key: 'revenue',
              label: 'Revenue',
              color: demoColors.revenue,
              mark: 'line',
              getValue: (d) => d.revenue * 1000,
            },
          ]}
        />
      </ChartCard>
      <ChartCard
        title="(j2) y.format — fmtPercent"
        subtitle="A ratio, formatted as a percentage"
        info="fmtPercent(value, { input: 'ratio' }) — the axis states what the number MEANS instead of guessing from its magnitude."
      >
        <MultiLine<DayPoint>
          data={SERIES_DATA}
          height={180}
          chartId="stress-fmt-percent"
          getX={(d) => d.date}
          y={{ domain: [0, 1], format: (v) => fmtPercent(v) }}
          series={[
            {
              key: 'churn',
              label: 'Churn',
              color: demoColors.churn,
              mark: 'line',
              getValue: (d) => d.churn / 100,
            },
          ]}
        />
      </ChartCard>
      <ChartCard
        title="(j3) y.format — fmtCurrency"
        subtitle="USD, compact"
        info="fmtCurrency(value, { currency: 'USD', compact: true }) — locale-aware money, one call instead of a template literal per chart."
      >
        <MultiLine<DayPoint>
          data={SERIES_DATA}
          height={180}
          chartId="stress-fmt-currency"
          getX={(d) => d.date}
          y={{ format: (v) => fmtCurrency(v, { currency: 'USD', compact: true }) }}
          series={[
            {
              key: 'revenue',
              label: 'Revenue',
              color: demoColors.revenue,
              mark: 'line',
              getValue: (d) => d.revenue * 1000,
            },
          ]}
        />
      </ChartCard>
    </SimpleGrid>
  )
}

// ── (k) The chart layer's own `state` — ChartPending / ChartError / ChartEmpty ─────────────────

function ChartStateBlock() {
  const [variant] = chartStateStore.field.variant.use()
  return (
    <ChartCard
      title="(k) MultiLine — state"
      subtitle="ChartPending / ChartError / ChartEmpty, via the state prop"
      info="state={{ pending, error, empty }} resolves the chart layer's own three-state placeholder set — no QueryState import, no Mantine: MultiLine and CartesianChart read it directly."
      actions={
        <ViewTabs
          field={chartStateStore.field.variant}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'error', label: 'Error' },
            { value: 'empty', label: 'Empty' },
            { value: 'data', label: 'Data' },
          ]}
        />
      }
    >
      <MultiLine<DayPoint>
        data={SERIES_DATA}
        height={220}
        chartId="stress-state"
        getX={(d) => d.date}
        state={{
          pending: variant === 'pending',
          error: variant === 'error' ? new Error('the sessions index did not answer') : undefined,
          empty: variant === 'empty',
        }}
        series={[
          {
            key: 'sessions',
            label: 'Sessions',
            color: demoColors.sessions,
            mark: 'line',
            getValue: (d) => d.sessions,
          },
        ]}
      />
    </ChartCard>
  )
}

export function ChartsStressPage() {
  const gapCount = useMemo(() => GAP_DATA.filter((d) => d.value === null).length, [])

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        The combinations most likely to surface a bug (audit-c-charts.md's top-15 missing-coverage
        list) rather than a happy-path repeat of <code>/charts</code>. {gapCount} slots are a
        genuine gap in block (e), by construction.
      </Text>
      <GroupedLogBarsBlock />
      <EightLegendBlock />
      <SizingModesBlock />
      <CursorScopeBlock />
      <NullGapBlock />
      <WideLabelBlock />
      <SparseStackedAreaBlock />
      <DonutHeatmapBlock />
      <CurveBlock />
      <AxisFormatBlock />
      <ChartStateBlock />
    </Stack>
  )
}
