/**
 * withPartIds — stamps `${runId}#${n}` onto any draft part arriving without an id; idempotent for
 * drafts that already have one (untouched, and doesn't advance the counter).
 */
import { describe, expect, test } from 'bun:test'
import { withPartIds } from './id'

async function* gen<T>(values: T[]): AsyncGenerator<T> {
  for (const value of values) yield value
}

async function collect<T>(source: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = []
  for await (const value of source) out.push(value)
  return out
}

describe('withPartIds', () => {
  test('stamps a sequential id on every draft missing one', async () => {
    const drafts = [
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
    const drafts = [{ type: 'text', text: 'a' }]
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
