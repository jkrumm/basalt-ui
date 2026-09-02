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
 *
 * **This component is law C9's ONE declared exception, and the exception is the point of the law.**
 * Every other responsive twin in the package is CSS (`visibleFrom`/`hiddenFrom` in `actions.tsx`,
 * `view-tabs.tsx`), because there the two forms are two RENDERINGS of one stateless control and
 * mounting both costs a hidden box. Here they are not. The desktop form lives inside
 * `AppShell.Aside` and the phone form inside a `FilterSheet` whose Drawer UNMOUNTS its body when
 * closed — two portal targets, never one node CSS could reposition between them — and the two
 * mount their children under DIFFERENT filter surfaces (`panel` vs `sheet`), which is a React
 * context value no media query in CSS can express. A CSS-only twin would therefore have to render
 * the children TWICE, and an aside's children are stateful: every bound control in there would
 * subscribe to its field twice, which is the same defect the shell already refuses for live
 * indicators in the More sheet. Single-mounting a stateful panel beats a CSS twin, so the viewport
 * read stays in JS — through `useSyncExternalStore`, so SSR, hydration and the first paint agree.
 * Recorded in `docs/CONTROLS-SPEC.md` §1 (C9) and `docs/ASIDE-SPEC.md` §0.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMantineTheme } from '@mantine/core'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { usePersistedOrLocal } from '../state/persisted-or-local'
import { FilterSetScope } from '../controls/filter-context'
import { useAsidePanelSlot } from './page-bar'
import { useIsomorphicLayoutEffect } from './isomorphic-layout-effect'
import { useMediaQueryMatches } from './use-breakpoint'
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

/** The three boxes `PageAside` paints, in every projection (`common/props.ts`). */
export type PageAsideSlot = 'root' | 'header' | 'body'

export type PageAsideProps = BasaltProps &
  SlotStylesProps<PageAsideSlot> & {
    /** Header label; also the accessible name of the region. */
    title: string
    /** Persists the fold at `basalt:aside:<persistKey>`. Omit for an unpersisted fold. */
    persistKey?: string
    /** Fold state on first render, respected only while nothing is persisted. @default false */
    defaultFolded?: boolean
    children: ReactNode
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

export function PageAside(props: PageAsideProps): ReactNode {
  // F-ERR-1, and here it is an ACCESSIBILITY fault rather than a crash: `title` is both the visible
  // header and the region's `aria-label`, so a missing one ships a landmark with no name and a
  // header row with nothing in it — silently, on the branch a screen reader depends on.
  assertRequiredProps('PageAside', props, ['title'], {
    title: 'it names the region — it is the header text AND the `aria-label` on the landmark.',
  })
  const { title, persistKey, defaultFolded = false, children, className, style, classNames } = props
  const { target, inShell, claim, publishFolded } = useContext(AsideContext)
  // Destructured, not held as one object: the hook returns a fresh literal every render, and the
  // claim effect below would then re-run (claim → release → claim) forever. `claimPanel` is a
  // `useCallback` on the provider, so it is the stable half.
  const { host: panelHost, claim: claimPanel, target: panelTarget } = useAsidePanelSlot()
  const theme = useMantineTheme()
  // `sm` is the only breakpoint (`docs/CONTROLS-SPEC.md` §2), read off the theme so a consumer that
  // retunes it moves the aside with it. THE declared C9 exception (see this file's header): the
  // read is JS because the two projections are two portal targets under two filter surfaces, and a
  // CSS twin would double-mount stateful children. `useSyncExternalStore` is what keeps SSR, the
  // hydration pass and the first client paint agreeing on which single node exists.
  const desktop = useMediaQueryMatches(`(min-width: ${theme.breakpoints.sm})`, true)
  const [folded, setFolded] = usePersistedOrLocal({
    scope: 'aside',
    persistKey,
    initial: defaultFolded,
  })

  const portalled = inShell && desktop
  // Below `sm` the panel goes into the page bar's row 2 IF there is one. Without a row 2 there is
  // nowhere to put a trigger, so the honest in-flow form (wave 1) stays.
  const projected = !portalled && panelHost
  // WHETHER there is a row 2 is published by a LAYOUT EFFECT inside `PageBar`, and React runs
  // layout effects after the whole commit — so on a phone's FIRST render pass `panelHost` is
  // always false, whatever the page contains. Rendering the in-flow form on that pass therefore
  // mounted the children, ran their effects, and unmounted them one commit later on every page
  // that does project: MEASURED at 2 mounts of one probe subtree for one sheet (real Chrome,
  // 390x844). Invisible — a layout-effect state flip is flushed before paint — but every bound
  // control in the aside subscribed to its field, tore the subscription down and rebuilt it, and
  // any child holding state lost it. Deferring ONE commit is what makes "exactly one mount at
  // each width" true, which is the promise law C9's exception for this component is granted on.
  //
  // Scoped to the shell branch on purpose: a shell-less app has no row 2 to wait for, so it keeps
  // rendering in flow on its first pass with nothing deferred.
  const [settled, setSettled] = useState(false)
  // Memoized on `title` alone: the claim goes into the provider's state, so an object rebuilt every
  // render would re-run the effect, re-set the state and re-render this component forever.
  const panelClaim = useMemo(() => ({ title, icon: <IconAsidePanel /> }), [title])

  useIsomorphicLayoutEffect(() => {
    setSettled(true)
  }, [])

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
      className={cx(classes.panel, classNames?.root, className)}
      data-basalt-page-aside={portalled ? 'shell' : 'standalone'}
      aria-label={title}
      {...(style !== undefined && { style })}
    >
      {portalled && folded ? (
        <div className={classes.rail}>
          <FoldButton folded onToggle={() => setFolded(false)} />
        </div>
      ) : (
        <>
          <div className={cx(classes.header, classNames?.header)} data-basalt-page-aside-header="">
            <span className={classes.title}>{title}</span>
            {portalled && <FoldButton folded={false} onToggle={() => setFolded(true)} />}
          </div>
          <div className={cx(classes.body, classNames?.body)}>
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
  // written where the page put it — and inside a shell, not until the row-2 claim has had its one
  // commit to arrive (see `settled` above), so a page that DOES project never mounts these
  // children just to throw them away.
  if (!portalled) return inShell && !settled ? null : panel
  // `target` is null for the first commit only — the outlet's ref sets it.
  if (target === null) return null
  return createPortal(panel, target)
}
