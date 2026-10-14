/**
 * Compile-time proof that `basalt-ui/agent`'s barrel no longer exports `StreamStatus` (MIGRATING.md
 * lists it as deleted) and that the derived spelling consumers are pointed at is the same union.
 * Same convention as `state.type-guard.test.ts`: a re-export creeping back fails `tsc --noEmit`.
 */
import { describe, expect, test } from 'bun:test'
import type { ComponentProps } from 'react'

// oxlint-disable import/no-duplicates -- one import per line so the `@ts-expect-error` pins exactly one name

import type { ThreadFeedRow } from './index'
// @ts-expect-error `StreamStatus` is internal to './thread', no longer exported from the './index' barrel
import type { StreamStatus } from './index'

type Derived = NonNullable<ComponentProps<typeof ThreadFeedRow>['liveStatus']>
type Union = 'idle' | 'submitted' | 'streaming' | 'done' | 'error'
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const derivedIsTheUnion: Equal<Derived, Union> = true

// Referenced so the unresolved import above is the only diagnostic on its line.
type Guard = [StreamStatus]

describe('basalt-ui/agent barrel types', () => {
  test('the derived liveStatus form equals the documented union', () => {
    const guard: Guard | undefined = undefined
    expect(derivedIsTheUnion).toBe(true)
    expect(guard).toBeUndefined()
  })
})
