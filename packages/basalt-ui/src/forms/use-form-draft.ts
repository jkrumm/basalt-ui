/**
 * ./forms — useFormDraft: autosave/restore/clear draft persistence via createPersistedState.
 * Mantine-coupled (reads from UseFormReturnType). Optional peer: @mantine/form.
 *
 * AUTOSAVE: `autosave: true` and the hook owns its own subscription. It used to be a documented
 * ref dance — declare a `saveDraftRef`, pass `onValuesChange: () => saveDraftRef.current?.()` into
 * `useBasaltForm`, assign the ref after the hook returns — which was copied verbatim into the
 * playground, and a five-line init-order puzzle a consumer has to re-derive is a hook that has not
 * finished being written. The dance still works; it is no longer the recommended path.
 *
 * @example (automatic)
 * const form = useBasaltForm({ initialValues, schema })
 * const { clearDraft, hasDraft } = useFormDraft(form, { key: 'my-form', version: 1, autosave: true })
 *
 * @example (manual — a blur-only save, or a form not created by useBasaltForm)
 * const { clearDraft, saveDraft } = useFormDraft(form, { key: 'my-form', version: 1 })
 * <TextInput key={fieldKey(form, 'name')} {...inputProps(form, 'name')} onBlur={saveDraft} />
 */
import { useCallback, useEffect, useRef } from 'react'
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
  /**
   * Persist on every value change, debounced. `true` uses {@link DEFAULT_AUTOSAVE_DEBOUNCE_MS};
   * pass `{ debounceMs }` to tune it (`0` saves on the next macrotask).
   *
   * **The on/off decision and the watched key set are read ONCE, on mount.** The subscription is
   * `form.watch` per top-level key, and `watch` calls `useEffect` internally, so both are a hook
   * count and neither may move between renders. Flipping this prop later therefore neither starts
   * nor stops autosaving; a form whose top-level SHAPE changes after mount needs `saveDraft` called
   * by hand for the new keys. `debounceMs` is the exception — it is read at FIRE time, so a form
   * that widens its window mid-edit gets the new one.
   *
   * Nested edits are covered: Mantine notifies a parent-path subscriber for a `a.b.c` change, so
   * watching the top level watches the whole tree.
   */
  autosave?: boolean | { debounceMs?: number }
}

/** Long enough that a typed word is one write, short enough that a closed tab keeps the sentence. */
export const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 500

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
 * - `saveDraft()` snapshots current form values (call onBlur, or leave it to `autosave`).
 * - `autosave: true` subscribes for you — see {@link UseFormDraftOptions.autosave} for the two
 *   properties that are frozen at mount, and why.
 *
 * @example
 * import * as v from 'valibot'
 * import { useBasaltForm, inputProps, fieldKey, FormErrorSummary, useFormDraft } from 'basalt-ui/forms'
 *
 * const Schema = v.object({ name: v.pipe(v.string(), v.minLength(2)), amount: v.number() })
 * type Values = v.InferOutput<typeof Schema>
 * const INITIAL: Values = { name: '', amount: 0 }
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: INITIAL, schema: Schema, mode: 'uncontrolled' })
 *   const { clearDraft, hasDraft } = useFormDraft(form, { key: 'my-form', version: 1, autosave: true })
 *   return (
 *     <form onSubmit={form.onSubmit((values) => { submit(values); clearDraft() })}>
 *       <FormErrorSummary form={form} />
 *       <TextInput key={fieldKey(form, 'name')} {...inputProps(form, 'name')} />
 *       {hasDraft && <Button onClick={clearDraft}>Clear draft</Button>}
 *     </form>
 *   )
 * }
 */
export function useFormDraft<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  opts: UseFormDraftOptions<Values>,
): UseFormDraftReturn {
  const { key, version, schema, autosave } = opts

  // Create ONE stable store instance per key. useRef + lazy init so it is never
  // recreated on re-render. `key` MUST be stable (document this invariant above).
  // The storage key becomes `basalt:form:<key>` (createPersistedState auto-namespaces `basalt:*`).
  const storeRef = useRef<ReturnType<typeof createPersistedState<DraftEnvelope<Values>>> | null>(
    null,
  )
  if (storeRef.current === null) {
    const envelopeSchema = wrapEnvelopeSchema(schema)
    storeRef.current = createPersistedState<DraftEnvelope<Values>>({
      key: `form:${key}`,
      version,
      initial: null,
      // exactOptionalPropertyTypes forbids `schema: undefined`, so it is spread or omitted.
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
  }, [])

  const saveDraft = (): void => {
    const values = formRef.current.getValues()
    setDraft({ values })
  }

  const clearDraft = (): void => {
    setDraft(null)
  }

  useAutosave(form, autosave, saveDraft)

  return { hasDraft, saveDraft, clearDraft }
}

// ── the two pieces the hook composes ─────────────────────────────────────────

/** What `createPersistedState` stores: the values under one key, or nothing persisted at all. */
type DraftEnvelope<Values> = { values: Values } | null

/**
 * Lifts a `Values` schema into a `DraftEnvelope<Values>` one, through the `~standard` interface.
 *
 * Only the inner `values` field is validated, and every failure resolves to `null` rather than to an
 * issue list: a draft is a convenience, so a stale or hand-edited one is DROPPED, never surfaced as
 * a validation error against a form the user has not touched yet. The async arm resolves to `null`
 * for the same reason `useBasaltForm` pins `sync: true` — `createPersistedState` reads storage
 * synchronously and has nowhere to await.
 *
 * Outside the hook because it is pure, closes over nothing, and inside it read as a third
 * responsibility in a body that already owned the store, the restore and the autosave.
 */
function wrapEnvelopeSchema<Values>(
  schema: StandardSchemaV1<unknown, Values> | undefined,
): StandardSchemaV1<unknown, DraftEnvelope<Values>> | undefined {
  if (schema === undefined) return undefined
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'basalt-form-draft',
      validate: (raw: unknown) => {
        if (typeof raw !== 'object' || raw === null || !('values' in raw)) return { value: null }
        const result = schema['~standard'].validate((raw as { values: unknown }).values)
        if (result instanceof Promise) return { value: null }
        if (result.issues !== undefined) return { value: null }
        return { value: { values: result.value } }
      },
    },
  }
}

/**
 * The debounced `form.watch` subscription behind `autosave`.
 *
 * **It relies on `form.watch` calling exactly one `useEffect` per call**, which is why the watched
 * path set is frozen on the first render: `watch` registers that effect INSIDE itself (checked in
 * the installed `@mantine/form` 9.3.2 source, `use-form-watch.ts`), so the number of `watch` calls
 * IS a hook count and a set that changed between renders would trip React's hook-order invariant.
 * Freezing it is what makes the loop below legal.
 *
 * That is a load-bearing dependency on an implementation detail of a peer, so state it plainly: a
 * `@mantine/form` minor that moves `watch` off `useEffect` — or calls a second hook from it —
 * changes the shape of this file. The failure would be loud (a hook-order error in dev on the first
 * autosaving form), not silent, but it is a real upgrade risk and belongs in the upgrade's diff
 * review rather than in a consumer's bug report.
 *
 * Nested edits need no extra paths: Mantine notifies a parent-path subscriber for an `a.b.c` write,
 * so watching every top-level key watches the whole tree.
 */
function useAutosave<Values extends Record<string, unknown>>(
  form: UseFormReturnType<Values>,
  autosave: UseFormDraftOptions<Values>['autosave'],
  saveDraft: () => void,
): void {
  const watchedPathsRef = useRef<string[] | null>(null)
  if (watchedPathsRef.current === null) {
    watchedPathsRef.current =
      autosave === undefined || autosave === false ? [] : Object.keys(form.getValues())
  }

  // Read at FIRE time, not at schedule time, so a window that opened three renders ago still writes
  // the current values and the current debounce.
  const debounceRef = useRef(DEFAULT_AUTOSAVE_DEBOUNCE_MS)
  debounceRef.current =
    typeof autosave === 'object'
      ? (autosave.debounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS)
      : DEFAULT_AUTOSAVE_DEBOUNCE_MS
  // `saveDraft` is a fresh closure each render and `watch`'s effect re-subscribes whenever its
  // callback identity changes, so the callback handed to `watch` must be stable and read the ref.
  const saveRef = useRef<() => void>(saveDraft)
  saveRef.current = saveDraft

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      saveRef.current()
    }, debounceRef.current)
  }, [])

  // An unmount mid-window flushes the pending write rather than dropping it — a closed tab keeps
  // the sentence.
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        saveRef.current()
      }
    },
    [],
  )

  for (const path of watchedPathsRef.current) form.watch(path, scheduleSave)
}
