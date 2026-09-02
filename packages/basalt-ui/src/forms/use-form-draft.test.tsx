/**
 * `useFormDraft`'s autosave — the option that replaced the documented ref dance (audit B §4).
 *
 * The three things worth pinning, because each is a way the subscription silently does nothing:
 *
 *  1. It fires WITHOUT any wiring at the call site. The ref-dance version needed three extra lines
 *     in the component; a regression that reintroduced that requirement would look identical here
 *     except that nothing is persisted.
 *  2. It is DEBOUNCED, not per-keystroke — `form.watch` fires on every `setFieldValue`.
 *  3. It is OFF by default. The existing two-argument signature has to keep behaving exactly as it
 *     did, because every consumer call site is that signature.
 *
 * `debounceMs: 0` throughout: the assertion is "on a later macrotask", not a specific delay, and a
 * real 500ms wait in a unit test is 500ms of nothing.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'bun:test'
import { useBasaltForm } from './create-form'
import { DEFAULT_AUTOSAVE_DEBOUNCE_MS, useFormDraft } from './use-form-draft'
import type { UseFormDraftOptions } from './use-form-draft'

type Values = { name: string; nested: { city: string } }

const INITIAL: Values = { name: '', nested: { city: '' } }

/** `createPersistedState` namespaces to `basalt:*`, and `useFormDraft` prefixes `form:`. */
const storageKey = (key: string) => `basalt:form:${key}`

let counter = 0
function freshKey(): string {
  counter += 1
  return `draft-test-${counter}`
}

function renderDraft(options: Omit<UseFormDraftOptions<Values>, 'key' | 'version'>, key: string) {
  return renderHook(() => {
    const form = useBasaltForm<Values>({ initialValues: structuredClone(INITIAL) })
    return { form, draft: useFormDraft(form, { key, version: 1, ...options }) }
  })
}

/** Let the debounce timer and the resulting state update land. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('autosave', () => {
  test('persists a change with no wiring at the call site', async () => {
    const key = freshKey()
    const { result } = renderDraft({ autosave: { debounceMs: 0 } }, key)
    expect(result.current.draft.hasDraft).toBe(false)

    act(() => result.current.form.setFieldValue('name', 'Ada'))
    await settle()

    expect(result.current.draft.hasDraft).toBe(true)
    expect(localStorage.getItem(storageKey(key))).toContain('Ada')
  })

  test('a nested edit reaches the top-level watcher', async () => {
    const key = freshKey()
    const { result } = renderDraft({ autosave: { debounceMs: 0 } }, key)

    act(() => result.current.form.setFieldValue('nested.city', 'Berlin'))
    await settle()

    expect(localStorage.getItem(storageKey(key))).toContain('Berlin')
  })

  test('is debounced — three keystrokes inside the window write once, with the LAST value', async () => {
    const key = freshKey()
    const { result } = renderDraft({ autosave: { debounceMs: 30 } }, key)

    act(() => {
      result.current.form.setFieldValue('name', 'A')
      result.current.form.setFieldValue('name', 'Ad')
      result.current.form.setFieldValue('name', 'Ada')
    })
    // Nothing yet: the window has not closed.
    expect(localStorage.getItem(storageKey(key))).toBeNull()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
    })
    const stored = localStorage.getItem(storageKey(key))
    expect(stored).toContain('Ada')
    expect(stored).not.toContain('"Ad"')
  })

  test('`autosave: true` uses the default window rather than saving instantly', async () => {
    const key = freshKey()
    const { result } = renderDraft({ autosave: true }, key)
    act(() => result.current.form.setFieldValue('name', 'Ada'))
    await settle()
    expect(localStorage.getItem(storageKey(key))).toBeNull()
  })

  test('is OFF by default — the existing signature is unchanged', async () => {
    const key = freshKey()
    const { result } = renderDraft({}, key)
    act(() => result.current.form.setFieldValue('name', 'Ada'))
    await settle()
    expect(localStorage.getItem(storageKey(key))).toBeNull()

    // …and the manual path still works, which is what a consumer on the old signature relies on.
    act(() => result.current.draft.saveDraft())
    expect(localStorage.getItem(storageKey(key))).toContain('Ada')
  })

  // The two frozen-at-mount properties, asserted rather than merely documented. Both are hook-count
  // consequences of `form.watch` registering a `useEffect` inside itself: a watch set that changed
  // between renders would trip React's hook-order invariant, so it cannot be allowed to.
  test('toggling autosave ON after mount is inert — the watch set is frozen at mount', async () => {
    const key = freshKey()
    const { result, rerender } = renderHook(
      ({ autosave }: { autosave: boolean }) => {
        const form = useBasaltForm<Values>({ initialValues: structuredClone(INITIAL) })
        return { form, draft: useFormDraft(form, { key, version: 1, autosave }) }
      },
      { initialProps: { autosave: false } },
    )

    rerender({ autosave: true })
    act(() => result.current.form.setFieldValue('name', 'Ada'))
    await settle()
    expect(localStorage.getItem(storageKey(key))).toBeNull()

    // …and `saveDraft` is still the documented escape for exactly this case.
    act(() => result.current.draft.saveDraft())
    expect(localStorage.getItem(storageKey(key))).toContain('Ada')
  })

  // The mirror image, and the one that would surprise someone reading `autosave: false` on the
  // page: turning it OFF after mount does not stop the subscription either. `debounceMs` IS read
  // live, so this is also the pin on WHICH half is frozen — the on/off decision and the key set,
  // never the window.
  test('toggling autosave OFF after mount does not stop it — only the window changes', async () => {
    const key = freshKey()
    const { result, rerender } = renderHook(
      ({ autosave }: { autosave: boolean | { debounceMs?: number } }) => {
        const form = useBasaltForm<Values>({ initialValues: structuredClone(INITIAL) })
        return { form, draft: useFormDraft(form, { key, version: 1, autosave }) }
      },
      { initialProps: { autosave: { debounceMs: 0 } as boolean | { debounceMs?: number } } },
    )

    rerender({ autosave: false })
    act(() => result.current.form.setFieldValue('name', 'Ada'))
    // Not on the old 0ms window — `false` resolves to the DEFAULT one, read at fire time.
    await settle()
    expect(localStorage.getItem(storageKey(key))).toBeNull()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_AUTOSAVE_DEBOUNCE_MS + 60))
    })
    expect(localStorage.getItem(storageKey(key))).toContain('Ada')
  })

  test('unmounting mid-window flushes the pending write rather than dropping it', async () => {
    const key = freshKey()
    const { result, unmount } = renderDraft({ autosave: { debounceMs: 30 } }, key)
    act(() => result.current.form.setFieldValue('name', 'Ada'))
    expect(localStorage.getItem(storageKey(key))).toBeNull()

    unmount()
    // The pending window flushed synchronously on cleanup — a closed tab keeps the sentence.
    expect(localStorage.getItem(storageKey(key))).toContain('Ada')
  })

  test('clearDraft wins over a pending autosave window that already fired', async () => {
    const key = freshKey()
    const { result } = renderDraft({ autosave: { debounceMs: 0 } }, key)
    act(() => result.current.form.setFieldValue('name', 'Ada'))
    await settle()

    act(() => result.current.draft.clearDraft())
    expect(result.current.draft.hasDraft).toBe(false)
  })
})

describe('restore', () => {
  test('a persisted draft is restored into the form on mount', () => {
    const key = freshKey()
    localStorage.setItem(
      storageKey(key),
      // `createPersistedState`'s envelope is `{ v, value }` (`state/persisted.ts`).
      JSON.stringify({ v: 1, value: { values: { name: 'Ada', nested: { city: 'Berlin' } } } }),
    )
    const { result } = renderDraft({}, key)
    expect(result.current.form.getValues().name).toBe('Ada')
  })
})
