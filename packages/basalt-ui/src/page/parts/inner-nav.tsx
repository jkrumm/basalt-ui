import { useContext, useEffect, useId, useRef } from 'react'
import type { MouseEventHandler, ReactElement } from 'react'
import { scrollParentOf } from '../../common/scroll-parent'
import { cn } from '../../core/cn'
import { page } from '../../core/messages/page'
import { useMessages } from '../../core/messages/use-messages'
import { Button } from '../../ui/button'
import { CountBadge } from '../../ui/badge'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu'
import type { InnerNavGroup, InnerNavItem, InnerNavProps, PushField } from '../contract'
import { SplitListContext } from './split-page'

/**
 * What `InnerNav` reads off its `state` beyond the frozen `PushField`: whether the field was
 * written (`isSet`, the signal `SplitPage selected` takes) and the props of one item's link. The
 * real binding is the controls layer's; until a handle carries both, `InnerNav` raises a plain error
 * instead of rendering links that go nowhere.
 */
export type InnerNavHandle<K extends string> = PushField<K> & {
  readonly isSet: boolean
  link(value: K): { href: string; onClick?: MouseEventHandler<HTMLAnchorElement> }
}

function handleOf<K extends string>(state: PushField<K>): InnerNavHandle<K> {
  const handle = state as Partial<InnerNavHandle<K>>
  if (typeof handle.link !== 'function') {
    throw new Error(
      'basalt-ui: `InnerNav state` must be a push field whose handle has `link(value)`; ' +
        'a handle without it cannot render real links',
    )
  }
  return state as InnerNavHandle<K>
}

const LINK =
  'flex h-ctl min-w-0 flex-1 items-center gap-2 rounded-ctrl px-2.5 text-sm whitespace-nowrap text-muted-foreground focus-ring hover:bg-accent hover:text-foreground pointer-coarse:min-h-11 aria-[current=page]:bg-selected aria-[current=page]:font-medium aria-[current=page]:text-foreground'

function Badge({ badge }: { badge: NonNullable<InnerNavItem['badge']> }): ReactElement {
  const t = useMessages(page)
  if ('count' in badge)
    return <CountBadge count={badge.count} attention={badge.attention === true} />
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0 rounded-full',
          badge.attention === true ? 'bg-brand-fill' : 'bg-muted-foreground',
        )}
      />
      {badge.attention === true && <span className="sr-only">{t('page.itemAttention')}</span>}
    </>
  )
}

function ItemMenu({ item }: { item: InnerNavItem }): ReactElement | null {
  const t = useMessages(page)
  if (item.menu === undefined) return null
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('page.itemActions', item.label)}
            className="ms-1"
          />
        }
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="13" cy="8" r="1.25" />
        </svg>
      </MenuTrigger>
      <MenuContent>
        {item.menu.map((entry) => (
          <MenuItem key={entry.id} onClick={entry.onSelect}>
            {entry.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

function Group<K extends string>({
  group,
  active,
  handle,
  strip,
}: {
  group: InnerNavGroup
  active: K
  handle: InnerNavHandle<K>
  strip: boolean
}): ReactElement {
  const labelId = useId()
  return (
    <div
      data-slot="inner-nav-group"
      className={cn(
        'flex gap-1',
        strip ? 'shrink-0 items-center @wide:flex-col @wide:items-stretch' : 'flex-col',
      )}
    >
      <p
        id={labelId}
        className={cn(
          'm-0 px-2.5 text-xs font-medium text-muted-foreground',
          strip && 'sr-only @wide:not-sr-only',
        )}
      >
        {group.label}
      </p>
      <ul
        aria-labelledby={labelId}
        className={cn(
          'm-0 flex list-none gap-1 p-0',
          strip ? 'flex-row @wide:flex-col' : 'flex-col',
        )}
      >
        {group.items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id} data-slot="inner-nav-item" className="flex shrink-0 items-center">
              <a
                {...handle.link(item.id as K)}
                aria-current={item.id === active ? 'page' : undefined}
                className={LINK}
              >
                {Icon !== undefined && <Icon className="size-icon shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && <Badge badge={item.badge} />}
              </a>
              <ItemMenu item={item} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * A page's inner sidebar: groups of section links on a `push` field, so each section is a history
 * entry and Back walks them. Every item is a real `<a href>` through the handle's `link()`, with
 * `aria-current` on the active one, so middle-click, copy-link and the status bar all work. One DOM
 * at every width: a standalone nav is a vertical list from the `wide` container tier and a
 * horizontally scrolling link strip below it (never a `Select`, which would lose the hrefs); inside
 * a `SplitPage` list pane it stays a list. An item may carry a count or dot `badge` and a `menu`
 * of two or more actions (a single action is a plain button elsewhere). A section change resets
 * the page's scroll; a write to a `filter` control does not.
 *
 * @useWhen a page has named sections or panes the URL should remember (settings, the sections of a record)
 * @neverWhen the state is a `replace` field (it is a type error) or the choices are views of one dataset (use `ViewTabs`) or an inspector for a row (use `PageAside`)
 *
 * @example
 * <InnerNav
 *   label="Settings"
 *   state={store.field.section}
 *   filter={filterSlot([qSpec])}
 *   groups={[{ id: 'account', label: 'Account', items: [
 *     { id: 'general', label: 'General', icon: Cog },
 *     { id: 'billing', label: 'Billing', badge: { dot: true }, menu: [exportItem, resetItem] },
 *   ] }]}
 * />
 */
export function InnerNav<K extends string = string>({
  label,
  state,
  filter,
  groups,
}: InnerNavProps<K>): ReactElement {
  const handle = handleOf(state)
  const [active] = state.use()
  const inSplit = useContext(SplitListContext)
  const strip = !inSplit
  const nav = useRef<HTMLElement>(null)
  const previous = useRef(active)

  useEffect(() => {
    if (previous.current === active) return
    previous.current = active
    const el = nav.current
    if (el === null) return
    // The pane's page scrolls, not the list column the nav may sit in: start above the split.
    const scroller = scrollParentOf(el.closest('[data-slot="split-page"]') ?? el)
    if (scroller === null) window.scrollTo({ top: 0 })
    else scroller.scrollTo({ top: 0 })
  }, [active])

  return (
    <nav
      ref={nav}
      data-slot="inner-nav"
      aria-label={label}
      className={cn(
        'flex min-w-0 gap-2',
        strip
          ? 'items-center overflow-x-auto overscroll-x-contain @wide:flex-col @wide:items-stretch @wide:gap-3 @wide:overflow-visible'
          : 'flex-col gap-3',
      )}
    >
      {filter !== undefined && (
        <div data-slot="inner-nav-filter" className={cn('shrink-0', !strip && 'w-full')}>
          {filter.render()}
        </div>
      )}
      {groups.map((group) => (
        <Group key={group.id} group={group} active={active} handle={handle} strip={strip} />
      ))}
    </nav>
  )
}
