/**
 * Compile-time proof of the `radio-group` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The module has no cva axes,
 * so the guard pins its props and the tables' classes.
 */
import { describe, expect, test } from 'bun:test'
import { radioGroupVariants, radioVariants } from './radio-group'
import { requiresGroup, requiresRadio } from './radio-group.guard'

type CalledRadio = Parameters<typeof requiresRadio>[0]
type Accepts<P> = (c: CalledRadio) => P

type WithoutDisabled = { value: string; disabled?: undefined }
type WithMoreValues = { value: string | number; disabled?: boolean | undefined }

// @ts-expect-error `disabled` is called but no longer accepted
export const removed: Accepts<WithoutDisabled> = requiresRadio

export const added: Accepts<WithMoreValues> = requiresRadio

describe('radio-group guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requiresGroup({ value: 'a', name: 'plan' })).toEqual({ value: 'a', name: 'plan' })
    expect(requiresRadio({ value: 'a' })).toEqual({ value: 'a' })
    expect(radioGroupVariants()).toContain('flex-col')
    expect(radioVariants()).toContain('after:size-6')
  })
})
