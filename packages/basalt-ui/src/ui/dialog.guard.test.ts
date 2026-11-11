/**
 * Compile-time proof of the `dialog` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop composites call fails, one that accepts more passes. A panel without a `title`
 * is a type error (the `untitled` lines in the guard).
 */
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { alertDialogContentVariants, dialogContentVariants } from './dialog'
import type { DialogContentProps } from './dialog'
import { requiresAlertContent, requiresContent, requiresDialog } from './dialog.guard'

type CalledContent = Parameters<typeof requiresContent>[0]
type Accepts<P> = (c: CalledContent) => P

type Size = NonNullable<DialogContentProps['size']>
type WithoutLg = {
  title: ReactNode
  description?: ReactNode
  size?: Exclude<Size, 'lg'> | null | undefined
}
type WithXl = {
  title: ReactNode
  description?: ReactNode
  size?: Size | 'xl' | null | undefined
}

// @ts-expect-error `lg` is called but no longer accepted
export const removed: Accepts<WithoutLg> = requiresContent

export const added: Accepts<WithXl> = requiresContent

describe('dialog guard', () => {
  test('every called size resolves to classes in the cva table and the requires functions pass through', () => {
    const widths = (['sm', 'md', 'lg'] as const).map((size) => dialogContentVariants({ size }))
    expect(new Set(widths).size).toBe(3)
    expect(alertDialogContentVariants()).toContain('max-w-sm')
    expect(requiresContent({ title: 'T', size: 'lg' })).toEqual({ title: 'T', size: 'lg' })
    expect(requiresAlertContent({ title: 'T' })).toEqual({ title: 'T' })
    expect(requiresDialog({ defaultOpen: true })).toEqual({ defaultOpen: true })
  })
})
