/**
 * `PageBar` — the tier-1 home (`docs/CONTROLS-SPEC.md` §2.1). One per page; every page-level
 * control enters through one of its slots (law C1) and is sized by it (law C5).
 *
 * Two rows, and WHERE they render is decided by context, never by a prop:
 *
 * - **Inside `BasaltShell`** row 1 (`actions`, `sync`) portals into the existing 48px app-shell
 *   header — the same slot/portal mechanism `PageActions` used through 1.25.0, which this replaces.
 *   The breadcrumb stays the header's lead, so `title` is ignored. Row 2 (`tabs`, `filters`,
 *   `filtersEnd`) renders IN-FLOW at the top of the page content, sticky under the header, and
 *   publishes its measured height as `--basalt-page-bar-h` on `documentElement` so a page can
 *   compute a viewport-filling body (`calc(100dvh - var(--app-shell-header-height) -
 *   var(--basalt-page-bar-h, 0px))`) without measuring anything itself.
 * - **Without a shell** both rows render in-flow, sticky at the top of the document, with
 *   `title` + `icon` leading row 1 — the page title is the bar's job when there is no breadcrumb
 *   (law C8). The published height then covers the whole bar, since that is what content clears.
 *
 * An empty home renders NOTHING (law C14): a page with no tabs and no filters pays for no row 2,
 * and the header never reserves a second mobile row the way the pre-1.26.0 two-row layout did.
 *
 * Originally extracted from argo's `apps/dashboard/src/components/app-shell/page-header.tsx`;
 * linewatch's `page-header.tsx` measure-and-publish effect became the framework behaviour below.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CtlSlot } from '../theme'
import { BarActionRow, BarExtrasProvider, globalActionAsBarAction } from '../controls/actions'
import { FilterPill } from '../controls/filter-pill'
import { FilterSheet } from '../controls/filter-sheet'
import { SyncButton } from '../controls/sync-button'
import type { ActionGroupProps, BarAction, GlobalAction } from '../controls/actions'
import type { SyncButtonProps } from '../controls/sync-button'
import { useIsomorphicLayoutEffect } from './isomorphic-layout-effect'
import classes from './page-bar.module.css'

/** The custom property row 2's measured height is published on. */
export const PAGE_BAR_HEIGHT_VAR = '--basalt-page-bar-h'

/**
 * What a `PageAside` publishes when it projects itself into row 2 below `sm`
 * (`docs/ASIDE-SPEC.md` §0 "Desktop and mobile are one declaration"). Metadata only — the aside's
 * CHILDREN never travel through this context: they are portalled into the sheet's own node
 * ({@link PageBarSlots.panelTarget}), because a `ReactNode` in state would be a fresh object on
 * every parent render and the claim effect would loop.
 */
export type AsidePanelClaim = {
  /** The aside's `title` — the pill's accessible name and the sheet's heading. */
  readonly title: string
  /** The aside's own glyph, supplied by the claimant so this module owns no aside iconography. */
  readonly icon: ReactNode
}

type PageBarSlots = {
  /** The header node row 1 portals into. `null` outside a shell, and until the outlet mounts. */
  target: HTMLElement | null
  setTarget: (el: HTMLElement | null) => void
  /** True only under `BasaltShell` — the provider is shell-internal, so the context IS the probe. */
  inShell: boolean
  /** Shell `globalActions` marked `mobile: 'more'`, already shaped as kebab rows. */
  mobileMoreActions: readonly BarAction[]
  /** How many page kebabs are mounted. `> 0` means the shell must not render one of its own. */
  kebabClaims: number
  claimKebab: () => () => void
  /** True while a mounted `PageBar` is rendering a row 2 — the row that can host the aside's pill.
   * Without one the aside keeps its in-flow mobile form; there is nowhere to put the trigger. */
  panelHost: boolean
  claimPanelHost: () => () => void
  /** The projecting aside, or `null`. At most one — the aside region holds one page at a time. */
  panel: AsidePanelClaim | null
  claimPanel: (panel: AsidePanelClaim) => () => void
  /** The node inside the open panel sheet the aside's children portal into. `null` while closed —
   * the Drawer unmounts its body, which is what keeps ONE node mounted at a time (law C9). */
  panelTarget: HTMLElement | null
  setPanelTarget: (el: HTMLElement | null) => void
}

const NO_SLOTS: PageBarSlots = {
  target: null,
  setTarget: () => {},
  inShell: false,
  mobileMoreActions: [],
  kebabClaims: 0,
  claimKebab: () => () => {},
  panelHost: false,
  claimPanelHost: () => () => {},
  panel: null,
  claimPanel: () => () => {},
  panelTarget: null,
  setPanelTarget: () => {},
}

const PageBarContext = createContext<PageBarSlots>(NO_SLOTS)

/**
 * Internal — mounted by `BasaltShell`. Owns the portal target, and the single-kebab claim that
 * lets the shell fall back to its OWN kebab on a route that renders no `PageBar`.
 */
export function PageBarProvider({
  globalActions,
  children,
}: {
  globalActions: readonly GlobalAction[]
  children: ReactNode
}): ReactNode {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [kebabClaims, setKebabClaims] = useState(0)
  const [panelHostClaims, setPanelHostClaims] = useState(0)
  const [panel, setPanel] = useState<AsidePanelClaim | null>(null)
  const [panelTarget, setPanelTarget] = useState<HTMLElement | null>(null)

  const claimKebab = useCallback(() => {
    setKebabClaims((n) => n + 1)
    return () => setKebabClaims((n) => n - 1)
  }, [])

  const claimPanelHost = useCallback(() => {
    setPanelHostClaims((n) => n + 1)
    return () => setPanelHostClaims((n) => n - 1)
  }, [])

  // Identity-checked on release, not an unconditional `null`: two asides never coexist, but a route
  // change can mount the next one's claim before the previous one's cleanup runs, and clearing
  // blindly there would drop the live claim.
  const claimPanel = useCallback((next: AsidePanelClaim) => {
    setPanel(next)
    return () => {
      setPanel((current) => (current === next ? null : current))
    }
  }, [])

  const mobileMoreActions = globalActions
    .filter((action, index) => (action.mobile ?? (index < 2 ? 'bar' : 'more')) === 'more')
    .map(globalActionAsBarAction)

  const value: PageBarSlots = {
    target,
    setTarget,
    inShell: true,
    mobileMoreActions,
    kebabClaims,
    claimKebab,
    panelHost: panelHostClaims > 0,
    claimPanelHost,
    panel,
    claimPanel,
    panelTarget,
    setPanelTarget,
  }

  return (
    <PageBarContext.Provider value={value}>
      <BarExtrasProvider value={{ mobileMoreActions, claimKebab }}>{children}</BarExtrasProvider>
    </PageBarContext.Provider>
  )
}

/** Internal — the app-shell header node the active page's row 1 portals into. */
export function PageBarOutlet({ className }: { className?: string }) {
  const { setTarget } = useContext(PageBarContext)
  return <div ref={setTarget} className={className} />
}

/** Internal — `true` while a page's `ActionGroup` owns the header's one mobile kebab. */
export function usePageKebabClaimed(): boolean {
  return useContext(PageBarContext).kebabClaims > 0
}

/**
 * Internal — the seam `PageAside` projects itself through below `sm` (`docs/ASIDE-SPEC.md` §0).
 * `host` says whether there is a row 2 to hang the pill off at all; `claim` publishes the aside's
 * title and glyph; `target` is the node inside the opened sheet its children portal into.
 */
export function useAsidePanelSlot(): {
  host: boolean
  claim: (panel: AsidePanelClaim) => () => void
  target: HTMLElement | null
} {
  const { panelHost, claimPanel, panelTarget } = useContext(PageBarContext)
  return { host: panelHost, claim: claimPanel, target: panelTarget }
}

export type PageBarProps = {
  /**
   * Read only when there is no `BasaltShell` outlet (a shell-less app such as linewatch). Inside a
   * shell the breadcrumb names the page and this is ignored.
   */
  title?: string
  icon?: ReactNode
  actions?: ActionGroupProps
  /** `scope` is fixed to `'page'` — a global sync belongs in the shell's `globalActions` (law C12). */
  sync?: Omit<SyncButtonProps, 'scope'>
  /** `FilterSet` descendants only (law C1). */
  filters?: ReactNode
  /** Right-aligned row-2 actions ("Manage metrics"). */
  filtersEnd?: BarAction[]
  /** One `ViewTabs`. */
  tabs?: ReactNode
  /**
   * Added to the bar's ROOT — the shell-less `<div data-basalt-page-bar="standalone">`, or row 2's
   * sticky wrapper (`data-basalt-page-bar="shell"`) inside a `BasaltShell`. The seam for the two
   * things only the consumer's own layout knows: bleeding the sticky bar across its container's
   * gutters (`margin-inline: calc(var(--gutter) * -1); padding-inline: var(--gutter)`) and drawing
   * a hairline under it (`border-bottom: 1px solid var(--vx-surface-hairline)`).
   *
   * Scope that CSS through this class, not through a global `[data-basalt-page-bar]` selector: the
   * data attributes are stable enough to READ (a shell-less consumer can style
   * `[data-basalt-page-bar="standalone"]` in a pinch, and this doc is the promise that the value
   * stays), but a global rule reaches every page in the app including the ones that want neither.
   */
  className?: string
}

/**
 * Publishes an element's measured height as a custom property on `documentElement`.
 *
 * **A LAYOUT effect, and a plain ref rather than ref-state.** Both halves buy the same thing: the
 * property exists at the FIRST paint. A passive effect publishes it one frame later, which is a
 * frame in which a cold load of `/page#anchor` has already scrolled — `scroll-margin-top` reads
 * `var(--basalt-page-bar-h, 0px)`, so the anchored heading lands under the sticky bar and stays
 * there. A `useState` node would also have cost a second commit before the measure could run.
 *
 * The `height > 0` guard is the whole point: a ResizeObserver fires once with a zero box while the
 * element is still being laid out (and again whenever it is hidden), and publishing that zero is
 * what made a consumer's sticky offset collapse mid-navigation. The property is removed on unmount
 * so a route without a bar does not inherit the last one's height.
 */
function useMeasuredHeightVar(active: boolean): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)

  useIsomorphicLayoutEffect(() => {
    const node = ref.current
    if (!active || node === null) return
    const publish = () => {
      const { height } = node.getBoundingClientRect()
      if (height > 0) {
        document.documentElement.style.setProperty(PAGE_BAR_HEIGHT_VAR, `${height}px`)
      }
    }
    publish()
    // Guarded like `FilterSet`'s identical call: happy-dom and jsdom ship no `ResizeObserver`, and a
    // consumer's page test mounting a bar without the shim would otherwise throw from this effect.
    // The one-shot `publish()` above already ran, so a test DOM still gets a height when it has a
    // layout engine — it just never re-measures.
    if (typeof ResizeObserver === 'undefined') {
      return () => document.documentElement.style.removeProperty(PAGE_BAR_HEIGHT_VAR)
    }
    const observer = new ResizeObserver(publish)
    observer.observe(node)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty(PAGE_BAR_HEIGHT_VAR)
    }
  }, [active])

  return ref
}

/** The bar root's own class plus the consumer's, in that order (`content/toc.tsx`'s idiom). */
function rootClass(own: string, extra: string | undefined): string {
  return [own, extra].filter(Boolean).join(' ')
}

export function PageBar({
  title,
  icon,
  actions,
  sync,
  filters,
  filtersEnd,
  tabs,
  className,
}: PageBarProps): ReactNode {
  const { target, inShell, panel, claimPanelHost, setPanelTarget } = useContext(PageBarContext)
  // An overlay's open flag, like `FilterPill`'s and `FilterSet`'s — not page state (C3).
  const [panelOpened, setPanelOpened] = useState(false)

  // The flag belongs to the CLAIM, not to the bar. `FilterSheet`'s `onClose` was the only thing
  // clearing it, so a route change that released the aside's claim while the sheet was open left
  // `true` behind — and the NEXT page's `PageAside` mounted its sheet already open, with no user
  // action anywhere. Keyed on the claim's IDENTITY rather than on `panel === null` because the
  // release and the next claim can land in one commit, where `panel` is never observed null.
  const seenPanel = useRef(panel)
  useEffect(() => {
    if (seenPanel.current === panel) return
    seenPanel.current = panel
    setPanelOpened(false)
  }, [panel])

  const filtersEndActions = filtersEnd ?? []
  const hasRow2 = tabs !== undefined || filters !== undefined || filtersEndActions.length > 0
  const hasLead = !inShell && (title !== undefined || icon !== undefined)
  // `filtersEnd` keeps row 1 alive on its own: below `sm` its items fold into the ROW-1 kebab (the
  // header's single one), so the row that hosts that kebab has to exist even with no `actions`.
  const hasRow1 =
    actions !== undefined || sync !== undefined || hasLead || filtersEndActions.length > 0
  const measureRef = useMeasuredHeightVar(hasRow2 || (!inShell && hasRow1))

  // Row 2 is what an aside's mobile pill needs; publishing the claim from here is what lets
  // `PageAside` decide between projecting and staying in flow without either component knowing
  // about the other's props.
  useIsomorphicLayoutEffect(() => {
    if (!inShell || !hasRow2) return
    return claimPanelHost()
  }, [inShell, hasRow2, claimPanelHost])

  const row1 = hasRow1 ? (
    <div className={classes.row1}>
      {hasLead && (
        <div className={classes.lead}>
          {icon !== undefined && (
            <span className={classes.icon} aria-hidden>
              {icon}
            </span>
          )}
          {title !== undefined && <h1 className={classes.title}>{title}</h1>}
        </div>
      )}
      <div className={classes.row1End}>
        {(actions !== undefined || filtersEndActions.length > 0 || sync !== undefined) && (
          <CtlSlot>
            {/* THE row-1 group: the only `host: 'page'` instance, so the shell's `mobile: 'more'`
                global actions reach exactly one kebab (`BarActionRowProps.host`). `filtersEnd`
                joins that kebab below `sm` and renders in row 2 above it.

                `sync` is handed DOWN as `syncNode` rather than rendered as a sibling here, because
                the row's order is custom chips · secondaries · `More` · sync · primary
                (`docs/CONTROLS-SPEC.md` §2.1) and only `BarActionRow` knows where the primary is.
                One `CtlSlot` for the whole row now, so the sync button and the buttons around it
                resolve the tier from the same provider. */}
            <BarActionRow
              {...actions}
              host="page"
              mobileOnly={filtersEndActions}
              {...(sync !== undefined && { syncNode: <SyncButton {...sync} scope="page" /> })}
            />
          </CtlSlot>
        )}
      </div>
    </div>
  ) : null

  const row2 = hasRow2 ? (
    <div className={classes.row2}>
      {tabs !== undefined && <CtlSlot>{tabs}</CtlSlot>}
      {filters !== undefined && (
        <div className={classes.filters}>
          <CtlSlot>{filters}</CtlSlot>
        </div>
      )}
      {panel !== null && (
        <FilterPill
          // One word, no count: unlike `Filters (n)` an aside has no census to count (its children
          // are not a `FilterSet`), and a number nobody can derive is worse than none.
          label="Panel"
          ariaLabel={panel.title}
          icon={panel.icon}
          className={classes.panelPill}
          hideGlyph
          onClick={() => {
            setPanelOpened(true)
          }}
        />
      )}
      {filtersEndActions.length > 0 && (
        <div className={classes.filtersEnd}>
          <CtlSlot>
            {/* Desktop only — below `sm` these live in the row-1 kebab above, never in a second one
                (spec §2.1: mobile row 2 is tabs + the first pill + `Filters (n)`, nothing else). */}
            <BarActionRow secondary={filtersEndActions} host="slot" viewport="desktop" />
          </CtlSlot>
        </div>
      )}
    </div>
  ) : null

  // The aside's mobile sheet. `onResetAll` is deliberately absent — the children mount under a
  // `null` registry, so there is nothing registered to reset. The body is an OUTLET, not the
  // children: `PageAside` portals into it, which is what keeps the aside's node singular (C9) and
  // keeps a `ReactNode` out of context state (see `AsidePanelClaim`).
  const panelSheet =
    panel === null ? null : (
      <FilterSheet
        opened={panelOpened}
        title={panel.title}
        onClose={() => {
          setPanelOpened(false)
        }}
      >
        <div ref={setPanelTarget} />
      </FilterSheet>
    )

  // Shell-less: one sticky bar at the top of the document holding both rows, `title` leading.
  if (!inShell) {
    if (row1 === null && row2 === null) return null
    return (
      <div
        ref={measureRef}
        className={rootClass(classes.bar, className)}
        data-basalt-page-bar="standalone"
      >
        {row1}
        {row2}
      </div>
    )
  }

  // In a shell: row 1 lives in the header (a portal), row 2 stays in the page flow and sticks
  // underneath it. `target` is null for the first commit only — the outlet's ref sets it.
  return (
    <>
      {row1 !== null && target !== null && createPortal(row1, target)}
      {row2 !== null && (
        <div
          ref={measureRef}
          className={rootClass(classes.row2Sticky, className)}
          data-basalt-page-bar="shell"
        >
          {row2}
        </div>
      )}
      {panelSheet}
    </>
  )
}
