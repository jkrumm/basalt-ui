/**
 * Compile-time proof that `menu` is one shape: every card frame and `InnerNavItem` takes the same
 * `CardMenu` (action data the frame draws), made of the same `MenuEntry`. Checked by `tsc --noEmit`;
 * every `@ts-expect-error` is one "never".
 */
import type { DataPanelProps, KanbanCardProps, StatCardProps } from '../cards/contract'
import type { ChartCardProps } from '../charts/contract'
import type { InnerNavItem } from '../page/contract'
import type { CardMenu, MenuEntry } from './phase'

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const assert = <T extends true>(): T | undefined => undefined

assert<Same<NonNullable<StatCardProps['menu']>, CardMenu>>()
assert<Same<NonNullable<DataPanelProps['menu']>, CardMenu>>()
assert<Same<NonNullable<ChartCardProps['menu']>, CardMenu>>()
assert<Same<NonNullable<InnerNavItem['menu']>, CardMenu>>()
/** A kanban card's own entries follow the move rows it always offers, so one entry is enough. */
assert<Same<NonNullable<KanbanCardProps<string>['menu']>[number], MenuEntry>>()

export const link: MenuEntry = { id: 'open', label: 'Open', href: '/flow' }
export const handler: MenuEntry = { id: 'export', label: 'Export', onClick: () => undefined }

// @ts-expect-error an entry has an `id`
export const noId: MenuEntry = { label: 'Open', href: '/flow' }

// @ts-expect-error an entry is a link or a handler
export const neither: MenuEntry = { id: 'x', label: 'X' }

// @ts-expect-error a menu has at least two entries; one action is a plain button
export const one: CardMenu = [link]

export const two: CardMenu = [link, handler]
