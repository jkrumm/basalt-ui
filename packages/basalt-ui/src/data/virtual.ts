/**
 * ./data/virtual — BasaltVirtualList: a windowed virtual list over @tanstack/react-virtual,
 * rendered with a Mantine Box scroll container.
 *
 * Optional peer: @tanstack/react-virtual >=3.13.26 <4. This list works on any 3.x — the floor is
 * set by ./agent-chat's virtualize mode (see ./data/index.ts), so do not lower it.
 *
 * Use this fine subpath instead of the `./data` barrel when your app only needs the virtual list
 * — it does NOT value-import @tanstack/react-table, so the data-table peer is never required.
 *
 * Install with:
 *   bun add @tanstack/react-virtual
 *
 * @example
 * import { BasaltVirtualList } from 'basalt-ui/data/virtual'
 * const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `Row ${i}` }))
 * <BasaltVirtualList items={items} height={400} renderItem={(item) => <div>{item.label}</div>} />
 */

// ── BasaltVirtualList ─────────────────────────────────────────────────────────
export { BasaltVirtualList } from './virtual-list'
export type {
  BasaltVirtualListHandle,
  BasaltVirtualListProps,
  BasaltVirtualListSlot,
} from './virtual-list'
