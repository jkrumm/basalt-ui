/**
 * `VirtualRows` — the package's ONE lazy virtual-list seam (SPEC D11 / § 9.3).
 *
 * `@tanstack/react-virtual` is an OPTIONAL peer, so this is the only module that may name it at
 * runtime, and only through a dynamic `import()`: `lazy` + `.catch()` to the plain rows keeps the
 * root entry and `./agent` resolving with the peer absent (a static import here would make every
 * consumer of either require it, even one that never virtualises). Same shape as
 * `../agent/stick-to-bottom.tsx`'s `LazyStickToBottom`. Internal: no barrel exports it.
 *
 * Two scroll owners, one prop (a union, so both cannot be passed):
 * - `height` — the seam renders its own scroll node (the chat transcript's mode).
 * - `scroll: 'parent'` — the rows virtualise against the nearest scrolling ancestor
 *   ({@link scrollParentOf}; `null` → the window) with `scrollMargin` = the list's offset inside it.
 *   That is an event list on a page inside `BasaltShell`, whose `AppShell.Main` is the scrollport.
 *
 * Verified against the INSTALLED virtual-core 3.18.0 (react-virtual 3.14.14), not memory:
 * `rangeExtractor`, `scrollMargin` (item `start` includes it; the `translateY` below subtracts it,
 * as react-virtual's own `applyItemPosition` does), `gap`, `anchorTo`, `followOnAppend`,
 * `scrollEndThreshold`, `getItemKey`, `measureElement` and `range` are all `VirtualizerOptions`
 * members / instance fields; `useWindowVirtualizer` supplies the window scroll/rect observers.
 * `anchorTo: 'end'` re-resolves the first visible item BY KEY after a count/edge-key change
 * (`setOptions`), which is why `getItemKey` is always `row.key`: a prepend then keeps the previously
 * first-visible row at the same on-screen offset.
 */
// theme-allow-file raw-html-layout, hidden-inline-style — src/common is Mantine-free by contract (common/boundary.test.ts), so the seam owns plain elements.
import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ComponentType, CSSProperties, JSX, ReactNode } from 'react'
import type { Range, Virtualizer } from '@tanstack/react-virtual'
import { cx } from './props'
import type { BasaltProps } from './props'
import { scrollParentOf } from './scroll-parent'

export type VirtualRow = {
  readonly key: string
  readonly node: ReactNode
  /** A group header: the active one stays rendered while scrolled and is drawn `position: sticky`. */
  readonly sticky?: boolean
}

type InitialScroll = 'start' | 'end'

type ScrollOwner =
  | { readonly height: number | string; readonly scroll?: never }
  | { readonly scroll: 'parent'; readonly height?: never }

export type VirtualRowsProps = BasaltProps &
  ScrollOwner & {
    readonly rows: readonly VirtualRow[]
    /** Extra rows rendered beyond the viewport, each side. */
    readonly overscan: number
    /** Estimated row height in px before a row is measured; estimate toward the LARGER end. */
    readonly estimateSize: number
    /** px between rows. Default 0. */
    readonly gap?: number
    /** Row gap of the peer-absent degrade when it should differ from the windowed `gap`. */
    readonly fallbackGap?: number | string
    /** Where the list sits on first mount. Default 'start'. */
    readonly initialScroll?: InitialScroll
    /** Which edge a count/edge-key change keeps fixed. Default 'start'. */
    readonly anchorTo?: 'start' | 'end'
    /** Follow an append while at the end. Default false. */
    readonly followOnAppend?: boolean
  }

/** `scroll: 'parent'` resolved: the scrolling ancestor (`null` → window) and the list's offset in it. */
type ParentScroll = { readonly element: HTMLElement | null; readonly margin: number }

type InnerProps = VirtualRowsProps & { readonly parent?: ParentScroll }

/** Opaque sticky-header backdrop; a caller overrides `--virtual-rows-sticky-bg` via `className`. */
const STICKY_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--virtual-rows-sticky-bg, var(--vx-surface-bg))',
}

/** How close (px) to the end still counts as "at the end" for `followOnAppend`/`anchorTo: 'end'`. */
const SCROLL_END_THRESHOLD = 64

/** Caps `applyInitialScroll`'s clobber-recovery retries (see `agent/chat/virtualize.ts`'s fourth composition
 * rule for the full mechanism this guards). A small fixed budget, not a time/frame-based deadline:
 * every observed case of virtual-core's `_willUpdate` clobbering this effect's jump resolves within
 * one extra commit, so this exists purely as a backstop against a pathological DOM that never
 * reports settled — not as the expected path. Once exhausted, the effect gives up and marks the
 * jump permanently done wherever the last attempt landed, rather than fighting the DOM (or a user
 * who has since scrolled away) forever. Exported (like `messageBlockRenderCounter`) purely so its
 * test can assert the exact bound without duplicating the number; not part of the public surface. */
export const MAX_INITIAL_SCROLL_ATTEMPTS = 5

/**
 * Minimal structural slice of `Virtualizer` (virtual-core 3.18.0) that
 * {@link resolveGuardedMeasurement} needs — `indexFromElement`/`itemSizeCache`/`options` are all
 * public instance members, but typing against the real (generic, peer-only) `Virtualizer` class
 * would force this test-only-exported helper to import the peer's runtime types at module scope,
 * the exact static-import-forces-the-peer problem the surrounding `lazy(() => import(...))` exists
 * to avoid. A structural type sidesteps that without loosening to `any`. Generic over the item
 * element type (rather than fixed at `Element`) so it stays exactly assignable FROM a real
 * `Virtualizer<TScrollElement, TItemElement>` at the call site below — `indexFromElement` is
 * declared with arrow-property (not method) syntax upstream, so it is checked contravariantly, and
 * a fixed `Element` parameter there does not structurally match a real instance's narrower
 * `TItemElement` parameter.
 */
type MeasurementCacheHost<TItemElement extends Element> = {
  readonly indexFromElement: (node: TItemElement) => number
  readonly itemSizeCache: Map<unknown, number>
  readonly options: {
    readonly getItemKey: (index: number) => unknown
    readonly estimateSize: (index: number) => number
  }
}

/**
 * Resolves the size a `measureElement` implementation should report, given what the underlying
 * (default or custom) measurement already produced: that value unchanged when it is a genuine
 * measurement, or the row's own last-known size when it is `0` — never a real reading for a mounted
 * row, so a `0` only ever means the ResizeObserver measured through a `display: none` (or otherwise
 * unlaid-out) ancestor, e.g. a virtualized transcript sitting inside a collapsed `ThreadFeedRow`.
 * Falling through to it unguarded is what corrupted `itemSizeCache`/`measurementsCache`: virtual-
 * core's default `resizeItem` writes whatever `measureElement` returns with no floor, so every
 * mounted row remeasures at 0px the instant an ancestor hides, `getTotalSize()` collapses within
 * the same tick, and the collapse is never undone — a later real remeasurement only OVERWRITES
 * entries the ResizeObserver happens to re-fire for, it does not restore ones that silently kept
 * their poisoned 0 (see `virtualize.ts`'s composition-rule doc for the full mechanism and the
 * measured numbers).
 *
 * Takes the already-computed `size` plus the {@link MeasurementCacheHost} slice, rather than
 * wrapping the `measureElement` function itself, so this stays a plain, non-generic-over-a-
 * generic-function call at its one call site below (`instance` there is `Virtualizer<TScrollElement,
 * TItemElement>` for THAT call's concrete type arguments, not the peer's own generic
 * `measureElement` export — wrapping the latter directly hits TS's higher-rank inference limits on
 * a doubly-generic HOF). That shape is also what makes this unit-testable with a fake host object
 * and no ResizeObserver/layout engine at all (happy-dom has neither). Not exported from
 * `agent-chat/index.ts`: a test-only escape hatch, matching
 * `messageBlockRenderCounter`/`nonVirtualizedRowsFallback` above.
 */
export function resolveGuardedMeasurement<TItemElement extends Element>(
  host: MeasurementCacheHost<TItemElement>,
  element: TItemElement,
  size: number,
): number {
  if (size > 0) return size
  // Same key derivation `resizeItem` itself uses (index → getItemKey), read BEFORE `resizeItem`
  // writes the new (bad) size — `itemSizeCache` still holds the last-good measurement here.
  const index = host.indexFromElement(element)
  const key = host.options.getItemKey(index)
  return host.itemSizeCache.get(key) ?? host.options.estimateSize(index)
}

/**
 * Decides what `VirtualRowsInner`'s one-shot initial-scroll effect should do this render,
 * given the inputs the effect closes over. Pure and peer/DOM-free — pulled out of the lazy-loaded
 * closure for the same reason `resolveGuardedMeasurement` is: it stays unit-testable without a
 * real `Virtualizer` instance or `@tanstack/react-virtual` itself.
 *
 * `'start'` and an empty transcript resolve to `'skip-done'` — there is nothing to scroll to, and
 * DONE is permanent (see `virtualize.ts`'s fourth composition rule: the real scroll must fire at
 * most once, ever, so a later append never yanks a user who has scrolled up). A non-positive
 * `containerHeight` — the transcript's own scroll node measuring `0`, e.g. mounted behind a
 * `display: none` ancestor per `virtualize.ts`'s third composition rule — resolves to
 * `'skip-retry'`: NOT done, so the caller's effect (which re-runs after EVERY commit until the jump
 * lands — see {@link applyInitialScroll}) gets another chance the next time this subtree renders,
 * instead of permanently stranding the transcript at the top the moment it becomes visible. Only a
 * genuinely measured, non-empty, `'end'`-targeted mount resolves to `'scroll'`.
 */
export function resolveInitialScrollAction(
  initialScroll: InitialScroll,
  rowCount: number,
  containerHeight: number,
): 'scroll' | 'skip-done' | 'skip-retry' {
  if (initialScroll === 'start') return 'skip-done'
  if (rowCount === 0) return 'skip-done'
  if (containerHeight <= 0) return 'skip-retry'
  return 'scroll'
}

/** The mutable half of the one-shot initial-scroll contract. `hasApplied` is whether it has
 * PERMANENTLY finished — either there was nothing to do (`'start'`/empty transcript), or
 * `scrollToEnd` fired and was subsequently CONFIRMED (via a real DOM read — see
 * {@link applyInitialScroll}'s doc for why virtual-core's own tracked offset can't be trusted for
 * this) to have survived whatever else committed since. `attempts` counts how many times
 * `scrollToEnd` has been (re-)fired this mount; 0 means never attempted, and also gates whether a
 * call re-derives {@link resolveInitialScrollAction} at all. One instance lives for the lifetime of
 * a `VirtualRowsInner` mount, held in a `useRef` so it survives re-renders without itself
 * triggering one. */
export type InitialScrollState = { hasApplied: boolean; attempts: number }

/**
 * The stateful half of "fires once, on first mount, and never again" (`virtualize.ts`'s fourth
 * composition rule): wraps {@link resolveInitialScrollAction}'s per-call decision with the
 * ACROSS-CALLS memory that decision alone can't carry. Exported (like `resolveGuardedMeasurement`)
 * so `VirtualRowsInner`'s effect below calls this SAME function rather than a hand-mirrored
 * copy for tests — a fake `scrollToEnd` is the only DOM/peer-free way to prove the guard, since a
 * real `Virtualizer`'s own `followOnAppend` also calls the real DOM `scrollTo` on a later append,
 * making that specific call indistinguishable from this one at the DOM boundary (see this
 * function's test suite for the measurement that ruled that boundary out).
 *
 * Firing `scrollToEnd()` once is NOT the same as landing there: virtual-core 3.18.0's own
 * `_willUpdate` (verified against the installed dist) writes to the SAME scroll container from
 * `this.scrollOffset`, which updates only from the ASYNCHRONOUS native `scroll` event — never from
 * the synchronous call that requested a scroll. A commit that runs `_willUpdate` before this
 * effect gets a turn (element-attach) or that re-derives an anchor while `scrollOffset` still holds
 * the pre-jump value writes that STALE offset straight back to `scrollTop`, undoing the jump within
 * about one extra commit of it landing (see `agent/chat/virtualize.ts`'s fourth composition rule for the full
 * trace this was diagnosed from). So `resolveInitialScrollAction`'s `'scroll'` outcome does not, by
 * itself, set `hasApplied`: `isAtEnd` — a real `scrollTop`/`scrollHeight`/`clientHeight` read, the
 * one piece of ground truth that is NEVER stale, unlike virtual-core's own tracked offset — is
 * consulted on the NEXT call (i.e. the next commit, exactly the cadence this dependency-free effect
 * already runs on) to confirm the jump survived. If it didn't, `scrollToEnd` fires again; if it did,
 * `hasApplied` is set and the effect is inert for the rest of the mount. `MAX_INITIAL_SCROLL_ATTEMPTS`
 * bounds this so a DOM that pathologically never reports settled — or a user who scrolls away mid-
 * measurement — can never be fought forever; once exhausted, `hasApplied` is set regardless, wherever
 * the last attempt left the container.
 *
 * `state.hasApplied` is the ONLY thing that can permanently stop this from calling `scrollToEnd`
 * again: `'start'` and an empty transcript set it immediately (nothing to verify), and `'skip-retry'`
 * deliberately leaves it `false` so a transcript that mounted behind a hidden ancestor gets another
 * attempt on the caller's next commit, rather than being silently abandoned the moment it becomes
 * visible. That retry — and the clobber-recovery above — is why the caller's effect carries NO
 * dependency array: the commit that matters (a collapsed `ThreadFeedRow` flipping its body back to
 * `display: block`, or virtual-core's own follow-up commit after this effect's own jump) changes
 * neither the row count nor the virtualizer identity, so a dependency-keyed effect would never
 * re-run for it.
 *
 * `getContainerHeight` is a THUNK, not a number, for the same reason: reading `offsetHeight` forces
 * a synchronous layout, and it is read at most ONCE per mount — only on the very first call
 * (`attempts === 0`) — never again while verifying or retrying, so a landed transcript still pays
 * nothing for the effect it keeps re-running (a streaming transcript commits on every chunk).
 * `isAtEnd` is cheaper (a plain property read, no forced reflow beyond what the browser already
 * tracks) and is exactly what the verification/retry loop above consults instead.
 */
export function applyInitialScroll(
  state: InitialScrollState,
  initialScroll: InitialScroll,
  rowCount: number,
  getContainerHeight: () => number,
  scrollToEnd: () => void,
  isAtEnd: () => boolean,
): void {
  if (state.hasApplied) return

  // Already fired at least once this mount — verify it survived rather than re-deriving
  // `resolveInitialScrollAction` (row count / container height are irrelevant to "did the DOM
  // keep the scroll we already decided on").
  if (state.attempts > 0) {
    if (isAtEnd() || state.attempts >= MAX_INITIAL_SCROLL_ATTEMPTS) {
      state.hasApplied = true
      return
    }
    scrollToEnd()
    state.attempts += 1
    return
  }

  const action = resolveInitialScrollAction(initialScroll, rowCount, getContainerHeight())
  if (action === 'skip-retry') return
  if (action === 'skip-done') {
    state.hasApplied = true
    return
  }
  scrollToEnd()
  state.attempts += 1
}

/** Reads the transcript's own scroll container to answer "is it currently at (or within
 * `threshold`px of) the end" — the ground-truth check {@link applyInitialScroll} verifies its jump
 * against. Deliberately NOT `virtualizer.isAtEnd()`/`getScrollOffset()`: both are backed by
 * `this.scrollOffset`, the exact value that lags a real scroll until the next native `scroll`
 * event fires — using it here would make the verification vulnerable to the identical staleness
 * that causes the clobber in the first place. `scrollTop`/`scrollHeight`/`clientHeight` are plain
 * DOM properties with no such lag: `Element.scrollTo` with `'auto'` (this module's own behavior)
 * updates `scrollTop` synchronously, so a read immediately after — or, as here, on the next
 * commit — reflects reality. `null` (container not yet attached) reads as "not at end" rather than
 * throwing, matching every other guard in this file's tolerance for a not-yet-mounted ref. */
function isContainerAtEnd(container: Element | null, threshold: number): boolean {
  if (container === null) return false
  const distanceFromEnd = container.scrollHeight - container.clientHeight - container.scrollTop
  return distanceFromEnd <= threshold
}

/** `scroll: 'parent'`'s ground-truth "at the end": the LIST's bottom edge against the scrollport's
 * visible bottom (`null` scroller → the window). Not the whole scrollport — content after the list
 * keeps that distance positive forever, which would make {@link applyInitialScroll} re-fire
 * `scrollToEnd` up to its attempt cap and yank a user who has scrolled away. */
export function isListAtEnd(
  list: Element | null,
  scroller: HTMLElement | null,
  threshold: number,
): boolean {
  if (list === null) return false
  const visibleBottom =
    scroller === null
      ? window.innerHeight
      : scroller.getBoundingClientRect().top + scroller.clientTop + scroller.clientHeight
  return list.getBoundingClientRect().bottom - visibleBottom <= threshold
}

// ── Sticky headers ───────────────────────────────────────────────────────────────

/** The active sticky header: the last sticky index at or before the first visible index. */
export function activeStickyIndex(
  stickyIndexes: readonly number[],
  firstVisible: number | undefined,
): number | undefined {
  if (firstVisible === undefined) return undefined
  let active: number | undefined
  for (const index of stickyIndexes) {
    if (index > firstVisible) break
    active = index
  }
  return active
}

/** `base` (virtual-core's `defaultRangeExtractor`) plus the active sticky index, ascending. */
export function extractRangeWithSticky(
  range: Range,
  stickyIndexes: readonly number[],
  base: (range: Range) => number[],
): number[] {
  const indexes = base(range)
  const active = activeStickyIndex(stickyIndexes, range.startIndex)
  if (active === undefined || indexes.includes(active)) return indexes
  return [active, ...indexes]
}

// ── Degrade target ───────────────────────────────────────────────────────────────

/**
 * Every row rendered unwindowed in the same scroll owner. This is what a list falls back to when
 * `@tanstack/react-virtual` fails to resolve (peer absent). Sticky headers stay `position: sticky`
 * through CSS alone.
 *
 * NOT used as the `Suspense` fallback (see `SuspensePane`): mounting every real row for the one
 * tick the lazy import takes would make that settle a genuine unmount/remount of every row,
 * re-firing each row's effects and risking a message mid-stream during the resolve window.
 */
export function NonVirtualizedRows({
  rows,
  height,
  gap = 0,
  fallbackGap = gap,
  className,
  style,
}: VirtualRowsProps): JSX.Element {
  const list = (
    // theme-allow inline-display — the degrade target is a plain column of rows.
    <div style={{ display: 'flex', flexDirection: 'column', gap: fallbackGap }}>
      {rows.map((row) =>
        row.sticky === true ? (
          <div key={row.key} style={STICKY_STYLE}>
            {row.node}
          </div>
        ) : (
          <Fragment key={row.key}>{row.node}</Fragment>
        ),
      )}
    </div>
  )
  // theme-allow raw-scroll-container — degrade target owns its own scroll node, same as the real virtualizer below.
  if (height === undefined)
    return (
      <div className={cx(className)} style={style}>
        {list}
      </div>
    )
  return (
    // theme-allow raw-scroll-container — as above.
    <div className={cx(className)} style={{ height, overflow: 'auto', ...style }}>
      {list}
    </div>
  )
}

/** Test-only escape hatch: proves the peer-absent degrade renders every row without having to fight
 * `React.lazy`'s permanent once-per-module-instance resolution cache. */
export const nonVirtualizedRowsFallback = NonVirtualizedRows

// ── Lazy virtualizer ─────────────────────────────────────────────────────────────

type ReactVirtual = typeof import('@tanstack/react-virtual')

/** The slice of the virtualizer the rows component reads — it never leaves that component. */
type RowsVirtualizer = {
  readonly getVirtualItems: () => ReadonlyArray<{ readonly index: number; readonly start: number }>
  readonly getTotalSize: () => number
  readonly measureElement: (node: Element | null) => void
  readonly scrollToEnd: (options?: { behavior?: ScrollBehavior }) => void
  readonly range: { readonly startIndex: number } | null
}

type RowsOptions = Pick<
  Parameters<ReactVirtual['useVirtualizer']>[0],
  | 'count'
  | 'estimateSize'
  | 'overscan'
  | 'getItemKey'
  | 'anchorTo'
  | 'followOnAppend'
  | 'scrollEndThreshold'
  | 'useFlushSync'
  | 'gap'
  | 'scrollMargin'
  | 'rangeExtractor'
> & { readonly getScrollElement: () => Element | null }

type UseRowsVirtualizer = (options: RowsOptions) => RowsVirtualizer

/** `measureElement` with the hidden-ancestor 0px guard (see {@link resolveGuardedMeasurement}).
 * NOT `enabled: false`, which virtual-core wipes `itemSizeCache`/`measurementsCache` on. */
function guardedMeasure<TScroll extends Element | Window>(base: ReactVirtual['measureElement']) {
  return (
    element: Element,
    entry: ResizeObserverEntry | undefined,
    instance: Virtualizer<TScroll, Element>,
  ): number => resolveGuardedMeasurement(instance, element, base(element, entry, instance))
}

/** One rows component per scroll owner (element or window), since the hook differs. Window height
 * for the `null` scroll parent, else the element's own `offsetHeight` — the measurement
 * virtual-core's `getRect` takes, so a hidden ancestor reads as unmeasured. */
function createRows(rv: ReactVirtual, useRowsVirtualizer: UseRowsVirtualizer, onWindow: boolean) {
  return function VirtualRowsInner({
    rows,
    height,
    overscan,
    estimateSize,
    gap = 0,
    initialScroll = 'start',
    anchorTo = 'start',
    followOnAppend = false,
    parent,
    className,
    style,
  }: InnerProps): JSX.Element {
    'use no memo'
    const ownRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const initialScrollStateRef = useRef<InitialScrollState>({ hasApplied: false, attempts: 0 })
    const stickyIndexes = useMemo(
      () => rows.flatMap((row, index) => (row.sticky === true ? [index] : [])),
      [rows],
    )
    const rangeExtractor = useMemo(
      () => (range: Range) =>
        extractRangeWithSticky(range, stickyIndexes, rv.defaultRangeExtractor),
      [stickyIndexes],
    )
    const elementNode = (): HTMLElement | null => parent?.element ?? ownRef.current
    const scrollNode = (): Element | null => (onWindow ? document.scrollingElement : elementNode())

    // `getItemKey` returns `row.key` (NOT the default index) so a prepend/stream doesn't scramble
    // anchoring; `useFlushSync: false` is the React-19 opt-out `BasaltVirtualList` documents.
    const virtualizer = useRowsVirtualizer({
      count: rows.length,
      getScrollElement: scrollNode,
      estimateSize: () => estimateSize,
      overscan,
      gap,
      scrollMargin: parent?.margin ?? 0,
      rangeExtractor,
      getItemKey: (index) => rows[index]?.key ?? index,
      anchorTo,
      followOnAppend,
      scrollEndThreshold: SCROLL_END_THRESHOLD,
      useFlushSync: false,
    })

    // The one-shot "open at the end" jump — see `applyInitialScroll` for the guard mechanics,
    // including why this effect deliberately carries NO dependency array.
    useLayoutEffect(() => {
      applyInitialScroll(
        initialScrollStateRef.current,
        initialScroll,
        rows.length,
        () => (onWindow ? window.innerHeight : (elementNode()?.offsetHeight ?? 0)),
        () => virtualizer.scrollToEnd({ behavior: 'auto' }),
        () =>
          parent === undefined
            ? isContainerAtEnd(scrollNode(), SCROLL_END_THRESHOLD)
            : isListAtEnd(listRef.current, parent.element, SCROLL_END_THRESHOLD),
      )
    })

    const margin = parent?.margin ?? 0
    const virtualItems = virtualizer.getVirtualItems()
    // `range` is assigned inside `calculateRange` (virtual-core index.js:795), which
    // `getVirtualItems()` drives through `getVirtualIndexes` — before this call it is the PREVIOUS
    // render's (null on the first), so the active header is derived after it.
    const activeSticky = activeStickyIndex(stickyIndexes, virtualizer.range?.startIndex)
    const items = (
      <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index]
          if (row === undefined) return null
          return (
            <div
              key={row.key}
              // Dynamic measurement of variable-height rows — `ref` and `data-index` are both
              // required together.
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={
                virtualItem.index === activeSticky
                  ? STICKY_STYLE
                  : {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start - margin}px)`,
                    }
              }
            >
              {row.node}
            </div>
          )
        })}
      </div>
    )
    // `scroll: 'parent'`: the ancestor scrolls; the outer wrapper already carries className/style.
    if (height === undefined) return items
    return (
      <div
        ref={ownRef}
        className={cx(className)}
        // theme-allow raw-scroll-container — TanStack Virtual measures/scrolls this element (never nest in BasaltStickToBottom, see agent/chat/virtualize).
        style={{ height, overflow: 'auto', ...style }}
      >
        {items}
      </div>
    )
  }
}

/** Resolved once, permanently, per module instance — `LazyStickToBottom`'s caching behaviour. */
const LazyVirtualRows = lazy<ComponentType<InnerProps>>(() =>
  import('@tanstack/react-virtual')
    .then((rv) => {
      const { useVirtualizer, useWindowVirtualizer, measureElement } = rv
      const Rows = createRows(
        rv,
        (o) =>
          useVirtualizer({
            ...o,
            measureElement: guardedMeasure(measureElement),
          }),
        false,
      )
      const WindowRows = createRows(
        rv,
        ({ getScrollElement: _unused, ...o }) =>
          useWindowVirtualizer({ ...o, measureElement: guardedMeasure(measureElement) }),
        true,
      )
      return {
        default: function Dispatch(props: InnerProps): JSX.Element {
          return props.parent?.element === null ? <WindowRows {...props} /> : <Rows {...props} />
        },
      }
    })
    .catch(() => ({ default: NonVirtualizedRows })),
)
Object.assign(LazyVirtualRows, { displayName: 'LazyVirtualRows' })

/** `Suspense` fallback: an empty, correctly sized scroll pane — shown only for the one tick the
 * dynamic import takes. Deliberately not `NonVirtualizedRows` (see its doc). */
function SuspensePane({
  height,
  className,
  style,
}: BasaltProps & { readonly height: number | string }): JSX.Element {
  // theme-allow raw-scroll-container — placeholder owns its own scroll node, matching the real virtualizer's shape.
  return <div className={cx(className)} style={{ height, overflow: 'auto', ...style }} />
}

/** Measures which box scrolls the list and where the list starts inside it. */
function measureParent(list: HTMLElement | null): ParentScroll | null {
  if (list === null) return null
  const element = scrollParentOf(list)
  const top = list.getBoundingClientRect().top
  const margin =
    element === null
      ? top + window.scrollY
      : top - element.getBoundingClientRect().top - element.clientTop + element.scrollTop
  return { element, margin: Math.round(margin) }
}

function sameParent(a: ParentScroll | null, b: ParentScroll): boolean {
  return a !== null && a.element === b.element && a.margin === b.margin
}

function ParentRows(props: Extract<VirtualRowsProps, { scroll: 'parent' }>): JSX.Element {
  const { className, style, ...rest } = props
  const listRef = useRef<HTMLDivElement>(null)
  const [parent, setParent] = useState<ParentScroll | null>(null)

  const remeasure = (): void => {
    const next = measureParent(listRef.current)
    if (next !== null) setParent((prev) => (sameParent(prev, next) ? prev : next))
  }

  // After every commit (a layout read, no dependency array); an unchanged value bails the state
  // out. Changes that arrive WITHOUT a commit — a font or image settling above the list — are the
  // observer's job below.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- every commit, by design (see above)
  useLayoutEffect(remeasure)

  // The offset moves when anything above the list resizes, and that resizes every ancestor between
  // the list and the scrollport (the list's own box and the scrollport's do not change). Observe
  // that chain, plus the window for the window case.
  const scroller = parent?.element
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- `remeasure` only reads refs and a stable setter
  useEffect(() => {
    const list = listRef.current
    if (list === null) return
    window.addEventListener('resize', remeasure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure)
    for (let node: HTMLElement | null = list; node !== null; node = node.parentElement) {
      observer?.observe(node)
      if (node === scroller) break
    }
    return () => {
      window.removeEventListener('resize', remeasure)
      observer?.disconnect()
    }
  }, [scroller])

  return (
    <div ref={listRef} className={cx(className)} style={style}>
      {parent !== null && (
        <Suspense fallback={null}>
          <LazyVirtualRows {...rest} parent={parent} />
        </Suspense>
      )}
    </div>
  )
}

/** The seam. `height` → own scroll node; `scroll: 'parent'` → the nearest scrolling ancestor. */
export function VirtualRows(props: VirtualRowsProps): JSX.Element {
  if (props.scroll === 'parent') return <ParentRows {...props} />
  return (
    <Suspense
      fallback={
        <SuspensePane
          height={props.height}
          {...(props.className !== undefined && { className: props.className })}
          {...(props.style !== undefined && { style: props.style })}
        />
      }
    >
      <LazyVirtualRows {...props} />
    </Suspense>
  )
}
