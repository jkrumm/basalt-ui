/**
 * Compile-time proof of the `file-upload` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop callers pass fails, one that accepts more passes. The zone's `compact` axis is set
 * by the part, so the guard pins the props and the table's classes.
 */
import { describe, expect, test } from 'bun:test'
import { fileUploadVariants } from './file-upload'
import type { FileRejection } from './file-upload'
import { requires } from './file-upload.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type WithoutMaxSize = {
  value?: readonly File[]
  defaultValue?: readonly File[]
  onValueChange?: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: undefined
  maxFiles?: number
  onReject?: (rejections: readonly FileRejection[]) => void
  disabled?: boolean
  name?: string
}
type WithMoreMaxSize = { maxSize?: number | string | undefined }

// @ts-expect-error `maxSize` is called but no longer accepted
export const removed: Accepts<WithoutMaxSize> = requires

export const added: Accepts<WithMoreMaxSize> = requires

describe('file-upload guard', () => {
  test('every called prop is accepted and the table resolves', () => {
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    expect(requires({ value: [file], multiple: true, maxSize: 10, name: 'docs' })).toEqual({
      value: [file],
      multiple: true,
      maxSize: 10,
      name: 'docs',
    })
    expect(fileUploadVariants()).toContain('border-dashed')
    expect(fileUploadVariants({ compact: true })).toContain('py-3')
    expect(fileUploadVariants()).not.toContain('pointer-coarse')
  })
})
