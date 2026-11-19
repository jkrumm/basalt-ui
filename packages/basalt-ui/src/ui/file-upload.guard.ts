import type { FileRejection, FileUploadProps } from './file-upload'

/**
 * Hand-authored guard for `file-upload` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The only cva axis is the zone's own `compact`, set by the part, so
 * the guard pins the props a caller binds: the file list, its change callback and the limits.
 */

// basalt:guard requires
type Called = {
  value?: readonly File[]
  defaultValue?: readonly File[]
  onValueChange?: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number
  maxFiles?: number
  onReject?: (rejections: readonly FileRejection[]) => void
  disabled?: boolean
  name?: string
}

export const requires = (
  c: Called,
): Pick<
  FileUploadProps,
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'accept'
  | 'multiple'
  | 'maxSize'
  | 'maxFiles'
  | 'onReject'
  | 'disabled'
  | 'name'
> => c

// basalt:guard closed
// @ts-expect-error the value is a list of files, never a path string
export const pathValue: FileUploadProps = { value: 'report.pdf' }
// @ts-expect-error a rejection reason outside type, size and count is a type error
export const unknownReason: FileRejection = { file: new File([], 'a.pdf'), reason: 'virus' }
// @ts-expect-error the zone's density follows the chosen file; there is no compact prop
export const compact: FileUploadProps = { compact: true }
