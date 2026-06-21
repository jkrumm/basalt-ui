/**
 * ./forms — useFormDraft: autosave/restore/clear draft persistence via createPersistedState.
 * Mantine-coupled (reads from UseFormReturnType). Optional peer: @mantine/form.
 *
 * AUTOSAVE NOTE: @mantine/form v9 has no whole-form subscription hook on an existing form
 * instance — `form.watch` is per-path only. The cleanest autosave path is to thread
 * `onValuesChange` through useBasaltForm at creation time (the consumer passes the callback
 * there). useFormDraft therefore exposes an explicit `saveDraft()` that the consumer calls
 * at field blur / form change events. Wire it via useBasaltForm's `onValuesChange` prop for
 * fully-automatic autosave:
 *
 * @example (manual blur-based autosave)
 * const form = useBasaltForm({ initialValues, schema })
 * const { clearDraft, saveDraft } = useFormDraft(form, { key: 'my-form', version: 1 })
 * <TextInput {...field(form, 'name')} onBlur={saveDraft} />
 *
 * @example (automatic via onValuesChange in useBasaltForm — use saveDraft ref pattern)
 * const saveDraftRef = useRef<(() => void) | null>(null)
 * const form = useBasaltForm({ initialValues, schema, onValuesChange: () => saveDraftRef.current?.() })
 * const { clearDraft, saveDraft } = useFormDraft(form, { key: 'my-form', version: 1 })
 * saveDraftRef.current = saveDraft
 * // NOTE: the ref pattern avoids the init-order problem — form is created first, the ref
 * // is populated after useFormDraft runs (hooks run top-to-bottom), so by the time
 * // onValuesChange fires on user interaction the ref is always populated.
 */
import { useEffect, useRef } from 'react'
import type { UseFormReturnType } from '@mantine/form'
import { createPersistedState } from '../state'
import type { StandardSchemaV1 } from '../register'

// ── Types ────────────────────────────────────────────────────────────────────

/** Options for useFormDraft. */
export type UseFormDraftOptions<Values> = {
  /**
   * Stable localStorage key for the draft. Must not change between renders —
   * changing the key recreates the storage instance and loses the draft.
   * Will be stored under `basalt:form:<key>`.
   */
  key: string
  /** Envelope version — increment when the values shape changes to discard stale drafts. */
  version: number
  /** Optional Standard Schema to validate the persisted draft before restoring. */
  schema?: StandardSchemaV1<unknown, Values>
}

/** Return value of useFormDraft. */
export type UseFormDraftReturn = {
  /** True when a draft different from the initial values is persisted. */
  hasDraft: boolean
  /** Persist the current form values to localStorage. Call on blur, onValuesChange, or submit failure. */
  saveDraft: () => void
  /** Clear the persisted draft (call in onSubmit success). */
  clearDraft: () => void
}

// ── useFormDraft ─────────────────────────────────────────────────────────────

/**
 * Autosave/restore/clear-on-submit draft persistence for Mantine forms.
 * Backed by `createPersistedState` (versioned, SSR-safe, cross-tab).
 *
 * MUST-HAVES:
 * - Restores the draft once on mount if a draft is persisted.
 * - `clearDraft()` removes the persisted draft (call in onSubmit success).
 * - `saveDraft()` snapshots current form values (call onBlur or wire into useBasaltForm's `onValuesChange`).
 *
 * AUTOSAVE: @mantine/form has no whole-form change subscription on an existing form.
 * The cleanest path is to pass `saveDraft` to `useBasaltForm({ onValuesChange: () => saveDraft() })`.
 * For forms not created via useBasaltForm, call `saveDraft` manually on blur.
 *
 * @example
 * import * as v from 'valibot'
 * import { useBasaltForm, field, FormErrorSummary, useFormDraft } from 'basalt-ui/forms'
 *
 * const Schema = v.object({ name: v.pipe(v.string(), v.minLength(2)), amount: v.number() })
 * type Values = v.InferOutput<typeof Schema>
 * const INITIAL: Values = { name: '', amount: 0 }
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: INITIAL, schema: Schema, mode: 'uncontrolled' })
 *   const { clearDraft, saveDraft, hasDraft } = useFormDraft(form, { key: 'my-form', version: 1 })
 *   // Wire saveDraft into onValuesChange after form creation via a ref or external callback:
 *   // form is created above; wire via onBlur as the safe fallback shown here.
 *   return (
 *     <form onSubmit={form.onSubmit((values) => { submit(values); clearDraft() })}>
 *       <FormErrorSummary form={form} />
 *       <TextInput {...field(form, 'name')} onBlur={saveDraft} />
 *       {hasDraft && <Button onClick={clearDraft}>Clear draft</Button>}
 *     </form>
 *   )
 * }
 */
export function useFormDraft<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  opts: UseFormDraftOptions<Values>,
): UseFormDraftReturn {
  const { key, version, schema } = opts

  // Create ONE stable store instance per key. useRef + lazy init so it is never
  // recreated on re-render. `key` MUST be stable (document this invariant above).
  // The storage key becomes `basalt:form:<key>` (createPersistedState auto-namespaces `basalt:*`).
  type DraftEnvelope = { values: Values } | null
  const storeRef = useRef<ReturnType<typeof createPersistedState<DraftEnvelope>> | null>(null)
  if (storeRef.current === null) {
    // Wrap the Values schema into a DraftEnvelope schema using the ~standard interface.
    // We validate the inner `values` field so stale/invalid drafts fall back to null.
    // Only created when schema is provided — exactOptionalPropertyTypes forbids `schema: undefined`.
    const envelopeSchema: StandardSchemaV1<unknown, DraftEnvelope> | undefined =
      schema !== undefined
        ? {
            '~standard': {
              version: 1 as const,
              vendor: 'basalt-form-draft',
              validate: (raw: unknown) => {
                if (typeof raw !== 'object' || raw === null || !('values' in raw)) {
                  return { value: null }
                }
                const result = schema['~standard'].validate((raw as { values: unknown }).values)
                if (result instanceof Promise) return { value: null }
                if (result.issues !== undefined) return { value: null }
                return { value: { values: result.value } }
              },
            },
          }
        : undefined

    storeRef.current = createPersistedState<DraftEnvelope>({
      key: `form:${key}`,
      version,
      initial: null,
      ...(envelopeSchema !== undefined && { schema: envelopeSchema }),
    })
  }

  const useDraft = storeRef.current
  const [draft, setDraft] = useDraft()

  // Track whether a draft exists — differs from null initial
  const hasDraft = draft !== null

  // RESTORE: once on mount, if a draft exists, restore it into the form.
  // useEffect runs once (empty dep array); `form` and `draft` captured via ref to avoid
  // re-running on subsequent renders. This is intentionally mount-only.
  const restoredRef = useRef(false)
  const formRef = useRef(form)
  formRef.current = form
  const draftOnMountRef = useRef(draft)

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const mountDraft = draftOnMountRef.current
    if (mountDraft !== null) {
      formRef.current.setValues(mountDraft.values as Partial<Values>)
    }
    // Intentionally empty deps — restore happens once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveDraft = (): void => {
    const values = formRef.current.getValues()
    setDraft({ values })
  }

  const clearDraft = (): void => {
    setDraft(null)
  }

  return { hasDraft, saveDraft, clearDraft }
}
