---
name: shotState
use when: 'a page feeds a query result to a frame (`phase`, a chart, a table) and `basalt-ui shot` must score its empty, loading and error states'
never when: 'the page has no query to force, or a state the frame already derives from fixed props'
subpath: basalt-ui/data
peers: ['@tanstack/react-query']
slots: []
---

# shotState

Returns the query result with the phase a shot asked for, else the result itself.

## Signature

```ts
shotState<T extends QueryStateLike & { data?: unknown; }>(result: T, options?: ShotStateOptions): T
```

`QueryStateLike` import from `basalt-ui/cards`: `import type { QueryStateLike } from 'basalt-ui/cards'`.

## Example

```tsx
const result = shotState(useQuery(runsQuery))
return <DataTable phase={result} rows={result.data ?? []} />
```
