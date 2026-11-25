import { useContext, useEffect, useId, useRef } from 'react'
import type { MouseEvent, MouseEventHandler, ReactElement } from 'react'
import { scrollParentOf } from '../../common/scroll-parent'
import { cn } from '../../core/cn'
import { AppLink } from '../../core/link'
import { page } from '../../core/messages/page'
import { resolvePhase } from '../../core/phase'
import { useMessages } from '../../core/messages/use-messages'
import { Button } from '../../ui/button'
import { CountBadge } from '../../ui/badge'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu'
import { Skeleton } from '../../ui/skeleton'
import type { InnerNavGroup, InnerNavItem, InnerNavProps, PushField } from '../contract'
import { SplitListContext } from './split-page'

/** An anchor's own props. */
type AnchorLink = { href: string; onClick?: MouseEventHandler<HTMLAnchorElement> }

/**
 * What `InnerNav` reads off its `state` beyond the frozen `PushField`: `useHref()`, a hook that
 * returns each value's href. A `defineControls` push field (`basalt-ui/router`) builds it through
 * the router, so this file imports none; a handle without it raises a plain error instead of
 * rendering links that go nowhere.
 */
export type InnerNavHandle<K extends string> = PushField<K> & {
  useHref(): (value: K) => string
  /** A `defineControls` field's choice write: it keeps the fallback pane in the URL, where `use()`'s setter unsets it. */
  choose?(value: K): void
}

function handleOf<K extends string>(state: PushField<K>): InnerNavHandle<K> {
  const handle = state as Partial<InnerNavHandle<K>>
  if (typeof handle.useHref !== 'function') {
    throw new Error(
      'basalt-ui: `InnerNav state` must be a push field whose handle has `useHref()` ' +
        '(a `defineControls` field); a handle without it cannot render real links',
    )
  }
  return state as InnerNavHandle<K>
}

/** A plain left click writes the field; a modified one (new tab, download) is the browser's. */
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)

/** One item's anchor props: the handle's href, and a plain click writes through the field. */
function anchorOf<K extends string>(
  href: (value: K) => string,
  pick: (value: K) => void,
  value: K,
): AnchorLink {
  return {
    href: href(value),
    onClick: (event) => {
      if (!isPlainClick(event)) return
      event.preventDefault()
      pick(value)
    },
  }
}

// A navigation row is a list's whole target: it keeps a 44 px row on a phone, where rows sit flush and no `::after` can reach past a neighbour.
const LINK =
  'flex h-ctl min-w-0 pointer-coarse:min-h-11 flex-1 items-center gap-2 rounded-ctrl px-2.5 text-sm whitespace-nowrap text-muted-foreground focus-ring hover:bg-accent hover:text-foreground aria-[current=page]:bg-selected aria-[current=page]:font-medium aria-[current=page]:text-foreground'

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
            size="sm"
            shape="icon"
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
        {item.menu.map((entry) =>
          'href' in entry ? (
            // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- MenuItem passes its children into the link
            <MenuItem key={entry.id} render={<AppLink href={entry.href} />}>
              {entry.label}
            </MenuItem>
          ) : (
            <MenuItem key={entry.id} onClick={entry.onClick}>
              {entry.label}
            </MenuItem>
          ),
        )}
      </MenuContent>
    </Menu>
  )
}

function Group<K extends string>({
  group,
  active,
  anchor,
  strip,
  loading,
}: {
  group: InnerNavGroup
  active: K
  anchor: (value: K) => AnchorLink
  strip: boolean
  loading: boolean
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
          // Loading: the group's rows hold their places and carry no link until the data settles.
          if (loading)
            return (
              <li key={item.id} data-slot="inner-nav-item" className="flex shrink-0 items-center">
                <div className="flex h-ctl min-w-0 flex-1 items-center px-2.5 text-sm pointer-coarse:min-h-11">
                  <Skeleton className="w-24" />
                </div>
              </li>
            )
          const Icon = item.icon
          return (
            <li key={item.id} data-slot="inner-nav-item" className="flex shrink-0 items-center">
              <AppLink
                {...(item.href === undefined ? anchor(item.id as K) : { href: item.href })}
                {...(item.id === active && { 'aria-current': 'page' as const })}
                className={LINK}
              >
                {Icon !== undefined && <Icon className="size-icon shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && <Badge badge={item.badge} />}
              </AppLink>
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
 * entry and Back walks them. Every item is a real `<a href>` built from the handle's `useHref()` (a
 * `defineControls` push field builds it through the router), with `aria-current` on the active one, so
 * middle-click, copy-link and the status bar all work; a plain click writes the field. One DOM
 * at every width: a standalone nav is a vertical list from the `wide` container tier and a
 * horizontally scrolling link strip below it (never a `Select`, which would lose the hrefs); inside
 * a `SplitPage` list pane it stays a list. An item may carry a count or dot `badge` and a `menu`
 * of two or more actions (a single action is a plain button elsewhere). A section change resets
 * the page's scroll; a write to a `filter` control does not. Given a `phase` that is loading, the
 * groups keep their labels and each item draws a placeholder row with no link, so the column holds
 * its width and height until the data lands.
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
  phase,
}: InnerNavProps<K>): ReactElement {
  const loading = resolvePhase({ phase }).tag === 'loading'
  const handle = handleOf(state)
  const [active, set] = state.use()
  const href = handle.useHref()
  const pick = (value: K): void => (handle.choose === undefined ? set(value) : handle.choose(value))
  const anchor = (value: K): AnchorLink => anchorOf(href, pick, value)
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
      {...(loading && { 'aria-busy': true, 'data-phase': 'loading' })}
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
        <Group
          key={group.id}
          group={group}
          active={active}
          anchor={anchor}
          strip={strip}
          loading={loading}
        />
      ))}
    </nav>
  )
}
