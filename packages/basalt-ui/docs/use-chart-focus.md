---
name: useChartFocus
use when: 'a chart, a heat grid, a meter or hand-drawn marks should dim the rest around one datum and drive a readout'
never when: 'only a tooltip is wanted (the hosts draw one already)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# useChartFocus

The focus handle for `items`, in reading order (the order arrow keys step).

## Signature

```ts
useChartFocus<D>(items: readonly D[], options: ChartFocusOptions<D>): ChartFocus<D>
```

## Example

`apps/playground/src/demo/gallery/seam.tsx`

```tsx
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
```
