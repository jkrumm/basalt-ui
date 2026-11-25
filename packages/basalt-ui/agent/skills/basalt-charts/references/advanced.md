# Advanced chart options

Read this before a chart needs a second scale, a color that carries a value, events on its time axis, a rich tooltip, or a window over a long history. Every prop is in `node_modules/basalt-ui/docs/cartesian-chart.md`, `waterfall.md` and `range-navigator.md`.

## Axes and color

- `y2` configures the right axis the `axis: 'right'` series read: its own `domain`, `format`, `title` and `scale: 'log'`. A price over years sits on a log right axis beside a 0 to 100 score on the left. A bar or an area on a log axis throws in a dev build.
- `colorBy: { value, domain, label }` on a line colors its stroke point by point through the status ramp: the low end good, the middle warn, the high end bad (`ramp: 'bad-good'` reverses it). The legend draws the ramp with its two ends and the tooltip names the reading. Use it when the second value is a verdict on the first (a cycle score on a price), never for a third series.
- `extremes: true` names the highest and the lowest drawn point of a line with their values. Use it on the line that answers, once per chart.

## Events

`events: [{ at, label, note? }]` draws a dashed rule with its caption, a dot on the x axis line, and a tooltip row while the cursor is on the datum nearest it. Use it for dated causes (a release, a halving, a policy change), never for a threshold (a `refLines` entry) or a span (a zone with `axis: 'x'`).

## Rich tooltip

The rows stay data. `tooltip.change: 'start' | 'previous'` gives every series row its signed change since the first drawn value or the datum before. A series' `compare: { label, y }` adds a muted reference reading under its row, its `status: (v, d) => Verdict` a tone and a word. `tooltip.follow: true` on two charts that share a cursor paints the readout in both while either is hovered: use it for charts read together (load and heart rate on the same days), in separate cards or one card's `panes`.

## Waterfall

`<Waterfall data step value start total />` floats each signed step on the running total, rises in the good tone and falls in the bad one (`polarity: 'up-bad'` for a cost), labels every bar and reads the running total in its tooltip. `ticks="all"` names every step on the axis: keep the names short.

## A window over a long history

The window is a `field.range({ presets, custom: true })` handle; each preset is a span in days back from the last datum.

```tsx
const SPANS = { '6m': 182, '1y': 365, all: 'all' } as const
const [range] = store.field.window.use()
const view = RangeNavigator.window(rows, (d) => d.t, range, SPANS)
<ChartCard panes={[
  { weight: 3, chart: () => <CartesianChart data={view.data} x={{ value: (d) => d.t, domain: view.domain }} height="fill" … /> },
  { chart: () => <RangeNavigator label="History" data={rows} x={(d) => d.t} y={(d) => d.price}
      color={series.price} window={store.field.window} spans={SPANS} height="fill" /> },
]} … />
```

The navigator draws the presets row (labelled by the field's `.labels()`) and the brush; a brush commit writes `custom` with two ISO days, so the URL, the presets and the brush are one state. Pass `presets={false}` when the presets already sit in a control home.
