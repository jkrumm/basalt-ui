/**
 * `useFormDraft`: a local, per-device draft of an unfinished form. Restores once after mount (the
 * first render stays the server value, so hydration matches), autosaves on a trailing 500 ms, flushes
 * when the tab hides or the form unmounts, and deletes the key once the form is pristine again.
 *
 * Storage is `persisted`'s: the key is `basalt:form:<owner>:<key>` (`basalt:form:<key>` for an owner
 * of `null`) and `persisted.clearOwner(owner)` removes it at logout. A 1.x draft under
 * `basalt:form:<key>` is read once, written to the new key and deleted.
 */
import { useEffect, useRef, useState } from 'react'
import { debounce } from '../core/debounce'
import { isPristine } from '../core/form-dirty'
import { persisted } from '../core/persisted'
import type { PersistedSchema } from '../core/persisted'
import type { FormLike } from '../core/ports'
import type { UseFormDraftOptions, UseFormDraftResult } from './contract'

const AUTOSAVE_MS = 500

const storeKey = (owner: string | null, key: string): string =>
  owner === null ? `form:${key}` : `form:${owner}:${key}`

function draftStore<V>(o: UseFormDraftOptions<V>, key: string) {
  return persisted<V | null>(key, {
    version: o.version,
    initial: null,
    schema: o.schema as unknown as PersistedSchema<V | null>,
  })
}

/**
 * Keeps an unfinished form across a reload. The form's `defaultValues` stay the server value
 * (`keepDefaultValues`), so the form is dirty against the server while a draft is applied.
 *
 * @useWhen a submit-and-leave form with a textarea or more than three fields can be lost to a reload
 * @neverWhen the form is an instant-apply preference (`persisted`) or a settings form with a Save action
 *
 * @example
 * const form = useForm({ defaultValues, validators: { onSubmitAsync: toSubmitErrors(save) } })
 * const draft = useFormDraft(form, { key: `run-edit:${id}`, version: 1, schema: Schema, owner: userId })
 * // after a successful save: draft.clear()
 */
export function useFormDraft<V>(form: FormLike<V>, o: UseFormDraftOptions<V>): UseFormDraftResult {
  const [status, setStatus] = useState<UseFormDraftResult['status']>('none')
  const key = storeKey(o.owner, o.key)
  const store = draftStore(o, key)
  const writer = useRef<ReturnType<typeof debounce<[]>> | null>(null)

  useEffect(() => {
    let draft = store.get()
    if (draft === null && o.owner !== null) {
      // The 1.x key: read once, adopted under the new key, then gone.
      const legacy = draftStore(o, `form:${o.key}`)
      const old = legacy.get()
      if (old !== null) {
        store.set(old)
        draft = store.get()
      }
      legacy.reset()
    }
    if (draft !== null) {
      form.reset(draft, { keepDefaultValues: true })
      setStatus('restored')
    }

    // Subscribed after the restore, so the restore's own notification never reads as an edit.
    let seen: unknown = form.state.values
    const save = debounce(() => {
      // This mount's own form and store: a pending edit must never land under a newer key.
      if (isPristine(form)) store.reset()
      else store.set(form.state.values)
    }, AUTOSAVE_MS)
    writer.current = save
    const subscription = form.store.subscribe(() => {
      // The store also fires for `isSubmitting` and `canSubmit`; only a values change is an edit.
      if (form.state.values === seen) return
      seen = form.state.values
      save.call()
    })
    const flushOnHide = (): void => {
      if (document.visibilityState === 'hidden') save.flush()
    }
    const flush = (): void => save.flush()
    document.addEventListener('visibilitychange', flushOnHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flushOnHide)
      window.removeEventListener('pagehide', flush)
      subscription.unsubscribe()
      save.flush()
      writer.current = null
    }
    // One restore per mounted draft: the key identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    status,
    clear() {
      writer.current?.cancel()
      store.reset()
    },
  }
}
