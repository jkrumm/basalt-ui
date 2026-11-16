/**
 * Compile-time proof of the `table` guard, checked by `tsc --noEmit`: a props type that drops a
 * `size` value composites call fails, one that adds a value passes.
 */
import { describe, expect, test } from 'bun:test'
import type { TableProps } from './table'
import { tableVariants } from './table'
import { requires } from './table.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type Size = NonNullable<TableProps['size']>
type WithoutSm = { size?: Exclude<Size, 'sm'> | null | undefined }
type WithRoomy = { size?: Size | 'roomy' | null | undefined }

// @ts-expect-error `size` sm is called but no longer accepted
export const removed: Accepts<WithoutSm> = requires

export const added: Accepts<WithRoomy> = requires

describe('table guard', () => {
  test('every called size value resolves to its row height in the cva table', () => {
    expect(tableVariants({ size: 'md' })).toContain('[--table-row-h:var(--basalt-row-h)]')
    expect(tableVariants({ size: 'sm' })).toContain('[--table-row-h:1.75rem]')
    expect(tableVariants({})).toBe(tableVariants({ size: 'md' }))
    expect(requires({ size: 'sm' })).toEqual({ size: 'sm' })
  })
})
