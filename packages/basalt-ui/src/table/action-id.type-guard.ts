/**
 * Compile-time proof that a table action's identity is `id`, as on the page and shell actions.
 * Checked by `tsc --noEmit`; every `@ts-expect-error` is one "never".
 */
import type { BulkAction, RowAction } from './contract'

export const row: RowAction<{ n: number }> = { id: 'open', label: 'Open', onClick: () => undefined }
export const bulk: BulkAction<{ n: number }> = {
  id: 'archive',
  label: 'Archive',
  onClick: () => undefined,
}

// @ts-expect-error the old identity `key` is gone
export const staleRow: RowAction<{ n: number }> = {
  key: 'open',
  label: 'Open',
  onClick: () => undefined,
}

// @ts-expect-error the old identity `key` is gone
export const staleBulk: BulkAction<{ n: number }> = {
  key: 'a',
  label: 'A',
  onClick: () => undefined,
}
