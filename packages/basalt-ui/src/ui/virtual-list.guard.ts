import type { VirtualLike } from '../core/ports'
import { VirtualList } from './virtual-list'
import type { VirtualListProps } from './virtual-list'

/**
 * Hand-authored guard for `virtual-list` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. `./table` reaches this module only through the `VirtualLike` port,
 * so the component must stay assignable to it.
 */

// basalt:guard requires
type Called = {
  count: number
  keepIndex?: number
  overscan?: number
  spacer?: 'div' | 'tr'
}

export const requires = (
  c: Called,
): Pick<VirtualListProps, 'count' | 'keepIndex' | 'overscan' | 'spacer'> => c

export const asPort: VirtualLike = VirtualList

// basalt:guard closed
// @ts-expect-error the spacer is a div or a tr
export const closedSpacer: Pick<VirtualListProps, 'spacer'> = { spacer: 'li' }

// @ts-expect-error rows are keyed by id, so the key getter is required
export const noKey: Pick<VirtualListProps, 'getItemKey' | 'count'> = { count: 1 }
