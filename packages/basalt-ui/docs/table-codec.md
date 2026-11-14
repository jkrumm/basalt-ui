---
name: tableCodec
use when: "the table's search, filters, sort and page belong in the URL (a shared or saved view)"
never when: 'the table keeps its own memory (omit `state` on `useDataTable`)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# tableCodec

The URL codec of a table: `field.composite(tableCodec(schema))` makes the whole table state one
route field. The schema comes from `c.codec`, which names columns by id and kind only, so it can
sit at module scope.

## Signature

```ts
tableCodec(schema: TableSchema, options?: TableCodecOptions): TableCodec
  kinds: Readonly<Record<string, CodecKind>>
  defaults: Partial<TableRequest>
  prefix: string
```
