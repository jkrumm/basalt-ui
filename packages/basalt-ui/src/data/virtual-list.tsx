/**
 * ./data — BasaltVirtualList: a windowed virtual list over @tanstack/react-virtual,
 * rendered with a Mantine Box scroll container.
 * Optional peer: @tanstack/react-virtual >=3 <4.
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
import { type ReactNode, useRef } from 'react'

// ── Props ─────────────────────────────────────────────────────────────────────

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
export type BasaltVirtualListProps<T> = {
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
   * Stable key for each item. Falls back to the numeric list index when omitted.
   * Providing a stable key prevents react reconciliation churn on scroll.
   */
  getItemKey?: (item: T, index: number) => string | number
  /**
   * When true, renders skeleton placeholder rows at the given height instead of the virtual item
   * list. The scroll container is still rendered at the specified `height`. Use while async data
   * is loading.
   */
  isLoading?: boolean
  /**
   * Number of skeleton rows to render when `isLoading` is true.
   * @default 5
   */
  skeletonRows?: number
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
export function BasaltVirtualList<T>({
  items,
  height,
  estimateSize = 40,
  overscan = 5,
  renderItem,
  getItemKey,
  isLoading = false,
  skeletonRows = 5,
}: BasaltVirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    // Silences a React 19 deprecation warning: TanStack Virtual calls flushSync on scroll;
    // setting this to false opts out of that path entirely.
    useFlushSync: false,
    ...(getItemKey !== undefined && {
      getItemKey: (index: number) => {
        const item = items[index]
        return item !== undefined ? getItemKey(item, index) : index
      },
    }),
  })

  if (isLoading) {
    return (
      <Box style={{ height, overflow: 'auto' }}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div
            key={`skeleton-${i}`}
            style={{ height: estimateSize, padding: '8px 12px', boxSizing: 'border-box' }}
          >
            <Skeleton height={estimateSize - 16} radius="sm" />
          </div>
        ))}
      </Box>
    )
  }

  return (
    <Box
      ref={parentRef}
      style={{
        height,
        overflow: 'auto',
      }}
    >
      {/* Inner sizer — defines total scroll height for the virtualizer */}
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index]
          if (item === undefined) return null
          return (
            <div
              key={virtualItem.key}
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
            </div>
          )
        })}
      </div>
    </Box>
  )
}
