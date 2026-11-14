---
name: optimistic
use-when: a save should show its result in the cached record before the server answers, and undo itself when the server refuses
file: apps/playground/src/recipes/optimistic.tsx
---

Spread `optimistic` into `useMutation`: it returns the `mutationKey` and `scope` with the handlers, so overlapping saves run one after the other and only the last settle invalidates.
`onMutate` cancels the record's queries, snapshots it and writes `apply(prev, values)`. `onError` restores the snapshot, and an entry with no cached data is skipped.
Pass the handlers to `useMutation`, never to `mutate()`: a per-call callback does not run for a mutation that was superseded.
The component reads the same query key, so a page title or a list row changes at submit and moves back if the save throws. A form submits through `mutateAsync` so `toSubmitErrors` can map the thrown error.

```tsx
import { useMutation } from '@tanstack/react-query'
import { optimistic } from 'basalt-ui/data'

export function useSaveRun(id: string) {
  return useMutation({
    mutationFn: (values: RunValues) => runsApi.save(values),
    ...optimistic<RunValues>({
      key: runKey(id),
      targets: [
        { queryKey: runKey(id), apply: (prev, values) => ({ ...(prev as Run), ...values }) },
      ],
    }),
  })
}
```
