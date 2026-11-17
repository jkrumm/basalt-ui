import { useContext, useRef } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../core/cn'
import type { NavTarget } from '../core/ports'
import { PageHostContext, ShellOverlayContext } from './page'
import { RecordPanelBody, RecordPanelHeader, useFocusIn } from './record-panel'
import { useSizeClass } from './use-size-class'
import type { SizeClass } from './use-size-class'

export type PeekProps = {
  /** The accessible name and the visible heading: what is shown (`Issue 12`). Required. */
  title: string
  /** A short mono tag before the title (`#12`), for what the heading does not say. */
  tag?: string
  /** The record's own page. Draws an `Open full page` link in the header; a plain click leaves the peek. */
  fullPage?: string | NavTarget
  /** Escape, the close button and Back: the caller decides how the address changes (`usePeek().close`). */
  onClose: () => void
  /** Draws a button that moves the record into the shell's `Dock` (`usePeek().pin`). Not drawn on a phone. */
  onPin?: () => void
  children?: ReactNode
}

type PeekStyle = CSSProperties & { '--peek-w': string }

/** The width of the content area under a shell: the viewport less the rail, which is 0 on a phone. */
const AREA = 'calc(100vw - var(--shell-rail-w, 0px))'

/**
 * The panel's width as one custom property, so a later resize handle sets the same property and
 * nothing else changes: the whole content area on a phone, else 60% of the viewport between 38 and
 * 52rem and never closer than 3rem to the rail.
 */
function peekWidth(sizeClass: SizeClass, shelled: boolean): string {
  if (!shelled) return '100%'
  if (sizeClass === 'compact') return AREA
  return `min(52rem, max(38rem, 60vw), calc(${AREA} - 3rem))`
}

/**
 * A right-side panel (a non-modal `<dialog open>`) over the page it was opened from, for a record: the page underneath stays
 * mounted, so its scroll, filters and selection are where they were when the panel closes. It is
 * not modal (no scrim, nothing inert), so another link can be clicked to swap what it shows. Under
 * an `AppShell` it sits over main between the header and the footer and does not scroll with the
 * page; without one it is a block in flow. Focus moves in when it opens and back to the opener
 * when it closes. `onPin` adds a button that moves the record into the shell's `Dock`. It draws no address and binds no keys: `usePeek` from `basalt-ui/router` owns
 * the `?peek=` address, the click handler, history and Escape, and hands this panel its `onClose`.
 *
 * @useWhen a plain click on a record link should show the record beside a list or a graph without leaving it (master-detail with the list kept live)
 * @neverWhen the choice is a yes or no (a `Dialog`), a form edited beside the page that should block it (a `Sheet`), or a page's own inspector docked beside its content (`PageAside`)
 *
 * @example
 * const peek = usePeek({ field: globals.field.peek, kinds: { issue: '/issues/$id' } })
 * {peek.open && (
 *   <Peek title={`Issue ${peek.open.id}`} fullPage={peek.fullPage ?? undefined} onClose={peek.close}>
 *     <IssueView id={peek.open.id} />
 *   </Peek>
 * )}
 */
export function Peek({
  title,
  tag,
  fullPage,
  onClose,
  onPin,
  children,
}: PeekProps): ReactElement | null {
  const host = useContext(PageHostContext)
  const slot = useContext(ShellOverlayContext)
  const sizeClass = useSizeClass()
  const panel = useRef<HTMLDialogElement>(null)
  const shelled = host !== null
  // Under a shell the panel waits for the region to mount: a frame later than the first commit.
  const ready = !shelled || slot !== null
  useFocusIn(panel, ready)
  if (!ready) return null
  const style: PeekStyle = { '--peek-w': peekWidth(sizeClass, shelled) }
  const node = (
    <dialog
      ref={panel}
      open
      aria-label={title}
      tabIndex={-1}
      data-slot="peek"
      style={style}
      className={cn(
        'm-0 flex h-full max-h-none w-(--peek-w) min-w-0 flex-col border-0 bg-popover p-0 text-popover-foreground shadow-overlay outline-none',
        'transition-[translate,opacity] duration-300 ease-standard starting:translate-x-8 starting:opacity-0 motion-reduce:transition-none',
        // In the shell the region is zero wide, so a percentage cap would cap the panel at nothing, and the
        // dialog's own `inset-inline-start: 0` must give way to the end edge.
        shelled ? 'absolute inset-y-0 start-auto end-0 z-30' : 'max-w-full',
        sizeClass !== 'compact' && 'rounded-s-card',
      )}
    >
      <RecordPanelHeader
        title={title}
        tag={tag}
        fullPage={fullPage}
        onClose={onClose}
        onPin={sizeClass === 'compact' ? undefined : onPin}
      />
      <RecordPanelBody>{children}</RecordPanelBody>
    </dialog>
  )
  return shelled && slot !== null ? createPortal(node, slot) : node
}
