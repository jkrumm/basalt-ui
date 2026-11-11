/**
 * Compile-time proof of the `textarea` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. The module has no cva axes,
 * so the guard pins its props and the table's classes.
 */
import { describe, expect, test } from 'bun:test'
import { textareaVariants } from './textarea'
import { requires } from './textarea.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type WithoutRows = {
  value?: string
  defaultValue?: string
  rows?: undefined
  disabled?: boolean
  name?: string
}
type WithMoreRows = { rows?: number | string | undefined }

// @ts-expect-error `rows` is called but no longer accepted
export const removed: Accepts<WithoutRows> = requires

export const added: Accepts<WithMoreRows> = requires

describe('textarea guard', () => {
  test('every called prop is accepted and the table resolves', () => {
    expect(requires({ rows: 4, name: 'note' })).toEqual({ rows: 4, name: 'note' })
    expect(textareaVariants()).toContain('pointer-coarse:min-h-11')
  })
})
