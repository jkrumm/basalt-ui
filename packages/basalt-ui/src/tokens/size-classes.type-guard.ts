/**
 * Compile-time proof of the width words: `compact` names the window class only, and the container
 * class that opens at 240 px is `narrow`, the word the `@narrow:` variant already uses. Checked by
 * `tsc --noEmit`; every `@ts-expect-error` is one "never".
 */
import { CONTAINER_CLASSES, CONTAINER_KEYS, SIZE_CLASSES } from './size-classes'
import type { ContainerClass } from './size-classes'

export const container: ContainerClass[] = ['micro', 'narrow', 'regular', 'wide']

// @ts-expect-error `compact` is not a container class
export const staleContainer: ContainerClass = 'compact'

export const narrowKey: '240px' = CONTAINER_KEYS.narrow
export const narrowPx: 240 = CONTAINER_CLASSES.narrow

// @ts-expect-error the container constants have no `compact`
export const staleKey = CONTAINER_KEYS.compact

export const windowClass: 0 = SIZE_CLASSES.compact
