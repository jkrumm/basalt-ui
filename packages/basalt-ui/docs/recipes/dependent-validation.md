---
name: dependent-validation
use-when: a form validates with one Standard Schema, with a rule across fields and one field the server decides
file: apps/playground/src/recipes/dependent-validation.tsx
---

Put the schema on `onDynamic` and pair it with `revalidateLogic`: nothing shows before the first submit, then every change revalidates. Never add the same schema on `onSubmit` as well: each error then appears twice.
Errors are issue objects with a `message`; `FormField` reads the first. A rule across fields is a `refine` with a `path`, so it re-runs on every change and lands on the field it names.
The async delta is two options on one field: `onDynamicAsync` and `onDynamicAsyncDebounceMs`. It runs only after the synchronous schema passed, so the server is asked about a title that is already well formed.
`onSubmitAsync: toSubmitErrors(save)` sends a server refusal to the field or to the form footer, and clears it on the next change. `useFormDraft` takes the same schema.

```tsx
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { toSubmitErrors } from 'basalt-ui/controls'
import { z } from 'zod'
import type { RunValues } from './optimistic'

export const RunSchema = z
  .object({
    title: z.string().min(1, 'Give the run a title.'),
    notes: z.string().max(280, 'Keep notes under 280 characters.'),
    km: z.number('Enter a distance.').min(0.1, 'At least 0.1 km.').max(100, 'At most 100 km.'),
    kind: z.enum(['easy', 'tempo', 'long']),
    intervals: z.number().int().min(0).max(20),
    shoes: z.string(),
  })
  // A rule across fields lives in the schema: it re-runs on every change after the first submit.
  .refine((run) => run.kind !== 'tempo' || run.intervals > 0, {
    path: ['intervals'],
    error: 'A tempo run needs at least one interval.',
  })

export function useRunForm(o: {
  defaultValues: RunValues
  save: (v: RunValues) => Promise<unknown>
}) {
  return useForm({
    defaultValues: o.defaultValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: RunSchema, onSubmitAsync: toSubmitErrors(o.save) },
  })
}

// The async delta, on one field: it runs only after the schema passed, debounced, once per value.
export const titleFree = (taken: (title: string) => Promise<boolean>) => ({
  onDynamicAsyncDebounceMs: 400,
  onDynamicAsync: async ({ value }: { value: string }) =>
    (await taken(value)) ? 'That title is taken.' : undefined,
})
```
