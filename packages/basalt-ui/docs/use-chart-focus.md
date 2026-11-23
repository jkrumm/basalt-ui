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
useChartFocus<D>(settled: readonly D[] | undefined, options: ChartFocusOptions<D>): ChartFocus<D>
```

## Example

`apps/playground/src/recipes/seam-examples.tsx`

```tsx
export function PipelinePace() {
  const focus = useChartFocus(STAGES, { announce: (s) => `${s.name}: ${s.behind} s behind best` })
  return (
    <ChartCard
      title="Pipeline pace"
      subtitle="Seconds behind the best run, per stage"
      figure={{
        value: `${STAGES_TOTAL} s`,
        period: focus.readout('whole run', (s) => `${s.name}: ${s.behind} s`),
      }}
      chart={() => (
        <CartesianChart
          data={STAGES}
          label="Seconds behind the best run for each of five pipeline stages"
          x={{ value: (s) => s.at, format: (at) => STAGES[Number(at) - 1]?.name ?? '' }}
          y={{ title: 'Seconds behind best' }}
          series={[
            { mark: 'dot', key: 'behind', label: 'Behind best', color: PACE, y: (s) => s.behind },
          ]}
          focus={focus}
        />
      )}
    />
  )
}
```
