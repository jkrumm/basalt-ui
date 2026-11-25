/**
 * The frame: two planes, owned here and nowhere else (concept section 1, decision 1). The frame
 * (`canvas`) holds the top row (the brand zone over the rail, the header strip beside it) and the rail;
 * the work surface (`card`) holds main, the aside and the dock, and clips them to its corners:
 *
 *     brand   header            surface:  main  aside  dock
 *     rail    surface
 *     footer  footer
 *
 * The brand zone and the header are cells of one grid row, so they share its height and baseline at
 * every width. Under `chrome="native-overlay"` the header is the window's title bar, a full row above
 * the rail and the surface. `frame="panel"` insets the surface from `md` up (`--shell-inset`, on its
 * end and bottom: the rail side meets the rail and the top meets the strip), rounds it and draws its hairline; `flush` and every compact screen draw it
 * edge to edge with one hairline on the rail side. The prop is the app's default: `data-frame` on
 * `<html>` (the reader's choice, `setAppearance`) wins, in CSS, so server HTML paints it before hydration.
 *
 * The root is `h-dvh` and the document never scrolls: `Main` is the one scrollport and carries the
 * `<main>` landmark. These custom properties are the frame's whole public geometry, set on the root
 * and read by the parts and by a page:
 *
 * - `--shell-header-h`: one height at every width (48), shorter on a landscape phone.
 * - `--shell-inset`: the surface's margin from the window on its end and bottom; 6 for a panel from
 *   `md` up, else 0.
 * - `--shell-rail-w`: 0 compact, 64 medium, 240 expanded; `data-rail` overrides it once the user
 *   toggled the rail (`auto` is the CSS default, so server HTML is right for anyone who never did).
 * - `--shell-aside-w`: 0 while no `PageAside` is mounted, no 1 px ghost.
 * - `--shell-dock-w`: 0 while no `Dock` docks beside main (an overlaid one reserves nothing). It
 *   eases from 0 to the dock's width and back, and only while it changes: the rail and the aside
 *   keep their instant reflow.
 * - `--shell-gutter`: the page's inset on all four sides, 8, 12, 16 by size class; `Main` hands it
 *   to `Page` as `--page-gutter`, and the header strip starts its breadcrumb on it.
 *
 * Size classes are the Tailwind `md` (840) and `xl` (1200) breakpoints, which are the chrome axis
 * of `SIZE_CLASSES`. Rail and tab bar both render on the server and CSS picks one (decision 7).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react'
import { useMediaQuery } from '../../common/use-media-query'
import { cn } from '../../core/cn'
import { useKeyboardInset } from '../../core/keyboard'
import { persisted } from '../../core/persisted'
import type { RecordSequence } from '../../core/ports'
import { DOCK_WIDTH, asideDockQuery, resolveAsideDocking } from '../../page/core/docking'
import type { AsideDock, AsideSheetState } from '../../page/core/docking'
import type { ShellFrame, SizeClass } from '../contract'
import { MOTION_DURATION_MS } from '../../tokens/motion'
import { SHELL_MAIN_ID } from './a11y'
import type { PhoneNavVariant } from './mobile/variant'
import { SAFE } from './mobile/section-nav/safe'
import { PRINT_FRAME, PRINT_MAIN, PRINT_OFF, PRINT_SURFACE } from './print'

// ---- Rail state ---------------------------------------------------------------------------------

/** `auto` follows the size class; the two others are the user's explicit choice. */
export type RailState = 'auto' | 'expanded' | 'collapsed'

export type RailControl = {
  readonly state: RailState
  /** Whether the rail is collapsed at the current size class. */
  readonly collapsed: boolean
  setCollapsed(next: boolean): void
  toggle(): void
}

export const RAIL_EXPANDED_PX = 240
export const RAIL_COLLAPSED_PX = 64
/** The bounds of the width the reader drags the open rail to: Tailwind spacing 50 and 90. */
export const RAIL_MIN_PX = 200
export const RAIL_MAX_PX = 360

/** The default key; the stored value is the 2.x envelope `{ v: 1, value: boolean }`. */
export const DEFAULT_STORAGE_KEY = 'basalt-sidebar-collapsed'

/** The rail's width at a size class and state, in px: what the dock rule subtracts from the room. */
export function railWidth(
  sizeClass: SizeClass,
  state: RailState,
  openPx: number = RAIL_EXPANDED_PX,
): number {
  if (sizeClass === 'compact') return 0
  if (state === 'expanded') return openPx
  if (state === 'collapsed') return RAIL_COLLAPSED_PX
  return sizeClass === 'expanded' ? openPx : RAIL_COLLAPSED_PX
}

const RailControlContext = createContext<RailControl | null>(null)

export const RailControlProvider = RailControlContext

/**
 * The rail's collapse, persisted under `basalt:<storageKey>`. While nothing is stored the state is
 * `auto` and CSS decides; any stored value, `false` included, wins. The server and the hydration
 * pass read the initial value, so the markup always matches.
 */
export function useRailState(storageKey: string, sizeClass: SizeClass): RailControl {
  const store = useMemo(
    () => persisted<boolean>(storageKey, { version: 1, initial: false }),
    [storageKey],
  )
  const [stored, setStored] = store.use()
  const isSet = useSyncExternalStore(
    store.subscribe,
    () => store.isSet(),
    () => false,
  )
  const state: RailState = isSet ? (stored ? 'collapsed' : 'expanded') : 'auto'
  const collapsed = railWidth(sizeClass, state) === RAIL_COLLAPSED_PX
  return useMemo(
    () => ({
      state,
      collapsed,
      setCollapsed: setStored,
      toggle: () => setStored(!collapsed),
    }),
    [state, collapsed, setStored],
  )
}

// ---- Rail width ---------------------------------------------------------------------------------

/** The width of the open rail, and what changes it: the handle on the rail's inner edge. */
export type RailWidthControl = {
  /** The open rail's width in px, within `min` and `max`. */
  readonly width: number
  readonly min: number
  readonly max: number
  /** Clamps to the bounds and stores. */
  setWidth(px: number): void
  /** Back to the default width, and the stored value forgotten. */
  reset(): void
}

const RailWidthContext = createContext<RailWidthControl | null>(null)

export const RailWidthProvider = RailWidthContext

/** The width control, or `null` outside an `AppShell` (a rail drawn alone has no handle). */
export function useRailWidth(): RailWidthControl | null {
  return useContext(RailWidthContext)
}

export const clampRail = (px: number): number =>
  Math.min(RAIL_MAX_PX, Math.max(RAIL_MIN_PX, Math.round(px)))

/**
 * The open rail's width, persisted under `basalt:<storageKey>-width`. The server and the hydration
 * pass render the default; a stored width applies once the client has read it. Anything stored that
 * is not a finite number is the default, and a number outside the bounds is brought inside them.
 */
export function useRailWidthState(storageKey: string): RailWidthControl {
  const store = useMemo(
    () => persisted<number>(`${storageKey}-width`, { version: 1, initial: RAIL_EXPANDED_PX }),
    [storageKey],
  )
  const [stored, setStored] = store.use()
  const width = Number.isFinite(stored) ? clampRail(stored) : RAIL_EXPANDED_PX
  return useMemo(
    () => ({
      width,
      min: RAIL_MIN_PX,
      max: RAIL_MAX_PX,
      setWidth: (px: number) => setStored(clampRail(px)),
      reset: () => store.reset(),
    }),
    [width, setStored, store],
  )
}

/** The rail control, for the rail's own toggle. Throws outside an `AppShell`. */
export function useRailControl(): RailControl {
  const control = useContext(RailControlContext)
  if (control === null) throw new Error('[basalt] useRailControl must be used inside an AppShell.')
  return control
}

// ---- Media -------------------------------------------------------------------------------------

/** The document never scrolls and never rubber-bands: `Main` is the scrollport. */
export function useDocumentFrame(): void {
  useEffect(() => {
    const els = [document.documentElement, document.body]
    const before = els.map((el) => el.style.overscrollBehavior)
    for (const el of els) el.style.overscrollBehavior = 'none'
    return () => {
      els.forEach((el, i) => {
        el.style.overscrollBehavior = before[i] ?? ''
      })
    }
  }, [])
}

// ---- The root -----------------------------------------------------------------------------------

type RootStyle = CSSProperties & {
  '--shell-aside-w': string
  '--shell-dock-w': string
  '--shell-rail-open-w': string
}

export type ShellGridProps = {
  rootRef: (el: HTMLDivElement | null) => void
  rail: RailState
  frame: ShellFrame
  /** The header is the window's title bar, a row of the frame above the rail and the surface. */
  titlebar: boolean
  compactHeader: 'show' | 'hidden'
  /** The width the aside region reserves, in px. */
  asideWidth: number
  /** The width the dock region reserves, in px: 0 while the dock overlays main or is closed. */
  dockWidth: number
  /** The width of the open rail, in px: the default unless the reader dragged it. */
  railOpenWidth?: number
  /** The phone nav: `drawer`, the section bar, is the default; `tabs`, the tab bar, adds nothing to the root. */
  phoneNav?: PhoneNavVariant
  children: ReactNode
}

/** How long the dock's width takes to ease, in ms: `duration-slow`, plus a frame of margin. */
const DOCK_SHIFT_MS = MOTION_DURATION_MS.slow + 50

/** What arms the dock's easing: a reader's own input. A dock present at load never eases. */
const INPUT_EVENTS = ['pointerdown', 'keydown', 'click'] as const

/**
 * Whether the dock's reserved width changed within the last `DOCK_SHIFT_MS` after the reader had
 * given input: the one window in which the grid eases its columns. Derived in render, so the class
 * that turns the transition on lands in the same commit as the new width. A route's content mounts
 * after the shell has painted, so "first render" cannot tell a dock restored from the address from
 * one the reader just opened; input can. Reduced motion is the stylesheet's (`motion-safe`).
 */
function useDockShift(dockWidth: number): boolean {
  const [seen, setSeen] = useState(dockWidth)
  const [armed, setArmed] = useState(false)
  const [shifting, setShifting] = useState(false)
  if (seen !== dockWidth) {
    setSeen(dockWidth)
    if (armed) setShifting(true)
  }
  useEffect(() => {
    if (armed) return undefined
    const arm = (): void => setArmed(true)
    for (const name of INPUT_EVENTS)
      window.addEventListener(name, arm, { capture: true, once: true })
    return () => {
      for (const name of INPUT_EVENTS) window.removeEventListener(name, arm, { capture: true })
    }
  }, [armed])
  useEffect(() => {
    if (!shifting) return undefined
    const timer = setTimeout(() => setShifting(false), DOCK_SHIFT_MS)
    return () => clearTimeout(timer)
  }, [shifting, dockWidth])
  return shifting
}

/** The root element: the frame's grid, its geometry properties and the print fallback. */
export function ShellGrid({
  rootRef,
  rail,
  frame,
  titlebar,
  compactHeader,
  asideWidth,
  dockWidth,
  railOpenWidth = RAIL_EXPANDED_PX,
  phoneNav = 'drawer',
  children,
}: ShellGridProps): ReactElement {
  const shifting = useDockShift(dockWidth)
  useKeyboardInset()
  const style: RootStyle = {
    '--shell-rail-open-w': `${railOpenWidth}px`,
    '--shell-aside-w': `${asideWidth}px`,
    '--shell-dock-w': `${dockWidth}px`,
  }
  return (
    <div
      ref={rootRef}
      data-slot="shell"
      data-dock-shift={shifting ? '' : undefined}
      data-rail={rail}
      data-frame={frame}
      data-titlebar={titlebar ? '' : undefined}
      data-compact-header={compactHeader}
      data-phone-nav={phoneNav === 'tabs' ? undefined : phoneNav}
      style={style}
      className={cn(
        'group/shell grid h-dvh w-full grid-cols-[var(--shell-rail-w)_minmax(0,1fr)] grid-rows-[var(--shell-top-h)_minmax(0,1fr)_auto] bg-background font-sans text-foreground',
        // The device's safe areas (`viewport-fit=cover`): the frame pads top, left and right. The bottom is the
        // tab bar's on a phone and the root's from `md`, plus what the keyboard covers (`useKeyboardInset`).
        'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[calc(var(--shell-safe-b)+var(--basalt-keyboard-inset,0px))] pl-[env(safe-area-inset-left)] [--shell-safe-b:0px] md:[--shell-safe-b:env(safe-area-inset-bottom)]',
        // One top row at every width: the brand zone over the rail and the header strip beside it (a
        // title bar spans both). Compact has no rail column, so the strip is the whole row there.
        titlebar
          ? '[grid-template-areas:"header_header"_"rail_surface"_"footer_footer"]'
          : '[grid-template-areas:"brand_header"_"rail_surface"_"footer_footer"]',
        '[--shell-top-h:var(--shell-header-h)]',
        '[--shell-header-h:--spacing(12)] [--shell-rail-open-w:--spacing(60)] [--shell-rail-w:0px] [--shell-gutter:--spacing(2)] [--shell-inset:0px]',
        // The frame: `data-frame` on <html> (`setAppearance`, the boot script) wins over the prop on this root.
        '[:root:not([data-frame])_&[data-frame=panel]]:md:[--shell-inset:--spacing(1.5)] [:root[data-frame=panel]_&]:md:[--shell-inset:--spacing(1.5)]',
        'md:[--shell-rail-w:--spacing(16)] md:[--shell-gutter:--spacing(3)]',
        'xl:[--shell-rail-w:var(--shell-rail-open-w)] xl:[--shell-gutter:--spacing(4)]',
        'data-[rail=expanded]:md:[--shell-rail-w:var(--shell-rail-open-w)] data-[rail=collapsed]:md:[--shell-rail-w:--spacing(16)] data-[rail=collapsed]:xl:[--shell-rail-w:--spacing(16)]',
        '[@media(max-height:30rem)_and_(orientation:landscape)]:max-md:[--shell-header-h:clamp(2.25rem,9dvh,3rem)]',
        'data-[compact-header=hidden]:max-md:[--shell-header-h:0px]',
        // The section bar is the footer row, so main ends above it; the frame keeps off all four
        // safe-area insets; More slides the whole root right (`--phone-sidebar-x`) over the rail it
        // reveals, on the kit's spring.
        phoneNav !== 'tabs' && [
          SAFE,
          'max-md:pt-(--phone-safe-t) max-md:ps-(--phone-safe-l) max-md:pe-(--phone-safe-r)',
          'max-md:relative max-md:z-10 max-md:translate-x-[var(--phone-sidebar-x,0px)] max-md:[transition:translate_var(--basalt-spring),box-shadow_var(--basalt-dur-base)_var(--basalt-ease-standard)]',
          'data-phone-sidebar:shadow-overlay data-phone-dragging:[transition:none] motion-reduce:[transition:none]',
        ],
        PRINT_FRAME,
      )}
    >
      {children}
    </div>
  )
}

/**
 * The work surface: one plane in the card color holding main, the aside and the dock, a grid of its
 * own, under the header strip. As a rounded panel it clips, so an aside or a dock panel ends at its corners. Its columns
 * ease while a dock opens or closes (`data-dock-shift` on the root).
 */
export function ShellSurface({
  titlebar,
  children,
}: {
  /** The header is the window's title bar (`native-overlay`), so a flush surface draws its top edge under it on every screen. */
  titlebar: boolean
  children: ReactNode
}): ReactElement {
  return (
    <div
      data-slot="shell-surface"
      data-surface="card"
      className={cn(
        'relative grid min-h-0 min-w-0 bg-card [grid-area:surface]',
        'grid-cols-[minmax(0,1fr)_var(--shell-aside-w)_var(--shell-dock-w)]',
        'grid-rows-[minmax(0,1fr)] [grid-template-areas:"main_aside_dock"]',
        'motion-safe:group-data-dock-shift/shell:transition-[grid-template-columns] motion-safe:group-data-dock-shift/shell:duration-slow motion-safe:group-data-dock-shift/shell:ease-standard',
        // Panel: inset on its end and bottom, rounded, one hairline drawn as an outset ring in the
        // inset, so the edge costs the rows inside no pixel. Flush: one hairline on the rail side and
        // one under the strip, where the frame's color meets the surface's.
        'border-border ring-border md:me-(--shell-inset) md:mb-(--shell-inset)',
        // Only a rounded panel clips: its corners cut what runs to them (a fill table, an aside, a dock).
        '[:root:not([data-frame])_[data-frame=panel]_&]:md:overflow-clip [:root:not([data-frame])_[data-frame=panel]_&]:md:rounded-card [:root:not([data-frame])_[data-frame=panel]_&]:md:ring-1',
        '[:root[data-frame=panel]_&]:md:overflow-clip [:root[data-frame=panel]_&]:md:rounded-card [:root[data-frame=panel]_&]:md:ring-1',
        '[:root:not([data-frame])_[data-frame=flush]_&]:md:border-s [:root[data-frame=flush]_&]:md:border-s',
        '[:root:not([data-frame])_[data-frame=flush]_&]:md:border-t [:root[data-frame=flush]_&]:md:border-t',
        // A title bar above: the surface draws its top edge under it on a phone too (the web phone
        // header draws its own rule).
        titlebar &&
          'max-md:border-t [:root:not([data-frame])_[data-frame=flush]_&]:border-t [:root[data-frame=flush]_&]:border-t',
        PRINT_SURFACE,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Whether the element's content overflows it, re-measured when it or one of its children resizes or
 * a child is added or removed. `false` until measured, so server HTML carries no tab stop.
 */
function useScrolls(ref: RefObject<HTMLElement | null>): boolean {
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (el === null) return undefined
    const measure = (): void =>
      setScrolls(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const resize = new ResizeObserver(measure)
    const watch = (): void => {
      resize.disconnect()
      resize.observe(el)
      for (const child of el.children) resize.observe(child)
    }
    watch()
    const mutation = new MutationObserver(() => {
      watch()
      measure()
    })
    mutation.observe(el, { childList: true })
    return () => {
      resize.disconnect()
      mutation.disconnect()
    }
  }, [ref])
  return scrolls
}

/**
 * The one scrollport and the `<main>` landmark. It is always programmatically focusable
 * (`tabindex="-1"`) so the skip link can jump to it, and joins the tab order (`tabindex="0"`) only
 * while its content overflows, so a keyboard user can scroll it and a page that fits adds no tab
 * stop; `scroll-restoration` keys on its `data-scroll-restoration-id`. Horizontal overflow scrolls
 * (`auto`, never `hidden`) so a wide child is visible, not clipped.
 */
export function ShellMain({
  pending = false,
  children,
}: {
  /** A navigation has waited past the router's pending delay: main is busy and draws a bar. */
  pending?: boolean
  children?: ReactNode
}): ReactElement {
  const ref = useRef<HTMLElement>(null)
  const scrolls = useScrolls(ref)
  return (
    <main
      ref={ref}
      id={SHELL_MAIN_ID}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be keyboard reachable (axe scrollable-region-focusable)
      tabIndex={scrolls ? 0 : -1}
      data-slot="shell-main"
      data-scroll-restoration-id={SHELL_MAIN_ID}
      aria-busy={pending ? true : undefined}
      data-pending={pending ? '' : undefined}
      className={cn(
        // The busy bar: a sticky hairline that takes no room, so the page under it does not move.
        'data-pending:before:sticky data-pending:before:top-0 data-pending:before:z-10 data-pending:before:-mb-0.5 data-pending:before:block data-pending:before:h-0.5 data-pending:before:animate-pulse data-pending:before:bg-primary data-pending:before:content-[""] motion-reduce:data-pending:before:animate-none',
        'min-h-0 min-w-0 overflow-auto overscroll-contain [grid-area:main]',
        // A sticky page bar covers the top of the scrollport: focus scrolled into view lands below it.
        'has-[[data-slot=page-bar][data-sticky]]:scroll-pt-(--page-bar-h)',
        // The ring is inset: a panel surface clips at its corners, so an outset ring would be cut off.
        scrolls
          ? 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand focus-visible:outline-solid'
          : 'outline-none',
        // Under a shell the gutter is the shell's: `Page` declares its own default for use without one.
        '[&_[data-slot=page]]:[--page-gutter:var(--shell-gutter)]',
        PRINT_MAIN,
      )}
    >
      {children}
    </main>
  )
}

// ---- The aside region ---------------------------------------------------------------------------

/** What the region reads off a claimed panel element: it never renders the panel's own props. */
export type AsideClaim = {
  readonly node: ReactNode
  readonly title: string
  readonly width: number
  readonly dock: AsideDock
  readonly body: ReactNode
  /** Present when the aside is bound to a `state`: the page's open state and its setter. */
  readonly sheet?: AsideSheetState
  /** The shown detail's records, so the phone's sheet steps through them too. */
  readonly records?: RecordSequence
}

const DEFAULT_ASIDE_WIDTH = 360

/** Reads the claimed `PageAsidePanel` element's props. `undefined` when nothing is claimed. */
export function readAsideClaim(node: ReactNode | undefined): AsideClaim | undefined {
  if (node === undefined || node === null || typeof node !== 'object' || !('props' in node)) {
    return undefined
  }
  const props = node.props as {
    title?: unknown
    width?: unknown
    dock?: unknown
    sheet?: AsideSheetState
    records?: RecordSequence
    children?: ReactNode
  }
  return {
    node,
    title: typeof props.title === 'string' ? props.title : '',
    width: typeof props.width === 'number' ? props.width : DEFAULT_ASIDE_WIDTH,
    dock: props.dock === 'always' ? 'always' : 'auto',
    body: props.children,
    ...(props.sheet === undefined ? {} : { sheet: props.sheet }),
    ...(props.records === undefined ? {} : { records: props.records }),
  }
}

export type AsideModel = {
  readonly docks: boolean
  readonly overlay: boolean
  /** The width the grid reserves for the region, in px. */
  readonly width: number
}

/**
 * The region's docking decision. A claim exists only while its aside is open (a closed `PageAside`
 * releases it), so nothing here is ever folded. Compact never docks: the aside is a sheet there.
 */
export function useAsideModel(
  claim: AsideClaim | undefined,
  sizeClass: SizeClass,
  rail: RailState,
  railOpenPx: number = RAIL_EXPANDED_PX,
): AsideModel {
  const width = claim?.width ?? DEFAULT_ASIDE_WIDTH
  const room = useMediaQuery(
    asideDockQuery({ navbarWidth: railWidth(sizeClass, rail, railOpenPx), asideWidth: width }),
    false,
  )
  return resolveAsideDocking({
    claimed: claim !== undefined && sizeClass !== 'compact',
    folded: false,
    sizeClass,
    roomToDock: room,
    asideWidth: width,
    asideRailWidth: 0,
    dock: claim?.dock ?? 'auto',
  })
}

export type DockModel = {
  /** An open dock pushes main; else it overlays it (no room, or a phone). */
  readonly docks: boolean
  /** The width the grid reserves for the region, in px. */
  readonly width: number
}

/**
 * The dock region's docking decision, from the same room rule as the aside's: the rail and the
 * aside's reserved width come off the viewport, and main must keep its floor. The aside decides
 * first and is never pushed out by a dock; a compact screen never docks.
 */
export function useDockModel(
  open: boolean,
  sizeClass: SizeClass,
  rail: RailState,
  asideReserved: number,
  /** The width the open `Dock` draws at: the reader can drag it. */
  dockWidth: number = DOCK_WIDTH,
  railOpenPx: number = RAIL_EXPANDED_PX,
): DockModel {
  const room = useMediaQuery(
    asideDockQuery({
      navbarWidth: railWidth(sizeClass, rail, railOpenPx) + asideReserved,
      asideWidth: dockWidth,
    }),
    false,
  )
  const docks = open && sizeClass !== 'compact' && room
  return { docks, width: docks ? dockWidth : 0 }
}

/**
 * The dock region: zero wide while no dock is docked, the panel's column when one is. The panel
 * portals in and is pinned to the end edge, so an overlaid one needs no width here.
 */
export function DockRegion({
  model,
  regionRef,
}: {
  model: DockModel
  regionRef: (el: HTMLDivElement | null) => void
}): ReactElement {
  return (
    <div
      ref={regionRef}
      data-slot="shell-dock"
      data-state={model.docks ? 'docked' : 'overlay'}
      className={cn(
        // The docked panel paints the surface it sits on.
        'relative min-h-0 min-w-0 [grid-area:dock] [&_[data-slot=dock]]:bg-surface',
        // Docked, the column's growing edge reveals the panel; overlaid, the panel spills over main.
        model.docks && 'overflow-hidden',
        PRINT_OFF,
      )}
    />
  )
}

/**
 * The aside region: zero wide while unclaimed, the panel beside `Main` when it docks, over `Main`
 * when it does not. The claimed panel is a landmark itself, so this wrapper is not.
 */
export function AsideRegion({
  claim,
  model,
  regionRef,
}: {
  claim: AsideClaim | undefined
  model: AsideModel
  /** Hands the region element to the shell, which shares it with `Peek` through `ShellOverlayContext`. */
  regionRef?: (el: HTMLDivElement | null) => void
}): ReactElement {
  const shown = claim !== undefined && (model.docks || model.overlay)
  return (
    <div
      ref={regionRef}
      data-slot="shell-aside"
      data-state={model.docks ? 'docked' : model.overlay ? 'overlay' : 'none'}
      className={cn('relative min-h-0 min-w-0 [grid-area:aside]', PRINT_OFF)}
    >
      {shown && (
        <div
          className={cn(
            // The panel is `h-dvh` for use without a shell; in the region it is as tall as the row,
            // and its header meets the page-bar band's bottom edge.
            '[&>[data-slot=page-aside]]:h-full [&>[data-slot=page-aside]]:bg-surface [&>[data-slot=page-aside]>header]:min-h-[var(--page-bar-h,0px)]',
            model.docks ? 'h-full' : 'absolute inset-y-0 end-0 z-20 shadow-overlay',
          )}
        >
          {claim.node}
        </div>
      )}
    </div>
  )
}
