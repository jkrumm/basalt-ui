/**
 * More: the whole app slides to the right and reveals the rail behind it, as the desktop shows it
 * (the workspace switcher, favorites, every section, the blocks, settings and account), with search
 * pinned at its foot in thumb reach instead of at the rail's top. The
 * slide is the shell root's `translate`, a CSS transition on `--phone-sidebar-x`, so a tap that lands
 * mid-motion reverses it from where it is. The shifted app is one target: a tap returns it, and a
 * drag to the left follows the finger and returns it once it passes a quarter of the rail's width.
 *
 * The rail is the desktop part itself, its rows raised to the 44 px touch floor by this wrapper.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent, ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../../../core/cn'
import { useSizeClass } from '../../../../page/use-size-class'
import { Rail } from '../../rail'
import { WorkspaceMenu } from '../../workspace-switcher'
import type { VariantProps } from './host'
import { SearchGlyph, VARIANT_TEXT } from './parts'
import { SAFE } from './safe'

/** The spring settles in 500 ms: the rail stays drawn that long after More closes, then goes. */
const SLIDE_MS = 600

/** A drag past this share of the rail's width returns the app; a shorter one springs back. */
const RETURN_SHARE = 0.25
/** Movement under this many px is a tap. */
const TAP_SLOP = 6

const never = (): (() => void) => () => {}

/** False on the server and while hydrating, true after: the rail is a portal, so it is drawn on the client only. */
const useClient = (): boolean =>
  useSyncExternalStore(
    never,
    () => true,
    () => false,
  )

const shellOf = (el: Element | null): HTMLElement | null =>
  el?.closest<HTMLElement>('[data-slot="shell"]') ?? null

export function PhoneSidebar({
  open,
  onOpenChange,
  anchor,
  props,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Any element inside the shell root: the root is what slides. */
  anchor: HTMLElement | null
  props: VariantProps
}): ReactElement | null {
  const panel = useRef<HTMLElement | null>(null)
  const drag = useRef<{ x: number; dx: number } | null>(null)
  // The rail is drawn while More is open and while it slides away, not behind the app all day: a
  // closed phone has no second copy of the nav for a page to find.
  const [lingering, setLingering] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setLingering(!open)
  }
  useEffect(() => {
    if (!lingering) return undefined
    const timer = setTimeout(() => setLingering(false), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [lingering])
  const drawn = open || lingering

  // The shell root is outside React's reach from here: its slide is set on the element itself.
  useEffect(() => {
    const shell = shellOf(anchor)
    if (shell === null) return undefined
    const width = panel.current?.offsetWidth ?? 0
    shell.style.setProperty('--phone-sidebar-x', open ? `${width}px` : '0px')
    if (open) shell.setAttribute('data-phone-sidebar', '')
    else shell.removeAttribute('data-phone-sidebar')
    if (open) panel.current?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true })
    return undefined
  }, [open, anchor])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const width = (): number => panel.current?.offsetWidth ?? 0
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    drag.current = { x: event.clientX, dx: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
    shellOf(anchor)?.setAttribute('data-phone-dragging', '')
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const state = drag.current
    if (state === null) return
    state.dx = Math.min(0, event.clientX - state.x)
    shellOf(anchor)?.style.setProperty('--phone-sidebar-x', `${width() + state.dx}px`)
  }
  const onPointerUp = (): void => {
    const state = drag.current
    drag.current = null
    const shell = shellOf(anchor)
    shell?.removeAttribute('data-phone-dragging')
    if (state === null) return
    const tap = Math.abs(state.dx) < TAP_SLOP
    if (tap || -state.dx > width() * RETURN_SHARE) {
      onOpenChange(false)
      return
    }
    shell?.style.setProperty('--phone-sidebar-x', `${width()}px`)
  }

  const search = props.search
  const client = useClient()
  const compact = useSizeClass() === 'compact'
  // The rail is on screen beside the page from `md`: no second copy of it behind the app there.
  if (!client || !compact) return null
  return (
    <>
      {open && (
        // The shifted app: one target that returns it. Inside the shell root, so it slides with it.
        <div
          aria-hidden="true"
          data-slot="shell-phone-sidebar-scrim"
          className="fixed inset-0 z-50 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}
      {createPortal(
        <aside
          ref={panel}
          data-slot="shell-phone-sidebar"
          aria-label={VARIANT_TEXT.more}
          inert={!open}
          className={cn(
            SAFE,
            'fixed inset-y-0 start-0 z-0 flex w-[min(85vw,20rem)] flex-col gap-1 bg-background md:hidden',
            'pt-(--phone-safe-t) pb-(--phone-safe-b) ps-(--phone-safe-l)',
            // The rail's rows are 32 px for a pointer; a thumb gets the 44 px floor.
            '[&_a]:min-h-11 [&_button]:min-h-11 [&_button]:min-w-11',
          )}
        >
          {drawn && (
            <>
              {props.workspace !== undefined && (
                <div className="shrink-0 px-1.5 pt-2">
                  <WorkspaceMenu workspace={props.workspace} className="w-full" />
                </div>
              )}
              <div className="min-h-0 flex-1">
                <Rail
                  runtime={props.runtime}
                  brand={props.brand}
                  badges={props.badges}
                  blocks={props.blocks}
                  settings={props.settings}
                  account={props.account}
                  search={undefined}
                  workspace={props.workspace}
                />
              </div>
              {/* Search sits at the foot, where the thumb is: the rail's own row is at the top of a tall screen. */}
              {search !== undefined && (
                <div className="shrink-0 px-1.5 pb-1">
                  <button
                    type="button"
                    data-slot="shell-phone-search"
                    className="flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-ctrl border border-border bg-card px-3 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-ring"
                    onClick={() => {
                      onOpenChange(false)
                      search.onOpen()
                    }}
                  >
                    <SearchGlyph className="size-5" />
                    {VARIANT_TEXT.search}
                  </button>
                </div>
              )}
            </>
          )}
        </aside>,
        document.body,
      )}
    </>
  )
}
