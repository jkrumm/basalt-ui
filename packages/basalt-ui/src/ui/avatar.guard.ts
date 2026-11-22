import type { AvatarProps, AvatarStackProps } from './avatar'

/**
 * Hand-authored guard for `avatar` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. `name` is required on `Avatar`: a face with no name is unlabelled, and
 * the fallback tint and initials are read from it.
 */

// basalt:guard requires
type CalledAvatar = {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  shape?: 'person' | 'object'
}

type CalledStack = {
  label: string
  people: readonly { name: string; src?: string }[]
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  ground?: 'surface' | 'card' | 'popover'
}

export const requires = (c: CalledAvatar): Pick<AvatarProps, 'name' | 'size' | 'shape'> => c

export const requiresStack = (
  c: CalledStack,
): Pick<AvatarStackProps, 'label' | 'people' | 'max' | 'size' | 'ground'> => c

// basalt:guard closed
// @ts-expect-error size is a closed union, not a free string
export const closedSize: Pick<AvatarProps, 'size'> = { size: 'huge' }

// @ts-expect-error shape is a closed union, not a free string
export const closedShape: Pick<AvatarProps, 'shape'> = { shape: 'square' }

// @ts-expect-error name has no default: a face with no name does not compile
export const requiredName: Pick<AvatarProps, 'name'> = {}

// @ts-expect-error a stack is named for assistive tech
export const requiredLabel: Pick<AvatarStackProps, 'label'> = {}
