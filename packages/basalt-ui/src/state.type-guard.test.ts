/**
 * Compile-time proof that `basalt-ui/state`'s barrel no longer re-exports the internal seam
 * `createSearchStore` (`basalt-ui/router-tanstack`) is built on. Each of the eight names below was
 * dropped from `state.ts` in favor of that internal-only seam — a re-export creeping back in must
 * fail `tsc --noEmit`, the same convention `provider/index.type-guard.test.ts` and
 * `controls/actions.type-guard.test.ts` use: one `@ts-expect-error` per bad line.
 */
import { describe, expect, test } from 'bun:test'

// oxlint-disable import/no-duplicates -- one import per line so each `@ts-expect-error` pins exactly one name

// @ts-expect-error `FieldCodec` is an internal seam type, no longer re-exported from './state'
import type { FieldCodec } from './state'
// @ts-expect-error `StoreEntry` is an internal seam type, no longer re-exported from './state'
import type { StoreEntry } from './state'
// @ts-expect-error `StoreCoreOptions` is an internal seam type, no longer re-exported from './state'
import type { StoreCoreOptions } from './state'
// @ts-expect-error `StoreCore` is an internal seam type, no longer re-exported from './state'
import type { StoreCore } from './state'
// @ts-expect-error `FieldUse` is an internal seam type, no longer re-exported from './state'
import type { FieldUse } from './state'
// @ts-expect-error `FieldWrite` is an internal seam type, no longer re-exported from './state'
import type { FieldWrite } from './state'
// @ts-expect-error `resolveFieldCodec` is an internal seam value, no longer re-exported from './state'
import { resolveFieldCodec } from './state'
// @ts-expect-error `createStoreCore` is an internal seam value, no longer re-exported from './state'
import { createStoreCore } from './state'

// Referenced so nothing above is ALSO flagged as an unused import — the type-check failure this
// file proves is the missing export, not an unrelated unused-import diagnostic.
type Guard = [
  FieldCodec,
  StoreEntry,
  StoreCoreOptions,
  StoreCore,
  FieldUse,
  FieldWrite,
  typeof resolveFieldCodec,
  typeof createStoreCore,
]

describe('basalt-ui/state barrel (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    const guard: Guard | undefined = undefined
    expect(guard).toBeUndefined()
  })
})
