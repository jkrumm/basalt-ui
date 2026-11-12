/**
 * The frame: one CSS grid of five areas, owned here and nowhere else (concept section 1, decision 1).
 *
 *     header  header  header
 *     rail    main    aside
 *     footer  footer  footer
 *
 * The root is `h-dvh` and the document never scrolls: `Main` is the one scrollport and carries the
 * `<main>` landmark. Four custom properties are the frame's whole public geometry, set on the root
 * and read by the parts and by a page:
 *
 * - `--shell-header-h`: one height at every width (48), shorter on a landscape phone.
 * - `--shell-rail-w`: 0 compact, 64 medium, 240 expanded; `data-rail` overrides it once the user
 *   toggled the rail (`auto` is the CSS default, so server HTML is right for anyone who never did).
 * - `--shell-aside-w`: 0 while no `PageAside` is mounted, no 1 px ghost.
 * - `--shell-gutter`: the page's inline inset, 8, 16, 24 by size class; `Main` hands it to `Page` as
 *   `--page-gutter`.
 *
 * Size classes are the Tailwind `md` (840) and `xl` (1200) breakpoints, which are the chrome axis
 * of `SIZE_CLASSES`. Rail and tab bar both render on the server and CSS picks one (decision 7).
 */
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import { persisted } from '../../core/persisted'
import { asideDockQuery, resolveAsideDocking } from '../../page/core/docking'
import type { AsideDock } from '../../page/core/docking'
import type { SizeClass } from '../contract'
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

// theme-allow raw-breakpoint — the aside dock rule's one viewport read; its query is `asideDockQuery`
const list = (query: string): MediaQueryList => window.matchMedia(query)

function useMatches(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = list(query)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    () => list(query).matches,
    () => false,
  )
}

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

type RootStyle = CSSProperties & { '--shell-aside-w': string }

export type ShellGridProps = {
  rootRef: (el: HTMLDivElement | null) => void
  rail: RailState
  compactHeader: 'show' | 'hidden'
  /** The width the aside region reserves, in px. */
  asideWidth: number
  children: ReactNode
}

/** The root element: the grid, its four geometry properties and the print fallback. */
export function ShellGrid({
  rootRef,
  rail,
  compactHeader,
  asideWidth,
  children,
}: ShellGridProps): ReactElement {
  const style: RootStyle = { '--shell-aside-w': `${asideWidth}px` }
  return (
    // theme-allow hidden-inline-style — one custom property carries the aside's reserved width; no layout is styled inline
    <div
      ref={rootRef}
      data-slot="shell"
      data-rail={rail}
      data-compact-header={compactHeader}
      style={style}
      className={cn(
        'group/shell grid h-dvh w-full grid-cols-[var(--shell-rail-w)_minmax(0,1fr)_var(--shell-aside-w)] grid-rows-[var(--shell-header-h)_minmax(0,1fr)_auto] bg-background font-sans text-foreground [grid-template-areas:"header_header_header"_"rail_main_aside"_"footer_footer_footer"]',
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
 * The one scrollport and the `<main>` landmark. It takes focus (`tabindex="-1"`) when the skip link
 * jumps to it, and `scroll-restoration` keys on its `data-scroll-restoration-id`. Horizontal
 * overflow scrolls (`auto`, never `hidden`) so a wide child is visible, not clipped.
 */
export function ShellMain({ children }: { children?: ReactNode }): ReactElement {
  return (
    <main
      id={SHELL_MAIN_ID}
      tabIndex={-1}
      data-slot="shell-main"
      data-scroll-restoration-id={SHELL_MAIN_ID}
      className={cn(
        'min-h-0 min-w-0 overflow-auto overscroll-contain outline-none [grid-area:main]',
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
    children?: ReactNode
  }
  return {
    node,
    title: typeof props.title === 'string' ? props.title : '',
    width: typeof props.width === 'number' ? props.width : DEFAULT_ASIDE_WIDTH,
    dock: props.dock === 'always' ? 'always' : 'auto',
    body: props.children,
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
  const room = useMatches(
    asideDockQuery({ navbarWidth: railWidth(sizeClass, rail), asideWidth: width }),
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

/**
 * The aside region: zero wide while unclaimed, the panel beside `Main` when it docks, over `Main`
 * when it does not. The claimed panel is a landmark itself, so this wrapper is not.
 */
export function AsideRegion({
  claim,
  model,
}: {
  claim: AsideClaim | undefined
  model: AsideModel
}): ReactElement {
  const shown = claim !== undefined && (model.docks || model.overlay)
  return (
    <div
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
