---
name: chartLabels
use when: 'a page draws its own marks and needs direct labels that never overlap, or needs to know whether a label fits its segment, with the same answer on the server and in the browser.'
never when: 'the chart is a shipped kind (it labels itself), or the label is HTML in normal flow that the browser lays out.'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# chartLabels

Label measuring and direct-label placement for marks a page draws itself (custom
`CartesianChart` marks, a hand-built SVG).

## Signature

```ts
chartLabels: { width, fits, place, axis, row }
```

## Example

```tsx
const { placed } = chartLabels.place(
  points.map((p) => ({ key: p.id, text: p.name, x: p.x, y: p.y, priority: p.weight })),
  { width: 480, height: 240 },
)
placed.map((l) => <text key={l.key} x={l.textX} y={l.baselineY} textAnchor={l.textAnchor}>{l.text}</text>)
```

## Example

`apps/playground/src/recipes/seam-examples.tsx`

```tsx
export function DirectLabels({ points }: { points: readonly Point[] }) {
  const { placed } = chartLabels.place(
    points.map((p) => ({ key: p.id, text: p.name, x: p.x, y: p.y, priority: p.weight })),
    { width: 480, height: 240 },
  )
  return (
    <svg viewBox="0 0 480 240" role="img" aria-label="Labelled points">
      {placed.map((l) => (
        <text key={l.key} x={l.textX} y={l.baselineY} textAnchor={l.textAnchor}>
          {l.text}
        </text>
      ))}
    </svg>
  )
}
```
