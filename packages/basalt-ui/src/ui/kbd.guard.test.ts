/**
 * Compile-time proof of the `kbd` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting the key string fails, one that accepts more passes. The module has no cva axes, so the
 * guard pins its prop and the table's classes.
 */
import { describe, expect, test } from 'bun:test'
import { kbdVariants } from './kbd'
import { requires } from './kbd.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type OnlyMod = { children: 'Mod' }
type StringOrNumber = { children: string | number }

// @ts-expect-error any key string is called but only `Mod` is accepted
export const removed: Accepts<OnlyMod> = requires

export const added: Accepts<StringOrNumber> = requires

describe('kbd guard', () => {
  test('the key is accepted and the table resolves', () => {
    expect(requires({ children: 'K' })).toEqual({ children: 'K' })
    expect(kbdVariants()).toContain('border-border')
  })
})
