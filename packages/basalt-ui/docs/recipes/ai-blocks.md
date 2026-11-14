---
name: ai-blocks
use-when: a model may show a stat, chart, table, callout, list or layout in the chat, as typed blocks that stay on-brand
file: apps/playground/src/recipes/ai-blocks.tsx
---

Copy this file and `ai-blocks-schemas.ts` (each block's `name`, `description`, zod `props`, `sample` and loading height; no UI import, so a server takes it alone). `validate` runs inside `Block`: URL, size and depth checks come before any render.
Test it with `expectCatalog(catalog)` from `basalt-ui/testing`. A block is a composite plus its phase; `reserve` is for a layout that composes several.

```tsx
import { defineBlock, defineCatalog } from 'basalt-ui/ai'
import { BarList, DataPanel, StatCard } from 'basalt-ui/cards'
import { Bars, ChartCard } from 'basalt-ui/charts'
import { Callout } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { VX } from 'basalt-ui/tokens'
import * as s from './ai-blocks-schemas'

const c = col<s.Row>()
const columns = [c.entity('name'), c.text('status'), c.number('value')]
const bars = [{ key: 'v', label: 'Value', color: VX.accent, getValue: (d: s.Point) => d.value }]

function Rows({ data }: { data: s.Row[] }) {
  const mode = { kind: 'client' } as const
  const t = useDataTable({ id: 'r', label: 'Rows', columns, data, mode, getRowId: (r) => r.name })
  return <DataTable table={t} height="fill" />
}

export const catalog = defineCatalog([
  defineBlock({ ...s.stat, render: (p) => <StatCard title={p.label} value={p.value} /> }),
  defineBlock({
    ...s.chart,
    render: (p) => (
      <ChartCard title={p.title}>
        <Bars data={p.points} ariaLabel={p.title} x={(d) => d.label} bars={bars} />
      </ChartCard>
    ),
  }),
  defineBlock({
    ...s.table,
    render: (p) => (
      <DataPanel title={p.title} skeleton={{ rows: 4 }} body={() => <Rows data={p.rows} />} />
    ),
  }),
  defineBlock({ ...s.callout, render: (p) => <Callout kind={p.kind}>{p.text}</Callout> }),
  defineBlock({ ...s.list, render: (p) => <BarList title={p.title} items={p.items} /> }),
  defineBlock({
    ...s.layout,
    render: (p) => (
      <div className="grid grid-cols-2 gap-4">
        {p.items.map((spec, i) => (
          <catalog.Block key={i} spec={spec} phase="ready" />
        ))}
      </div>
    ),
  }),
])
```
