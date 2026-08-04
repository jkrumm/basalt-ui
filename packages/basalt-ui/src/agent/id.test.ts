/**
 * withPartIds — stamps `${runId}#${n}` onto any draft part arriving without an id; idempotent for
 * drafts that already have one (untouched, and doesn't advance the counter).
 *
 * mintThreadId/mintMessageId — the two id-minting helpers behind every unguarded
 * `crypto.randomUUID()` call site this file's siblings used to have. Both share rungs 1
 * (`crypto.randomUUID`) and 2 (`crypto.getRandomValues`, hand-assembled into a UUIDv4); they
 * deliberately diverge on rung 3 (no crypto at all) — `mintThreadId` degrades, `mintMessageId`
 * throws. See each function's own doc for why.
 */
import { describe, expect, test } from 'bun:test'
import { mintMessageId, mintThreadId, withPartIds } from './id'
import type { AgentPartDraft } from './parts'

async function* gen<T>(values: T[]): AsyncGenerator<T> {
  for (const value of values) yield value
}

async function collect<T>(source: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = []
  for await (const value of source) out.push(value)
  return out
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Rung 2: randomUUID absent, getRandomValues present (a real, non-secure-context host). */
function withRung2Crypto<T>(run: () => T): T {
  const originalCrypto = globalThis.crypto
  Object.defineProperty(globalThis, 'crypto', {
    value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
    configurable: true,
  })
  try {
    return run()
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
  }
}

/** Rung 3: no usable crypto at all. */
function withRung3Crypto<T>(run: () => T): T {
  const originalCrypto = globalThis.crypto
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
  try {
    return run()
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
  }
}

describe('withPartIds', () => {
  test('stamps a sequential id on every draft missing one', async () => {
    // Annotated: all three literals uniformly omit `id`, so without this TS infers an `id`-less
    // element type that has no properties in common with withPartIds' `{ id?: string }`
    // constraint — a weak-type check failure, not a real shape mismatch.
    const drafts: AgentPartDraft[] = [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
      { type: 'text', text: 'c' },
    ]
    const result = await collect(withPartIds('run-1', gen(drafts)))
    expect(result).toEqual([
      { type: 'text', text: 'a', id: 'run-1#0' },
      { type: 'text', text: 'b', id: 'run-1#1' },
      { type: 'text', text: 'c', id: 'run-1#2' },
    ])
  })

  test('leaves a part that already has an id untouched', async () => {
    const drafts = [{ type: 'text', text: 'a', id: 'custom-id' }]
    const result = await collect(withPartIds('run-1', gen(drafts)))
    expect(result).toEqual([{ type: 'text', text: 'a', id: 'custom-id' }])
  })

  test('is idempotent: re-running withPartIds over already-identified parts changes nothing', async () => {
    const drafts: AgentPartDraft[] = [{ type: 'text', text: 'a' }]
    const once = await collect(withPartIds('run-1', gen(drafts)))
    const twice = await collect(withPartIds('run-1', gen(once)))
    expect(twice).toEqual(once)
  })

  test('does not advance the counter for parts that already carry an id', async () => {
    const drafts = [
      { type: 'text', text: 'a', id: 'preset' },
      { type: 'text', text: 'b' },
    ]
    const result = await collect(withPartIds('run-1', gen(drafts)))
    expect(result).toEqual([
      { type: 'text', text: 'a', id: 'preset' },
      { type: 'text', text: 'b', id: 'run-1#0' },
    ])
  })

  test('mixed run: only missing ids are stamped, sequentially among themselves', async () => {
    const drafts = [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b', id: 'preset' },
      { type: 'text', text: 'c' },
    ]
    const result = await collect(withPartIds('run-42', gen(drafts)))
    expect(result).toEqual([
      { type: 'text', text: 'a', id: 'run-42#0' },
      { type: 'text', text: 'b', id: 'preset' },
      { type: 'text', text: 'c', id: 'run-42#1' },
    ])
  })
})

describe('mintThreadId', () => {
  test('rung 1 (crypto.randomUUID): returns a valid UUIDv4 string', () => {
    const id = mintThreadId()
    expect(id).toMatch(UUID_V4_RE)
  })

  test('rung 1: many mints are distinct', () => {
    const ids = Array.from({ length: 1000 }, () => mintThreadId())
    expect(new Set(ids).size).toBe(1000)
  })

  test('rung 2 (getRandomValues only): assembles a valid UUIDv4 — version/variant bits set', () => {
    const id = withRung2Crypto(() => mintThreadId())
    expect(id).toMatch(UUID_V4_RE)
  })

  test('rung 2: many mints are distinct', () => {
    const ids = withRung2Crypto(() => Array.from({ length: 1000 }, () => mintThreadId()))
    expect(new Set(ids).size).toBe(1000)
  })

  test('rung 3 (no usable crypto at all): does NOT throw, still returns distinct non-empty strings', () => {
    const ids = withRung3Crypto(() => Array.from({ length: 50 }, () => mintThreadId()))
    for (const id of ids) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
    // Weak (Date.now() + Math.random()), not cryptographically random — but still distinct across
    // this many mints in one tick, since Math.random() varies even when Date.now() doesn't.
    expect(new Set(ids).size).toBe(50)
  })
})

describe('mintMessageId', () => {
  test('rung 1 (crypto.randomUUID): returns a valid UUIDv4 string', () => {
    const id = mintMessageId()
    expect(id).toMatch(UUID_V4_RE)
  })

  test('rung 1: many mints are distinct', () => {
    const ids = Array.from({ length: 1000 }, () => mintMessageId())
    expect(new Set(ids).size).toBe(1000)
  })

  test('rung 2 (getRandomValues only): assembles a valid UUIDv4 — version/variant bits set', () => {
    const id = withRung2Crypto(() => mintMessageId())
    expect(id).toMatch(UUID_V4_RE)
  })

  test('rung 2: many mints are distinct', () => {
    const ids = withRung2Crypto(() => Array.from({ length: 1000 }, () => mintMessageId()))
    expect(new Set(ids).size).toBe(1000)
  })

  test('rung 3 (no usable crypto at all): THROWS rather than minting a non-random id', () => {
    // Diverges from mintThreadId's rung 3 on purpose — appendMessage's idempotency key must never
    // silently degrade to a non-collision-resistant id. See mintMessageId's own doc.
    expect(() => withRung3Crypto(() => mintMessageId())).toThrow(/idempotency key/)
  })
})
