import { useContext, useId, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { PANEL_MAX, PanelHandle, usePanelWidth } from '../core/panel'
import { cn } from '../core/cn'
import type { IconComponent, NavTarget, RecordSequence } from '../core/ports'
import type { AvatarEntry } from '../ui/avatar'
import { DOCK_WIDTH } from './core/docking'
import type { FavouriteInput } from './contract'
import { widthStore } from './core/panel-store'
import { PageHostContext, ShellDockContext } from './page'
import {
  PanelBody,
  PanelFooter,
  PanelHeader,
  panelKeys,
  useFocusIn,
  usePanelLabels,
} from './record-panel'
import type { PanelActions } from './record-panel'
import { useSizeClass } from './use-size-class'

/** The narrowest a dock goes. */
export const DOCK_MIN = 320

export type DockProps = {
  /** The accessible name and the visible heading: what is shown (`Issue 12`). Required. */
  title: string
  /** A short mono tag before the title (`#12`), for what the heading does not say. */
  tag?: string
  /** The record's own page. Draws an `Open full page` link in the header. */
  fullPage?: string | NavTarget
  /** Draws a star in the header that adds the record to the shell rail's Favourites; nothing outside an `AppShell` or on a phone, where the rail is not drawn. */
  favourite?: FavouriteInput
  /** The close button and Escape inside the panel: the caller decides how the address changes (`usePeek().dock.close`). */
  onClose: () => void
  /** A glyph before the title, for what kind of record it is. */
  icon?: IconComponent
  /** A face before the title, for a person or an object; wins over `icon`. */
  avatar?: AvatarEntry
  /** The record's own actions, data like `PageBar` actions: the first two in the header, the rest in its More menu (a third alone stays inline). */
  actions?: PanelActions
  /** The opener's records: previous and next in the header, ArrowUp and ArrowDown on the panel. */
  records?: RecordSequence
  /** A band under the body for a form's actions. */
  footer?: ReactNode
  children?: ReactNode
}

type DockStyle = CSSProperties & { '--dock-w': string }

/**
 * A record panel that belongs to the shell, not to a page: it sits at the end edge beside main
 * and pushes it (main reflows, with a short slide) while there is room for `MAIN_MIN_WIDTH` of
 * main; with no room, and on a phone, it is the same panel over main, as a `Peek` is. It stays
 * through route changes, and mounting it at the app root keyed to a URL field is what makes it
 * global. Mount one at a time: two would stack. An overlaid one covers a docked `PageAside`, as a
 * `Peek` does. Not modal: nothing is inert and
 * Escape inside the panel closes it. Focus moves in when it mounts and back to the opener when it
 * unmounts. A handle on its start edge resizes it (pointer, ArrowLeft and ArrowRight, Enter or a
 * double click to reset), the device remembers the width, and a docked one pushes main by that
 * width. It draws the one panel anatomy `Peek` and `PageAside` share. Without a shell it is a block in flow. `usePeek({ dockField })` from `basalt-ui/router`
 * owns the `?dock=` address, the click that swaps its record and the pin from a `Peek`.
 *
 * @useWhen a record chosen from a list should stay open beside the screen while the reader keeps working in it, on any page
 * @neverWhen the record is a page's own inspector (`PageAside`), the choice is a quick look that should vanish (`Peek`), or the form must block the page (`Sheet`)
 *
 * @example
 * const peek = usePeek({ field: globals.field.peek, dockField: globals.field.dock, kinds: { issue: '/issues/$id' } })
 * {peek.dock.open && (
 *   <Dock title={`Issue ${peek.dock.open.id}`} fullPage={peek.dock.fullPage ?? undefined} onClose={peek.dock.close}>
 *     <IssueView id={peek.dock.open.id} />
 *   </Dock>
 * )}
 */
export function Dock({
  title,
  tag,
  fullPage,
  favourite,
  onClose,
  icon,
  avatar,
  actions,
  records,
  footer,
  children,
}: DockProps): ReactElement | null {
  const labels = usePanelLabels()
  const host = useContext(PageHostContext)
  const dock = useContext(ShellDockContext)
  const sizeClass = useSizeClass()
  const panel = useRef<HTMLElement>(null)
  const id = useId()
  const width = usePanelWidth({ store: widthStore('dock'), name: 'dock', min: DOCK_MIN })
  const shelled = host !== null
  // Under a shell the panel waits for the region to mount: a frame later than the first commit.
  const slot = dock?.slot ?? null
  const ready = !shelled || slot !== null
  const claim = dock?.claim
  const setWidth = dock?.setWidth
  const px = width.width ?? DOCK_WIDTH
  useIsomorphicLayoutEffect(() => claim?.(id), [claim, id])
  useIsomorphicLayoutEffect(() => setWidth?.(px), [setWidth, px])
  useFocusIn(panel, ready)
  if (!ready) return null
  const docked = dock?.docked === true
  const compact = sizeClass === 'compact'
  const style: DockStyle = {
    '--dock-w':
      compact && shelled ? 'calc(100vw - var(--shell-rail-w, 0px))' : shelled ? `${px}px` : '100%',
    ...(shelled && !compact && { maxWidth: PANEL_MAX }),
  }
  // Escape inside the panel closes it; a control that used the key itself has already prevented it.
  const keys = (event: KeyboardEvent<HTMLElement>): void => panelKeys(event, { onClose, records })
  const node = (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from the controls inside; the landmark itself takes no input
    <aside
      ref={panel}
      aria-label={title}
      tabIndex={-1}
      data-slot="dock"
      data-state={docked ? 'docked' : 'overlay'}
      onKeyDown={keys}
      style={style}
      className={cn(
        'flex h-full min-w-0 flex-col bg-background text-foreground outline-none',
        'transition-[translate,opacity] duration-slow ease-standard starting:translate-x-8 starting:opacity-0 motion-reduce:transition-none',
        // The panel is pinned to the end edge in both states: while the region grows, the panel is
        // revealed from the edge rather than squeezed. Its header meets the page-bar band's bottom edge.
        shelled ? 'absolute inset-y-0 end-0 z-30 w-(--dock-w)' : 'w-full',
        docked ? 'border-s border-border' : 'border-s border-border shadow-overlay',
      )}
    >
      {shelled && !compact && (
        <PanelHandle
          panel={panel}
          min={DOCK_MIN}
          label={labels.resize}
          onResize={width.resize}
          onCommit={width.commit}
        />
      )}
      <PanelHeader
        title={title}
        tag={tag}
        icon={icon}
        avatar={avatar}
        records={records}
        actions={actions}
        fullPage={fullPage}
        favourite={favourite}
        onClose={onClose}
        closeLabel={labels.close}
      />
      <PanelBody>{children}</PanelBody>
      <PanelFooter>{footer}</PanelFooter>
    </aside>
  )
  return shelled && slot !== null ? createPortal(node, slot) : node
}
