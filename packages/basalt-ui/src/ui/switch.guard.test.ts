/**
 * Compile-time proof of the `switch` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The module has no cva axes,
 * so the guard pins its props and the table's classes.
 */
import { describe, expect, test } from 'bun:test'
import { switchVariants } from './switch'
import { requires } from './switch.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type WithoutName = {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  name?: undefined
}
type WithMoreNames = { checked?: boolean | null | undefined; name?: string | number | undefined }

// @ts-expect-error `name` is called but no longer accepted
export const removed: Accepts<WithoutName> = requires

export const added: Accepts<WithMoreNames> = requires

describe('switch guard', () => {
  test('every called prop is accepted and the table resolves', () => {
    expect(requires({ checked: true, name: 'on' })).toEqual({ checked: true, name: 'on' })
    expect(switchVariants()).toContain('rounded-full')
  })
})
