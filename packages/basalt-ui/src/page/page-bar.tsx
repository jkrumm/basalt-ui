import { useCallback, useContext, useId, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { cn } from '../core/cn'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { Button } from '../ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu'
import { devAssertOnce, createBarClaims } from './core/claims'
import { observeBarHeight, publishBarHeight } from './core/bar-measure'
import type { PageAction, PageBarProps, PageButtonAction, PageTextAction } from './contract'
import { PageContext, PageHostContext } from './page'

type Parent = NonNullable<PageBarProps['parent']>

/** `Page`'s element, where `--page-bar-h` is written; the document without one. */
function publishTarget(node: HTMLElement): HTMLElement {
  return node.closest<HTMLElement>('[data-slot="page"]') ?? document.documentElement
}

/**
 * The breadcrumb a bar claims for a shell's header: the optional parent, then the leaf. Internal:
 * the shell reads `title` and `parent` off this element's props and draws them with its own link
 * adapter (a `NavTarget` is opened only there); rendered as is, it is a plain trail.
 */
export function PageCrumb({
  title,
  parent,
}: {
  title: string
  parent?: Parent | undefined
}): ReactElement {
  return (
    <>
      {parent !== undefined &&
        (typeof parent.href === 'string' ? (
          <a data-slot="page-breadcrumb-parent" href={parent.href}>
            {parent.label}
          </a>
        ) : (
          <span data-slot="page-breadcrumb-parent">{parent.label}</span>
        ))}
      <span data-slot="page-breadcrumb-leaf">{title}</span>
    </>
  )
}

type Placement = 'bar' | 'more' | 'hidden'

type Placed = { action: PageAction; placement: Placement }

const MAX_BAR_ACTIONS = 2

/** The explicit `mobile` wins; else the primary and the first two actions stay in the bar. */
function place(actions: readonly PageAction[]): Placed[] {
  return actions.map((action, index) => ({
    action,
    placement:
      action.mobile ??
      (('primary' in action && action.primary === true) || index < MAX_BAR_ACTIONS
        ? 'bar'
        : 'more'),
  }))
}

/** Folded below the `wide` container tier: shown inline from it, hidden under it. */
const FOLDED = 'hidden @wide:inline-flex'

function ActionButton({
  action,
  folded,
}: {
  action: PageButtonAction
  folded: boolean
}): ReactElement {
  const Icon = action.icon
  return (
    <Button
      variant={action.primary === true ? 'primary' : 'secondary'}
      data-action-id={action.id}
      {...(folded && { className: FOLDED })}
      onClick={action.onClick}
    >
      {Icon !== undefined && <Icon className="size-icon" aria-hidden="true" />}
      <span className={Icon === undefined ? undefined : 'sr-only @wide:not-sr-only'}>
        {action.label}
      </span>
    </Button>
  )
}

function ActionText({ action, folded }: { action: PageTextAction; folded: boolean }): ReactElement {
  return (
    <span
      data-action-id={action.id}
      className={cn(
        'text-sm whitespace-nowrap text-muted-foreground',
        folded && 'hidden @wide:inline',
      )}
    >
      {action.text}
    </span>
  )
}

const isText = (action: PageAction): action is PageTextAction =>
  'kind' in action && action.kind === 'text'

/** Consecutive actions sharing a `group` render joined; the rest stand alone. */
function segments(placed: readonly Placed[]): Placed[][] {
  const out: Placed[][] = []
  for (const item of placed) {
    const last = out.at(-1)
    const group = isText(item.action) ? undefined : item.action.group
    const lastGroup =
      last === undefined || isText(last[0]!.action) ? undefined : last[0]!.action.group
    if (last !== undefined && group !== undefined && group === lastGroup) last.push(item)
    else out.push([item])
  }
  return out
}

function MoreMenu({ items }: { items: readonly PageButtonAction[] }): ReactElement | null {
  const t = useMessages(page)
  if (items.length === 0) return null
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('page.moreActions')}
            className="@wide:hidden"
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
        {items.map((item) => (
          <MenuItem key={item.id} onClick={item.onClick}>
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

/** The actions row: joined groups, the `mobile` fold and the overflow menu. */
function PageActions({ actions }: { actions: readonly PageAction[] }): ReactElement {
  const placed = place(actions)
  const overflow = placed.flatMap(({ action, placement }) =>
    placement === 'more' && !isText(action) ? [action] : [],
  )
  return (
    <div data-slot="page-actions" className="flex min-w-0 items-center gap-2">
      {segments(placed).map((segment) => {
        const body = segment.map(({ action, placement }) =>
          isText(action) ? (
            <ActionText key={action.id} action={action} folded={placement !== 'bar'} />
          ) : (
            <ActionButton key={action.id} action={action} folded={placement !== 'bar'} />
          ),
        )
        const group = isText(segment[0]!.action) ? undefined : segment[0]!.action.group
        if (group === undefined || segment.length === 1) return body
        return (
          <fieldset
            key={group}
            data-slot="page-action-group"
            className="m-0 inline-flex min-w-0 items-center border-0 p-0 [&>*:not(:first-child)]:-ms-px [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none"
          >
            {body}
          </fieldset>
        )
      })}
      <MoreMenu items={overflow} />
    </div>
  )
}

function RefreshButton({
  refresh,
}: {
  refresh: NonNullable<PageBarProps['refresh']>
}): ReactElement {
  const t = useMessages(page)
  return (
    <Button
      variant="ghost"
      size="icon"
      data-scope={refresh.scope}
      aria-label={t('page.refresh')}
      loading={refresh.syncing}
      title={refresh.error}
      onClick={refresh.onSync}
    >
      <svg
        viewBox="0 0 16 16"
        className={cn('size-icon', refresh.syncing && 'animate-spin motion-reduce:animate-none')}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  )
}

const isEmptySlot = (slot: { count: number } | undefined): boolean =>
  slot === undefined || slot.count === 0

/**
 * The page's band: the title and breadcrumb, the page tabs, the controls, the refresh button and
 * the actions. One per `Page`; a second renders nothing and raises a dev warning, so nested layouts
 * that each render a bar fail loudly instead of stacking two bands.
 *
 * Where it renders follows the context, never a prop. Under an `AppShell` `title` claims the
 * header's breadcrumb leaf (`parent` the trail before it), names the in-flow screen-reader `h1` and
 * `document.title`, and `actions` claim the header's end; the band holds only `tabs`, `controls`
 * and `refresh`. Without a shell `title` is the visible `h1` and `actions` sit in the band. The
 * band is sticky at the nearest scrollport and publishes its measured height as `--page-bar-h`; an
 * empty band renders nothing. `actions` holds at most five entries and at most one `primary`.
 *
 * @useWhen a screen needs a title, tabs, filters, a refresh button or page-level actions in one sticky band
 * @neverWhen the screen has none of those (leave the bar out) or the title belongs to a card (use the card title)
 *
 * @example
 * <PageBar
 *   title={run.name}
 *   parent={{ label: 'Runs', href: '/runs' }}
 *   controls={filterSlot([rangeSpec, envSpec])}
 *   refresh={{ scope: 'page', ...freshness.button }}
 *   actions={[{ id: 'new', label: 'New run', icon: Plus, primary: true, onClick: create }]}
 * />
 *
 * @example
 * // Date navigation: grouped actions and a text action, no primary.
 * <PageBar
 *   actions={[
 *     { id: 'prev', label: 'Previous week', group: 'date', onClick: prev },
 *     { id: 'next', label: 'Next week', group: 'date', onClick: next },
 *     { kind: 'text', id: 'range', text: 'Nov 3 to 9', mobile: 'hidden' },
 *   ]}
 * />
 */
export function PageBar({
  title,
  parent,
  controls,
  tabs,
  refresh,
  actions,
}: PageBarProps): ReactElement | null {
  const context = useContext(PageContext)
  const host = useContext(PageHostContext)
  const id = useId()
  const [orphan] = useState(createBarClaims)
  const store = context?.bars ?? orphan
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [warn] = useState(() =>
    devAssertOnce('[basalt] PageBar actions hold at most 5 entries and at most one primary.'),
  )

  const owns = snapshot.owner === undefined || snapshot.owner.id === id
  const inShell = host !== null
  const list = actions?.filter((action) => action !== undefined) ?? []
  const primaries = list.filter((action) => 'primary' in action && action.primary === true).length

  useIsomorphicLayoutEffect(() => {
    const handle = store.claim(id, undefined)
    return handle.release
  }, [store, id])

  useIsomorphicLayoutEffect(() => {
    if (list.length > 5 || primaries > 1) warn()
  }, [list.length, primaries, warn])

  // The title is the shell's: the breadcrumb leaf and the document title. Only the owner claims.
  useIsomorphicLayoutEffect(() => {
    if (host === null || !owns || title === undefined) return undefined
    const releaseCrumb = host.claim('breadcrumb', <PageCrumb title={title} parent={parent} />, id)
    const releaseTitle = host.claim('title', title, id)
    const previous = document.title
    document.title = title
    return () => {
      releaseCrumb()
      releaseTitle()
      document.title = previous
    }
  }, [host, owns, id, title, parent])

  useIsomorphicLayoutEffect(() => {
    if (host === null || !owns || list.length === 0) return undefined
    return host.claim('actions', <PageActions actions={list} />, `${id}:actions`)
    // `list` is rebuilt per render, `actions` is the caller's value.
  }, [host, owns, id, actions])

  // Publish the band height onto Page before paint, then on every resize. A zero reading is refused.
  useIsomorphicLayoutEffect(() => {
    if (node === null) return undefined
    const stop = observeBarHeight(node, publishTarget(node))
    if (host === null) return stop
    const report = (): void => {
      const { height } = node.getBoundingClientRect()
      if (height > 0) host.setBarHeight(height)
    }
    report()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(report)
    observer?.observe(node)
    return () => {
      observer?.disconnect()
      stop()
      host.setBarHeight(0)
    }
  }, [node, host])

  const attach = useCallback((el: HTMLElement | null) => {
    setNode(el)
    if (el !== null) publishBarHeight(el, publishTarget(el))
  }, [])

  if (!owns) return null

  const visibleActions = !inShell && list.length > 0
  const bandHasContent =
    !isEmptySlot(controls) ||
    !isEmptySlot(tabs) ||
    refresh !== undefined ||
    visibleActions ||
    (!inShell && title !== undefined)

  const heading: ReactNode =
    title === undefined ? null : (
      <h1
        className={
          inShell
            ? 'sr-only'
            : 'm-0 min-w-0 font-head text-lg font-semibold tracking-tight text-balance text-foreground'
        }
      >
        {title}
      </h1>
    )

  if (!bandHasContent) return <>{heading}</>

  const trail =
    inShell || parent === undefined ? null : (
      <>
        {typeof parent.href === 'string' ? (
          <a
            href={parent.href}
            data-slot="page-breadcrumb-parent"
            className="text-sm text-muted-foreground hover:text-foreground focus-ring"
          >
            {parent.label}
          </a>
        ) : (
          <span data-slot="page-breadcrumb-parent" className="text-sm text-muted-foreground">
            {parent.label}
          </span>
        )}
        <span aria-hidden="true" className="text-faint">
          /
        </span>
      </>
    )

  return (
    <>
      {inShell && heading}
      <div
        ref={attach}
        data-slot="page-bar"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 -mx-(--page-gutter) border-b border-border bg-background px-(--page-gutter) py-2"
      >
        {!inShell && (trail !== null || heading !== null) && (
          <div className="flex min-w-0 items-baseline gap-2">
            {trail}
            {heading}
          </div>
        )}
        {!isEmptySlot(tabs) && (
          <div data-slot="page-bar-tabs" className="min-w-0">
            {tabs?.render()}
          </div>
        )}
        <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {!isEmptySlot(controls) && (
            <div
              data-slot="page-bar-controls"
              className="flex min-w-0 flex-wrap items-center gap-2"
            >
              {controls?.render()}
            </div>
          )}
          {refresh !== undefined && <RefreshButton refresh={refresh} />}
          {visibleActions && <PageActions actions={list} />}
        </div>
      </div>
    </>
  )
}
