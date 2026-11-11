/**
 * Compile-time proof of the `collapsible` guard, checked by `tsc --noEmit`: a props type that drops
 * `hiddenUntilFound` or `keepMounted`, which composites call, fails the guard.
 */
import { describe, expect, test } from 'bun:test'
import type { CollapsibleContentProps } from './collapsible'
import { requires } from './collapsible.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Both = Pick<CollapsibleContentProps, 'hiddenUntilFound' | 'keepMounted'>
type WithoutKeep = { hiddenUntilFound?: boolean | undefined; keepMounted?: undefined }
type WithExtra = Both & { extra?: boolean }

// @ts-expect-error `keepMounted` is called but no longer accepted
export const removed: Accepts<WithoutKeep> = requires

export const added: Accepts<WithExtra> = requires

describe('collapsible guard', () => {
  test('the called props pass through unchanged', () => {
    expect(requires({ hiddenUntilFound: true, keepMounted: true })).toEqual({
      hiddenUntilFound: true,
      keepMounted: true,
    })
  })
})
