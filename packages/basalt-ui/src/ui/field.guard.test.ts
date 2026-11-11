/**
 * Compile-time proof of the `field` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. `Field` has no cva axes, so
 * the guard pins its props and the table's classes.
 */
import { describe, expect, test } from 'bun:test'
import { fieldVariants, fieldsetVariants, formVariants } from './field'
import { requires } from './field.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type WithoutError = { error?: undefined }
type WithMoreErrors = { error?: string | number | null | undefined }

// @ts-expect-error `error` text is called but no longer accepted
export const removed: Accepts<WithoutError> = requires

export const added: Accepts<WithMoreErrors> = requires

describe('field guard', () => {
  test('every called prop is accepted and the layout tables resolve', () => {
    expect(requires({ label: 'Name', error: 'Required' })).toEqual({
      label: 'Name',
      error: 'Required',
    })
    expect(fieldVariants()).toContain('flex-col')
    expect(fieldsetVariants()).toContain('flex-col')
    expect(formVariants()).toContain('flex-col')
  })
})
