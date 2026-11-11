import type { Phase, QueryStateLike } from './ports'

/** A card action: a link or a handler, never both (`CardTarget` in the cards contract). */
export type CardAction = { label: string } & ({ href: string } | { onSelect: () => void })

/**
 * The measured-empty state. It cannot lack a cause. `filtered` is the no-results case under active
 * filters: it renders Clear filters instead of `action`.
 */
export type Empty = { cause: string; action?: CardAction; filtered?: { reset: () => void } }

/** The phase half of every frame's props; `empty` wins once the query settled. */
export type FrameState = {
  phase?: Phase | QueryStateLike | undefined
  empty?: Empty | null | undefined
}

/** The five states `data-phase` prints. */
export type PhaseTag = 'ready' | 'loading' | 'stale' | 'error' | 'empty'

export type ErrorKind = 'forbidden' | 'not-found'

/** What a frame renders. `body` is true exactly when the box slot may be called. */
export type ResolvedPhase =
  | { tag: 'ready'; body: true }
  | { tag: 'stale'; body: true; refreshFailed: boolean }
  | { tag: 'loading'; body: false }
  | { tag: 'empty'; body: false; empty: Empty }
  | { tag: 'error'; body: false; kind?: ErrorKind; message?: string; retry?: () => void }

const isQueryState = (phase: Phase | QueryStateLike): phase is QueryStateLike =>
  typeof phase === 'object' && 'isPending' in phase

/** A structural `status` of 403 or 404 on the error picks the kind; `forbidden` never retries. */
function kindOf(error: unknown): ErrorKind | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'not-found'
  return undefined
}

type Base = Exclude<ResolvedPhase, { tag: 'empty' }>

function resolveInput(phase: Phase | QueryStateLike | undefined): Base {
  if (phase === undefined || phase === 'ready') return { tag: 'ready', body: true }
  if (phase === 'loading') return { tag: 'loading', body: false }
  if (phase === 'stale') return { tag: 'stale', body: true, refreshFailed: false }
  if (!isQueryState(phase)) {
    return { tag: 'error', body: false, ...errorFields(phase) }
  }
  if (phase.isPending) return { tag: 'loading', body: false }
  if (phase.isError && phase.isRefetchError === true) {
    // The data survives a failed refetch, so the card keeps drawing it and says it is old.
    return { tag: 'stale', body: true, refreshFailed: true }
  }
  if (phase.isError) {
    const { refetch } = phase
    const kind = kindOf(phase.error)
    return {
      tag: 'error',
      body: false,
      ...(kind !== undefined && { kind }),
      ...(phase.error instanceof Error && { message: phase.error.message }),
      ...(refetch !== undefined &&
        kind !== 'forbidden' && {
          retry: () => {
            void refetch()
          },
        }),
    }
  }
  if (phase.isPlaceholderData === true) return { tag: 'stale', body: true, refreshFailed: false }
  return { tag: 'ready', body: true }
}

function errorFields(
  phase: Extract<Phase, { tag: 'error' }>,
): Omit<Extract<ResolvedPhase, { tag: 'error' }>, 'tag' | 'body'> {
  return {
    ...(phase.kind !== undefined && { kind: phase.kind }),
    ...(phase.message !== undefined && { message: phase.message }),
    ...(phase.retry !== undefined && phase.kind !== 'forbidden' && { retry: phase.retry }),
  }
}

/**
 * The one phase resolver every frame shares. Precedence: loading, error, empty, stale, ready; a
 * pending query is loading even when `empty` is set, and `isPlaceholderData` is stale. `empty`
 * applies only once the query settled, to a ready or stale phase.
 *
 * @example
 * resolvePhase({ phase: query, empty: rows.length ? null : { cause: 'No merges yet' } }).tag
 */
export function resolvePhase({ phase, empty }: FrameState): ResolvedPhase {
  const base = resolveInput(phase)
  if (base.body && empty !== undefined && empty !== null)
    return { tag: 'empty', body: false, empty }
  return base
}
