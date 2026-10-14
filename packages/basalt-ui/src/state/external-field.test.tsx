/**
 * `externalField` — a handle over a value another store owns, rendered with NO router.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'bun:test'
import { StrictMode } from 'react'
import { createExternalStore } from '../../tests/support/external-store'
import { externalField } from './fields'

let store = createExternalStore<'rest' | 'interval'>('rest')
const define = () =>
  externalField({
    values: ['rest', 'interval'],
    fallback: 'rest',
    labels: { rest: 'Rest Timer', interval: 'Interval Timer' },
    store,
  })

beforeEach(() => {
  localStorage.clear()
  store = createExternalStore<'rest' | 'interval'>('rest')
})

describe('externalField', () => {
  test('declares kind, fallback and labelled options at definition', () => {
    const handle = define()
    expect(handle.kind).toBe('enum')
    expect(handle.fallback).toBe('rest')
    expect(handle.options).toEqual([
      { value: 'rest', label: 'Rest Timer' },
      { value: 'interval', label: 'Interval Timer' },
    ])
    expect(handle.isDefault('rest')).toBe(true)
    expect(handle.isDefault('interval')).toBe(false)
  })

  test('an unlabelled value shows as itself', () => {
    const handle = externalField({
      values: ['a', 'b'],
      fallback: 'a',
      store: createExternalStore<'a' | 'b'>('a'),
    })
    expect(handle.options.map((o) => o.label)).toEqual(['a', 'b'])
  })

  test('use() reads the external value and re-renders on an external change', () => {
    const handle = define()
    const { result } = renderHook(() => handle.use())
    expect(result.current[0]).toBe('rest')
    act(() => store.set('interval'))
    expect(result.current[0]).toBe('interval')
  })

  test('the setter calls the external setter', () => {
    const handle = define()
    const { result } = renderHook(() => handle.use())
    act(() => result.current[1]('interval'))
    expect(store.sets).toEqual(['interval'])
  })

  test('clear() writes the fallback before any mount', () => {
    store.set('interval')
    define().clear()
    expect(store.get()).toBe('rest')
  })

  test('two controls on one handle stay consistent and clear() reaches both', () => {
    const handle = define()
    const a = renderHook(() => handle.use())
    const b = renderHook(() => handle.use())
    act(() => a.result.current[1]('interval'))
    expect(b.result.current[0]).toBe('interval')
    act(() => handle.clear())
    expect([a.result.current[0], b.result.current[0]]).toEqual(['rest', 'rest'])
  })

  test('a Strict Mode double render changes nothing', () => {
    const handle = define()
    const { result } = renderHook(() => handle.use(), { wrapper: StrictMode })
    act(() => result.current[1]('interval'))
    expect(result.current[0]).toBe('interval')
    expect(store.sets).toEqual(['interval'])
    act(() => handle.clear())
    expect(result.current[0]).toBe('rest')
  })

  test('a fallback outside values is refused at definition and at the type level', () => {
    expect(() =>
      externalField({
        values: ['rest', 'interval'],
        // @ts-expect-error 'resr' is not one of the declared values
        fallback: 'resr',
        store,
      }),
    ).toThrow(/fallback 'resr'/)
  })

  test('writes nothing to localStorage or the URL', () => {
    const before = window.location.href
    const handle = define()
    const { result } = renderHook(() => handle.use())
    act(() => result.current[1]('interval'))
    act(() => handle.clear())
    expect(localStorage.length).toBe(0)
    expect(window.location.href).toBe(before)
  })
})
