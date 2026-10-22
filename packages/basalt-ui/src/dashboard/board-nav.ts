/** Roving-focus movement for `Board`: pure, so the keyboard law is testable without a DOM. */

export type BoardKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

export const BOARD_KEYS: readonly string[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]

export type BoardPos = { col: number; row: number }

/**
 * The position `key` moves to from `from`, or `null` when it stays put. `sizes` is the card count of
 * every column in order. Up/Down/Home/End stay in the column; Left/Right jump to the nearest
 * non-empty column in that direction and land on the same row index, clamped to its last card.
 */
export function moveOnBoard(
  sizes: readonly number[],
  from: BoardPos,
  key: BoardKey,
): BoardPos | null {
  const size = sizes[from.col] ?? 0
  let next: BoardPos
  switch (key) {
    case 'ArrowUp':
      next = { col: from.col, row: from.row - 1 }
      break
    case 'ArrowDown':
      next = { col: from.col, row: from.row + 1 }
      break
    case 'Home':
      next = { col: from.col, row: 0 }
      break
    case 'End':
      next = { col: from.col, row: size - 1 }
      break
    default: {
      const step = key === 'ArrowLeft' ? -1 : 1
      let col = from.col + step
      while (col >= 0 && col < sizes.length && (sizes[col] ?? 0) === 0) col += step
      if (col < 0 || col >= sizes.length) return null
      next = { col, row: Math.min(from.row, (sizes[col] ?? 1) - 1) }
    }
  }
  if (next.row < 0 || next.row >= (sizes[next.col] ?? 0)) return null
  return next.col === from.col && next.row === from.row ? null : next
}

/** Only http(s) and relative references render as links; anything else (`javascript:`, `data:`) stays text. */
export function isSafeHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || /^(?:\/(?!\/)|\.{1,2}\/|#|\?)/.test(href)
}
