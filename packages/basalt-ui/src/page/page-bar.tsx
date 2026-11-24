import { useCallback, useContext, useId, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, MouseEvent, ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { requestMainFocus } from '../common/focus'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import { page } from '../core/messages/page'
import { SlotHomeContext } from '../core/slot-home'
import { useMessages } from '../core/messages/use-messages'
import { Button } from '../ui/button'
import { ButtonGroup } from '../ui/control-group'
import { EntityTitle } from '../ui/entity'
import { Input } from '../ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu'
import { ConnectionIndicator } from './connection-indicator'
import { FavoriteToggle } from './favorites'
import { devAssertOnce, createBarClaims } from './core/claims'
import { observeBarHeight, publishBarHeight } from './core/bar-measure'
import type {
  PageAction,
  PageBarProps,
  PageButtonAction,
  PageLayout,
  PageSearch,
  PageSettings,
  PageTextAction,
} from './contract'
import { PageContext, PageHostContext } from './page'
import { isEmptyTabs, renderTabs } from './page-tabs'
import { RefreshButton } from './refresh-button'

type Parent = NonNullable<PageBarProps['parent']>

/** A click the browser would follow in this document: main takes focus once the page it opens is in. */
function handOffOnPlainClick(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  requestMainFocus()
}

/** `Page`'s element, where `--page-bar-h` is written; the document without one. */
function publishTarget(node: HTMLElement): HTMLElement {
  return node.closest<HTMLElement>('[data-slot="page"]') ?? document.documentElement
}

/**
 * The breadcrumb a bar claims for a shell's header: the optional parent, then the leaf. Internal:
 * the shell draws this element as is, and the parent is a link through the provider's `link` for a
 * path string and a `NavTarget` alike, so a click navigates in the router and keeps the document.
 * The parent is the way up, never the current page (the adapter marks a link current only on an
 * exact match), and the leaf it replaces takes focus with it, so a click asks the shell to hand
 * focus to main.
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
      {parent !== undefined && (
        <AppLink
          href={parent.href}
          data-slot="page-breadcrumb-parent"
          data-basalt-hit=""
          className="focus-ring hover:text-foreground"
          onClick={handOffOnPlainClick}
        >
          {parent.label}
        </AppLink>
      )}
      <span data-slot="page-breadcrumb-leaf">{title}</span>
    </>
  )
}

type Placement = 'bar' | 'more' | 'hidden'

type Placed = { action: PageAction; placement: Placement }

/**
 * The explicit `mobile` wins; else only the primary stays in the bar below the fold, so a title and
 * two actions never take the phone header from the title. The rest are the overflow menu's.
 */
function place(actions: readonly PageAction[]): Placed[] {
  return actions.map((action) => ({
    action,
    placement: action.mobile ?? ('primary' in action && action.primary === true ? 'bar' : 'more'),
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
      className={cn(folded && FOLDED, Icon !== undefined && 'pointer-coarse:min-w-11')}
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
            shape="icon"
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

/**
 * The actions row: joined groups, the `mobile` fold and the overflow menu. `primaryLast` moves the
 * segment holding the primary to the end, whole, with the primary last inside it, so the view row
 * ends on the primary and no two groups fuse.
 */
function PageActions({
  actions,
  primaryLast,
}: {
  actions: readonly PageAction[]
  primaryLast: boolean
}): ReactElement {
  const placed = place(actions)
  const segs = segments(placed)
  const holdsPrimary = (segment: Placed[]): boolean => segment.some((p) => isPrimary(p.action))
  // Within its own group too, so the row ends on the primary and the group stays joined.
  const primaryInLast = (segment: Placed[]): Placed[] => [
    ...segment.filter((p) => !isPrimary(p.action)),
    ...segment.filter((p) => isPrimary(p.action)),
  ]
  const ordered = primaryLast
    ? [...segs.filter((s) => !holdsPrimary(s)), ...segs.filter(holdsPrimary).map(primaryInLast)]
    : segs
  const overflow = placed.flatMap(({ action, placement }) =>
    placement === 'more' && !isText(action) ? [action] : [],
  )
  return (
    <div data-slot="page-actions" className="flex min-w-0 items-center gap-2">
      {ordered.map((segment) => {
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
          <ButtonGroup key={group} className="min-w-0">
            {body}
          </ButtonGroup>
        )
      })}
      <MoreMenu items={overflow} />
    </div>
  )
}

const isEmptySlot = (slot: { count: number } | undefined): boolean =>
  slot === undefined || slot.count === 0

const isPrimary = (action: PageAction): boolean => 'primary' in action && action.primary === true

function SearchGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </svg>
  )
}

function SlidersGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2.5 4.5h6m3 0h2M2.5 11.5h2m3 0h6" />
      <circle cx="10" cy="4.5" r="1.5" />
      <circle cx="6" cy="11.5" r="1.5" />
    </svg>
  )
}

/**
 * The view row's search box, bound to a string field and written as the reader types: an empty box
 * unsets the field. An IME composition writes once, at its end, so a half-built word is never a
 * query. A value the field takes from elsewhere (a link, Back, a reset) replaces the box's text; a
 * value it takes from this box's own writes never does, however late a URL field reports it.
 */
function SearchBox({ search, className }: { search: PageSearch; className: string }): ReactElement {
  const [value, set] = search.state.use()
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  // Writes not yet reported back by the field, oldest first.
  const [pending, setPending] = useState<readonly string[]>([])
  if (seen !== value) {
    setSeen(value)
    const at = pending.indexOf(value)
    if (at === -1) {
      setText(value)
      setPending([])
    } else setPending(pending.slice(at + 1))
  }
  const commit = (next: string): void => {
    setPending((writes) => [...writes, next])
    if (next === '') search.state.clear()
    else set(next)
  }
  return (
    <div data-slot="page-bar-search" className={className}>
      <Input
        type="search"
        aria-label={search.label}
        placeholder={search.placeholder ?? search.label}
        start={SearchGlyph}
        value={text}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = event.currentTarget.value
          setText(next)
          if (!(event.nativeEvent as InputEvent).isComposing) commit(next)
        }}
        onCompositionEnd={(event) => {
          commit(event.currentTarget.value)
        }}
      />
    </div>
  )
}

/**
 * The view row's layout toggle: one icon per layout, named by its label. Below `@regular` it gives
 * its room to the tabs: a phone draws a table as cards whichever layout is set.
 */
function LayoutToggle<L extends string>({ layout }: { layout: PageLayout<L> }): ReactElement {
  const [value, set] = layout.state.use()
  // Pressed icon buttons on a tinted track, the look of `Segmented` without its toggle group in
  // the page barrel. One stays pressed: picking the pressed one again keeps it.
  return (
    <fieldset
      aria-label={layout.label}
      data-slot="page-bar-layout"
      className="m-0 hidden shrink-0 items-center gap-0.5 rounded-ctrl border-0 bg-accent p-0.5 @regular:inline-flex"
    >
      {layout.options.map(({ value: option, label, icon: Icon }) => (
        <Button
          key={option}
          variant="ghost"
          shape="icon"
          aria-label={label}
          aria-pressed={option === value}
          title={label}
          className="size-[calc(var(--basalt-ctl-h)-0.25rem)] rounded-chip text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground aria-pressed:shadow-raised forced-colors:border forced-colors:border-current forced-colors:aria-pressed:border-2"
          onClick={() => {
            set(option)
          }}
        >
          <Icon className="size-icon" aria-hidden="true" />
        </Button>
      ))}
    </fieldset>
  )
}

function SettingsButton({ settings }: { settings: PageSettings }): ReactElement {
  const Icon = settings.icon ?? SlidersGlyph
  return (
    <Button
      variant="ghost"
      shape="icon"
      aria-label={settings.label}
      title={settings.label}
      onClick={settings.onClick}
    >
      <Icon className="size-icon" aria-hidden="true" />
    </Button>
  )
}

/**
 * The page's band: the title and breadcrumb, then the view row of a list page. On its start the
 * page tabs, each a named view with an optional count and tone dot; on its end, in this order, the
 * search, the controls (the filters), the connection indicator, the refresh button, the layout
 * toggle, the view-settings button and the actions, the one primary last. One per `Page`; a second
 * renders nothing and raises a dev warning, so nested layouts that each render a bar fail loudly
 * instead of stacking two bands.
 *
 * The row is one line at every container tier: the tabs scroll sideways, the filters fold (`+N`, or
 * one `Filter` trigger for three or more), action labels become icons and secondary actions move to
 * the More menu below `@wide`, the search takes a line of its own under the band below `@wide`
 * (it scrolls away, so the sticky band stays one line tall), and below
 * `@regular` the layout toggle steps aside.
 *
 * Where it renders follows the context, never a prop. Under an `AppShell` `title` claims the
 * header's breadcrumb leaf (`parent` the trail before it, a link through the provider's `link` for a
 * path string and a `NavTarget` alike, so a click keeps the document), names the in-flow screen-reader `h1` and
 * `document.title`. `actions` end the band when it holds a control (tabs, search, controls,
 * connection, refresh, layout or settings) and claim the header's end, the identity row, when it
 * holds none. Without a shell `title` is the visible `h1` and `actions` sit in the band. A
 * band that holds a control is sticky at the nearest scrollport; a band of a title alone scrolls
 * away. It publishes its measured height as `--page-bar-h`; an empty band renders nothing. `tabs`
 * is `{ state, label, badges }` of an enum field (a tab strip bound to it; `badges` keyed by value
 * give a tab its count, `attention` and tone) or a `ControlsSlot` for custom content.
 * `actions` holds at most five entries and at most one `primary`. An `identity` (avatar, subtitle,
 * tags) makes the band a record header: the title is drawn beside its face as the page's visible
 * `h1`, in a shell too, and the tabs take a line under it, so a record page names itself once.
 *
 * @useWhen a screen needs a title, tabs, search, filters, a layout toggle, a refresh button or page-level actions in one band
 * @neverWhen the screen has none of those (leave the bar out) or the title belongs to a card (use the card title)
 *
 * @example
 * <PageBar
 *   tabs={{ state: store.field.status, label: 'Invoices', badges: { all: { count: 236 }, overdue: { count: 17, attention: true } } }}
 *   search={{ state: store.field.q, label: 'Search invoices' }}
 *   controls={filterSlot([customerSpec, methodSpec, issuedSpec], { match: { shown, total } })}
 *   layout={{ state: store.field.layout, label: 'Layout', options: [{ value: 'table', label: 'Table', icon: Rows3 }, { value: 'cards', label: 'Cards', icon: LayoutGrid }] }}
 *   settings={{ label: 'View settings', onClick: openView }}
 *   actions={[{ id: 'new', label: 'New invoice', icon: Plus, primary: true, onClick: create }]}
 * />
 *
 * @example
 * <PageBar
 *   title={run.name}
 *   parent={{ label: 'Runs', href: '/runs' }}
 *   controls={filterSlot([rangeSpec, envSpec])}
 *   refresh={{ scope: 'page', ...freshness.button }}
 * />
 *
 * @example
 * // A record page: the band carries the record's face, type line and tag, so the body never repeats its name.
 * <PageBar
 *   title={supplier.name}
 *   identity={{ avatar: { shape: 'object', icon: Factory }, subtitle: 'Hamburg, DE', tags: <Lozenge tone="good">Preferred</Lozenge> }}
 *   parent={{ label: 'Suppliers', href: '/suppliers' }}
 *   tabs={{ state: store.field.tab, label: 'Supplier' }}
 * />
 *
 * @example
 * // Date navigation: grouped actions that stay in the phone bar and a text action that does not.
 * <PageBar
 *   actions={[
 *     { id: 'prev', label: 'Previous week', group: 'date', mobile: 'bar', onClick: prev },
 *     { id: 'next', label: 'Next week', group: 'date', mobile: 'bar', onClick: next },
 *     { kind: 'text', id: 'range', text: 'Nov 3 to 9', mobile: 'hidden' },
 *   ]}
 * />
 */
export function PageBar<K extends string = string, L extends string = string>({
  title,
  identity,
  parent,
  controls,
  tabs,
  search,
  connection,
  refresh,
  layout,
  settings,
  favorite,
  actions,
}: PageBarProps<K, L>): ReactElement | null {
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
  // A band that holds a control is the view row, and the page's actions end it.
  const hasRow =
    !isEmptySlot(controls) ||
    !isEmptyTabs(tabs) ||
    search !== undefined ||
    connection !== undefined ||
    refresh !== undefined ||
    layout !== undefined ||
    settings !== undefined
  const actionsInHeader = inShell && !hasRow

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
    if (host === null || !owns || !actionsInHeader) return undefined
    if (list.length === 0 && favorite === undefined) return undefined
    return host.claim(
      'actions',
      <div data-slot="page-header-actions" className="flex min-w-0 items-center gap-2">
        {favorite !== undefined && <FavoriteToggle {...favorite} />}
        {list.length > 0 && <PageActions actions={list} primaryLast={false} />}
      </div>,
      `${id}:actions`,
    )
    // `list` is rebuilt per render, `actions` is the caller's value.
  }, [host, owns, id, actions, favorite, actionsInHeader])

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

  const bandActions = !actionsInHeader && list.length > 0
  const hasControls = hasRow || (!inShell && list.length > 0)
  const named = identity !== undefined && title !== undefined
  const bandHasContent = hasControls || named || (!inShell && title !== undefined)

  // An identity names the page visibly, in the band, with its face; the heading is then its `h1`.
  const heading: ReactNode =
    title === undefined ? null : named ? (
      <EntityTitle
        level={1}
        title={title}
        className="min-w-0 shrink"
        {...(identity.subtitle !== undefined && { subtitle: identity.subtitle })}
        {...(identity.avatar !== undefined && { avatar: identity.avatar })}
        {...(identity.tags !== undefined && { tags: identity.tags })}
      />
    ) : (
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

  // A band of title and actions alone scrolls away with the page; a band that holds a control stays.
  const sticky = hasControls
  const trail =
    inShell || parent === undefined ? null : (
      <>
        <AppLink
          href={parent.href}
          data-slot="page-breadcrumb-parent"
          data-basalt-hit=""
          className="text-sm text-muted-foreground hover:text-foreground focus-ring"
        >
          {parent.label}
        </AppLink>
        <span aria-hidden="true" className="text-faint">
          /
        </span>
      </>
    )

  const tabsNode = !isEmptyTabs(tabs) && (
    // Below regular the tabs scroll: the end fades so a cut tab reads as more, and the list keeps
    // that fade's width free at its end so the last tab is whole once scrolled to.
    <div
      data-slot="page-bar-tabs"
      className="flex min-w-0 shrink @max-regular:mask-[linear-gradient(to_right,black_calc(100%-1rem),transparent)] @max-regular:[&_[data-slot=tabs-list]]:pe-4"
    >
      {renderTabs(tabs, 'pill')}
    </div>
  )

  return (
    <>
      {inShell && !named && heading}
      <div
        ref={attach}
        data-slot="page-bar"
        data-sticky={sticky ? '' : undefined}
        className={cn(
          'flex flex-col gap-2 border-b border-border bg-surface py-2',
          // Flush with the chrome above (the page's top gutter is pulled back) and full bleed; the
          // gutter below the rule is kept, so content starts one gutter under it as on a bandless page.
          '-mx-(--page-gutter) -mt-(--page-gutter) mb-[calc(var(--page-gutter,--spacing(4))_-_--spacing(4))] px-[max(var(--page-gutter,0px),--spacing(1))]',
          // `Page` is an isolated stacking context, so z-30 clears the page body's z-10 and z-20 layers
          // (table head, event-list day rows, card menus) without reaching the shell's aside overlay.
          sticky && 'sticky top-0 z-30',
        )}
      >
        {/* One line at every tier: what does not fit scrolls (the tabs) or folds (filters, actions). */}
        <div data-slot="page-bar-row" className="flex min-w-0 flex-nowrap items-center gap-3">
          {(!inShell || named) && (trail !== null || heading !== null) && (
            <div
              className={cn('flex min-w-0 shrink gap-2', named ? 'items-center' : 'items-baseline')}
            >
              {trail}
              {heading}
            </div>
          )}
          {!named && tabsNode}
          {/* Grows into the room the tabs leave; never narrower than its fixed parts, so the tabs scroll first. */}
          <div
            data-slot="page-bar-end"
            className="ms-auto flex flex-1 flex-nowrap items-center justify-end gap-2 *:shrink-0"
          >
            {search !== undefined && (
              <SearchBox search={search} className="hidden w-56 shrink-0 @wide:block" />
            )}
            {!isEmptySlot(controls) && (
              // Pills take the room left and fold to it; a lone trigger keeps its own width beside the search.
              <div
                data-slot="page-bar-controls"
                className="flex min-w-0 flex-nowrap items-center justify-end gap-2 has-[[data-slot=filter-pills]]:flex-1 has-[[data-slot=filter-pills]]:shrink"
              >
                <SlotHomeContext value="page-bar">{controls?.render()}</SlotHomeContext>
              </div>
            )}
            {connection !== undefined && (
              <ConnectionIndicator connection={connection} className="shrink-0" />
            )}
            {refresh !== undefined && <RefreshButton {...refresh} />}
            {layout !== undefined && <LayoutToggle layout={layout} />}
            {favorite !== undefined && <FavoriteToggle {...favorite} />}
            {settings !== undefined && <SettingsButton settings={settings} />}
            {bandActions && <PageActions actions={list} primaryLast />}
          </div>
        </div>
        {named && tabsNode && (
          // With an identity the tabs take the line under it, so the face and name keep their room.
          <div data-slot="page-bar-tabs-row" className="flex min-w-0 items-center">
            {tabsNode}
          </div>
        )}
      </div>
      {search !== undefined && (
        // Below the sticky band, so the band stays one line tall and the search scrolls away with the page.
        <div
          data-slot="page-bar-search-line"
          className="@wide:hidden in-data-fill:px-[max(var(--page-gutter,0px),--spacing(1))] in-data-fill:pt-2"
        >
          <SearchBox search={search} className="w-full" />
        </div>
      )}
    </>
  )
}
