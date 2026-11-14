// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:dependent-validation
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
// #endregion
