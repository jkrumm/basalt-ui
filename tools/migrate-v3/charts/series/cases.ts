// One in/out pair per rewrite row, one flagged case per flag row (docs/v3/concepts/charts-cards-kanban.md
// section 10). A case of kind `flag` is left byte for byte; `rewritten` and `flagged` are the exact counts
// and row ids the report must carry for it.
export type Case = {
  name: string
  kind: 'rewrite' | 'flag'
  rewritten: Record<string, number>
  flagged: string[]
  in: string
  out: string
}

const flagCase = (name: string, flagged: string[], source: string): Case => ({
  name,
  kind: 'flag',
  rewritten: {},
  flagged,
  in: source,
  out: source,
})

export const CASES: Case[] = [
  {
    name: 'sf-format',
    kind: 'rewrite',
    rewritten: { 'sf-format': 2 },
    flagged: [],
    in: `import { Lines } from 'basalt-ui/charts'

const formatValue = (v: number) => String(v)

export const A = () => (
  <Lines
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, getValue: (d) => d.a, formatValue: (v, d) => fmt(v, d) },
      { key: 'b', label: 'B', color: VX.faint, getValue: (d) => d.b, formatValue },
    ]}
  />
)
`,
    out: `import { Lines } from 'basalt-ui/charts'

const formatValue = (v: number) => String(v)

export const A = () => (
  <Lines
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, getValue: (d) => d.a, format: (v, d) => fmt(v, d) },
      { key: 'b', label: 'B', color: VX.faint, getValue: (d) => d.b, format: formatValue },
    ]}
  />
)
`,
  },
  {
    name: 'sf-weight',
    kind: 'rewrite',
    rewritten: { 'sf-weight': 4 },
    flagged: [],
    in: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, getValue: (d) => d.a, strokeWidth: 1 },
      {
        key: 'b',
        label: 'B',
        color: VX.faint,
        getValue: (d) => d.b,
        strokeWidth: 1,
        strokeOpacity: 0.5,
      },
      { key: 'c', label: 'C', color: VX.faint, strokeOpacity: 0.4, getValue: (d) => d.c },
      { key: 'd', label: 'D', color: VX.faint, strokeWidth: 3, getValue: (d) => d.d },
    ]}
  />
)
`,
    out: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, getValue: (d) => d.a, weight: 'quiet' },
      {
        key: 'b',
        label: 'B',
        color: VX.faint,
        getValue: (d) => d.b,
        weight: 'quiet',
      },
      { key: 'c', label: 'C', color: VX.faint, weight: 'quiet', getValue: (d) => d.c },
      { key: 'd', label: 'D', color: VX.faint, weight: 'strong', getValue: (d) => d.d },
    ]}
  />
)
`,
  },
  {
    name: 'sf-dash',
    kind: 'rewrite',
    rewritten: { 'sf-dash': 6 },
    flagged: [],
    in: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, dashed: true },
      { key: 'b', label: 'B', color: VX.accent, dashed: false },
      { key: 'c', label: 'C', color: VX.accent, dash: 'dashed' },
      { key: 'd', label: 'D', color: VX.accent, dash: 'solid' },
      { key: 'e', label: 'E', color: VX.accent, dashed: isRef },
      { key: 'f', label: 'F', color: VX.accent, dash: isRef ? 'dashed' : 'solid' },
    ]}
  />
)
`,
    out: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, dash: true },
      { key: 'b', label: 'B', color: VX.accent },
      { key: 'c', label: 'C', color: VX.accent, dash: true },
      { key: 'd', label: 'D', color: VX.accent },
      { key: 'e', label: 'E', color: VX.accent, dash: isRef },
      { key: 'f', label: 'F', color: VX.accent, dash: isRef },
    ]}
  />
)
`,
  },
  {
    name: 'sf-axis',
    kind: 'rewrite',
    rewritten: { 'sf-axis': 3 },
    flagged: [],
    in: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    data={rows}
    zones={[{ from: 0, to: 10, fill: VX.good, axisSide: 'right' }]}
    refLines={[{ value: 5, color: VX.line, axisSide: 'right' }]}
    series={[{ key: 'a', label: 'A', color: VX.accent, axisSide: 'right' }]}
  />
)
`,
    out: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    data={rows}
    zones={[{ from: 0, to: 10, fill: VX.good, axis: 'right' }]}
    refLines={[{ value: 5, color: VX.line, axis: 'right' }]}
    series={[{ key: 'a', label: 'A', color: VX.accent, axis: 'right' }]}
  />
)
`,
  },
  {
    name: 'sf-opacity',
    kind: 'rewrite',
    rewritten: { 'sf-opacity': 2 },
    flagged: [],
    in: `import { Bars } from 'basalt-ui/charts'

export const A = () => (
  <Bars
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, mark: 'bar', fillOpacity: 0.5 },
      { key: 'b', label: 'B', color: VX.faint, mark: 'bar', fillOpacity: shade },
    ]}
  />
)
`,
    out: `import { Bars } from 'basalt-ui/charts'

export const A = () => (
  <Bars
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, mark: 'bar', opacity: () => 0.5 },
      { key: 'b', label: 'B', color: VX.faint, mark: 'bar', opacity: () => shade },
    ]}
  />
)
`,
  },
  {
    name: 'stacked-area',
    kind: 'rewrite',
    rewritten: { 'stacked-area': 1 },
    flagged: [],
    in: `import { StackedArea } from 'basalt-ui/charts'

export const A = () => (
  <StackedArea
    ariaLabel="Mix"
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, getValue: (d) => d.a },
      { key: 'b', label: 'B', color: VX.faint, getValue: (d) => d.b },
    ]}
  />
)
`,
    out: `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines
    ariaLabel="Mix"
    data={rows}
    series={[
      { key: 'a', label: 'A', color: VX.accent, getValue: (d) => d.a, mark: 'line', stack: 'area', area: 'fade' },
      { key: 'b', label: 'B', color: VX.faint, getValue: (d) => d.b, mark: 'line', stack: 'area', area: 'fade' },
    ]}
  />
)
`,
  },
  {
    name: 'chart-marks',
    kind: 'rewrite',
    rewritten: { 'chart-marks': 2 },
    flagged: [],
    in: `import { CartesianChart } from 'basalt-ui/charts'

export const A = () => (
  <>
    <CartesianChart ariaLabel="A" data={rows} series={series} marks={(plot) => [lineY(plot.rows('a'))]} />
    <CartesianChart ariaLabel="B" data={rows} series={series} marks={drawMarks} />
  </>
)
`,
    out: `import { CartesianChart } from 'basalt-ui/charts'

export const A = () => (
  <>
    <CartesianChart ariaLabel="A" data={rows} series={series} marks={CartesianChart.custom((plot) => [lineY(plot.rows('a'))])} />
    <CartesianChart ariaLabel="B" data={rows} series={series} marks={CartesianChart.custom(drawMarks)} />
  </>
)
`,
  },
  {
    name: 'meter-zones',
    kind: 'rewrite',
    rewritten: { 'meter-zones': 1 },
    flagged: [],
    in: `import { Meter } from 'basalt-ui/charts'

export const A = () => (
  <Meter
    label="Load"
    max={1000}
    value={612}
    zones={[
      { from: 0, to: 300, label: 'Low', tone: 'muted' },
      { from: 300, to: 750, label: 'Optimal', color: 'var(--vx-status-good)' },
      { from: 750, to: 1000, label: 'High', color: VX.status.bad },
    ]}
  />
)
`,
    out: `import { Meter } from 'basalt-ui/charts'

export const A = () => (
  <Meter
    label="Load"
    max={1000}
    value={612}
    zones={[
      { to: 300, tone: 'neutral', label: 'Low' },
      { to: 750, tone: 'good', label: 'Optimal' },
      { to: 1000, tone: 'bad', label: 'High' },
    ]}
  />
)
`,
  },
  {
    name: 'bars-1x',
    kind: 'rewrite',
    rewritten: { 'bars-1x': 1, 'sf-format': 1 },
    flagged: ['series-review'],
    in: `import { Bars } from 'basalt-ui/charts'

export const A = () => (
  <Bars
    data={rows}
    height={240}
    chartId="storage"
    getX={(d) => d.day}
    getValue={readValue}
    formatX={fmtDay}
    xTicks={6}
    positiveBars={[
      { key: 'used', label: 'Used', color: VX.accent, formatValue: fmtBytes },
      { key: 'free', label: 'Free', color: VX.faint },
    ]}
  />
)
`,
    out: `import { Bars } from 'basalt-ui/charts'

export const A = () => (
  <Bars
    data={rows}
    height={240}
    cursor="storage"
    x={{ value: (d) => d.day, format: fmtDay }}
    series={[
      { key: 'used', label: 'Used', color: VX.accent, format: fmtBytes, mark: 'bar', y: (d) => readValue(d, 'used') },
      { key: 'free', label: 'Free', color: VX.faint, mark: 'bar', y: (d) => readValue(d, 'free') },
    ]}
  />
)
`,
  },
  // ---- flag-only rows ----
  flagCase(
    'sf-auto-domain',
    ['sf-auto-domain', 'sf-auto-domain'],
    `import { Lines } from 'basalt-ui/charts'

export const A = () => <Lines data={rows} series={series} y={{ autoMaxFloor: 10, autoPad: 1.2 }} />
`,
  ),
  flagCase(
    'statstrip-statcell',
    ['statstrip-statcell', 'statstrip-statcell'],
    `import { StatStrip, WidgetHeader } from 'basalt-ui'

export const A = () => (
  <>
    <WidgetHeader title="A" />
    <StatStrip cells={cells} />
  </>
)
`,
  ),
  flagCase(
    'deltabadge-polarity',
    ['deltabadge-polarity'],
    `import { DeltaBadge } from 'basalt-ui'

export const A = () => (
  <>
    <DeltaBadge value={3} />
    <DeltaBadge value={3} polarity="up-bad" />
  </>
)
`,
  ),
  flagCase(
    'donut',
    ['donut'],
    `import { Donut } from 'basalt-ui/charts'

export const A = () => <Donut data={slices} ariaLabel="Storage" />
`,
  ),
  flagCase(
    'mirrored-bars',
    ['mirrored-bars'],
    `import { MirroredBars } from 'basalt-ui/charts'

export const A = () => <MirroredBars data={rows} ariaLabel="Up and down" />
`,
  ),
  flagCase(
    'dual-panel',
    ['dual-panel'],
    `import { DualPanel } from 'basalt-ui/charts'

export const A = () => <DualPanel data={rows} ariaLabel="Two panes" />
`,
  ),
  flagCase(
    'chart-curve',
    ['chart-curve'],
    `import { chartCurve } from 'basalt-ui/charts'

export const curve = chartCurve('monotone')
`,
  ),
  flagCase(
    'fold-bands',
    ['fold-bands'],
    `import { foldBands } from 'basalt-ui/charts'

export const folded = foldBands(spans)
`,
  ),
  flagCase(
    'series-review: stroke between 1.5 and 2',
    ['series-review'],
    `import { Lines } from 'basalt-ui/charts'

export const A = () => (
  <Lines data={rows} series={[{ key: 'a', label: 'A', color: VX.accent, strokeWidth: 1.75 }]} />
)
`,
  ),
]
