/**
 * Golden storage fixtures: the envelopes real apps already hold in `localStorage`, synthesized from
 * their stored SHAPES (keys, envelope structure) with neutral values. Reading and re-writing them
 * through `persisted` must not move a byte, or an upgrade resets users' saved preferences.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import type { StorageLike } from './ports'
import { persisted } from './persisted'
import golden from './persisted.golden.json'

type Golden = {
  id: string
  source: 'argo' | 'linewatch' | 'shutterflow'
  key: string
  version: number
  raw: string
  decoded: unknown
}

const cases: readonly Golden[] = golden as Golden[]

function memory(seed: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('persisted — golden fixtures', () => {
  test('every consumer is covered', () => {
    expect(new Set(cases.map((c) => c.source))).toEqual(
      new Set(['argo', 'linewatch', 'shutterflow']),
    )
  })

  test.each(cases)('$id decodes and re-encodes byte-identically', (c) => {
    const storage = memory({ [`basalt:${c.key}`]: c.raw })
    const p = persisted<unknown>(c.key, { version: c.version, initial: null, storage })

    expect(p.get()).toEqual(c.decoded)
    expect(p.isSet()).toBe(true)

    storage.data.delete(`basalt:${c.key}`)
    p.set(c.decoded)
    expect(storage.data.get(`basalt:${c.key}`)).toBe(c.raw)
  })

  test.each(cases)('$id at a stale version is not set', (c) => {
    const key = `stale:${c.key}`
    const storage = memory({ [`basalt:${key}`]: c.raw })
    const p = persisted<unknown>(key, { version: c.version + 1, initial: 'initial', storage })

    expect(p.get()).toBe('initial')
    expect(p.isSet()).toBe(false)
  })

  test('the fixture file holds no address, URL or private-range value', () => {
    const text = readFileSync(join(import.meta.dir, 'persisted.golden.json'), 'utf8')
    for (const forbidden of ['@', 'http', '100.']) expect(text).not.toContain(forbidden)
  })
})
