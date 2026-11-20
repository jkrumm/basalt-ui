---
name: ChartPanes
use when: 'two or three charts share one x inside one `ChartCard` (a price over a momentum line, a score over its drivers)'
never when: 'the charts answer different questions: give each its own `ChartCard` in a `CardGrid`'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: [chart-pane, chart-panes]
---

# ChartPanes

Charts stacked on one x inside one box: each pane takes its share of the box by `weight`, so a
`ChartCard` with two or three panes needs no pixel height per pane or per size class. Each pane's
slot is called with `height: 'fill'`. The panes sit 4 px apart; a shared cursor group, one
`y.gutter` and `x.ticks: []` on every pane but the bottom stay the page's (the two-pane recipe).

## Signature

```ts
ChartPanes({ box, panes }: ChartPanesProps): ReactElement
  box: Box  // The box the group fills: a `ChartCard` slot's own, or `{ height: <px>, phase }` outside a card
  panes: readonly ChartPane[]
```

## Example

```tsx
<ChartCard title="Recovery" height="tall" chart={(box) => (
  <ChartPanes box={box} panes={[
    { weight: 2, chart: (pane) => <Lines height={pane.height} label="Score" ... /> },
    { chart: (pane) => <Lines height={pane.height} label="HRV" ... /> },
  ]} />
)} />
```
