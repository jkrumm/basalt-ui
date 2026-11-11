/**
 * `externalField` — a plain store and a Zustand-shaped store both drive a `ControlHandle` consumer,
 * and the golden fixture pins the handle's observable shape.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { externalField } from './external-field'
import type { PlainStore, StateStore } from './external-field'
import type { ControlHandle } from './ports'

function plainStore<T>(initial: T): PlainStore<T> & { sets: T[] } {
  let value = initial
  const sets: T[] = []
  const listeners = new Set<() => void>()
  return {
    sets,
    get: () => value,
    set(next) {
      sets.push(next)
      value = next
      for (const l of listeners) l()
    },
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

type Timer = { mode: 'rest' | 'interval'; seconds: number }

/** The Zustand store API, hand-rolled: `getState`, `setState(partial)`, `subscribe((state, prev))`. */
function zustandShaped(initial: Timer): StateStore<Timer> {
  let state = initial
  const listeners = new Set<(s: Timer, prev: Timer) => void>()
  return {
    getState: () => state,
    setState(partial) {
      const prev = state
      state = { ...state, ...partial }
      for (const l of listeners) l(state, prev)
    },
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

/** What a control does with a handle: read through `use()`, write through the setter. */
function consume<T>(handle: ControlHandle<T>) {
  return renderHook(() => handle.use())
}

describe('externalField', () => {
  test('a plain store drives a ControlHandle consumer', () => {
    const store = plainStore<'rest' | 'interval'>('rest')
    const handle = externalField(store, { key: 'timer-mode', kind: 'enum', fallback: 'rest' })
    const { result } = consume(handle)
    expect(result.current[0]).toBe('rest')

    act(() => result.current[1]('interval'))
    expect(result.current[0]).toBe('interval')
    expect(store.get()).toBe('interval')

    act(() => store.set('rest'))
    expect(result.current[0]).toBe('rest')
  })

  test('a Zustand-shaped store drives a ControlHandle consumer', () => {
    const store = zustandShaped({ mode: 'rest', seconds: 30 })
    const handle = externalField(store, {
      key: 'timer-mode',
      kind: 'enum',
      fallback: 'rest' as Timer['mode'],
      select: (s) => s.mode,
      update: (mode) => ({ mode }),
    })
    const { result } = consume(handle)
    expect(result.current[0]).toBe('rest')

    act(() => result.current[1]('interval'))
    expect(result.current[0]).toBe('interval')
    expect(store.getState()).toEqual({ mode: 'interval', seconds: 30 })

    act(() => store.setState({ mode: 'rest' }))
    expect(result.current[0]).toBe('rest')
  })

  test('clear writes the fallback through the store, mounted or not', () => {
    const store = plainStore(5)
    const handle = externalField(store, { key: 'n', kind: 'number', fallback: 1 })
    store.set(5)
    handle.clear()
    expect(store.get()).toBe(1)
  })

  test('isDefault follows the store, with a custom equality', () => {
    const store = plainStore(['a'])
    const handle = externalField(store, {
      key: 'tags',
      kind: 'multi',
      fallback: ['a'],
      equals: (a, b) => a.join() === b.join(),
    })
    expect(handle.isDefault).toBe(true)
    store.set(['a', 'b'])
    expect(handle.isDefault).toBe(false)
  })

  test('a slice update the selector does not see does not re-render', () => {
    const store = zustandShaped({ mode: 'rest', seconds: 30 })
    const handle = externalField(store, {
      key: 'timer-mode',
      kind: 'enum',
      fallback: 'rest' as Timer['mode'],
      select: (s) => s.mode,
      update: (mode) => ({ mode }),
    })
    let renders = 0
    renderHook(() => {
      renders += 1
      return handle.use()
    })
    const before = renders
    act(() => store.setState({ seconds: 31 }))
    expect(renders).toBe(before)
  })

  test('useSource is always own: a memory handle has no lane', () => {
    const handle = externalField(plainStore(true), { key: 'b', kind: 'boolean', fallback: false })
    const { result } = renderHook(() => handle.useSource())
    expect(result.current).toEqual({ source: 'own', inherited: undefined })
  })

  test('a state store without select and update throws, naming the key', () => {
    const store = zustandShaped({ mode: 'rest', seconds: 30 })
    expect(() =>
      (externalField as (s: unknown, o: unknown) => unknown)(store, {
        key: 'broken',
        kind: 'enum',
        fallback: 'rest',
      }),
    ).toThrow('broken')
  })

  test('golden: the handle shape is frozen', () => {
    const fixture = JSON.parse(
      readFileSync(join(import.meta.dir, 'external-field.golden.json'), 'utf8'),
    ) as {
      id: string
      kind: ControlHandle<string>['kind']
      key: string
      fallback: string
      options?: { value: string; label: string }[]
      handle: unknown
    }[]
    for (const row of fixture) {
      const store = plainStore(row.fallback)
      const handle = externalField(store, {
        key: row.key,
        kind: row.kind,
        fallback: row.fallback,
        ...(row.options === undefined ? {} : { options: row.options }),
      })
      expect({
        key: handle.key,
        kind: handle.kind,
        options: handle.options,
        isDefault: handle.isDefault,
        members: Object.keys(handle).toSorted(),
      }).toEqual(row.handle as never)
    }
  })
})
