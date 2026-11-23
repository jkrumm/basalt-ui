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
 *
 * `when` is the measure of emptiness for a frame given a query as its `phase` (`ChartCard`,
 * `StatCell`): it reads the settled `data`, so a query that returns an object, not an array, can say
 * when it is empty (`when: (data) => data.runs.length === 0`). Without it the data is empty when it is
 * an empty array. The frame calls it only once the query settled with data, and a frame given a
 * `Phase` ignores it: there `empty` applies whenever it is set.
 *
 * @useWhen a frame's query settled with no rows and the card must say why and what to do next
 * @neverWhen the query is pending or failed (pass the phase) or the card is merely short of data
 * @example
 * empty={{ cause: 'No deploys in this range', action: { label: 'Widen range', onClick: widen } }}
 */
export type Empty = {
  cause: string
  action?: CardAction
  filtered?: { reset: () => void }
  when?(data: unknown): boolean
}

/** The phase half of every frame's props; `empty` wins once the query settled. */
export type FrameState = {
  phase?: Phase | QueryStateLike | undefined
  empty?: Empty | null | undefined
}

/**
 * One labelled fact in a footer. `value` is data, never a node, so every card formats alike.
 *
 * @useWhen a card footer states a fact beside its figure: a source, a time, an id
 * @neverWhen the text is the card's headline figure or a sentence (use `value` or `sub`)
 * @example
 * { label: 'Updated', value: '14:02', mono: true }
 */
export type Fact = {
  label: string
  value: string | number
  /** The value is a time or an id: drawn in the mono face with tabular numerals. */
  mono?: boolean | undefined
}

/**
 * Capped at 2; `null` or `undefined` drops one, so a conditional fact type-checks without a hole.
 *
 * @useWhen a card's `footer` prop takes one or two facts
 * @neverWhen a card needs three facts or a node in the footer (cut a fact: the footer holds two)
 * @example
 * footer={[{ label: 'Source', value: 'CI' }, stale ? { label: 'Age', value: '2 h' } : null]}
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
  | {
      tag: 'error'
      body: false
      kind?: ErrorKind
      message?: string
      /** `message` is the text of a failed query's `Error`, not a sentence the page wrote: a group never prints it. */
      raw?: true
      retry?: () => void
    }

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

const retryOfRefetch = new WeakMap<() => unknown, () => void>()

/**
 * One `retry` per query `refetch`, however often the card renders: frames fed one query result
 * hold the same function, so a group runs it once and frames can tell they share a source.
 */
export function retryOf(refetch: () => unknown): () => void {
  const known = retryOfRefetch.get(refetch)
  if (known !== undefined) return known
  const retry = (): void => {
    void refetch()
  }
  retryOfRefetch.set(refetch, retry)
  return retry
}

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
      ...(phase.error instanceof Error && { message: phase.error.message, raw: true as const }),
      ...(refetch !== undefined && kind !== 'forbidden' && { retry: retryOf(refetch) }),
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

/** A query result's `data`, the field a TanStack result carries beyond `QueryStateLike`. */
const dataOf = (phase: QueryStateLike): unknown => (phase as { data?: unknown }).data

/**
 * The `empty` a frame given a query may act on. A frame whose `phase` is a query result measures
 * emptiness itself, so a page passes `empty` unconditionally: it holds only when the settled data is
 * empty (an empty array, or `empty.when(data)` for a result of another shape) and is `null` while the
 * query loads, failed or returned rows. A `Phase` or no phase passes `empty` through unchanged.
 */
export function settledEmpty(
  phase: Phase | QueryStateLike | undefined,
  empty: Empty | null | undefined,
): Empty | null | undefined {
  if (empty === undefined || empty === null) return empty
  if (phase === undefined || !isQueryState(phase)) return empty
  const data = dataOf(phase)
  if (phase.isPending || data === undefined || data === null) return null
  const isEmpty =
    empty.when !== undefined ? empty.when(data) : Array.isArray(data) && data.length === 0
  return isEmpty ? empty : null
}

/**
 * `resolvePhase` for a frame that measures emptiness from its query (`ChartCard`, `StatCell`): the
 * `empty` it was given counts only when `settledEmpty` says the settled data is empty.
 *
 * @example
 * resolveFrame({ phase: query, empty: { cause: 'No merges yet' } }).tag
 */
export function resolveFrame({ phase, empty }: FrameState): ResolvedPhase {
  return resolvePhase({ phase, empty: settledEmpty(phase, empty) })
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
