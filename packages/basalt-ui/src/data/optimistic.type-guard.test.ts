/**
 * Compile-time proof (state-1.19): naming the cached value's type `T` makes `apply` read `prev` as
 * that type, with no cast, and return the same type. Assignment with no cast is the proof for a
 * valid shape, `@ts-expect-error` for an invalid one, both checked by `tsc --noEmit`.
 */
import { describe, expect, test } from 'bun:test'
import { optimistic } from './optimistic'

type Run = { id: string; title: string }

export const typedPrev = optimistic<string, Run>({
  key: ['run', 1],
  targets: [{ queryKey: ['run', 1], apply: (prev, title) => ({ ...prev, title }) }],
})

export const unnamedStaysUnknown = optimistic<string>({
  key: ['run', 1],
  // @ts-expect-error without `T` the cached value is `unknown`: reading a field needs a cast
  targets: [{ queryKey: ['run', 1], apply: (prev, title) => ({ ...prev.id, title }) }],
})

export const wrongReturn = optimistic<string, Run>({
  key: ['run', 1],
  // @ts-expect-error `apply` returns the cached type
  targets: [{ queryKey: ['run', 1], apply: (_prev, title) => title }],
})

describe('optimistic (type-guard)', () => {
  test('is a compile-time fixture: see the @ts-expect-error directives above', () => {
    expect(typedPrev.mutationKey).toEqual(['run', 1])
  })
})
