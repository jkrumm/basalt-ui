/**
 * ChartsPrimitivesPage — the sanctioned hand-rolled path (audit-c-charts.md #16): `ChartFrame`,
 * `useChartCursor`, `autoMargin`, `HoverOverlay`, `Crosshair`, `ChartTooltipFloat` composed
 * directly for a shape no shipped kind covers (a scatter over a categorical x), plus the six
 * escape-hatch primitives/utils that had zero playground coverage — `HatchPattern`, `AreaGradient`,
 * `XZoneRects`, `foldBands`, `deriveLegend`, `deriveTooltipRows` — each exercised at least once.
 */
import { useMemo } from 'react'
import { Group as MGroup, Paper, Stack, Text } from '@mantine/core'
import {
  AreaClosed,
  areaFillUrl,
  AreaGradient,
  autoMargin,
  AxisBottomDate,
  AxisLeftNumeric,
  ChartCard,
  ChartFrame,
  ChartTooltipFloat,
  Crosshair,
  deriveLegend,
  deriveTooltipRows,
  foldBands,
  Group,
  GridRows,
  HatchPattern,
  hatchFill,
  HoverOverlay,
  probeAxisLabels,
  scaleLinear,
  scalePoint,
  SeriesDot,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
  useChartCursor,
  VX,
  XZoneRects,
} from 'basalt-ui/charts'
import type { ChartSeries, SeriesStyle } from 'basalt-ui/charts'

// ── Scatter data: a categorical x, one point absent (a real gap, not a zero) ────────────────────

type ScatterPoint = { key: string; value: number | null }

const SCATTER_DATA: ScatterPoint[] = Array.from({ length: 14 }, (_, i) => ({
  key: `P${i + 1}`,
  value: i === 6 ? null : Math.round(20 + Math.sin(i / 2) * 8 + i * 1.3),
}))

const SCATTER_SERIES: SeriesStyle[] = [
  { key: 'value', label: 'Reading', color: VX.line, mark: 'line' },
]

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')

/** The bespoke scatter plot — the part `ChartFrame` measures around. */
function ScatterPlot({ plot }: { plot: { width: number; height: number } }) {
  const chartId = 'primitives-scatter'
  const measured = useMemo(
    () => SCATTER_DATA.filter((d): d is { key: string; value: number } => d.value !== null),
    [],
  )
  const domain = useMemo<[number, number]>(() => {
    const values = measured.map((d) => d.value)
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo) * 0.15 || 1
    return [Math.max(0, lo - pad), hi + pad]
  }, [measured])

  const yLabels = useMemo(
    () => probeAxisLabels({ domain, ticks: 4, format: fmtInt, nice: true }).labels,
    [domain],
  )
  const xLabelsAll = useMemo(() => SCATTER_DATA.map((d) => d.key), [])
  const margin = useMemo(
    () => autoMargin({ left: yLabels, bottom: xLabelsAll }),
    [yLabels, xLabelsAll],
  )

  const xMax = Math.max(plot.width - margin.left - margin.right, 0)
  const yMax = Math.max(plot.height - margin.top - margin.bottom, 0)

  const xScale = useMemo(
    () =>
      scalePoint<string>({
        domain: SCATTER_DATA.map((d) => d.key),
        range: [0, xMax],
        padding: 0.5,
      }),
    [xMax],
  )
  const yScale = useMemo(
    () => scaleLinear<number>({ domain, range: [yMax, 0], nice: true }),
    [domain, yMax],
  )

  const cursor = useChartCursor<ScatterPoint>({
    data: SCATTER_DATA,
    chartId,
    getKey: (d) => d.key,
    xScale,
    marginLeft: margin.left,
  })

  const point = cursor.point
  const sx = point !== null ? (xScale(point.key) ?? 0) : 0

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <defs>
          <AreaGradient id={`${chartId}-area`} color={VX.line} />
          <HatchPattern id={`${chartId}-hatch`} color={VX.neutral} />
        </defs>
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={xMax} stroke={VX.grid} numTicks={4} />

          {/* XZoneRects — a categorical x-range band, edge-aligned so it covers P5..P8 in full. */}
          <XZoneRects
            zones={[{ from: 'P5', to: 'P8', fill: VX.grid, align: 'edge' }]}
            height={yMax}
            xScale={xScale}
          />

          {/* AreaGradient — a soft fill under the connecting trend line through the measured points. */}
          <AreaClosed<{ key: string; value: number }>
            data={measured}
            x={(d) => xScale(d.key) ?? 0}
            y={(d) => yScale(d.value)}
            yScale={yScale}
            fill={areaFillUrl(`${chartId}-area`)}
          />

          {/* HatchPattern — the absent slot (P7) reads as absence, not a faint measurement. */}
          {(() => {
            const gap = SCATTER_DATA.find((d) => d.value === null)
            if (gap === undefined) return null
            const cx = xScale(gap.key) ?? 0
            const bw = xScale.step() * 0.6
            return (
              <rect
                x={cx - bw / 2}
                y={0}
                width={bw}
                height={yMax}
                fill={hatchFill(`${chartId}-hatch`)}
              />
            )
          })()}

          {measured.map((d) => (
            <circle
              key={d.key}
              cx={xScale(d.key) ?? 0}
              cy={yScale(d.value)}
              r={VX.dotR}
              fill={VX.line}
            />
          ))}

          {point !== null && point.value !== null && (
            <SeriesDot cx={sx} cy={yScale(point.value)} color={VX.line} />
          )}
          {point !== null && <Crosshair x={sx} top={0} bottom={yMax} />}

          <AxisLeftNumeric scale={yScale} numTicks={4} tickFormat={fmtInt} />
          <AxisBottomDate
            scale={xScale}
            top={yMax}
            tickValues={SCATTER_DATA.map((d) => d.key)}
            tickFormat={(k) => k}
          />

          <HoverOverlay
            width={xMax}
            height={yMax}
            onMove={cursor.onPointerMove}
            onLeave={cursor.onPointerLeave}
            onKeyDown={cursor.onKeyDown}
            onBlur={cursor.onBlur}
            valueMax={Math.max(SCATTER_DATA.length - 1, 0)}
            {...(point !== null && { valueNow: SCATTER_DATA.indexOf(point), valueText: point.key })}
            ariaLabel="Scatter reading by point"
          />
        </Group>
      </svg>

      {point !== null && cursor.isSource && (
        <ChartTooltipFloat anchor={cursor.anchor}>
          <TooltipHeader date={point.key} format={(k) => k} />
          <TooltipBody>
            {point.value === null ? (
              <TooltipRow color={VX.neutral} label="Reading" value="not measured" shape="dot" />
            ) : (
              <TooltipRow color={VX.line} label="Reading" value={fmtInt(point.value)} shape="dot" />
            )}
          </TooltipBody>
        </ChartTooltipFloat>
      )}
    </>
  )
}

function ScatterChart() {
  return (
    <ChartFrame
      series={SCATTER_SERIES}
      chartId="primitives-scatter"
      height={260}
      legend={{ toggle: false }}
    >
      {/* theme-allow-file basalt/hand-rolled-plot — a categorical-x scatter is not one of the
          shipped kinds (every kind's mark set is line/bar/area over CartesianChart's plot), so this
          block assembles the plot itself from the SAME primitives every kind composes:
          `ChartFrame`, `autoMargin` + `probeAxisLabels`, `useChartCursor`, `ChartTooltipFloat`. */}
      {(plot) => <ScatterPlot plot={plot} />}
    </ChartFrame>
  )
}

// ── foldBands — width-driven folding, shown as a pure before/after over 40 source rows ──────────

type FoldRow = { key: string; value: number }

const FOLD_SOURCE: FoldRow[] = Array.from({ length: 40 }, (_, i) => ({
  key: `r${i}`,
  value: 10 + ((i * 7) % 23),
}))

function mergeFold(group: FoldRow[]): FoldRow {
  const first = group[0] as FoldRow
  return {
    key: first.key,
    value: Math.round(group.reduce((s, r) => s + r.value, 0) / group.length),
  }
}

function FoldBandsBlock() {
  const folded = useMemo(() => foldBands(FOLD_SOURCE, 8, mergeFold), [])
  return (
    <ChartCard
      title="foldBands"
      subtitle={`${FOLD_SOURCE.length} source rows collapsed to a cap of 8`}
      info="A pure width-driven fold — the same choreography BandStrip/MirroredBars use internally when a strip is narrower than one-band-per-datum. Each drawn band here is the mean of its group."
    >
      <MGroup gap={4} wrap="wrap">
        {folded.map((row) => (
          <Paper key={row.key} px="sm" py="xs" withBorder>
            <Text size="xs" ff="monospace">
              {row.key} → {row.value}
            </Text>
          </Paper>
        ))}
      </MGroup>
    </ChartCard>
  )
}

// ── deriveLegend / deriveTooltipRows — called directly, output rendered as plain rows ───────────

type DerivedPoint = { sessions: number; revenue: number }
const DERIVED_DATUM: DerivedPoint = { sessions: 812, revenue: 4.6 }

const DERIVED_SERIES: ChartSeries<DerivedPoint>[] = [
  {
    key: 'sessions',
    label: 'Sessions',
    color: VX.accent,
    mark: 'line',
    getValue: (d) => d.sessions,
  },
  {
    key: 'revenue',
    label: 'Revenue ×1k',
    color: VX.line2,
    mark: 'bar',
    getValue: (d) => d.revenue,
    formatValue: (v) => `$${v.toFixed(1)}k`,
  },
]

function DeriveBlock() {
  const legend = useMemo(() => deriveLegend(DERIVED_SERIES), [])
  const rows = useMemo(() => deriveTooltipRows(DERIVED_SERIES, DERIVED_DATUM, fmtInt), [])
  return (
    <ChartCard
      title="deriveLegend / deriveTooltipRows"
      subtitle="Called directly against a ChartSeries[] — the same derivation law every kind's legend and tooltip rides on"
      info="deriveLegend(series) below the divider is the raw legend entry list; deriveTooltipRows(series, datum, fallbackFormat) is the raw tooltip row list for one hovered datum — neither wrapped in ChartLegend/TooltipRow's own chrome here, so the derivation itself is what's on screen."
    >
      <Stack gap={4}>
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          deriveLegend
        </Text>
        {legend.map((entry) => (
          <MGroup key={entry.key} gap={6}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: entry.color,
                display: 'inline-block',
              }}
            />
            <Text size="sm">{entry.label}</Text>
          </MGroup>
        ))}
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mt="xs">
          deriveTooltipRows
        </Text>
        {rows.map((row) => (
          <MGroup key={row.key} gap={6}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: row.color,
                display: 'inline-block',
              }}
            />
            <Text size="sm">
              {row.label}: {row.value}
            </Text>
          </MGroup>
        ))}
      </Stack>
    </ChartCard>
  )
}

export function ChartsPrimitivesPage() {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        The escape hatch: every kind on `/charts` composes these same parts. This page shows them
        used directly, for the shapes no shipped kind covers.
      </Text>

      <ChartCard
        title="Scatter over a categorical x"
        subtitle="ChartFrame + useChartCursor + autoMargin + HoverOverlay + Crosshair + ChartTooltipFloat, composed by hand"
        info="P7 is a genuine gap (value: null) — hatched via HatchPattern rather than drawn as a faint zero. P5..P8 carries an XZoneRects band. The trend fills with AreaGradient. Tab into the plot and scrub with ←/→."
      >
        <ScatterChart />
      </ChartCard>

      <FoldBandsBlock />
      <DeriveBlock />
    </Stack>
  )
}
