/**
 * `PageAside` — the right-hand aside REGION (`docs/ASIDE-SPEC.md` §0, wave 1). One per page, and
 * it is the page that decides the region exists at all: `BasaltShell` always renders an
 * `AppShell.Aside`, but with a width of 0 and `collapsed.desktop` until a route mounts a
 * `PageAside` to CLAIM it — an empty home renders nothing (law C14), so no route pays for a
 * reserved column. There is deliberately no `BasaltShellProps` prop for it.
 *
 * The mechanism is `PageBar` row 1's, one region over: an internal provider owns the portal target
 * plus the claim, an internal outlet publishes the node, and the public component portals its own
 * chrome into it. What the aside adds on top of the claim is the FOLD state — the shell needs it to
 * size the region, so `PageAside` publishes it back through the same provider.
 *
 * WHERE it renders is decided by context and viewport, never by a prop:
 *
 * - **Inside `BasaltShell`, from `sm` up** the panel portals into `AppShell.Aside`, folding to a
 *   `appShellAsideRailWidth` rail with one expand button.
 * - **Below `sm`, with a `PageBar` that renders a row 2**, the panel PROJECTS into that row: it
 *   registers its title and glyph with the page-bar slot, renders no node of its own, and row 2
 *   draws one `Panel` pill opening a `FilterSheet` its children portal into. One node at a time —
 *   never the in-flow block AND the sheet.
 * - **Below `sm` with no such row, and in a shell-less app**, it renders IN-FLOW exactly where it
 *   is written — one node, no `visibleFrom` twin, no second mount (law C9) — with no fold chrome,
 *   because there is no region to fold into. A page therefore writes it after its main column and
 *   gets the stacked mobile order for free.
 *
 * **The body is the `panel` filter surface.** Children mount under `FilterSetScope surface="panel"`
 * with a `null` registry, so every basalt control in an aside renders its inspector/facet ROW form
 * rather than a pill (`docs/ASIDE-SPEC.md` §3), and none of them counts toward a `Filters (n)` that
 * does not exist here. In the mobile projection the same children mount under `surface="sheet"` —
 * the sheet's own row form, not a panel row squeezed into a drawer.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '@mantine/hooks'
import { useMantineTheme } from '@mantine/core'
import { usePersistedOrLocal } from '../state/persisted-or-local'
import { FilterSetScope } from '../controls/filter-context'
import { useAsidePanelSlot } from './page-bar'
import { useIsomorphicLayoutEffect } from './isomorphic-layout-effect'
import classes from './page-aside.module.css'

type AsideRegion = {
  /** The node inside `AppShell.Aside` the panel portals into. `null` outside a shell, and until
   * the outlet mounts. */
  target: HTMLElement | null
  setTarget: (el: HTMLElement | null) => void
  /** True only under `BasaltShell` — the provider is shell-internal, so the context IS the probe. */
  inShell: boolean
  /** A page is rendering a `PageAside` into the region; until then it has zero width. */
  claimed: boolean
  /** The claiming page's fold state, published back so the shell can size the region. */
  folded: boolean
  claim: () => () => void
  publishFolded: (folded: boolean) => void
}

const NO_REGION: AsideRegion = {
  target: null,
  setTarget: () => {},
  inShell: false,
  claimed: false,
  folded: false,
  claim: () => () => {},
  publishFolded: () => {},
}

const AsideContext = createContext<AsideRegion>(NO_REGION)

/**
 * Internal — mounted by `BasaltShell` inside `PageBarProvider`. Owns the portal target, the claim
 * that turns the region on, and the mirrored fold flag the shell reads for `aside.width`.
 */
export function AsideProvider({ children }: { children: ReactNode }): ReactNode {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [claims, setClaims] = useState(0)
  const [folded, setFolded] = useState(false)

  const claim = useCallback(() => {
    setClaims((n) => n + 1)
    return () => {
      setClaims((n) => n - 1)
      // A route that leaves folded must not hand the next one a folded, unclaimed region.
      setFolded(false)
    }
  }, [])

  const value: AsideRegion = {
    target,
    setTarget,
    inShell: true,
    claimed: claims > 0,
    folded,
    claim,
    publishFolded: setFolded,
  }

  return <AsideContext.Provider value={value}>{children}</AsideContext.Provider>
}

/** Internal — the region's state, read by `BasaltShell` to size `AppShell.Aside`. */
export function useAsideRegion(): Pick<AsideRegion, 'claimed' | 'folded'> {
  const { claimed, folded } = useContext(AsideContext)
  return { claimed, folded }
}

/** Internal — the node inside `AppShell.Aside` the active page's panel portals into. */
export function AsideOutlet({ className }: { className?: string }) {
  const { setTarget } = useContext(AsideContext)
  return <div ref={setTarget} className={className} />
}

export type PageAsideProps = {
  /** Header label; also the accessible name of the region. */
  title: string
  /** Persists the fold at `basalt:aside:<persistKey>`. Omit for an unpersisted fold. */
  persistKey?: string
  /** Fold state on first render, respected only while nothing is persisted. @default false */
  defaultFolded?: boolean
  children: ReactNode
  className?: string
}

/** The fold glyph — `app-sidebar.tsx`'s `IconCollapse`, mirrored onto the right-hand edge, so the
 * two shell folds read as one family. Inline, because basalt ships no icon dependency. */
function IconAsideFold({ folded }: { folded: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h16v16H4z" />
      <path d="M15 4v16" />
      {folded ? <path d="M10 9l-3 3l3 3" /> : <path d="M8 9l3 3l-3 3" />}
    </svg>
  )
}

/**
 * The aside's own glyph for the mobile `Panel` pill — {@link IconAsideFold}'s box and divider with
 * no chevron, because a pill that OPENS a panel is not folding one. Deliberately not a funnel: a
 * funnel is `Filters (n)`, and an aside is not a filter set.
 *
 * It travels to `PageBar` as part of the claim rather than being imported there, which is what
 * keeps `page-bar.tsx` free of any import back into this module.
 */
function IconAsidePanel() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h16v16H4z" />
      <path d="M15 4v16" />
    </svg>
  )
}

/** The fold toggle — a plain control sized to the `ctl` tier by hand, exactly like `Section`'s own
 * chevron (`section/section.module.css`) and for the same reason: wrapping one glyph in a
 * `CtlSlot` would nest a theme provider around it. */
function FoldButton({ folded, onToggle }: { folded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={classes.fold}
      aria-expanded={!folded}
      aria-label={folded ? 'Expand panel' : 'Collapse panel'}
      onClick={onToggle}
    >
      <IconAsideFold folded={folded} />
    </button>
  )
}

export function PageAside({
  title,
  persistKey,
  defaultFolded = false,
  children,
  className,
}: PageAsideProps): ReactNode {
  const { target, inShell, claim, publishFolded } = useContext(AsideContext)
  // Destructured, not held as one object: the hook returns a fresh literal every render, and the
  // claim effect below would then re-run (claim → release → claim) forever. `claimPanel` is a
  // `useCallback` on the provider, so it is the stable half.
  const { host: panelHost, claim: claimPanel, target: panelTarget } = useAsidePanelSlot()
  const theme = useMantineTheme()
  // `sm` is the only breakpoint (`docs/CONTROLS-SPEC.md` §2), read off the theme so a consumer that
  // retunes it moves the aside with it. `getInitialValueInEffect: false` plus the desktop default
  // keeps SSR and the first paint stable — the effect corrects a phone one commit later, and the
  // in-flow branch is the one that renders content, so nothing is ever unreachable in between.
  const desktop = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, true, {
    getInitialValueInEffect: false,
  })
  const [folded, setFolded] = usePersistedOrLocal({
    scope: 'aside',
    persistKey,
    initial: defaultFolded,
  })

  const portalled = inShell && desktop
  // Below `sm` the panel goes into the page bar's row 2 IF there is one. Without a row 2 there is
  // nowhere to put a trigger, so the honest in-flow form (wave 1) stays.
  const projected = !portalled && panelHost
  // Memoized on `title` alone: the claim goes into the provider's state, so an object rebuilt every
  // render would re-run the effect, re-set the state and re-render this component forever.
  const panelClaim = useMemo(() => ({ title, icon: <IconAsidePanel /> }), [title])

  useIsomorphicLayoutEffect(() => {
    if (!portalled) return
    return claim()
  }, [portalled, claim])

  useIsomorphicLayoutEffect(() => {
    if (!portalled) return
    publishFolded(folded)
  }, [portalled, folded, publishFolded])

  useIsomorphicLayoutEffect(() => {
    if (!projected) return
    return claimPanel(panelClaim)
  }, [projected, panelClaim, claimPanel])

  const panel = (
    <section
      className={[classes.panel, className].filter(Boolean).join(' ')}
      data-basalt-page-aside={portalled ? 'shell' : 'standalone'}
      aria-label={title}
    >
      {portalled && folded ? (
        <div className={classes.rail}>
          <FoldButton folded onToggle={() => setFolded(false)} />
        </div>
      ) : (
        <>
          <div className={classes.header}>
            <span className={classes.title}>{title}</span>
            {portalled && <FoldButton folded={false} onToggle={() => setFolded(true)} />}
          </div>
          <div className={classes.body}>
            {/* The aside body IS a home (law C1) and a filter surface: `panel` is what turns every
                bound control inside into an inspector row. `registry: null` because there is no
                census here — no `Filters (n)`, no `Reset all`. */}
            <FilterSetScope surface="panel" registry={null}>
              {children}
            </FilterSetScope>
          </div>
        </>
      )}
    </section>
  )

  // Projected: the node lives in the page bar's sheet, so this position renders NOTHING. The
  // children go through the outlet the bar publishes, under the SHEET surface — a 300px inspector
  // row in a full-width drawer would be a panel drawn in the wrong place.
  if (projected) {
    if (panelTarget === null) return null
    return createPortal(
      <FilterSetScope surface="sheet" registry={null}>
        {children}
      </FilterSetScope>,
      panelTarget,
    )
  }

  // In flow: below `sm` with no page bar to project into, and in every shell-less app. One node,
  // written where the page put it.
  if (!portalled) return panel
  // `target` is null for the first commit only — the outlet's ref sets it.
  if (target === null) return null
  return createPortal(panel, target)
}
