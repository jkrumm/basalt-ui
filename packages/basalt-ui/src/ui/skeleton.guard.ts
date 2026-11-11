import type { SkeletonProps, SpinnerProps } from './skeleton'

/**
 * Hand-authored guard for `skeleton` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The module has no cva axes: its height is one line of the
 * surrounding text, so the guard pins that neither part takes a child or a height.
 */

// basalt:guard requires
type Called = { className?: string; id?: string }

export const requires = (
  c: Called,
): Pick<SkeletonProps, 'className' | 'id'> & Pick<SpinnerProps, 'className' | 'id'> => c

// basalt:guard closed
// @ts-expect-error a skeleton draws its own box, not children
export const skeletonChild: Pick<SkeletonProps, 'children'> = { children: 'x' }

// @ts-expect-error a spinner draws its own ring, not children
export const spinnerChild: Pick<SpinnerProps, 'children'> = { children: 'x' }
