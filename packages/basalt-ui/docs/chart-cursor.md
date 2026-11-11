---
name: chartCursor
use when: 'app code outside the charts follows or drives the shared cursor (a map timeline, a detail readout)'
never when: 'two charts only need to share a crosshair, which they already do by default (name a group with cursorGroup to isolate one)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# chartCursor

The cursor controller for a group (default `'default'`), for app-side sync: a map timeline that
follows the charts, or drives them. Read it with `useSyncExternalStore`.

## Signature

```ts
chartCursor(group?: string): ChartCursorController
```
