/**
 * `PageBar` — the tier-1 home (`docs/CONTROLS-SPEC.md` §2.1). One per page; every page-level
 * control enters through one of its slots (law C1) and is sized by it (law C5).
 *
 * Two rows, and WHERE they render is decided by context, never by a prop:
 *
 * - **Inside `BasaltShell`** row 1 (`actions`, `sync`) portals into the existing 48px app-shell
 *   header — the same slot/portal mechanism `PageActions` used through 1.26.0, which this replaces.
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
 * and the header never reserves a second mobile row the way the pre-1.27.0 two-row layout did.
 *
 * Originally extracted from argo's `apps/dashboard/src/components/app-shell/page-header.tsx`;
 * linewatch's `page-header.tsx` measure-and-publish effect became the framework behaviour below.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CtlSlot } from '../theme'
import { BarActionRow, BarExtrasProvider, globalActionAsBarAction } from '../controls/actions'
import { SyncButton } from '../controls/sync-button'
import type { ActionGroupProps, BarAction, GlobalAction } from '../controls/actions'
import type { SyncButtonProps } from '../controls/sync-button'
import classes from './page-bar.module.css'

/** The custom property row 2's measured height is published on. */
export const PAGE_BAR_HEIGHT_VAR = '--basalt-page-bar-h'

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
}

const NO_SLOTS: PageBarSlots = {
  target: null,
  setTarget: () => {},
  inShell: false,
  mobileMoreActions: [],
  kebabClaims: 0,
  claimKebab: () => () => {},
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

  const claimKebab = useCallback(() => {
    setKebabClaims((n) => n + 1)
    return () => setKebabClaims((n) => n - 1)
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
}

/**
 * Publishes an element's measured height as a custom property on `documentElement`.
 *
 * The `height > 0` guard is the whole point: a ResizeObserver fires once with a zero box while the
 * element is still being laid out (and again whenever it is hidden), and publishing that zero is
 * what made a consumer's sticky offset collapse mid-navigation. The property is removed on unmount
 * so a route without a bar does not inherit the last one's height.
 */
function useMeasuredHeightVar(active: boolean): (node: HTMLDivElement | null) => void {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const ref = useCallback((next: HTMLDivElement | null) => setNode(next), [])

  useEffect(() => {
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
  }, [active, node])

  return ref
}

export function PageBar({
  title,
  icon,
  actions,
  sync,
  filters,
  filtersEnd,
  tabs,
}: PageBarProps): ReactNode {
  const { target, inShell } = useContext(PageBarContext)

  const filtersEndActions = filtersEnd ?? []
  const hasRow2 = tabs !== undefined || filters !== undefined || filtersEndActions.length > 0
  const hasLead = !inShell && (title !== undefined || icon !== undefined)
  // `filtersEnd` keeps row 1 alive on its own: below `sm` its items fold into the ROW-1 kebab (the
  // header's single one), so the row that hosts that kebab has to exist even with no `actions`.
  const hasRow1 =
    actions !== undefined || sync !== undefined || hasLead || filtersEndActions.length > 0
  const measureRef = useMeasuredHeightVar(hasRow2 || (!inShell && hasRow1))

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
        {(actions !== undefined || filtersEndActions.length > 0) && (
          <CtlSlot>
            {/* THE row-1 group: the only `host: 'page'` instance, so the shell's `mobile: 'more'`
                global actions reach exactly one kebab (`BarActionRowProps.host`). `filtersEnd`
                joins that kebab below `sm` and renders in row 2 above it. */}
            <BarActionRow {...actions} host="page" mobileOnly={filtersEndActions} />
          </CtlSlot>
        )}
        {sync !== undefined && (
          <CtlSlot>
            <SyncButton {...sync} scope="page" />
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

  // Shell-less: one sticky bar at the top of the document holding both rows, `title` leading.
  if (!inShell) {
    if (row1 === null && row2 === null) return null
    return (
      <div ref={measureRef} className={classes.bar} data-basalt-page-bar="standalone">
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
        <div ref={measureRef} className={classes.row2Sticky} data-basalt-page-bar="shell">
          {row2}
        </div>
      )}
    </>
  )
}
