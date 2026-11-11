/**
 * Compile-time proof of the `accordion` guard, checked by `tsc --noEmit`: a props type that drops
 * `hiddenUntilFound` or `keepMounted`, which composites call, fails the guard.
 */
import { describe, expect, test } from 'bun:test'
import type { AccordionProps } from './accordion'
import { requires } from './accordion.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type WithoutHidden = { hiddenUntilFound?: undefined; keepMounted?: boolean | undefined }
type WithExtra = Pick<AccordionProps, 'hiddenUntilFound' | 'keepMounted'> & { extra?: boolean }

// @ts-expect-error `hiddenUntilFound` is called but no longer accepted
export const removed: Accepts<WithoutHidden> = requires

export const added: Accepts<WithExtra> = requires

describe('accordion guard', () => {
  test('the called props pass through unchanged', () => {
    expect(requires({ hiddenUntilFound: true, keepMounted: true })).toEqual({
      hiddenUntilFound: true,
      keepMounted: true,
    })
  })
})
