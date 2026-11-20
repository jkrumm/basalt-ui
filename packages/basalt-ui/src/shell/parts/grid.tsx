/**
 * The frame: one CSS grid of five areas, owned here and nowhere else (concept section 1, decision 1).
 *
 *     header  header  header  header
 *     rail    main    aside   dock
 *     footer  footer  footer  footer
 *
 * The root is `h-dvh` and the document never scrolls: `Main` is the one scrollport and carries the
 * `<main>` landmark. Five custom properties are the frame's whole public geometry, set on the root
 * and read by the parts and by a page:
 *
 * - `--shell-header-h`: one height at every width (48), shorter on a landscape phone.
 * - `--shell-rail-w`: 0 compact, 64 medium, 240 expanded; `data-rail` overrides it once the user
 *   toggled the rail (`auto` is the CSS default, so server HTML is right for anyone who never did).
 * - `--shell-aside-w`: 0 while no `PageAside` is mounted, no 1 px ghost.
 * - `--shell-dock-w`: 0 while no `Dock` docks beside main (an overlaid one reserves nothing). It
 *   eases from 0 to the dock's width and back, and only while it changes: the rail and the aside
 *   keep their instant reflow.
 * - `--shell-gutter`: the page's inline inset, 8, 16, 24 by size class; `Main` hands it to `Page` as
 *   `--page-gutter`.
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
import { persisted } from '../../core/persisted'
import { DOCK_WIDTH, asideDockQuery, resolveAsideDocking } from '../../page/core/docking'
import type { AsideDock, AsideSheetState } from '../../page/core/docking'
import type { SizeClass } from '../contract'
import { MOTION_DURATION_MS } from '../../tokens/motion'
import { SHELL_MAIN_ID } from './a11y'
import { PRINT_FRAME, PRINT_MAIN, PRINT_OFF } from './print'

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

/** The default key; the stored value is the 2.x envelope `{ v: 1, value: boolean }`. */
export const DEFAULT_STORAGE_KEY = 'basalt-sidebar-collapsed'

/** The rail's width at a size class and state, in px: what the dock rule subtracts from the room. */
export function railWidth(sizeClass: SizeClass, state: RailState): number {
  if (sizeClass === 'compact') return 0
  if (state === 'expanded') return RAIL_EXPANDED_PX
  if (state === 'collapsed') return RAIL_COLLAPSED_PX
  return sizeClass === 'expanded' ? RAIL_EXPANDED_PX : RAIL_COLLAPSED_PX
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

type RootStyle = CSSProperties & { '--shell-aside-w': string; '--shell-dock-w': string }

export type ShellGridProps = {
  rootRef: (el: HTMLDivElement | null) => void
  rail: RailState
  compactHeader: 'show' | 'hidden'
  /** The width the aside region reserves, in px. */
  asideWidth: number
  /** The width the dock region reserves, in px: 0 while the dock overlays main or is closed. */
  dockWidth: number
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

/** The root element: the grid, its four geometry properties and the print fallback. */
export function ShellGrid({
  rootRef,
  rail,
  compactHeader,
  asideWidth,
  dockWidth,
  children,
}: ShellGridProps): ReactElement {
  const shifting = useDockShift(dockWidth)
  const style: RootStyle = {
    '--shell-aside-w': `${asideWidth}px`,
    '--shell-dock-w': `${dockWidth}px`,
  }
  return (
    <div
      ref={rootRef}
      data-slot="shell"
      data-dock-shift={shifting ? '' : undefined}
      data-rail={rail}
      data-compact-header={compactHeader}
      style={style}
      className={cn(
        'group/shell grid h-dvh w-full grid-cols-[var(--shell-rail-w)_minmax(0,1fr)_var(--shell-aside-w)_var(--shell-dock-w)] grid-rows-[var(--shell-header-h)_minmax(0,1fr)_auto] bg-background font-sans text-foreground [grid-template-areas:"header_header_header_header"_"rail_main_aside_dock"_"footer_footer_footer_footer"]',
        'motion-safe:data-dock-shift:transition-[grid-template-columns] motion-safe:data-dock-shift:duration-slow motion-safe:data-dock-shift:ease-standard',
        '[--shell-header-h:--spacing(12)] [--shell-rail-w:0px] [--shell-gutter:--spacing(2)]',
        'md:[--shell-rail-w:--spacing(16)] md:[--shell-gutter:--spacing(4)]',
        'xl:[--shell-rail-w:--spacing(60)] xl:[--shell-gutter:--spacing(6)]',
        'data-[rail=expanded]:md:[--shell-rail-w:--spacing(60)] data-[rail=collapsed]:md:[--shell-rail-w:--spacing(16)] data-[rail=collapsed]:xl:[--shell-rail-w:--spacing(16)]',
        '[@media(max-height:30rem)_and_(orientation:landscape)]:max-md:[--shell-header-h:clamp(2.25rem,9dvh,3rem)]',
        'data-[compact-header=hidden]:max-md:[--shell-header-h:0px]',
        PRINT_FRAME,
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
        scrolls ? 'focus-ring' : 'outline-none',
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
    children?: ReactNode
  }
  return {
    node,
    title: typeof props.title === 'string' ? props.title : '',
    width: typeof props.width === 'number' ? props.width : DEFAULT_ASIDE_WIDTH,
    dock: props.dock === 'always' ? 'always' : 'auto',
    body: props.children,
    ...(props.sheet === undefined ? {} : { sheet: props.sheet }),
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
): AsideModel {
  const width = claim?.width ?? DEFAULT_ASIDE_WIDTH
  const room = useMediaQuery(
    asideDockQuery({ navbarWidth: railWidth(sizeClass, rail), asideWidth: width }),
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
): DockModel {
  const room = useMediaQuery(
    asideDockQuery({
      navbarWidth: railWidth(sizeClass, rail) + asideReserved,
      asideWidth: DOCK_WIDTH,
    }),
    false,
  )
  const docks = open && sizeClass !== 'compact' && room
  return { docks, width: docks ? DOCK_WIDTH : 0 }
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
        'relative min-h-0 min-w-0 [grid-area:dock]',
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
            '[&>[data-slot=page-aside]]:h-full [&>[data-slot=page-aside]>header]:min-h-[var(--page-bar-h,0px)]',
            model.docks ? 'h-full' : 'absolute inset-y-0 end-0 z-20 shadow-overlay',
          )}
        >
          {claim.node}
        </div>
      )}
    </div>
  )
}
