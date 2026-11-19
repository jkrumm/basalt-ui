import type { IconComponent, NavTarget, Phase, QueryStateLike } from './ports'

/** A card action: a link or a handler, never both (`CardTarget` in the cards contract). */
export type CardAction = { label: string } & (
  | { href: string | NavTarget }
  | { onClick: () => void }
)

/**
 * One menu entry: a link or a handler, never both, with a stable `id`. The one entry type of every
 * `menu` prop (`StatCard`, `KanbanCard`, `DataPanel`, `ChartCard`, `InnerNavItem`).
 */
export type MenuEntry = CardAction & { id: string }

/** The `menu` prop: action data the frame draws as its menu. Min 2 entries; one action is a plain button. */
export type CardMenu = readonly [MenuEntry, MenuEntry, ...MenuEntry[]]

/** @deprecated Use `CardMenu`, which `ui/menu` does not share a name with; removed in the next minor. */
export type Menu = CardMenu

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

/** One labelled fact in a footer. `value` is data, never a node, so every card formats alike. */
export type Fact = {
  label: string
  value: string | number
  /** The value is a time or an id: drawn in the mono face with tabular numerals. */
  mono?: boolean | undefined
}

/**
 * Capped at 2; `null` or `undefined` drops one, so a conditional fact type-checks without a hole.
 */
export type FootFacts = readonly [Fact | null | undefined, (Fact | null | undefined)?]

/**
 * A legend entry: the key of a series, or of a mark a page draws through the seam (no fake series).
 * One declaration for `./charts` (`ChartCard legend`) and `./cards` (`DataPanel legend`, `BarList
 * series`), so one array types both.
 */
export type LegendEntry = {
  key: string
  label: string
  color: { light: string; dark: string }
  /**
   * `dot` is a filled dot, `ring` a hollow one; a `mark: 'dot'` series legends as `dot`. `bar` is a
   * filled square and `hollow` an outlined one: the keys of marks a page draws through the seam.
   */
  swatch?: 'solid' | 'dashed' | 'dot' | 'ring' | 'bar' | 'hollow'
  failed?: boolean
}

/** The header every frame shares. An `undefined` field is an absent one. */
export type FrameHead = {
  title: string
  subtitle?: string | undefined
  icon?: IconComponent | undefined
  info?: string | undefined
}

/** The six states `data-phase` prints. */
export type PhaseTag = 'ready' | 'loading' | 'offline' | 'stale' | 'error' | 'empty'

export type ErrorKind = 'forbidden' | 'not-found'

/** What a frame renders. `body` is true exactly when the box slot may be called. */
export type ResolvedPhase =
  | { tag: 'ready'; body: true }
  | { tag: 'stale'; body: true; refreshFailed: boolean }
  | { tag: 'loading'; body: false }
  | { tag: 'offline'; body: false }
  | { tag: 'empty'; body: false; empty: Empty }
  | { tag: 'error'; body: false; kind?: ErrorKind; message?: string; retry?: () => void }

/**
 * A TanStack query result also carries `fetchStatus`, which `QueryStateLike` does not name (the
 * port is frozen), so it is read here as an optional extra: a `paused` fetch with no data waits for
 * the connection, not for the server.
 */
type QueryResultLike = QueryStateLike & { fetchStatus?: 'fetching' | 'paused' | 'idle' }

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
  if (phase.isPending) {
    return (phase as QueryResultLike).fetchStatus === 'paused'
      ? { tag: 'offline', body: false }
      : { tag: 'loading', body: false }
  }
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
 * The one phase resolver every frame shares. Precedence: offline, loading, error, empty, stale, ready; a
 * pending query is loading (offline when its fetch is paused) even when `empty` is set, and `isPlaceholderData` is stale. `empty`
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
