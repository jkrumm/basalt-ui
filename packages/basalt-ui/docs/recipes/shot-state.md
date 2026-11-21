---
name: shot-state
use-when: a page's empty, loading and error states must be scored by `basalt-ui shot`
---

`basalt-ui shot` reloads each route with `?shot-state=empty`, `loading` or `error` and crops the anchors that declare the state with `data-phase` or `data-shot-states`. A crop equal to the ready crop is `craft-7/states-ignored`.
Pass the query result through `shotState` from `basalt-ui/data` once, in the hook that owns the query; the frame reads the result as its `phase`, as always.
The helper acts only when the shot runner has marked the page, so a production URL that carries the parameter renders what the query returned. It ships in the production bundle on purpose: `shot` renders the built app.
`empty` sets `data` to `[]`; a result that is not a list passes its empty shape: `shotState(result, { empty: { rows: [] } })`.

```tsx
import { useQuery } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'

export function useRuns() {
  const result = shotState(useQuery({ queryKey: ['runs'], queryFn: () => runsApi.list() }))
  return result
}
```
