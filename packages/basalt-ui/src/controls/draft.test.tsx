/**
 * `useFormDraft`: reload restores, submit clears, `clearOwner` clears, a version bump discards,
 * the owner-null key shape, the 1.x key read once, a schema that rejects a `File` or a password, a
 * never-mounted field survives the autosave tick, array rows restore in order, and S2 (a changed
 * field the form never mounted is still a draft, never a pristine form).
 */
import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FormLike } from '../core/ports'
import { persisted } from '../core/persisted'
import { useFormDraft } from './draft'
import type {
  UseFormDraftOptions as FormDraftOptions,
  UseFormDraftResult as FormDraft,
} from './contract'

type Values = { title: string; other: string; lines: { qty: number }[] }
const defaults: Values = { title: 'server', other: 'x', lines: [{ qty: 1 }] }

type Fake = FormLike<Values> & {
  edit(values: Values): void
  submitState(isSubmitting: boolean): void
}

/** A TanStack-shaped form: `reset` and every edit notify once, `defaultValues` stay put. */
function fakeForm(initial: Values = defaults): Fake {
  let state = { values: initial, isSubmitting: false, canSubmit: true, errors: [] as unknown[] }
  const subs = new Set<() => void>()
  const emit = (): void => subs.forEach((cb) => cb())
  return {
    get state() {
      return state
    },
    options: { defaultValues: defaults },
    store: {
      subscribe(cb) {
        subs.add(cb)
        return { unsubscribe: () => void subs.delete(cb) }
      },
    },
    reset(values) {
      state = { ...state, values }
      emit()
    },
    edit(values) {
      state = { ...state, values }
      emit()
    },
    submitState(isSubmitting) {
      state = { ...state, isSubmitting }
      emit()
    },
  }
}

const schema = {
  '~standard': {
    version: 1 as const,
    vendor: 'test',
    validate(value: unknown) {
      const v = value as Record<string, unknown>
      const ok =
        typeof v === 'object' &&
        v !== null &&
        typeof v['title'] === 'string' &&
        typeof v['other'] === 'string' &&
        Array.isArray(v['lines']) &&
        !('password' in v)
      return ok ? { value: value as Values } : { issues: [{ message: 'rejected' }] }
    },
  },
}

const opts = (over: Partial<FormDraftOptions<Values>> = {}): FormDraftOptions<Values> => ({
  key: 'run-edit:1',
  version: 1,
  schema,
  owner: 'u1',
  ...over,
})

let last: FormDraft
function Host({ form, o }: { form: FormLike<Values>; o: FormDraftOptions<Values> }) {
  const draft = useFormDraft(form, o)
  useEffect(() => {
    last = draft
  })
  return null
}

const draftKey = 'basalt:form:u1:run-edit:1'
const draftOf = (k = draftKey): unknown => {
  const raw = localStorage.getItem(k)
  return raw === null ? null : JSON.parse(raw)
}
const tick = async (ms = 560): Promise<void> => {
  await act(() => new Promise<void>((r) => setTimeout(r, ms)))
}
const changed: Values = {
  title: 'draft',
  other: 'CHANGED',
  lines: [{ qty: 3 }, { qty: 1 }, { qty: 2 }],
}

beforeEach(() => {
  persisted.setStorage({
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
  })
  localStorage.clear()
})
afterEach(cleanup)

describe('useFormDraft', () => {
  test('autosaves on the trailing tick; a reload restores it and defaults stay the server value', async () => {
    const first = fakeForm()
    render(<Host form={first} o={opts()} />)
    act(() => first.edit(changed))
    expect(draftOf()).toBeNull()
    await tick()
    expect(draftOf()).toEqual({ v: 1, value: changed })
    cleanup()

    const second = fakeForm()
    render(<Host form={second} o={opts()} />)
    // Array rows come back in their saved order.
    expect(second.state.values).toEqual(changed)
    expect(second.state.values.lines.map((l) => l.qty)).toEqual([3, 1, 2])
    expect(second.options.defaultValues).toEqual(defaults)
    expect(last.status).toBe('restored')
  })

  test("the restore's own notification is no edit, and a submit-state change is no edit", async () => {
    localStorage.setItem(draftKey, JSON.stringify({ v: 1, value: changed }))
    const form = fakeForm()
    render(<Host form={form} o={opts()} />)
    localStorage.removeItem(draftKey)
    act(() => form.submitState(true))
    await tick()
    expect(draftOf()).toBeNull()
  })

  test('clear() after a submit deletes the key and the unmount flush stays dead', async () => {
    const form = fakeForm()
    const { unmount } = render(<Host form={form} o={opts()} />)
    act(() => form.edit(changed))
    act(() => last.clear())
    unmount()
    await tick()
    expect(draftOf()).toBeNull()
  })

  test('reverting to the server values deletes the key', async () => {
    const form = fakeForm()
    render(<Host form={form} o={opts()} />)
    act(() => form.edit(changed))
    await tick()
    expect(draftOf()).not.toBeNull()
    act(() => form.edit({ ...defaults, lines: [{ qty: 1 }] }))
    await tick()
    expect(draftOf()).toBeNull()
  })

  test('the unmount flushes a pending edit', () => {
    const form = fakeForm()
    const { unmount } = render(<Host form={form} o={opts()} />)
    act(() => form.edit(changed))
    unmount()
    expect(draftOf()).toEqual({ v: 1, value: changed })
  })

  test('a hidden tab flushes', () => {
    const form = fakeForm()
    render(<Host form={form} o={opts()} />)
    act(() => form.edit(changed))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    expect(draftOf()).toEqual({ v: 1, value: changed })
  })

  test('clearOwner clears the draft', () => {
    localStorage.setItem(draftKey, JSON.stringify({ v: 1, value: changed }))
    persisted.clearOwner('u1')
    expect(localStorage.getItem(draftKey)).toBeNull()
  })

  test('a version bump discards the older draft', () => {
    localStorage.setItem('basalt:form:u1:bump', JSON.stringify({ v: 1, value: changed }))
    const form = fakeForm()
    render(<Host form={form} o={opts({ key: 'bump', version: 2 })} />)
    expect(form.state.values).toEqual(defaults)
    expect(last.status).toBe('none')
  })

  test('owner null writes basalt:form:<key>', () => {
    const form = fakeForm()
    const { unmount } = render(<Host form={form} o={opts({ key: 'anon', owner: null })} />)
    act(() => form.edit(changed))
    unmount()
    expect(draftOf('basalt:form:anon')).toEqual({ v: 1, value: changed })
  })

  test('a 1.x basalt:form:<key> is read once and moved to the owner key', () => {
    localStorage.setItem('basalt:form:legacy', JSON.stringify({ v: 1, value: changed }))
    const form = fakeForm()
    render(<Host form={form} o={opts({ key: 'legacy' })} />)
    expect(form.state.values).toEqual(changed)
    expect(draftOf('basalt:form:u1:legacy')).toEqual({ v: 1, value: changed })
    expect(localStorage.getItem('basalt:form:legacy')).toBeNull()
  })

  test('a File (serialised without its shape) and a password are rejected by the schema', () => {
    for (const [k, value] of [
      ['file', { title: 'a', other: 'b', lines: 'not-rows' }],
      ['pw', { ...changed, password: 'hunter2' }],
    ] as const) {
      localStorage.setItem(`basalt:form:u1:${k}`, JSON.stringify({ v: 1, value }))
      const form = fakeForm()
      render(<Host form={form} o={opts({ key: k })} />)
      expect(form.state.values).toEqual(defaults)
      expect(last.status).toBe('none')
      cleanup()
    }
  })

  test('a never-mounted field survives the autosave tick', async () => {
    localStorage.setItem(draftKey, JSON.stringify({ v: 1, value: changed }))
    const form = fakeForm()
    render(<Host form={form} o={opts()} />)
    // Only `title` is edited after the restore; `other` is never touched.
    act(() => form.edit({ ...form.state.values, title: 'again' }))
    await tick()
    expect(draftOf()).toEqual({ v: 1, value: { ...changed, title: 'again' } })
  })

  test('S2: a form whose only difference is a never-mounted field is not pristine', async () => {
    const form = fakeForm({ ...defaults, other: 'CHANGED' })
    render(<Host form={form} o={opts()} />)
    act(() => form.edit({ ...form.state.values }))
    await tick()
    expect(draftOf()).toEqual({ v: 1, value: { ...defaults, other: 'CHANGED' } })
  })
})
