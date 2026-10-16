/**
 * Resolve a `defineNav` definition into the two props `BasaltShell` renders from.
 *
 * One `defineNav([...])` in a leaf module produces the desktop sidebar AND the mobile bar: this
 * hook resolves active state through the router and builds each destination's anchor, which is
 * what deletes a consumer's `renderNavLink` / `renderBreadcrumbLink` / `NAV_TARGETS` table and
 * every hand-written `useMatchRoute` call.
 *
 * No JSX — anchors are built with `createElement`, so `./router-tanstack` stays a headless,
 * no-JSX `.ts` module per its own barrel contract.
 */
import { createElement, forwardRef, useMemo, useRef } from 'react'
import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react'
import { Link, useMatchRoute, useRouterState } from '@tanstack/react-router'
import type {
  ActiveCrumb,
  MobileNavConfig,
  NavAnchor,
  SidebarItem,
  SidebarSection,
} from '../shell/nav-types'
import { flattenNav } from './nav-stash'
import type { AnyNavGroup, AnyNavItem, NavConfig, NavItemId, NavTabId } from './nav'

export type UseNavOptions<G extends ReadonlyArray<AnyNavGroup>> = {
  /**
   * Live per-destination badges, keys typed to the definition's id union.
   * A `number` becomes `item.count` (desktop `NavCountBadge` + mobile dot).
   * Anything else becomes `item.badge` (desktop only).
   */
  badges?: Partial<Record<NavItemId<G>, number | ReactNode>>
  /** Override active detection entirely. */
  isActive?: (item: AnyNavItem & { id: NavItemId<G> }) => boolean
  getScrollElement?: () => HTMLElement | null
}

type OverriddenAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  'data-status'?: string
  'data-basalt-current'?: 'page' | 'true'
  _asChild?: unknown
}

/**
 * The host `Link` renders as when `isActive` overrides the router. A `Link` computes its own
 * `isActive` and spreads `aria-current="page"` + `data-status="active"` as the LAST props it
 * applies (`@tanstack/react-router` 1.170.x `dist/esm/link.js`, `applyLinkState`), so under an
 * override a router-matched loser would still claim the page. `Link` renders `props._asChild` as
 * its host element in place of `'a'` (same file, `Link`: `const host = props._asChild || "a"`) —
 * an underscore-prefixed, undocumented seam, so `MAINTAINING.md` names it for re-verification on
 * every router bump. This host drops the router's two attributes and re-applies only basalt's own
 * verdict, which the anchor smuggles through `data-basalt-current`; `data-status` is re-stamped
 * for it so both paths expose the same hooks on the winner.
 */
const OverriddenAnchor = forwardRef<HTMLAnchorElement, OverriddenAnchorProps>((props, ref) => {
  const {
    'aria-current': _routerCurrent,
    'data-status': _routerStatus,
    'data-basalt-current': current,
    _asChild: _host,
    ...rest
  } = props
  return createElement('a', {
    ...rest,
    ...(current !== undefined && { 'aria-current': current, 'data-status': 'active' }),
    ref,
  })
})
OverriddenAnchor.displayName = 'OverriddenAnchor'

/** What this resolver turns a definition into: `ShellFrame`'s sidebar sections and mobile-bar tuning. */
export type ResolvedNav = {
  sections: SidebarSection[]
  mobileNav: MobileNavConfig
  /** The breadcrumb for the one active destination; `undefined` when nothing matches. */
  activeCrumb: ActiveCrumb | undefined
}

/**
 * One anchor per destination for the life of its `config`. An anchor is a component TYPE to React,
 * so a fresh function per resolve unmounts every nav `<a>` on every navigation (focus lost, hover
 * reset). Nothing per-render is closed over: active state travels as plain data on
 * `SidebarItem.active` and arrives here as the `aria-current` prop. Keyed `override:id` because the
 * `isActive` override swaps the host element (`OverriddenAnchor`).
 */
const anchorCache = new WeakMap<object, Map<string, NavAnchor>>()

function anchorFor(config: object, item: AnyNavItem, overridden: boolean): NavAnchor {
  let byId = anchorCache.get(config)
  if (!byId) anchorCache.set(config, (byId = new Map()))
  const key = `${overridden ? 1 : 0}:${item.id}`
  const cached = byId.get(key)
  if (cached) return cached
  // `activeOptions: { exact: true, includeSearch: true }` makes `resolveState` the ONLY authority
  // on active, and it is not a preference — a `Link` computes its own `isActive` (default
  // `exact: false`, i.e. prefix) and spreads `{ 'data-status': 'active', 'aria-current': 'page' }`
  // LAST, after `activeProps` and every caller prop (`@tanstack/react-router/dist/esm/link.js`).
  // `aria-current` cannot be overridden from outside; the only lever is `isActive` itself. Left at
  // its default, parent AND child anchors both carried `aria-current="page"` at
  // `/dashboard/sessions` (verified in Chrome). `includeSearch` defaults to `true` upstream; naming
  // it is belt-and-braces. Exact here does NOT narrow basalt's own law: `resolveState` still
  // matches fuzzily, and an item whose exact route is never visited is named by the `aria-current`
  // `app-sidebar.tsx` stamps itself. `Link as ElementType` is the single cast in the chain (the
  // widened `AnyNavLink['search']` is `unknown`, which `LinkComponentProps` rejects); the consumer
  // gets zero casts.
  const Anchor: NavAnchor = (props) =>
    createElement(Link as ElementType, {
      ...item.link,
      activeOptions: { exact: true, includeSearch: true },
      ...(overridden && {
        _asChild: OverriddenAnchor,
        'data-basalt-current': props['aria-current'],
      }),
      ...props,
    })
  byId.set(key, Anchor)
  return Anchor
}

/** Shallow structural equality, so an inline `badges={{ … }}` literal is not a new input. */
function shallowEqual(a: object | undefined, b: object | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ak = Object.keys(a)
  return (
    ak.length === Object.keys(b).length &&
    ak.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}

/**
 * Resolve a nav definition against the live router into `BasaltShell`'s internal `ShellFrame`
 * props. Shell-internal: a consumer passes `nav={NAV}` to `BasaltShell` and never calls this.
 */
export function useNav<
  const G extends ReadonlyArray<AnyNavGroup>,
  const T extends ReadonlyArray<NavTabId<G>>,
>(config: NavConfig<G, T>, opts?: UseNavOptions<G>): ResolvedNav {
  // `useMatchRoute` is `useCallback(fn, [router])` — a STABLE identity across renders — and it
  // subscribes internally to `router.stores.matchRouteDeps`, so the component still re-renders on
  // navigation. That makes it safe as a memo dep, and makes the memo below actually hit.
  const matchRoute = useMatchRoute()
  // The change signal: one string that moves on every navigation, including search-param-only ones.
  const href = useRouterState({ select: (s) => s.location.href })

  // Compared structurally on a ref: the previous object is kept while every value is unchanged, so
  // an inline literal never rebuilds the sections below.
  const badgesRef = useRef(opts?.badges)
  if (!shallowEqual(badgesRef.current, opts?.badges)) badgesRef.current = opts?.badges
  const badges = badgesRef.current
  const isActiveOverride = opts?.isActive

  const resolved = useMemo<Pick<ResolvedNav, 'sections' | 'activeCrumb'>>(() => {
    const badgeOf = (id: string): number | ReactNode =>
      (badges as Record<string, number | ReactNode> | undefined)?.[id]

    // Per-item match, exactly as before: the override wins when supplied, otherwise a router
    // prefix match (`'/'` stays exact). What changed is that this boolean no longer BECOMES
    // `active` on its own — it only says "on the path", and the pass below picks ONE winner
    // across the whole definition so a parent and its child can no longer both read `active`.
    const matchOf = (item: AnyNavItem): boolean =>
      isActiveOverride?.(item as AnyNavItem & { id: NavItemId<G> }) ??
      Boolean(
        matchRoute({
          to: item.link.to,
          ...(item.link.params !== undefined && { params: item.link.params }),
          fuzzy: item.exact !== true && item.link.to !== '/',
        }),
      )

    // One pass over the WHOLE flattened definition (`flattenNav` — depth-first, parent then
    // children, the same order every other reader of a nav config walks it) rather than a
    // per-item independent check, which is what let a parent prefix-match stay lit alongside an
    // exact-matching child. The most SPECIFIC match (most non-empty `/`-segments in `link.to`)
    // wins; a tie (the playground's `reports`/`components` shape, both pointing at `/components`)
    // keeps the FIRST item in definition order, since only a strictly later, strictly longer match
    // ever replaces the current winner below.
    const allItems = flattenNav(config)
    const specificity = (to: string): number => to.split('/').filter(Boolean).length
    const matchedById = new Map<string, boolean>()
    let winnerId: string | undefined
    let winnerTo: string | undefined
    for (const item of allItems) {
      const matched = matchOf(item)
      matchedById.set(item.id, matched)
      if (
        matched &&
        (winnerTo === undefined || specificity(item.link.to) > specificity(winnerTo))
      ) {
        winnerId = item.id
        winnerTo = item.link.to
      }
    }

    // `active` is true for the winner only. `ancestor` is true for a matched item that sits
    // strictly on the winner's PATH (`winnerTo` starts with `item.link.to + '/'`) — a same-length
    // tie loser matches nothing here (its own `to` cannot be a strict prefix of an equally long
    // `winnerTo`), so it reads as neither active nor an ancestor, which is the point: two
    // destinations sharing one route are siblings, not a hierarchy.
    const resolveState = (item: AnyNavItem): { active: boolean; ancestor: boolean } => {
      if (item.id === winnerId) return { active: true, ancestor: false }
      const matched = matchedById.get(item.id) ?? false
      const ancestor = winnerTo !== undefined && matched && winnerTo.startsWith(`${item.link.to}/`)
      return { active: false, ancestor }
    }

    let activeCrumb: ActiveCrumb | undefined
    let sectionLabel = ''
    const overridden = isActiveOverride !== undefined

    const toSidebarItem = (item: AnyNavItem, parent?: AnyNavItem): SidebarItem => {
      // One anchor per destination, hosted by basalt's own chrome (desktop row, 56px slot, 44px
      // sheet row), so `preload`, middle-click and back/forward all keep working.
      const Anchor = anchorFor(config, item, overridden)
      const badge = badgeOf(item.id)
      const children = item.children?.map((child) => toSidebarItem(child, item))
      const { active, ancestor } = resolveState(item)
      if (active) {
        activeCrumb = {
          section: sectionLabel,
          page: item.label,
          ...(parent !== undefined && {
            parent: parent.label,
            parentAnchor: anchorFor(config, parent, overridden),
          }),
        }
      }

      return {
        key: item.id,
        label: item.label,
        icon: item.icon,
        Anchor,
        // Exactly one destination in the WHOLE definition reads `active` (`resolveState` above).
        // Rolling that up into a mobile SLOT (any descendant active → the slot reads active) is
        // still `projectMobileNav`'s job, which reads `children` for that. `ancestor` is the
        // desktop-only middle state: a matched item that sits on the winner's path but isn't it.
        active,
        ...(ancestor && { ancestor }),
        ...(item.short !== undefined && { short: item.short }),
        ...(item.mobile !== undefined && { mobile: item.mobile }),
        ...(item.disabled !== undefined && { disabled: item.disabled }),
        ...(typeof badge === 'number'
          ? { count: badge }
          : badge === undefined || badge === null
            ? {}
            : { badge }),
        ...(children !== undefined && { children }),
      }
    }

    const sections = config.groups.map((group) => {
      sectionLabel = group.label
      return {
        label: group.label,
        items: group.items.map((item) => toSidebarItem(item)),
        ...(group.icon !== undefined && { icon: group.icon }),
        ...(group.collapsible !== undefined && { collapsible: group.collapsible }),
        ...(group.defaultCollapsed !== undefined && { defaultCollapsed: group.defaultCollapsed }),
        ...(group.mobile !== undefined && { mobile: group.mobile }),
      }
    })
    return { sections, activeCrumb }
    // `href` is deliberately an unread dep, and the reason the memo is correct: `matchRoute` has a
    // STABLE identity (`useCallback(fn, [router])`), so nothing else in this list moves on a
    // navigation — while the `matchRoute` calls above read router state that just changed. `href`
    // is the one value that always does move, so it is what re-derives `active`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [config, matchRoute, href, badges, isActiveOverride])

  const mobile = config.mobile
  const getScrollElement = opts?.getScrollElement

  const mobileNav = useMemo<MobileNavConfig>(() => {
    // `MobileNavConfig.tabs` names SIDEBAR keys, and a `SidebarSection` is identified by its
    // `label` (it carries no key). A group id in `mobile.tabs` is therefore translated to that
    // group's label here; item ids pass through verbatim because `SidebarItem.key` IS the id.
    const groupLabelById = new Map(config.groups.map((g) => [g.id, g.label]))
    const tabs = mobile?.tabs?.map((id) => {
      const key = id as string
      return groupLabelById.get(key) ?? key
    })

    return {
      ...(tabs !== undefined && { tabs }),
      ...(mobile?.maxTabs !== undefined && { maxTabs: mobile.maxTabs }),
      ...(mobile?.menuMax !== undefined && { menuMax: mobile.menuMax }),
      ...(mobile?.moreLabel !== undefined && { moreLabel: mobile.moreLabel }),
      ...(getScrollElement !== undefined && { getScrollElement }),
    }
  }, [config, mobile, getScrollElement])

  return { ...resolved, mobileNav }
}
