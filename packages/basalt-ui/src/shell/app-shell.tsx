import { useRouter, useRouterState } from '@tanstack/react-router'
import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { ShellDockContext, ShellOverlayContext } from '../page/page'
import type { ShellDock } from '../page/page'
import { DOCK_WIDTH } from '../page/core/docking'
import { PanelSteps } from '../page/record-panel'
import { useSizeClass } from '../page/use-size-class'
import { registerNav } from '../router/nav/registry'
import {
  decodePath,
  flattenNavEntries,
  navItemPath,
  resolveActive,
} from '../router/nav/resolve-active'
import type { DefinedNav } from '../router/nav/types'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { FavoritesContext } from '../page/favorites'
import { createShellHost, useClaim } from './app-shell-host'
import { useFavoritesApi } from './favorites-host'
import { ChromeHost, useChromeRoot } from './chrome'
import type { AppShellProps } from './contract'
import { createNavRuntime } from './core/nav-runtime'
import {
  RouteAnnouncer,
  SkipLink,
  composeTitle,
  SHELL_TEXT,
  useDocumentTitle,
  useNavigationPending,
  useRouteAnnouncement,
  useRouteFocus,
} from './parts/a11y'
import {
  AsideRegion,
  DEFAULT_STORAGE_KEY,
  DockRegion,
  RailControlProvider,
  RailWidthProvider,
  ShellGrid,
  ShellMain,
  ShellSurface,
  readAsideClaim,
  useAsideModel,
  useDockModel,
  useDocumentFrame,
  useRailState,
  useRailWidthState,
} from './parts/grid'
import type { AsideClaim } from './parts/grid'
import { buildCrumbs } from './core/crumbs'
import type { CrumbClaim, CrumbRoute } from './core/crumbs'
import { Crumbs } from './parts/crumbs'
import { BrandZone, Header } from './parts/header'
import { usePhoneNav } from './parts/mobile'
import { RailMount, TabBarMount } from './parts/mounts'
import { usePrintScheme } from './parts/print'

/** The page's breadcrumb claim (a `PageCrumb` element) as data: its `title` and `parent`. */
function readCrumbClaim(node: ReactNode | undefined): CrumbClaim | undefined {
  if (node === undefined || node === null || typeof node !== 'object' || !('props' in node)) {
    return undefined
  }
  const props = node.props as { title?: unknown; parent?: CrumbClaim['parent'] }
  if (typeof props.title !== 'string') return undefined
  return { title: props.title, parent: props.parent }
}

/** One string per matched route that names itself (`staticData.title`), so the selection is stable. */
const ROUTE_SEP = '\u0000'
const MATCH_SEP = '\u0001'

function parseRoutes(key: string): CrumbRoute[] {
  if (key === '') return []
  return key.split(MATCH_SEP).map((pair) => {
    const [pathname = '', title = ''] = pair.split(ROUTE_SEP)
    return { pathname, title }
  })
}

function titleOf(staticData: unknown): string | undefined {
  if (typeof staticData !== 'object' || staticData === null) return undefined
  const title = (staticData as { title?: unknown }).title
  return typeof title === 'string' ? title : undefined
}

const NO_BLOCKS: NonNullable<AppShellProps['blocks']> = []
const NO_ACTIONS: NonNullable<AppShellProps['globalActions']> = []

/** A record aside with no record open: its header button would open nothing. */
function emptyRecord(claim: AsideClaim): boolean {
  return claim.sheet?.record === true && claim.sheet.open !== true
}

/**
 * On a compact screen the claimed aside is a sheet, opened from the header. A bound aside hands the
 * page's open state and setter in its claim, so the sheet follows that state; an aside without
 * `state` keeps a state of its own.
 */
function AsideSheet({ claim }: { claim: AsideClaim }): ReactElement {
  const [local, setLocal] = useState(false)
  const { sheet } = claim
  const open = sheet === undefined ? local : sheet.open === true
  const setOpen = sheet === undefined ? setLocal : sheet.onOpenChange
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="secondary" size="sm" />}>{claim.title}</SheetTrigger>
      <SheetContent
        title={claim.title}
        actions={claim.records === undefined ? undefined : <PanelSteps records={claim.records} />}
      >
        {claim.body}
      </SheetContent>
    </Sheet>
  )
}

/**
 * The application frame: a header, a rail, the one scrollport, an aside region and, on a phone, a
 * tab bar, all projections of one `nav` declaration. Two planes: the frame carries the top row (the
 * brand zone over the rail, the breadcrumb strip beside it with the global controls and the global
 * actions at its end) and the rail; one work surface under the strip carries the page, its `PageBar`
 * band as its first line, with the aside and the dock inside it. `frame="panel"` (the default)
 * insets and rounds that surface from `md` up; `frame="flush"` meets the window's edges, as every phone does. It owns the markup (a CSS grid in
 * `@layer basalt`), so there is nothing to override and nothing to fight. The crumb trail is the nav
 * section, the active item's nav ancestors, every path prefix a nav item or a matched route's
 * `staticData.title` names, the page's `PageBar` `parent`, then its `title` (`core/crumbs.ts`);
 * every ancestor is a link, joined by `/`. A selection such as
 * `/services?service=checkout` is `Fleet / Services / checkout` from
 * `<PageBar title={service.name} parent={{ label: 'Services', href: navTarget({ to: '/services', ...services.field.service.link('') }) }} />`.
 * The parent is a link through the provider's `link`, a path string or a `NavTarget` alike, so a
 * click keeps the document; the `NavTarget` form shown clears the selection and keeps the params the
 * page's store `retain`s (`services` is that store). A phone keeps the nearest ancestor and the
 * title, so the way up stays one tap away. The parent is the way up, never the
 * current page: it carries no `aria-current`, and a click hands focus to main. A page with no bar
 * shows its nav label, and a path no route matches shows `Not found`, in the crumb and in the document title.
 *
 * The document never scrolls: `Main` is the scrollport and the `<main>` landmark. The shell also
 * renders what a repeated block needs and a consumer cannot be trusted to remember: a skip link, a
 * polite announcer that says the new page's title after a pathname change, `document.title` as
 * `page · brand`, and the print rules. A `Page` inside claims the breadcrumb, the aside and
 * the title through the shell; `Page` itself renders the one `h1`.
 *
 * While a navigation waits past the router's `defaultPendingMs`, main is `aria-busy` and draws a
 * hairline bar; the rail, the crumb and the title keep naming the page on screen until the next
 * one arrives, then change together. A navigation that leaves focus on `<body>` hands it to main.
 * Two palette entries of one label name their section (`Go to Services · Fleet`).
 *
 * Needs TanStack Router; another router or none uses `./page` with its own frame.
 *
 * The palette is the app's `CommandPalette`, mounted once inside the shell; it lists every `nav`
 * item. While the shell is mounted `BasaltProvider` mounts no Spotlight, so `Mod+K` has one
 * listener. `search={{ onOpen }}` draws the rail's search row; point it at the palette's open state.
 *
 * @useWhen an app has more than one destination and wants one rail, header and tab bar from a single `defineNav`
 * @neverWhen the app is one screen or keeps its own frame (use Page, PageBar and Section inside your own main)
 *
 * @example
 * <AppShell nav={NAV} brand={{ name: 'Argo', logo: Mark }} storageKey="argo-sidebar" badges={{ jobs: { dot: true } }}>
 *   <Outlet />
 * </AppShell>
 */
export function AppShell<N extends DefinedNav>({
  nav,
  brand,
  badges,
  blocks = NO_BLOCKS,
  globalControls,
  globalActions = NO_ACTIONS,
  settings,
  account,
  search,
  workspace,
  favorites,
  storageKey = DEFAULT_STORAGE_KEY,
  compactHeader = 'show',
  chrome = 'web',
  frame = 'panel',
  children,
}: AppShellProps<N>): ReactElement {
  const router = useRouter()
  // Registration is idempotent and runs in render so the server render has it too.
  registerNav(router, nav)

  // The page on screen: the resolved location, so a slow loader keeps the rail, the breadcrumb and
  // the title on the page the reader still sees until the next one arrives. `location` leads
  // `resolvedLocation` only while a navigation is pending.
  const pathname = useRouterState({
    select: (s) => (s.resolvedLocation ?? s.location).pathname,
  })
  // `status` is a loader's `notFound()`; `_notFound` marks the route that answers a path nothing matched.
  const missing = useRouterState({
    select: (s) => s.matches.some((m) => m.status === 'notFound' || m._notFound === true),
  })
  // The route tree's ancestors that name themselves: every match below the root, as one string.
  const routeKey = useRouterState({
    select: (s) =>
      s.matches
        .slice(1)
        .flatMap((m) => {
          const title = titleOf(m.staticData)
          return title === undefined ? [] : [`${m.pathname}${ROUTE_SEP}${title}`]
        })
        .join(MATCH_SEP),
  })
  const pending = useNavigationPending(router.options.defaultPendingMs ?? 1000)
  const runtime = useMemo(
    () =>
      createNavRuntime({
        nav,
        resolve: (path) => resolveActive(nav, path),
        pathname,
      }),
    // The runtime is built once per declaration; later pathnames reach it through `setPathname`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [nav],
  )
  useIsomorphicLayoutEffect(() => runtime.setPathname(pathname), [runtime, pathname])
  const active = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)

  const [shellHost] = useState(createShellHost)
  const [overlaySlot, setOverlaySlot] = useState<HTMLElement | null>(null)
  const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null)
  const [dockWidth, setDockWidth] = useState(DOCK_WIDTH)
  const attachRoot = useChromeRoot(shellHost.attachRoot, chrome)
  const breadcrumb = useClaim(shellHost.regions.breadcrumb)
  const titleClaim = useClaim(shellHost.regions.title)
  const asideNode = useClaim(shellHost.regions.aside)

  const entries = useMemo(() => flattenNavEntries(nav), [nav])
  const activeLabel = entries.find((e) => e.item.id === active.activeId)?.item.label
  // A path no route matched (or a loader's `notFound()`) renders no page, so no page names it: it
  // is "Not found", not the nearest nav item.
  const fallbackLabel = missing ? SHELL_TEXT.notFound : activeLabel
  const pageTitle = typeof titleClaim === 'string' ? titleClaim : fallbackLabel
  useDocumentTitle(composeTitle(pageTitle, brand.name))
  const announcement = useRouteAnnouncement(pathname)
  useRouteFocus(pathname)

  const sizeClass = useSizeClass()
  // The phone nav: the section bar, unless the app opted into the tab bar (`data-phone-nav="tabs"`).
  const phoneNav = usePhoneNav()
  const rail = useRailState(storageKey, sizeClass)
  const railWidth = useRailWidthState(storageKey)
  const favoritesApi = useFavoritesApi(favorites, storageKey)
  const claim = readAsideClaim(asideNode)
  // A bound aside claims while closed too (the phone's header button needs it); beside main a
  // closed one is no region.
  const regionClaim = claim?.sheet?.open === false ? undefined : claim
  const model = useAsideModel(regionClaim, sizeClass, rail.state, railWidth.width)
  const dockOpen = useSyncExternalStore(
    shellHost.regions.dock.subscribe,
    () => shellHost.regions.dock.getSnapshot().count > 0,
    () => false,
  )
  const dockModel = useDockModel(
    dockOpen,
    sizeClass,
    rail.state,
    model.width,
    dockWidth,
    railWidth.width,
  )
  const dock: ShellDock = {
    slot: dockSlot,
    docked: dockModel.docks,
    claim: shellHost.claimDock,
    setWidth: setDockWidth,
  }
  useDocumentFrame()
  usePrintScheme()

  const titlebar = chrome === 'native-overlay'
  const crumbs = buildCrumbs({
    entries,
    activeId: active.activeId,
    pathname: decodePath(pathname),
    pathOf: (item) => navItemPath(item, pathname),
    routes: parseRoutes(routeKey).map((route) => ({
      ...route,
      pathname: decodePath(route.pathname),
    })),
    claim: readCrumbClaim(breadcrumb),
    fallbackLabel,
    compact: sizeClass === 'compact',
    missing,
  })

  const phoneProps = {
    runtime,
    badges,
    blocks,
    globalActions,
    settings,
    account,
    workspace,
  }
  const aside =
    claim !== undefined && sizeClass === 'compact' && !emptyRecord(claim) ? (
      <AsideSheet claim={claim} />
    ) : null

  const header = (
    <Header
      brand={brand}
      breadcrumb={<Crumbs trail={crumbs} />}
      globalControls={globalControls}
      globalActions={globalActions}
      asideTrigger={aside}
      sizeClass={sizeClass}
      workspace={workspace}
      chrome={chrome}
    />
  )

  return (
    <ChromeHost chrome={chrome} host={shellHost.host}>
      <RailControlProvider value={rail}>
        <RailWidthProvider value={railWidth}>
          <FavoritesContext value={favoritesApi}>
            <ShellOverlayContext value={overlaySlot}>
              <ShellDockContext value={dock}>
                <ShellGrid
                  rootRef={attachRoot}
                  rail={rail.state}
                  frame={frame}
                  titlebar={titlebar}
                  compactHeader={compactHeader}
                  asideWidth={model.width}
                  dockWidth={dockModel.width}
                  railOpenWidth={railWidth.width}
                  phoneNav={phoneNav}
                >
                  <SkipLink />
                  <RouteAnnouncer message={announcement} />
                  {!titlebar && <BrandZone brand={brand} workspace={workspace} />}
                  {header}
                  <RailMount
                    runtime={runtime}
                    brand={brand}
                    badges={badges}
                    blocks={blocks}
                    settings={settings}
                    account={account}
                    search={search}
                    workspace={workspace}
                  />
                  <ShellSurface titlebar={titlebar}>
                    <ShellMain pending={pending}>{children}</ShellMain>
                    <AsideRegion claim={regionClaim} model={model} regionRef={setOverlaySlot} />
                    <DockRegion model={dockModel} regionRef={setDockSlot} />
                  </ShellSurface>
                  <TabBarMount {...phoneProps} variant={phoneNav} brand={brand} search={search} />
                </ShellGrid>
              </ShellDockContext>
            </ShellOverlayContext>
          </FavoritesContext>
        </RailWidthProvider>
      </RailControlProvider>
    </ChromeHost>
  )
}
