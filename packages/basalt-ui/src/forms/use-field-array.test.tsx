/**
 * `useFieldArray` — the list field over Mantine's four list actions.
 *
 * The interesting assertions are the ones a hand-rolled version gets wrong: `items` has to be read
 * back correctly under the `mode: 'uncontrolled'` default (a `form.values` read would go stale), and
 * `key(index)` has to be per-index unique so two rows never collide in the reconciler.
 *
 * The last test pins the LIMIT rather than a feature: Mantine's list actions do not bump the
 * form-level key generation, so the key is positional and a removal does not rotate it. It is
 * asserted so that a Mantine release changing that is a red test rather than a silent behaviour
 * shift under `useFieldArray`'s documented contract.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { useBasaltForm } from './create-form'
import { useFieldArray } from './use-field-array'

type Contact = { email: string }
type Values = { contacts: Contact[]; nested: { tags: string[] } }

const INITIAL: Values = {
  contacts: [{ email: 'a@b.c' }, { email: 'd@e.f' }],
  nested: { tags: ['x'] },
}

function renderList(path: 'contacts' | 'nested.tags' = 'contacts') {
  return renderHook(() => {
    const form = useBasaltForm<Values>({ initialValues: structuredClone(INITIAL) })
    return { form, list: useFieldArray(form, path) }
  })
}

describe('items', () => {
  test('reads the live list under the uncontrolled default', () => {
    const { result } = renderList()
    expect(result.current.list.items).toEqual([{ email: 'a@b.c' }, { email: 'd@e.f' }])
  })

  test('resolves a dotted path', () => {
    const { result } = renderList('nested.tags')
    expect(result.current.list.items).toEqual(['x'])
  })

  test('a path holding nothing reads as [], not undefined', () => {
    const { result } = renderHook(() => {
      const form = useBasaltForm<Values>({ initialValues: structuredClone(INITIAL) })
      return useFieldArray(form, 'contacts.0.missing')
    })
    expect(result.current.items).toEqual([])
  })

  // The typing already reports "this field is not a list", so the runtime contract is only about
  // what a `.map` at the call site gets. A scalar, an object and a null all read as the empty list
  // rather than as three different ways to throw one frame later.
  test('a path holding a NON-array value reads as [] too', () => {
    const { result } = renderHook(() => {
      const form = useBasaltForm<Values>({ initialValues: structuredClone(INITIAL) })
      return {
        scalar: useFieldArray(form, 'contacts.0.email'),
        object: useFieldArray(form, 'nested'),
        // A path that walks THROUGH a scalar — `readList` has to stop, not read a char index.
        throughScalar: useFieldArray(form, 'contacts.0.email.length'),
      }
    })
    expect(result.current.scalar.items).toEqual([])
    expect(result.current.object.items).toEqual([])
    expect(result.current.throughScalar.items).toEqual([])
  })
})

describe('mutations', () => {
  test('append pushes onto the end and re-renders', () => {
    const { result } = renderList()
    act(() => result.current.list.append({ email: 'g@h.i' }))
    expect(result.current.list.items).toEqual([
      { email: 'a@b.c' },
      { email: 'd@e.f' },
      { email: 'g@h.i' },
    ])
  })

  test('remove drops the item at the index', () => {
    const { result } = renderList()
    act(() => result.current.list.remove(0))
    expect(result.current.list.items).toEqual([{ email: 'd@e.f' }])
  })

  test('move reorders', () => {
    const { result } = renderList()
    act(() => result.current.list.move(0, 1))
    expect(result.current.list.items).toEqual([{ email: 'd@e.f' }, { email: 'a@b.c' }])
  })

  test('the mutations reach the form itself, not a copy', () => {
    const { result } = renderList()
    act(() => result.current.list.append({ email: 'g@h.i' }))
    expect(result.current.form.getValues().contacts).toHaveLength(3)
  })
})

describe('key(index)', () => {
  test('is stable across a re-render that changed nothing', () => {
    const { result, rerender } = renderList()
    const before = result.current.list.key(0)
    rerender()
    expect(result.current.list.key(0)).toBe(before)
  })

  test('is POSITIONAL — a removal moves the item, not the key (the documented limit)', () => {
    const { result } = renderList()
    const before = result.current.list.key(0)
    act(() => result.current.list.remove(0))
    expect(result.current.list.key(0)).toBe(before)
  })

  test('two indices never share a key', () => {
    const { result } = renderList()
    expect(result.current.list.key(0)).not.toBe(result.current.list.key(1))
  })
})
