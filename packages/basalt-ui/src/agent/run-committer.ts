/**
 * The commit side of a run: when accumulated parts reach `useAgentThreadRuns`' `runs` state.
 * Mantine-free and React-free so it is testable on its own.
 */
import type { PartLike } from './merge'
import type { LiveRunStatus } from './thread'

export type RunCommitter<TPart> = {
  /** Queue a commit; `immediate` (or `wait <= 0`) bypasses the window and drops any pending one. */
  readonly push: (parts: TPart[], status: LiveRunStatus, immediate?: boolean) => void
  /** Commit the pending snapshot now, if any. */
  readonly flush: () => void
  /** Drop the pending snapshot and its timer. */
  readonly cancel: () => void
}

/**
 * Leading + trailing throttle over `runs` commits (the semantics of `useChat`'s stable
 * `throttle`): the first push commits at once, pushes inside the window collapse into one trailing
 * commit of the LATEST snapshot.
 */
export function createRunCommitter<TPart>(
  wait: number,
  commit: (parts: TPart[], status: LiveRunStatus) => void,
): RunCommitter<TPart> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastCommitAt = Number.NEGATIVE_INFINITY
  let pending: { parts: TPart[]; status: LiveRunStatus } | undefined

  const clear = (): void => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }
  const flush = (): void => {
    clear()
    if (pending === undefined) return
    const { parts, status } = pending
    pending = undefined
    lastCommitAt = Date.now()
    commit(parts, status)
  }
  return {
    push(parts, status, immediate = false) {
      pending = { parts, status }
      const windowOpen = timer === undefined && Date.now() - lastCommitAt >= wait
      if (wait <= 0 || immediate || windowOpen) {
        flush()
        return
      }
      timer ??= setTimeout(flush, Math.max(0, wait - (Date.now() - lastCommitAt)))
    },
    flush,
    cancel() {
      clear()
      pending = undefined
    },
  }
}

/** True for the parts that end `'submitted'`: model output, not the synthetic start/source/error. */
export function isContentPart(part: PartLike): boolean {
  return part.type === 'text' || part.type === 'reasoning' || part.type === 'tool'
}
