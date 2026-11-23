import { useContext, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PANEL_MAX, PanelHandle, usePanelWidth } from '../core/panel'
import { cn } from '../core/cn'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import type { IconComponent, NavTarget, RecordSequence } from '../core/ports'
import type { AvatarEntry } from '../ui/avatar'
import { Button } from '../ui/button'
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '../ui/menu'
import { Sheet, SheetContent } from '../ui/sheet'
import { PRESENTATIONS, presentationStore, widthStore } from './core/panel-store'
import type { Presentation } from './core/panel-store'
import type { FavouriteInput } from './contract'
import { PageHostContext, ShellOverlayContext } from './page'
import { PeekChip, PeekWindow } from './peek-window'
import type { WindowRect } from './peek-window'
import {
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelActionBar,
  PanelSteps,
  FullPageLink,
  panelKeys,
  useFocusIn,
  usePanelLabels,
} from './record-panel'
import type { PanelActions } from './record-panel'
import { useSizeClass } from './use-size-class'

/** The narrowest a peek goes: wide enough for a record's header and a line of body. */
export const PEEK_MIN = 384

export type PeekProps = {
  /** The accessible name and the visible heading: what is shown (`Issue 12`). Required. */
  title: string
  /** A short mono tag before the title (`#12`), for what the heading does not say. */
  tag?: string
  /** A glyph before the title, for what kind of record it is. */
  icon?: IconComponent
  /** A face before the title, for a person or an object; wins over `icon`. */
  avatar?: AvatarEntry
  /**
   * The record kind (`issue`): its presentation, its side width and its window's size are
   * remembered on the device per kind. Default `record`.
   */
  kind?: string
  /** The record's own page. Draws an `Open full page` link in the header; a plain click leaves the peek. */
  fullPage?: string | NavTarget
  /** Draws a star in the header that adds the record to the shell rail's Favourites; nothing outside an `AppShell` or on a phone, where the rail is not drawn. */
  favourite?: FavouriteInput
  /** Escape, the close button and Back: the caller decides how the address changes (`usePeek().close`). */
  onClose: () => void
  /** Draws a button that moves the record into the shell's `Dock` (`usePeek().pin`). Not drawn on a phone. */
  onPin?: () => void
  /** The record's own actions, data like `PageBar` actions: the first two in the header, the rest in its More menu (a third alone stays inline). */
  actions?: PanelActions
  /**
   * The opener's records in its order (`usePeek().go` or a table's rows): draws previous and
   * next, disabled at the ends, and ArrowUp and ArrowDown on the panel step through them in place.
   */
  records?: RecordSequence
  /** A band under the body for a form's actions. */
  footer?: ReactNode
  /**
   * The width in px the side panel opens at, from where the app saved it; else the width the
   * reader last dragged this kind to; else the default tiers. A width past the content area is
   * clamped by CSS, so a value saved on a wide screen is safe on a narrow one.
   */
  defaultWidth?: number
  /** The width in px once the user released the pointer or pressed a key on the handle, `null` once Enter or a double click put it back at the default. Basalt also remembers it per `kind`. */
  onWidthChange?: (px: number | null) => void
  children?: ReactNode
}

type PeekStyle = CSSProperties & { '--peek-w': string }

/**
 * The side panel's width as one custom property, which the resize handle sets: the width the
 * reader chose, else 60% of the viewport between 38 and 52rem.
 */
function peekWidth(shelled: boolean, chosen: number | null): string {
  if (!shelled) return '100%'
  if (chosen !== null) return `${chosen}px`
  return `min(52rem, max(38rem, 60vw), ${PANEL_MAX})`
}

function PresentMenu({
  value,
  onChange,
  onMinimise,
}: {
  value: Presentation
  onChange: (next: Presentation) => void
  onMinimise?: (() => void) | undefined
}): ReactElement {
  const t = useMessages(page)
  const label: Record<Presentation, string> = {
    peek: t('page.presentPeek'),
    window: t('page.presentWindow'),
    page: t('page.presentPage'),
  }
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={t('page.openAs')}
            data-panel="present"
          />
        }
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <path
            d="M2.5 3.5h11v9h-11zM9.5 3.5v9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuGroup label={t('page.openAs')}>
          <MenuRadioGroup
            value={value}
            onValueChange={(next: unknown) => {
              if (PRESENTATIONS.includes(next as Presentation)) onChange(next as Presentation)
            }}
          >
            {PRESENTATIONS.map((p) => (
              <MenuRadioItem key={p} value={p} data-present={p}>
                {label[p]}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
        {onMinimise !== undefined && (
          <>
            <MenuSeparator />
            <MenuItem data-panel="minimise" onClick={onMinimise}>
              {t('page.minimise')}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  )
}

/**
 * A record's panel, non-modal and over the page it was opened from: the page underneath stays
 * mounted and live (no scrim, nothing inert), so its scroll, filters and selection are where they
 * were when the panel closes, and another link can be clicked to swap what it shows. Focus moves in
 * when it opens and back to the opener when it closes; Escape inside it closes it (in a field the
 * first Escape only leaves the field).
 *
 * Under an `AppShell` it opens in one of three presentations, which the reader switches from the
 * header's `Open as` menu and the device remembers per `kind`: `peek`, a side panel at the end
 * edge between the header and the footer that does not scroll with the page, resized by a handle on
 * its start edge (pointer, or ArrowLeft and ArrowRight on the focused handle; Home and End for the
 * narrowest and the widest, Enter or a double click to reset), the width remembered per kind;
 * `window`, a floating window above every shell panel, dragged by its header and resized from its
 * edges and corners, which minimises to a chip in the corner; and `page`, which covers main and
 * the aside. Without a shell it is a block in flow. On a phone every presentation is a bottom
 * `Sheet` with the scrim.
 *
 * The header is the one panel anatomy `Dock`, `PageAside` and a right `Sheet` share: `icon` or
 * `avatar`, `tag` and `title`, previous and next from `records`, the record's typed `actions`,
 * the full-page link, the pin, `Open as` and close; `footer` adds a band under the body. One peek
 * at a time: a peek covers a docked `Dock` and `PageAside`, a window floats above them. It draws
 * no address and binds no window keys: `usePeek` from `basalt-ui/router` owns the `?peek=`
 * address, the click handler, history and Escape outside the panel, and hands it `onClose`.
 *
 * @useWhen a plain click on a record link or a table row should show the record beside a list or a graph without leaving it (master-detail with the list kept live)
 * @neverWhen the choice is a yes or no (a `Dialog`), a form edited beside the page that should block it (a `Sheet`), or a page's own inspector docked beside its content (`PageAside`)
 *
 * @example
 * const peek = usePeek({ field: globals.field.peek, kinds: { issue: '/issues/$id' } })
 * {peek.open && (
 *   <Peek
 *     kind="issue"
 *     title={`Issue ${peek.open.id}`}
 *     fullPage={peek.fullPage ?? undefined}
 *     records={{ ids: issueIds, id: peek.open.id, onStep: peek.go }}
 *     onClose={peek.close}
 *   >
 *     <IssueView id={peek.open.id} />
 *   </Peek>
 * )}
 */
export function Peek(props: PeekProps): ReactElement | null {
  const host = useContext(PageHostContext)
  const sizeClass = useSizeClass()
  if (host !== null && sizeClass === 'compact') return <PeekSheet {...props} />
  return <PeekPanel {...props} shelled={host !== null} />
}

/** The phone's presentation: a bottom sheet with the scrim; closing it is the peek's close. */
function PeekSheet({
  title,
  tag,
  fullPage,
  records,
  actions,
  footer,
  onClose,
  children,
}: PeekProps): ReactElement {
  return (
    <Sheet
      open
      placement="bottom"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        title={title}
        tag={tag}
        footer={footer}
        data-present="sheet"
        actions={
          records === undefined && fullPage === undefined && actions === undefined ? undefined : (
            <>
              {records !== undefined && <PanelSteps records={records} />}
              {actions !== undefined && <PanelActionBar actions={actions} />}
              {fullPage !== undefined && <FullPageLink href={fullPage} />}
            </>
          )
        }
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}

function PeekPanel({
  title,
  tag,
  icon,
  avatar,
  kind = 'record',
  fullPage,
  favourite,
  onClose,
  onPin,
  actions,
  records,
  footer,
  defaultWidth,
  onWidthChange,
  children,
  shelled,
}: PeekProps & { shelled: boolean }): ReactElement | null {
  const labels = usePanelLabels()
  const slot = useContext(ShellOverlayContext)
  const node = useRef<HTMLElement | null>(null)
  const [stored, setPresent] = presentationStore(kind).use()
  const [minimised, setMinimised] = useState(false)
  // Where the window was dragged to, so a restore from the chip brings it back there.
  const [placedAt, setPlacedAt] = useState<WindowRect | null>(null)
  const width = usePanelWidth({
    store: widthStore(`peek:${kind}`),
    name: `peek:${kind}`,
    min: PEEK_MIN,
    saved: defaultWidth,
    onWidthChange,
  })
  // Under a shell the panel waits for the region to mount: a frame later than the first commit.
  const ready = !shelled || slot !== null
  const surface = slot?.closest<HTMLElement>('[data-slot="shell-surface"]') ?? null
  const present: Presentation = !shelled
    ? 'peek'
    : stored === 'page' && surface === null
      ? 'peek'
      : stored
  const shown = present === 'window' && minimised ? 'chip' : present
  useFocusIn(node, ready, shown)
  if (!ready) return null

  const attach = (el: HTMLElement | null): void => {
    node.current = el
  }
  const keys = (event: KeyboardEvent<HTMLElement>): void => panelKeys(event, { onClose, records })
  const menu = shelled ? (
    <PresentMenu
      value={present}
      onChange={(next) => {
        setMinimised(false)
        setPresent(next)
      }}
      onMinimise={present === 'window' ? () => setMinimised(true) : undefined}
    />
  ) : undefined
  const header = (extra?: { onPointerDown?: (event: PointerEvent<HTMLElement>) => void }) => (
    <PanelHeader
      title={title}
      tag={tag}
      icon={icon}
      avatar={avatar}
      records={records}
      actions={actions}
      fullPage={fullPage}
      favourite={favourite}
      onPin={onPin}
      menu={menu}
      onClose={onClose}
      closeLabel={labels.close}
      onPointerDown={extra?.onPointerDown}
    />
  )
  const body = (
    <>
      <PanelBody>{children}</PanelBody>
      <PanelFooter>{footer}</PanelFooter>
    </>
  )

  if (shown === 'chip') {
    return createPortal(
      <PeekChip
        title={title}
        tag={tag}
        chipRef={attach}
        onKeyDown={keys}
        onRestore={() => setMinimised(false)}
        onClose={onClose}
      />,
      document.body,
    )
  }

  if (present === 'window') {
    return createPortal(
      <PeekWindow
        kind={kind}
        title={title}
        panelRef={attach}
        onKeyDown={keys}
        header={(drag) => header({ onPointerDown: drag })}
        from={placedAt}
        onPlaced={setPlacedAt}
      >
        {body}
      </PeekWindow>,
      document.body,
    )
  }

  if (present === 'page' && surface !== null) {
    return createPortal(
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape and the step keys bubble from the controls inside; the panel itself takes no input
      <dialog
        ref={attach}
        open
        aria-label={title}
        tabIndex={-1}
        data-slot="peek"
        data-present="page"
        onKeyDown={keys}
        // The surface is a grid: an absolute child placed on its main and aside tracks is sized by them.
        style={{ gridColumn: 'main-start / aside-end', gridRow: 'main' }}
        className={cn(
          'absolute inset-0 z-30 m-0 flex h-auto max-h-none w-auto max-w-none flex-col border-0 bg-card p-0 text-foreground outline-none',
          'transition-opacity duration-slow ease-standard starting:opacity-0 motion-reduce:transition-none',
        )}
      >
        {header()}
        {body}
      </dialog>,
      surface,
    )
  }

  const style: PeekStyle = {
    '--peek-w': peekWidth(shelled, width.width),
    ...(shelled && { maxWidth: PANEL_MAX }),
  }
  const side = (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape and the step keys bubble from the controls inside; the panel itself takes no input
    <dialog
      ref={attach}
      open
      aria-label={title}
      tabIndex={-1}
      data-slot="peek"
      data-present="peek"
      onKeyDown={keys}
      style={style}
      className={cn(
        'm-0 flex h-full max-h-none w-(--peek-w) min-w-0 flex-col border-0 bg-popover p-0 text-popover-foreground outline-none',
        'transition-[translate,opacity] duration-slow ease-standard starting:translate-x-8 starting:opacity-0 motion-reduce:transition-none',
        // In the shell the region is zero wide, so a percentage cap would cap the panel at nothing, and the
        // dialog's own `inset-inline-start: 0` must give way to the end edge. It meets the surface's end
        // edge, whose corners clip it, and draws a hairline and a shadow on its free side.
        shelled
          ? 'absolute inset-y-0 start-auto end-0 z-30 border-s border-border shadow-overlay'
          : 'max-w-full',
      )}
    >
      {shelled && (
        <PanelHandle
          panel={node}
          min={PEEK_MIN}
          slot="peek-handle"
          label={labels.resize}
          onResize={width.resize}
          onCommit={width.commit}
        />
      )}
      {header()}
      {body}
    </dialog>
  )
  return shelled && slot !== null ? createPortal(side, slot) : side
}
