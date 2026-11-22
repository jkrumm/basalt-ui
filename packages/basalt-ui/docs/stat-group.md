---
name: StatGroup
use when: 'a page shows several headline figures side by side, a status bar or a row of KPIs'
never when: 'there is one figure (use a stat card), the figures are bare counts (put them in the footer of the card they belong to) or need a chart each (use chart cards) `flush` is the summary strip of a list page: it sits under the `PageBar` of a fill page, with no card, and every cell carries the line that gives its figure a base. A bare number does not render there (the owner rejected the bare stat strip): a cell with none of `sub`, `delta`, `status`, `meter`, `chart` or `rows` is dropped, with a development warning.'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# StatGroup

A row of `StatCell`s on shared tracks. `strip` draws them on one surface, ruled into cells, for
the status bar of a dashboard; `cards` draws one card each with the headline bands aligned across
them, two to a line in a narrow container. A cell fills the tracks it declares and the rest
collapse, so a loading cell is already its final height. Every cell carries a baseline: a delta
naming its base, a verdict, a meter or a trend; a group of bare numbers warns in development.

## Signature

```ts
StatGroup({ variant, label, children }: StatGroupProps): ReactElement
  variant: "cards" | "strip" | "flush"  // `strip` is one dense surface whose cells share their tracks; `cards` is one card per cell with the bands aligned across them, two to a line when the container is narrow
  label?: string  // Names the group for assistive tech (`Recovery`)
  children: StatCellElement | readonly StatCellElement[]
```

## Example

```tsx
<StatGroup variant="strip" label="Fleet health">
  <StatCell icon={Rocket} label="Deploys" value={164} delta={{ value: '+12%', polarity: 'up-good', label: 'vs prior 7 days' }} chart={perDay} phase={query} />
  <StatCell icon={Clock} label="Median duration" value={174} unit="s" delta={{ value: '-14 s', polarity: 'up-bad', label: 'vs prior 7 days' }} phase={query} />
</StatGroup>
```
