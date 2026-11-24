/**
 * The page side of the one panel anatomy `Peek`, `Dock` and `PageAside` share: the header (lead,
 * title, tag, previous and next, the record's typed actions with an overflow menu, the tools a panel
 * adds, the presentation menu and close), the scrolling body, the footer band, the Escape and step
 * keys and the focus rule. The classes and the width handle are `core/panel`'s, which a right `Sheet`
 * reads too.
 * Internal: each panel owns its element, position and motion.
 */
import type { KeyboardEvent, PointerEvent, ReactElement, ReactNode } from 'react'
import { focusLost, focusMain } from '../common/focus'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import {
  PANEL_BODY,
  PANEL_DIVIDER,
  PANEL_FOOTER,
  PANEL_HEADER,
  PANEL_LEAD,
  PANEL_TAG,
  PANEL_TITLE,
} from '../core/panel'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import type { IconComponent, NavTarget, RecordSequence } from '../core/ports'
import { Avatar } from '../ui/avatar'
import type { AvatarEntry } from '../ui/avatar'
import { Button, buttonVariants } from '../ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/menu'
import type { FavoriteInput } from './contract'
import { FavoriteToggle } from './favorites'
import { ScrollArea } from '../ui/scroll-area'

/** The labels every side panel shares, so each message has one home: its close button and its width handle. */
export function usePanelLabels(): { close: string; resize: string } {
  const t = useMessages(page)
  return { close: t('page.closePeek'), resize: t('page.resizePeek') }
}

/**
 * One of a panel's own actions: data, like a `PageBar` action. The first two draw in the header and
 * the rest fold into its More menu; a third alone draws inline rather than as a menu of one.
 */
export type PanelAction = {
  id: string
  label: string
  /** Draws the action as an icon button named by `label`; without one it is a text button. */
  icon?: IconComponent
  onClick: () => void
  disabled?: boolean
}

/** At most five; the first two are inline. */
export type PanelActions = readonly [
  PanelAction?,
  PanelAction?,
  PanelAction?,
  PanelAction?,
  PanelAction?,
]

/** How many actions draw in the header before the rest fold into More. */
const INLINE = 2

export type PanelHeaderProps = {
  title: string
  tag?: string | undefined
  /** A glyph before the title, for what kind of record it is. */
  icon?: IconComponent | undefined
  /** A face before the title, for a person or an object; wins over `icon`. */
  avatar?: AvatarEntry | undefined
  /** The opener's records: draws previous and next. */
  records?: RecordSequence | undefined
  actions?: PanelActions | undefined
  fullPage?: string | NavTarget | undefined
  /** Draws the favorite star, before the full-page link; nothing outside an `AppShell`. */
  favorite?: FavoriteInput | undefined
  /** Draws the pin button. */
  onPin?: (() => void) | undefined
  /** The presentation menu, drawn after the divider. */
  menu?: ReactNode
  onClose?: (() => void) | undefined
  closeLabel: string
  /** Marks the close button for a caller's selector (the aside's published `data-aside-close`). */
  closeMark?: 'data-aside-close' | undefined
  /** The header is a window's drag handle. */
  onPointerDown?: ((event: PointerEvent<HTMLElement>) => void) | undefined
  className?: string | undefined
}

function Glyph({ d }: { d: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const CLOSE = 'M4 4l8 8M12 4l-8 8'
const UP = 'M4 10l4-4 4 4'
const DOWN = 'M4 6l4 4 4-4'
const OUT = 'M6 3H3v10h10v-3M9 3h4v4M13 3L7 9'
const PIN = 'M10 2l4 4-2 .5-2.5 2.5.5 3-1 1-2.5-2.5L3 14l-1-1 3.5-3.5L3 7l1-1 3 .5L9.5 4 10 2z'

/** The link to the record's own page; a plain click leaves the panel. */
export function FullPageLink({ href }: { href: string | NavTarget }): ReactElement {
  const t = useMessages(page)
  return (
    <AppLink
      href={href}
      aria-label={t('page.openFullPage')}
      data-slot="peek-full-page"
      data-peek="off"
      className={buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' })}
    >
      <Glyph d={OUT} />
    </AppLink>
  )
}

/** The record before and after the shown one in the opener's order; `undefined` at an end. */
export function neighbours(records: RecordSequence): { prev?: string; next?: string } {
  const at = records.ids.indexOf(records.id)
  if (at < 0) return {}
  const prev = records.ids[at - 1]
  const next = records.ids[at + 1]
  return { ...(prev !== undefined && { prev }), ...(next !== undefined && { next }) }
}

/** Previous and next through the opener's records, disabled at the ends. */
export function PanelSteps({ records }: { records: RecordSequence }): ReactElement {
  const t = useMessages(page)
  const { prev, next } = neighbours(records)
  return (
    <div className="flex items-center" data-panel="steps">
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('page.previousRecord')}
        data-panel="previous"
        disabled={prev === undefined}
        onClick={() => {
          // Read again at the click: the opener may have re-ordered since this render.
          const to = neighbours(records).prev
          if (to !== undefined) records.onStep(to)
        }}
      >
        <Glyph d={UP} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('page.nextRecord')}
        data-panel="next"
        disabled={next === undefined}
        onClick={() => {
          const to = neighbours(records).next
          if (to !== undefined) records.onStep(to)
        }}
      >
        <Glyph d={DOWN} />
      </Button>
    </div>
  )
}

/** The record's typed actions: the first two inline, the rest in a More menu (a third alone stays inline). */
export function PanelActionBar({ actions }: { actions: PanelActions }): ReactElement | null {
  const t = useMessages(page)
  const list = actions.filter((action): action is PanelAction => action !== undefined)
  if (list.length === 0) return null
  // One more than fits inline would fold one action alone; it draws inline instead.
  const inline = list.length === INLINE + 1 ? list : list.slice(0, INLINE)
  const folded = list.slice(inline.length)
  return (
    <div className="flex items-center gap-1" data-panel="actions">
      {inline.map(({ id, label, icon: Icon, onClick, disabled }) =>
        Icon === undefined ? (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            data-action-id={id}
            disabled={disabled}
            onClick={onClick}
          >
            {label}
          </Button>
        ) : (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={label}
            data-action-id={id}
            disabled={disabled}
            onClick={onClick}
          >
            <Icon className="size-icon" aria-hidden="true" />
          </Button>
        ),
      )}
      {folded.length > 0 && (
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                shape="icon"
                aria-label={t('page.recordActions')}
                data-panel="more"
              />
            }
          >
            <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
              <circle cx="3" cy="8" r="1.25" />
              <circle cx="8" cy="8" r="1.25" />
              <circle cx="13" cy="8" r="1.25" />
            </svg>
          </MenuTrigger>
          <MenuContent align="end">
            {folded.map(({ id, label, onClick, disabled }) => (
              <MenuItem key={id} data-action-id={id} disabled={disabled} onClick={onClick}>
                {label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
    </div>
  )
}

/**
 * The header at the bar height: lead, tag, title, then previous and next, the record's actions, the
 * full-page link and the pin, a divider, the presentation menu and close.
 */
export function PanelHeader({
  title,
  tag,
  icon: Icon,
  avatar,
  records,
  actions,
  fullPage,
  favorite,
  onPin,
  menu,
  onClose,
  closeLabel,
  closeMark,
  onPointerDown,
  className,
}: PanelHeaderProps): ReactElement {
  const t = useMessages(page)
  const lead =
    avatar !== undefined ? (
      <Avatar {...avatar} size="xs" aria-hidden="true" />
    ) : Icon !== undefined ? (
      <Icon className="size-icon" aria-hidden="true" />
    ) : null
  const tools = fullPage !== undefined || onPin !== undefined || favorite !== undefined
  const end = menu !== undefined || onClose !== undefined
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a window's drag handle; the keyboard path is the side panel and the page presentation
    <header
      data-panel="header"
      onPointerDown={onPointerDown}
      className={cn(PANEL_HEADER, className)}
    >
      {lead !== null && <span className={PANEL_LEAD}>{lead}</span>}
      {tag !== undefined && <span className={PANEL_TAG}>{tag}</span>}
      <h2 className={PANEL_TITLE}>{title}</h2>
      <div className="flex shrink-0 items-center gap-1" data-peek="off">
        {records !== undefined && <PanelSteps records={records} />}
        {actions !== undefined && <PanelActionBar actions={actions} />}
        {favorite !== undefined && <FavoriteToggle {...favorite} />}
        {fullPage !== undefined && <FullPageLink href={fullPage} />}
        {onPin !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={t('page.pinPanel')}
            data-slot="peek-pin"
            onClick={onPin}
          >
            <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
              <path d={PIN} stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            </svg>
          </Button>
        )}
        {end && (records !== undefined || actions !== undefined || tools) && (
          <span aria-hidden="true" className={PANEL_DIVIDER} />
        )}
        {menu}
        {onClose !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={closeLabel}
            data-panel="close"
            {...(closeMark !== undefined && { [closeMark]: '' })}
            onClick={onClose}
          >
            <Glyph d={CLOSE} />
          </Button>
        )}
      </div>
    </header>
  )
}

/** The panel's scrolling body. */
export function PanelBody({ children }: { children?: ReactNode }): ReactElement {
  return <ScrollArea className={PANEL_BODY}>{children}</ScrollArea>
}

/** The footer band, for a form's actions; nothing when there is no footer. */
export function PanelFooter({ children }: { children?: ReactNode }): ReactElement | null {
  if (children === undefined || children === null || children === false) return null
  return (
    <div data-panel="footer" className={PANEL_FOOTER}>
      {children}
    </div>
  )
}

/** Another popup (a menu, a listbox, a popover) owns the key: its portal bubbles through the panel. */
const OWNED = '[role="menu"], [role="listbox"], [role="dialog"][data-open]'

const isField = (target: EventTarget): target is HTMLElement =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * The keys a panel answers on its own element: Escape closes it (in a field the first Escape only
 * leaves the field, and a menu or listbox inside keeps its own), and with `records` ArrowUp and
 * ArrowDown step through them while focus is on the panel or its header. A handled key is
 * prevented, so `usePeek`'s window listener does not close the panel a second time.
 */
export function panelKeys(
  event: KeyboardEvent<HTMLElement>,
  {
    onClose,
    records,
  }: { onClose?: (() => void) | undefined; records?: RecordSequence | undefined },
): void {
  if (event.defaultPrevented) return
  const target = event.target
  if (target instanceof Element && target.closest(OWNED) !== null) return
  if (event.key === 'Escape') {
    if (onClose === undefined) return
    event.preventDefault()
    if (isField(target)) {
      target.blur()
      return
    }
    onClose()
    return
  }
  if (records === undefined || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
  const onPanel =
    target === event.currentTarget ||
    (target instanceof Element && target.closest('[data-panel="header"]') !== null)
  if (!onPanel) return
  const { prev, next } = neighbours(records)
  const to = event.key === 'ArrowUp' ? prev : next
  event.preventDefault()
  if (to !== undefined) records.onStep(to)
}

/**
 * Takes focus into the panel when it mounts and gives it back to what had it when it unmounts,
 * else to the shell's main: closing removes the panel, and focus left on `<body>` makes the next
 * Tab start at the skip link. Focus that already went somewhere real (the reader moved on) stays.
 * `key` names the element the panel is drawn as (a presentation, a minimised chip): when it
 * changes, focus moves to the new element, and the return still goes to the first opener.
 */
export function useFocusIn(
  panel: { current: HTMLElement | null },
  mounted: boolean,
  key?: string,
): void {
  useIsomorphicLayoutEffect(() => {
    if (!mounted) return undefined
    const el = panel.current
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body ? active : null
    el?.focus({ preventScroll: true })
    return () => {
      const now = document.activeElement
      const shown = panel.current ?? el
      const inside = now instanceof HTMLElement && shown?.contains(now) === true
      if (!focusLost() && !inside) return
      if (opener?.isConnected === true) opener.focus({ preventScroll: true })
      else focusMain()
    }
  }, [panel, mounted])
  useIsomorphicLayoutEffect(() => {
    if (!mounted || key === undefined) return
    panel.current?.focus({ preventScroll: true })
  }, [key])
}
