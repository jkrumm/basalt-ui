import type { TagInputProps } from './tag-input'

/**
 * Hand-authored guard for `tag-input` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The guard pins the props a caller binds.
 */

// basalt:guard requires
type CalledTagInput = {
  value?: readonly string[]
  onValueChange?: (value: string[]) => void
  validate?: (tag: string) => string | undefined
  separators?: string
  max?: number
  name?: string
  disabled?: boolean
  onBlur?: () => void
}

export const requiresTagInput = (
  c: CalledTagInput,
): Pick<
  TagInputProps,
  'value' | 'onValueChange' | 'validate' | 'separators' | 'max' | 'name' | 'disabled' | 'onBlur'
> => c

// basalt:guard closed
// @ts-expect-error the tags are strings
export const numbers: Pick<TagInputProps, 'value'> = { value: [1] }
