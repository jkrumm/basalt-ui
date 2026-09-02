/**
 * ./data — BasaltVirtualList: a windowed virtual list over @tanstack/react-virtual,
 * rendered with a Mantine Box scroll container.
 * Optional peer: @tanstack/react-virtual >=3.13.26 <4. This list works on any 3.x — the floor is
 * set by ./agent-chat's virtualize mode (see ./data/index.ts), so do not lower it.
 *
 * @example
 * import { BasaltVirtualList } from 'basalt-ui/data'
 *
 * const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `Row ${i}` }))
 * <BasaltVirtualList
 *   items={items}
 *   height={400}
 *   renderItem={(item) => <div>{item.label}</div>}
 *   getItemKey={(item) => item.id}
 * />
 */
import { Box, Skeleton } from '@mantine/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ScrollToOptions, Virtualizer } from '@tanstack/react-virtual'
import { useImperativeHandle, useRef } from 'react'
import type { ReactNode, Ref } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { BASALT_PREFIX } from '../common/errors'
import { assertRequiredProps, useValidateProps } from '../common/validate'
import { ErrorState } from '../dashboard/query-state'
import type { QueryStateLike } from '../dashboard/query-state'
import { dataQueryBranch } from './query-branch'

// ── Props ─────────────────────────────────────────────────────────────────────

/** The two boxes `BasaltVirtualList` paints: `root` is the scroll container, `row` is each
 * absolutely-positioned virtual item. */
export type BasaltVirtualListSlot = 'root' | 'row'

/**
 * Props for {@link BasaltVirtualList}.
 *
 * @example
 * const props: BasaltVirtualListProps<{ id: number; label: string }> = {
 *   items: rows,
 *   height: 400,
 *   estimateSize: 48,
 *   overscan: 5,
 *   renderItem: (item, index) => <div key={item.id}>{index}: {item.label}</div>,
 *   getItemKey: (item) => item.id,
 * }
 */
export type BasaltVirtualListProps<T> = BasaltProps &
  SlotStylesProps<BasaltVirtualListSlot> & {
    /** All items in the list (unsliced — virtualization is handled internally). */
    items: T[]
    /** Height of the scroll container. Accepts a CSS value ('400px', '60vh') or a number in px. */
    height: number | string
    /**
     * Estimated row height in px (used for virtual layout before measure).
     * @default 40
     */
    estimateSize?: number
    /**
     * Number of items rendered beyond the visible viewport (above + below) to reduce flicker.
     * @default 5
     */
    overscan?: number
    /**
     * Render function for a single item. Receives the item and its list index.
     * The returned node is placed inside an absolutely-positioned row container.
     */
    renderItem: (item: T, index: number) => ReactNode
    /**
     * Stable key for each item, handed straight to the virtualizer's own `getItemKey` — required,
     * not merely recommended: the previous index fallback hid stale rows across a mutation (an
     * insert/delete shifting every index below it keeps rendering the OLD item at each shifted
     * index until React's own reconciliation happens to catch up), silently, in the one component
     * whose job is a long mutable list.
     */
    getItemKey: (item: T, index: number) => string | number
    /**
     * When true, renders skeleton placeholder rows at the given height instead of the virtual item
     * list. The scroll container is still rendered at the specified `height`. Use while async data
     * is loading.
     *
     * Superseded by `query`, which resolves this branch AND the two this prop cannot express — pass
     * both and `query` wins, with a dev warning.
     */
    isLoading?: boolean
    /**
     * The result behind `items`, resolved into a body: pending → the skeleton rows, error with no
     * data → an `ErrorState` inside the scroll box (the query's own `refetch` behind Retry),
     * anything else → the rows, or `emptyState` when `items` is empty.
     *
     * Law C3's uniform container contract (`docs/CONTROLS-SPEC.md` §1). The list took `isLoading`
     * and nothing else (components audit #3), so a failed fetch and a genuinely empty list rendered
     * the same blank box — the exact false claim `QueryState` exists to delete.
     *
     * The container keeps its declared `height` through every branch, so the page does not jump as
     * the state resolves.
     */
    query?: QueryStateLike<unknown>
    /**
     * Rendered inside the scroll container when `items` is empty and nothing is pending. Omit to
     * keep today's rendering — an empty box. Works with or without `query`.
     */
    emptyState?: ReactNode
    /**
     * Number of skeleton rows to render when `isLoading` is true.
     * @default 5
     */
    skeletonRows?: number
    /** Imperative scroll handle — see {@link BasaltVirtualListHandle}. */
    ref?: Ref<BasaltVirtualListHandle>
  }

/**
 * Imperative escape hatch for {@link BasaltVirtualList} — the virtualizer's own `scrollToIndex` /
 * `scrollToOffset` / `scrollToEnd` were otherwise unreachable, since the component owns the
 * `useVirtualizer()` instance internally. `getVirtualizer()` is the full escape hatch for anything
 * not covered by the three convenience methods (mirrors `./data/table`'s `useReactTable` export as
 * the table's own escape hatch).
 *
 * @example
 * const listRef = useRef<BasaltVirtualListHandle>(null)
 * <BasaltVirtualList ref={listRef} items={items} height={400} renderItem={renderRow} getItemKey={(i) => i.id} />
 * listRef.current?.scrollToIndex(42, { align: 'center' })
 */
export type BasaltVirtualListHandle = {
  /** Scrolls so the item at `index` is in view. */
  scrollToIndex: (index: number, opts?: ScrollToOptions) => void
  /** Scrolls the container to a raw pixel `offset`. */
  scrollToOffset: (offset: number, opts?: ScrollToOptions) => void
  /** Scrolls to the end of the list. */
  scrollToEnd: (opts?: Pick<ScrollToOptions, 'behavior'>) => void
  /**
   * The underlying `@tanstack/react-virtual` instance — the full escape hatch. Returns the RAW
   * `@tanstack/react-virtual` `Virtualizer`, so a future major of that library reaching this shape
   * ships here as a plain `feat:` under the no-majors doctrine (`../../CLAUDE.md` "Commit type
   * discipline"), not a silent break.
   */
  getVirtualizer: () => Virtualizer<HTMLDivElement, Element>
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A windowed virtual list backed by TanStack Virtual, rendered inside a Mantine `Box` scroll
 * container. Only the visible rows (+`overscan`) are in the DOM at any time.
 *
 * Important: `useFlushSync: false` is set explicitly to silence a React 19 scroll warning
 * (TanStack Virtual internally calls the deprecated `flushSync` on scroll events; this opt-out
 * disables that path and is the correct setting for React 19+ apps).
 *
 * Render pattern: scroll container (fixed height, overflow auto) → inner sizer div (total height,
 * position relative) → absolutely-positioned virtual rows via `transform: translateY(vi.start)`.
 *
 * @example
 * const items = Array.from({ length: 5_000 }, (_, i) => ({ id: i, name: `User ${i}` }))
 * <BasaltVirtualList
 *   items={items}
 *   height={300}
 *   estimateSize={40}
 *   renderItem={(item) => <div style={{ padding: '8px 12px' }}>{item.name}</div>}
 *   getItemKey={(item) => item.id}
 * />
 */
export function BasaltVirtualList<T>(props: BasaltVirtualListProps<T>) {
  // F-ERR-1: without this, a list missing `items`/`renderItem`/`getItemKey` fails deep inside
  // `useVirtualizer` as a raw `TypeError` caught by `BasaltErrorBoundary` — a blank subtree with no
  // message naming any of the three.
  assertRequiredProps('BasaltVirtualList', props, ['items', 'renderItem', 'getItemKey'])
  const {
    items,
    height,
    estimateSize = 40,
    overscan = 5,
    renderItem,
    getItemKey,
    isLoading = false,
    query,
    emptyState,
    skeletonRows = 5,
    ref,
    className,
    style,
    classNames,
  } = props

  // `query` resolves the pending branch `isLoading` used to own, plus the error and empty ones the
  // boolean cannot express — so it wins outright, and says so rather than letting the flag look
  // broken.
  useValidateProps(
    'BasaltVirtualList',
    () =>
      query === undefined || props.isLoading === undefined
        ? null
        : `${BASALT_PREFIX} BasaltVirtualList: props "query" and "isLoading" are both set — ` +
          '"query" wins and "isLoading" is ignored. Drop "isLoading".',
    [query === undefined, props.isLoading === undefined],
  )

  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    // Silences a React 19 deprecation warning: TanStack Virtual calls flushSync on scroll;
    // setting this to false opts out of that path entirely.
    useFlushSync: false,
    getItemKey: (index: number) => {
      const item = items[index]
      return item !== undefined ? getItemKey(item, index) : index
    },
  })

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index, opts) => rowVirtualizer.scrollToIndex(index, opts),
      scrollToOffset: (offset, opts) => rowVirtualizer.scrollToOffset(offset, opts),
      scrollToEnd: (opts) => rowVirtualizer.scrollToEnd(opts),
      getVirtualizer: () => rowVirtualizer,
    }),
    [rowVirtualizer],
  )

  const branch = query === undefined ? undefined : dataQueryBranch('BasaltVirtualList', query)
  const showSkeleton = branch === undefined ? isLoading : branch === 'pending'
  // Every non-virtual branch paints into the SAME box at the SAME declared height, so the page does
  // not reflow as one state resolves into the next.
  const boxProps = {
    className: cx(classNames?.root, className),
    style: {
      height,
      // theme-allow raw-scroll-container — matches the virtualizer's own scroll box below, so a
      // placeholder branch doesn't reflow.
      overflow: 'auto' as const,
      ...style,
    },
  }

  if (branch === 'error' && query !== undefined) {
    return (
      <Box {...boxProps}>
        <ErrorState
          error={query.error}
          title="Could not load"
          tier="section"
          retrying={query.fetchStatus === 'fetching'}
          onRetry={() => void query.refetch()}
        />
      </Box>
    )
  }

  if (showSkeleton) {
    return (
      <Box {...boxProps}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Box
            key={`skeleton-${i}`}
            style={{
              height: estimateSize,
              padding: 'var(--vx-space-virtual-row-inset-y) var(--vx-space-virtual-row-inset-x)',
              boxSizing: 'border-box',
            }}
          >
            {/* Inner height = row height minus the row's own vertical inset (top + bottom), read
                from the same density-tracking var the padding above uses — a hardcoded subtrahend
                would only be correct at density level 0. */}
            <Skeleton
              height={`calc(${estimateSize}px - 2 * var(--vx-space-virtual-row-inset-y))`}
              radius="sm"
            />
          </Box>
        ))}
      </Box>
    )
  }

  if (items.length === 0 && emptyState !== undefined) return <Box {...boxProps}>{emptyState}</Box>

  return (
    <Box
      ref={parentRef}
      className={cx(classNames?.root, className)}
      style={{
        height,
        // theme-allow raw-scroll-container — TanStack Virtual measures this element as the scroll container.
        overflow: 'auto',
        ...style,
      }}
    >
      {/* Inner sizer — defines total scroll height for the virtualizer */}
      <Box
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index]
          if (item === undefined) return null
          return (
            <Box
              key={virtualItem.key}
              className={cx(classNames?.row)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
