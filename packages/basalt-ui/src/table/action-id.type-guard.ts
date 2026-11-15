/**
 * Compile-time proof that a table action's identity is `id`, as on the page and shell actions.
 * Checked by `tsc --noEmit`; every `@ts-expect-error` is one "never".
 */
import type { BulkAction, RowAction } from './contract'

type Item = { n: number }
const noop = (): void => undefined

export const row: RowAction<Item> = { id: 'open', label: 'Open', onClick: noop }
export const bulk: BulkAction<Item> = { id: 'archive', label: 'Archive', onClick: noop }

export const staleRow: RowAction<Item> = {
  id: 'open',
  // @ts-expect-error the old identity `key` is gone
  key: 'open',
  label: 'Open',
  onClick: noop,
}

export const staleBulk: BulkAction<Item> = {
  id: 'archive',
  // @ts-expect-error the old identity `key` is gone
  key: 'archive',
  label: 'Archive',
  onClick: noop,
}

// @ts-expect-error an action has an `id`
export const noId: RowAction<Item> = { label: 'Open', onClick: noop }
