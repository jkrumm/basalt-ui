---
name: col
use when: 'declaring the columns of a v3 data table: each column is a kind (`entity`, `money`, `status`, ...)'
never when: 'the table is static with no sort, filter, page or selection (use `ui/table`), or a cell needs free markup (`custom` is the one counted escape)'
subpath: basalt-ui/table
peers: ['@base-ui/react', '@tanstack/react-table']
slots: []
---

# col

The column factory, typed by the row. Call it at module scope; it carries `T` and nothing else.

## Signature

```ts
col<T>(): Col<T>
```
