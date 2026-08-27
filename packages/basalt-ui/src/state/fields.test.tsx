/**
 * `createLocalStore` — the router-free lane of the store family.
 *
 * Rendered with NO `RouterProvider` on purpose: the local lane must not touch
 * `@tanstack/react-router`, because that is the whole difference between it and `createSearchStore`
 * (argo's five in-chart `useState` selects, linewatch's compact toggle). A router hook would throw
 * here, so these tests are the proof, not a claim.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { createLocalStore, field } from './fields'

function storedRecord(key: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(`basalt:${key}`)
  if (raw === null) return null
  return (JSON.parse(raw) as { value: Record<string, unknown> }).value
}

function persist(key: string, record: Record<string, unknown>): void {
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: 1, value: record }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('createLocalStore', () => {
  test('use() reads the mirror, falls back, and writes with no router in sight', () => {
    const store = createLocalStore({
      key: 'l-metric',
      fields: { metric: field.enum(['load', 'volume'], 'load') },
    })

    const { result } = renderHook(() => store.field.metric.use())
    expect(result.current[0]).toBe('load')

    act(() => {
      result.current[1]('volume')
    })
    expect(result.current[0]).toBe('volume')
    expect(storedRecord('l-metric')).toEqual({ metric: 'volume' })
  })

  test('a pre-existing mirror is read on first render', () => {
    const store = createLocalStore({
      key: 'l-restore',
      fields: { view: field.enum(['chart', 'table'], 'chart') },
    })
    persist('l-restore', { view: 'table' })

    const { result } = renderHook(() => store.field.view.use())
    expect(result.current[0]).toBe('table')
  })

  test('an invalid mirror entry decodes to the fallback rather than through it', () => {
    const store = createLocalStore({
      key: 'l-invalid',
      fields: { view: field.enum(['chart', 'table'], 'chart') },
    })
    persist('l-invalid', { view: 'spreadsheet' })

    const { result } = renderHook(() => store.field.view.use())
    expect(result.current[0]).toBe('chart')
  })

  test('every field kind round-trips through the mirror', () => {
    const store = createLocalStore({
      key: 'l-kinds',
      fields: {
        tags: field.multi(['api', 'design', 'guide']),
        range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
        rows: field.number({ fallback: 10, min: 1, max: 50, int: true }),
        compact: field.boolean(false),
        q: field.string(),
      },
    })

    const tags = renderHook(() => store.field.tags.use())
    act(() => {
      tags.result.current[1](['guide', 'api'])
    })
    // Canonical order is enforced on the way back out, not on the way in.
    expect(store.readStored()['tags']).toEqual(['api', 'guide'])

    const range = renderHook(() => store.field.range.use())
    act(() => {
      range.result.current[1]({ preset: 'custom', from: '2026-01-01', to: '2026-02-01' })
    })
    expect(range.result.current[0]).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-02-01',
    })

    const rows = renderHook(() => store.field.rows.use())
    act(() => {
      rows.result.current[1](25)
    })
    expect(rows.result.current[0]).toBe(25)

    const compact = renderHook(() => store.field.compact.use())
    act(() => {
      compact.result.current[1](true)
    })
    expect(compact.result.current[0]).toBe(true)

    const q = renderHook(() => store.field.q.use())
    act(() => {
      q.result.current[1]('sled')
    })
    expect(q.result.current[0]).toBe('sled')

    // One localStorage entry per store, holding every field.
    expect(storedRecord('l-kinds')).toEqual({
      tags: ['guide', 'api'],
      range: { preset: 'custom', from: '2026-01-01', to: '2026-02-01' },
      rows: 25,
      compact: true,
      q: 'sled',
    })
  })

  test('two fields written in the same tick do not clobber each other', () => {
    const store = createLocalStore({
      key: 'l-concurrent',
      fields: {
        view: field.enum(['chart', 'table'], 'chart'),
        compact: field.boolean(false),
      },
    })

    const view = renderHook(() => store.field.view.use())
    const compact = renderHook(() => store.field.compact.use())

    act(() => {
      view.result.current[1]('table')
      compact.result.current[1](true)
    })

    expect(storedRecord('l-concurrent')).toEqual({ view: 'table', compact: true })
  })

  test('readStored is flat and omits a field that has never been written', () => {
    const store = createLocalStore({
      key: 'l-read',
      fields: {
        view: field.enum(['chart', 'table'], 'chart'),
        compact: field.boolean(false),
      },
    })
    persist('l-read', { view: 'table' })

    expect(store.readStored()).toEqual({ view: 'table' })
  })

  test('handles carry the same contract a search store hands a control', () => {
    const store = createLocalStore({
      key: 'l-handle',
      fields: { view: field.enum(['chart', 'table'], 'chart') },
    }).field.view

    expect(store.kind).toBe('enum')
    expect(store.fallback).toBe('chart')
    expect(store.isDefault('chart')).toBe(true)
    expect(store.options).toEqual([
      { value: 'chart', label: 'chart' },
      { value: 'table', label: 'table' },
    ])
  })
})
