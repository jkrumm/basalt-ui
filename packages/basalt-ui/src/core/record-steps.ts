/**
 * The record a routed page steps through: `PageBar records` registers its sequence while the page is
 * on screen, and the shell's `record.previous` and `record.next` commands (`k` and `j`, declared
 * by `defineCommands` beside the app's own) step it. One page shows at a time, so the last
 * registration is the one the keys reach. Framework-free: the commands and the page meet here.
 */
import type { RecordSequence } from './ports'

/** The record before and after the shown one in the opener's order; `undefined` at an end. */
export function neighbours(records: RecordSequence): { prev?: string; next?: string } {
  const at = records.ids.indexOf(records.id)
  if (at < 0) return {}
  const prev = records.ids[at - 1]
  const next = records.ids[at + 1]
  return { ...(prev !== undefined && { prev }), ...(next !== undefined && { next }) }
}

const registered: (() => RecordSequence | undefined)[] = []

/** Registers a page's sequence, read at each key press so a step sees the current record; returns the release. */
export function registerRecordSteps(read: () => RecordSequence | undefined): () => void {
  registered.push(read)
  return () => {
    const at = registered.lastIndexOf(read)
    if (at >= 0) registered.splice(at, 1)
  }
}

const current = (): RecordSequence | undefined => registered.at(-1)?.()

/** The surfaces that step records of their own: a dialog, a `Peek`, a `PageAside` and a `Dock`. */
const PANELS = '[role="dialog"], [data-slot="peek"], [data-slot="page-aside"], [data-slot="dock"]'

/**
 * Whether a key may step: a page registered a sequence with a record on that side, and focus is not
 * inside a dialog or a panel that steps its own records (a `Peek` over the page keeps its keys).
 */
export function canStepRecord(direction: 'previous' | 'next'): boolean {
  const records = current()
  if (records === undefined) return false
  if (typeof document !== 'undefined') {
    const active = document.activeElement
    if (active !== null && active.closest(PANELS) !== null) return false
  }
  const { prev, next } = neighbours(records)
  return (direction === 'previous' ? prev : next) !== undefined
}

/** Steps the registered page to its previous or next record; nothing at an end or with none registered. */
export function stepRecord(direction: 'previous' | 'next'): void {
  const records = current()
  if (records === undefined) return
  const { prev, next } = neighbours(records)
  const to = direction === 'previous' ? prev : next
  if (to !== undefined) records.onStep(to)
}
