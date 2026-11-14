/**
 * `batchWrites(run)`: URL writes made inside `run` leave as one navigate per router. A control store
 * queues its unsets while a batch is open and registers its flush here; outside a batch every write
 * navigates at once, as before. Internal: `./controls` and `./router` meet here without importing
 * each other.
 */
let depth = 0
const flushers = new Set<() => void>()

export const batching = (): boolean => depth > 0

/** Runs `flush` when the outermost batch ends. */
export function onBatchEnd(flush: () => void): void {
  flushers.add(flush)
}

export function batchWrites(run: () => void): void {
  depth += 1
  try {
    run()
  } finally {
    depth -= 1
    if (depth === 0) {
      const pending = [...flushers]
      flushers.clear()
      for (const flush of pending) flush()
    }
  }
}
