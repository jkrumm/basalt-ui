/**
 * BasaltShell — the application shell (collapsible sidebar rail + slim top bar + mobile bottom
 * bar). Grounded in argo's app-shell; the layout mirrors the `AppShell` composition in
 * `apps/dashboard/src/routes/__root.tsx`.
 *
 * ONE nav definition drives both halves. `sections` renders the desktop sidebar, and
 * `projectMobileNav` projects the SAME sections onto the mobile bar — so a destination is declared
 * once and `SidebarItem.mobile` decides where it lands. There is no mobile sidebar drawer: below
 * the `sm` breakpoint the navbar is permanently collapsed and the bottom bar IS the nav, which is
 * why the More surface must also carry the account and settings rows the sidebar footer holds on
 * desktop.
 *
 * Router-agnostic: argo's router coupling (typed `navigate`, `useMatchRoute` active detection, the
 * sidebar-collapse zustand store) stays consumer-side. The consumer resolves `item.active`,
 * `item.onClick`, `item.badge`/`item.count` and supplies `item.Anchor` — its router `<Link>`,
 * which basalt HOSTS rather than delegating rendering to. The breadcrumb is derived from the
 * active item across `sections`, not from a router hook. Collapse is persisted via basalt's own
 * `createPersistedState` (`../state`) keyed by `storageKey` — see `collapseStore`.
 */
import { AppShell, Box } from '@mantine/core'
import { Fragment, useMemo } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { AppSidebar } from './app-sidebar'
import { MobileNav, accountRowCount } from './app-mobile-nav'
import { blockRowCount, projectMobileNav } from './mobile-nav-model'
import { AppBreadcrumbs } from './app-breadcrumbs'
import { PageBarOutlet, PageBarProvider, usePageKebabClaimed } from './page-bar'
import { AsideOutlet, AsideProvider, useAsideRegion } from './page-aside'
import { OverflowMenu, globalActionAsBarAction, globalActionMobile } from '../controls/actions'
import type { GlobalAction } from '../controls/actions'
import type { AccountMenuItem, BasaltAccountProps } from './account-types'
import type { SidebarSearchActions, SidebarSearchConfig } from './sidebar-search'
import type {
  MobileNavConfig,
  NavAnchor,
  SidebarBlock,
  SidebarItem,
  SidebarSection,
} from '../nav/types'
import { CtlSlot, useBasaltSpacing } from '../theme'
import { createPersistedState } from '../state'
import headerClasses from './app-header.module.css'
import mobileNavClasses from './app-mobile-nav.module.css'
import asideClasses from './page-aside.module.css'

export { AppSidebar, type AppSidebarProps } from './app-sidebar'
export { NavCountBadge } from './nav-count-badge'
export {
  SidebarSearch,
  type SidebarSearchConfig,
  type SidebarSearchActions,
} from './sidebar-search'
export { SidebarAccount } from './app-sidebar-account'
export type {
  AccountBadgeTone,
  BasaltIdentity,
  BasaltRole,
  BasaltPlan,
  AccountMenuItem,
  BasaltAccountState,
  BasaltAccountActions,
  BasaltAccountProps,
} from './account-types'
export { MobileNav, type MobileNavProps } from './app-mobile-nav'
export {
  projectMobileNav,
  type ProjectMobileNavOptions,
  MOBILE_MAX_TABS_DEFAULT,
  MOBILE_MENU_MAX_DEFAULT,
  MOBILE_MORE_KEY,
} from './mobile-nav-model'
export { AppBreadcrumbs } from './app-breadcrumbs'
export { PageBar, type PageBarProps } from './page-bar'
export { PageAside, type PageAsideProps } from './page-aside'

/**
 * The shared nav vocabulary lives in `src/nav/types.ts` so the headless router bridge can `import
 * type` it without reaching into the Mantine layer. Re-exported here so `SidebarItem` /
 * `SidebarSection` keep resolving straight from `basalt-ui`, exactly as before.
 */
export type {
  NavAnchor,
  NavAnchorProps,
  NavMobilePlacement,
  NavSectionMobile,
  SidebarItem,
  SidebarSection,
  SidebarBlock,
  SidebarBlockItem,
  SidebarBlockTone,
  SidebarListBlock,
  SidebarProgressBlock,
  SidebarCustomBlock,
  MobileNavConfig,
  MobileNavGroup,
  MobileNavModel,
  MobileNavSlot,
  MobileNavSurface,
} from '../nav/types'

/** Brand identity shown in the sidebar header (logo + name). */
export type BrandConfig = {
  /** Display name (e.g. "Argo"). */
  name: string
  /** Logo source URL (e.g. "/favicon.svg"). */
  logoSrc?: string
  /** Logo alt text; falls back to `name`. */
  logoAlt?: string
  /** App version string surfaced in the settings menu (e.g. from a build-time constant). */
  version?: string
}

/** A settings-menu entry (e.g. theme switcher, devtools). */
export type SettingsMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  onClick?: (e: MouseEvent) => void
}

export type BasaltShellProps = {
  /**
   * Brand identity for the sidebar header. Supplying `menu` turns the brand row into a `Name ▾`
   * workspace switcher — the rows are `AccountMenuItem`s, the shape the account menu already uses.
   */
  brand: BrandConfig & { menu?: AccountMenuItem[] }
  /** Grouped nav sections — the ONE definition, rendered as the sidebar and projected to the bar. */
  sections: SidebarSection[]
  /**
   * Mobile bar tuning. Every field optional — the defaults ARE the design, and a nav with nothing
   * configured still produces a working bar (see `projectMobileNav`'s zero-config fallback).
   */
  mobileNav?: MobileNavConfig
  /**
   * Persistent, shell-owned header actions (timer, notifications, a global `SyncButton`) — DECLARED
   * DATA, not a `ReactNode` slot, so basalt owns the mobile projection: the first two ride the bar,
   * the rest fold into the header's single kebab (`mobile: 'bar' | 'more' | 'hidden'`, see
   * `GlobalAction`). That kebab is the SAME one `PageBar`'s ROW 1 opens — a route whose bar has
   * row-1 actions (or `filtersEnd`) lends it, any other route gets it from the shell. An
   * `ActionGroup` a consumer mounts in some other home never inherits these rows.
   */
  globalActions?: GlobalAction[]
  /**
   * Sidebar blocks — DECLARED DATA (law C13, `docs/CONTROLS-SPEC.md` §2.3), which replaced both
   * `sidebarNavExtra` and `mobileNav.moreExtra`. `placement: 'nav'` (the default for `list` and
   * `custom`) appends after the nav sections inside the scroll region; `'bottom'` pins above the
   * settings footer.
   *
   * Because they are data, basalt owns the projections the two `ReactNode` slots could not express:
   * a `list` with a `count` becomes a dot on its icon in the collapsed rail, a `progress` block
   * becomes a ring on the settings row, and a block with `mobile: 'more'` becomes one More-sheet
   * row opening a nested sheet of its items. A `kind: 'custom'` block is desktop-only, exactly as
   * `sidebarNavExtra` was.
   */
  sidebarBlocks?: SidebarBlock[]
  /**
   * Entries appended to the sidebar settings footer — flat link rows at three or fewer, one gear
   * menu at four or more (`AppSidebarProps.settingsMenuItems` documents the threshold).
   */
  settingsMenuItems?: SettingsMenuItem[]
  /**
   * Forces the footer form instead of taking the count rule above: `'flat'` always renders link
   * rows, `'menu'` always renders the gear dropdown. `'auto'` (the default) is today's ≤3 → flat
   * behaviour. Reach for it when the rows are CONTROLS rather than destinations — three of those
   * (a theme radio group, a devtools switch) read as a widget pile in the footer even though the
   * count says flat. Full rationale on `AppSidebarProps.settingsMenu`.
   *
   * @default 'auto'
   */
  settingsMenu?: 'auto' | 'flat' | 'menu'
  /**
   * Optional account row rendered below the settings menu in the sidebar footer (see
   * `SidebarAccount` / `BasaltAccountProps`). Omitting it reproduces today's footer unchanged.
   */
  account?: BasaltAccountProps
  /**
   * Optional search field below the brand in the sidebar (fixed, above the nav scroll). Supply
   * `onOpen`, e.g. `() => openSpotlight()` from basalt-ui/commands. `actions` adds one or two
   * icon-only buttons to the right of that row (a tuple by type — see `SidebarSearchActions`).
   */
  search?: SidebarSearchConfig & { actions?: SidebarSearchActions }
  /**
   * localStorage key for the persisted sidebar-collapsed flag. Ignored when `collapsed` is set.
   *
   * Persisted through basalt's own `createPersistedState`, so the real storage key is
   * `basalt:<storageKey>` and the value is the versioned `{ v, value }` envelope. A consumer
   * mirroring this state reads it with `readPersistedValue(storageKey, 1)` from `basalt-ui/state`
   * — never with a bare `localStorage.getItem`, which is what the pre-1.20.1 shell forced.
   */
  storageKey?: string
  /**
   * Controlled desktop-collapse value. When provided, the shell no longer owns the persisted
   * collapse state — the consumer does (e.g. to drive it from its own `Cmd+B` hotkey), and should
   * own it through `createPersistedState` too. Pair with `onCollapsedChange` to receive toggle
   * events; omitting both reproduces today's internal, persisted collapse behavior unchanged.
   */
  collapsed?: boolean
  /**
   * Called with the next collapsed value whenever the desktop collapse toggle fires (button click
   * or a future consumer-driven trigger). Required to actually move `collapsed` when controlled;
   * a no-op when omitted.
   */
  onCollapsedChange?: (collapsed: boolean) => void
  /** Page content. */
  children?: ReactNode
}

/** Active nav item across all sections → the breadcrumb's `{ section, parent?, …, page }`. */
function findActiveCrumb(sections: SidebarSection[]): ActiveCrumb | undefined {
  for (const section of sections) {
    const found = findActiveWithParent(section.items)
    if (found)
      return {
        section: section.label,
        parent: found.parent,
        parentAnchor: found.parentAnchor,
        parentHref: found.parentHref,
        page: found.page,
      }
  }
  return undefined
}

type ActiveCrumb = {
  section: string
  parent?: string | undefined
  parentAnchor?: NavAnchor | undefined
  parentHref?: string | undefined
  page: string
}

/**
 * Recursively search for the deepest active item, returning the parent's label and its ROUTER
 * ANCHOR (not just an href) when nested — the crumb navigates client-side through the same seam
 * every nav row uses, so no second render callback is needed for it.
 */
function findActiveWithParent(
  items: SidebarItem[],
  parentLabel?: string | undefined,
  parentAnchor?: NavAnchor | undefined,
  parentHref?: string | undefined,
): Omit<ActiveCrumb, 'section'> | undefined {
  for (const item of items) {
    // Recurse into children first — deeper active match wins over a prefix-matched parent.
    if (item.children) {
      const found = findActiveWithParent(item.children, item.label, item.Anchor, item.href)
      if (found) return found
    }
    if (item.active) return { parent: parentLabel, parentAnchor, parentHref, page: item.label }
  }
  return undefined
}

/** Envelope version for the persisted collapse flag. Bump only if the value stops being a boolean. */
const COLLAPSE_VERSION = 1

/**
 * One `createPersistedState` store per `storageKey`, memoized at module scope.
 *
 * Through 1.20.0 the shell persisted collapse with `@mantine/hooks`' `useLocalStorage` while
 * `createPersistedState` was the documented house API — and this component's own docstring told
 * consumers to mirror that when driving `collapsed` externally, so the reference consumer's raw
 * `localStorage` call was COMPLIANCE with the shipped component rather than drift. A framework
 * cannot ship a persistence rule its own shell breaks; this is the shell coming into line.
 *
 * The memo is required, not an optimization: `createPersistedState` is a per-key module FACTORY and
 * `storageKey` is a runtime prop, so calling it during render would allocate a fresh store (and a
 * fresh `useSyncExternalStore` subscription) on every commit. Swapping keys mid-life stays safe —
 * every store's hook calls exactly one `useSyncExternalStore`, so the hook count never moves.
 */
const collapseStores = new Map<string, () => readonly [boolean, (next: boolean) => void]>()

/**
 * Seeds `basalt:<key>` from the raw pre-1.20.1 key once, so the switch doesn't silently re-expand
 * every consumer's sidebar. Mantine's `useLocalStorage` wrote a bare `JSON.stringify(value)` at the
 * un-namespaced key; only `'true'`/`'false'` are accepted, and only when the house key is empty.
 * A one-upgrade bridge, not a supported format — delete it once no consumer predates 1.20.1.
 */
function migrateLegacyCollapse(key: string): void {
  try {
    if (window.localStorage.getItem(`basalt:${key}`) !== null) return
    const legacy = window.localStorage.getItem(key)
    if (legacy !== 'true' && legacy !== 'false') return
    window.localStorage.setItem(
      `basalt:${key}`,
      JSON.stringify({ v: COLLAPSE_VERSION, value: legacy === 'true' }),
    )
  } catch {
    // Storage blocked (private browsing, quota) — defaulting to expanded is a fine outcome.
  }
}

function collapseStore(key: string): () => readonly [boolean, (next: boolean) => void] {
  const cached = collapseStores.get(key)
  if (cached) return cached
  if (typeof window !== 'undefined') migrateLegacyCollapse(key)
  const store = createPersistedState<boolean>({ key, version: COLLAPSE_VERSION, initial: false })
  collapseStores.set(key, store)
  return store
}

// The shared inset for the shell padding and the header's inline padding, so the breadcrumb's
// left edge and the global actions' right edge land on the card column's edges.
const SHELL_INSET = 'sm' as const

/**
 * The shell's two page-level regions are providers, and both wrap the frame rather than living
 * inside it: `PageBarProvider` owns the header portal and the single-kebab claim, `AsideProvider`
 * owns the aside portal, the region CLAIM and the claiming page's fold state — which `ShellFrame`
 * has to READ to size `AppShell.Aside`, so it cannot be the component that provides it.
 */
export function BasaltShell(props: BasaltShellProps) {
  return (
    <PageBarProvider globalActions={props.globalActions ?? []}>
      <AsideProvider>
        <ShellFrame {...props} />
      </AsideProvider>
    </PageBarProvider>
  )
}

function ShellFrame({
  brand,
  sections,
  mobileNav,
  globalActions,
  sidebarBlocks,
  settingsMenuItems,
  settingsMenu,
  storageKey = 'basalt-sidebar-collapsed',
  collapsed: collapsedProp,
  onCollapsedChange,
  account,
  search,
  children,
}: BasaltShellProps) {
  // The active density level's resolved spacing — the AppShell dimensions below must track it
  // (see `SPACE_STEP_BASE`'s "shell/index.tsx" group doc in `tokens/palette.ts`): their contents
  // (controls, the search trigger/avatar, nav labels) already track density, so a fixed literal
  // container squeezes progressively worse as density rises.
  const { step } = useBasaltSpacing()
  const aside = useAsideRegion()
  const [storedCollapsed, setStoredCollapsed] = collapseStore(storageKey)()
  // Controlled/uncontrolled seam (item 19): an explicit `collapsed` prop overrides the internal
  // localStorage-persisted state entirely — the consumer becomes the source of truth.
  const isCollapseControlled = collapsedProp !== undefined
  const collapsed = isCollapseControlled ? collapsedProp : storedCollapsed
  const toggleCollapse = () => {
    const next = !collapsed
    if (!isCollapseControlled) setStoredCollapsed(next)
    onCollapsedChange?.(next)
  }

  const activeCrumb = findActiveCrumb(sections)
  // The account row, every settings entry and every mobile-reachable sidebar block render as flat
  // rows in the More surface (there is no mobile sidebar to reach them through any more), so they
  // count toward BOTH `needsMore` and the menu-vs-sheet threshold. `accountRowCount` and
  // `blockRowCount` are the SAME functions the renderer agrees with, not second estimates of them:
  // an account is worth 0 rows while `loading` and up to seven once authenticated, a block is worth
  // exactly one row however many items it holds, and §2.2's whole guarantee (`menuMax` rows fit the
  // headroom above the bar, and the menu runs `flip: false` so it cannot escape upward) is
  // arithmetic over this number.
  const extraMoreRows =
    accountRowCount(account) + (settingsMenuItems?.length ?? 0) + blockRowCount(sidebarBlocks)
  const model = useMemo(
    () => projectMobileNav(sections, { config: mobileNav, extraMoreRows }),
    [sections, mobileNav, extraMoreRows],
  )

  return (
    <AppShell
      h="100dvh"
      layout="alt"
      header={{
        // ONE height at every width (law C14): nothing reserves a second mobile row any more.
        height: step.appShellHeaderHeight,
      }}
      navbar={{
        width: {
          base: step.appShellNavbarWidth,
          sm: collapsed ? step.appShellNavbarRailWidth : step.appShellNavbarWidth,
        },
        breakpoint: 'sm',
        // No mobile sidebar drawer, ever — the bottom bar is the entire mobile nav.
        collapsed: { mobile: true },
      }}
      // The aside region (`docs/ASIDE-SPEC.md` §0). It is DECLARED here on every route and costs
      // nothing until a page mounts a `PageAside` to claim it: unclaimed it is zero-wide and
      // `collapsed.desktop`, so `--app-shell-aside-offset` stays 0 and the main column is
      // full-width (law C14 — an empty home renders nothing). There is no `BasaltShellProps`
      // prop for it on purpose; the ROUTE decides, the same way it decides its page bar.
      aside={{
        width: aside.claimed
          ? aside.folded
            ? step.appShellAsideRailWidth
            : step.appShellAsideWidth
          : 0,
        breakpoint: 'sm',
        // Below `sm` there is no region at all — `PageAside` renders its content in the page
        // flow instead, one node, no responsive twin (law C9).
        collapsed: { desktop: !aside.claimed, mobile: true },
      }}
      // A plain number, NOT a `calc(... + env(safe-area-inset-bottom))` string: Mantine's own
      // `.footer` rule already adds the inset to both the height and the padding (§2.7).
      footer={{ height: { base: step.mobileNavBarHeight, sm: 0 } }}
      padding={SHELL_INSET}
    >
      {/* Region seams (docs/DESIGN-SPEC.md §5, §8 #12): Mantine's `[data-with-border]` painted in
       * `--vx-divider` by the theme's `AppShell.extend({ vars })`. No shell module draws a region
       * edge; never opt a section back out of its border here. */}
      <AppShell.Header px={SHELL_INSET}>
        <div className={headerClasses.bar}>
          <div className={headerClasses.lead}>
            <AppBreadcrumbs {...activeCrumb} />
          </div>
          <PageBarOutlet className={headerClasses.pageBar} />
          <HeaderGlobalActions actions={globalActions ?? []} />
        </div>
      </AppShell.Header>

      <AppShell.Navbar p={0}>
        <AppSidebar
          brand={brand}
          sections={sections}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          {...(sidebarBlocks !== undefined && { blocks: sidebarBlocks })}
          {...(settingsMenuItems !== undefined && { settingsMenuItems })}
          {...(settingsMenu !== undefined && { settingsMenu })}
          {...(account !== undefined && { account })}
          {...(search !== undefined && { search })}
        />
      </AppShell.Navbar>

      {/* `mainSafeArea` closes the one real safe-area gap: Mantine sets
       * `--app-shell-footer-offset` to the RAW footer height, so Main's own padding-bottom is
       * short by exactly `env(safe-area-inset-bottom)` (§2.7). */}
      <AppShell.Main className={mobileNavClasses.mainSafeArea}>{children}</AppShell.Main>

      {/* The outlet is bare; the region's leading seam is the AppShell's own. An unclaimed region
       * is zero-wide but NOT display-none — Mantine's collapsed aside keeps its border-box, so a
       * seam would still paint as a 1px ghost at the viewport's right edge (measured on
       * `/dashboard`). The border follows the claim, not the section (C14). */}
      <AppShell.Aside p={0} withBorder={aside.claimed}>
        <AsideOutlet className={asideClasses.outlet} />
      </AppShell.Aside>

      <AppShell.Footer hiddenFrom="sm" p={0}>
        <MobileNav
          model={model}
          config={mobileNav}
          {...(account !== undefined && { account })}
          {...(settingsMenuItems !== undefined && { settingsMenuItems })}
          {...(sidebarBlocks !== undefined && { blocks: sidebarBlocks })}
        />
      </AppShell.Footer>
    </AppShell>
  )
}

/**
 * The shell's own `globalActions`, projected for both viewports.
 *
 * Each action is mounted EXACTLY ONCE inline, in declaration order — a `mobile: 'bar'` action with
 * no wrapper (visible at every width), a `'more'`/`'hidden'` one inside a `visibleFrom="sm"` box.
 * The `'more'` nodes appear a second time only inside the kebab dropdown, which Mantine mounts
 * lazily on open. That asymmetry is why `GlobalAction`'s JSDoc points anything stateful at
 * `mobile: 'bar'`.
 *
 * The kebab renders here only while NO page bar owns one (`usePageKebabClaimed`), so a header never
 * shows two — the claim is what makes "one kebab per header" a fact rather than a convention.
 */
function HeaderGlobalActions({ actions }: { actions: readonly GlobalAction[] }): ReactNode {
  const kebabClaimed = usePageKebabClaimed()
  if (actions.length === 0) return null

  const more = actions
    .filter((action, index) => globalActionMobile(action, index) === 'more')
    .map(globalActionAsBarAction)

  return (
    // `CtlSlot` here for the same reason a home wraps its own slot (law C5): `globalActions` are
    // consumer NODES, so basalt cannot pass them a size — it can only provide the tier they resolve
    // against. Without it a `<NotificationBell/>`'s internal `ActionIcon` fell back to Mantine's
    // `md` (28px) beside a 30px page group.
    <CtlSlot>
      <div className={headerClasses.global}>
        {actions.map((action, index) =>
          globalActionMobile(action, index) === 'bar' ? (
            <Fragment key={action.key}>{action.node}</Fragment>
          ) : (
            <Box key={action.key} visibleFrom="sm">
              {action.node}
            </Box>
          ),
        )}
        {!kebabClaimed && more.length > 0 && (
          <Box hiddenFrom="sm">
            <OverflowMenu actions={more} trigger="kebab" label="More actions" />
          </Box>
        )}
      </div>
    </CtlSlot>
  )
}
