import { useRouter, useRouterState } from '@tanstack/react-router'
import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { PageHostContext } from '../page/page'
import { useSizeClass } from '../page/use-size-class'
import { registerNav } from '../router/nav/registry'
import { flattenNavEntries, resolveActive } from '../router/nav/resolve-active'
import type { AnyNavConfig } from '../router/nav/types'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { createShellHost, useClaim } from './app-shell-host'
import { ChromeProvider, useChromeRoot } from './chrome'
import type { AppShellProps } from './contract'
import { createNavRuntime } from './core/nav-runtime'
import type { CoreNavConfig } from './core/types'
import {
  RouteAnnouncer,
  SkipLink,
  composeTitle,
  useDocumentTitle,
  useRouteAnnouncement,
} from './parts/a11y'
import {
  AsideRegion,
  DEFAULT_STORAGE_KEY,
  RailControlProvider,
  ShellGrid,
  ShellMain,
  readAsideClaim,
  useAsideModel,
  useDocumentFrame,
  useRailState,
} from './parts/grid'
import type { AsideClaim } from './parts/grid'
import { Header } from './parts/header'
import { RailMount, TabBarMount } from './parts/mounts'
import { usePrintScheme } from './parts/print'

const NO_BLOCKS: NonNullable<AppShellProps['blocks']> = []
const NO_ACTIONS: NonNullable<AppShellProps['globalActions']> = []

/** On a compact screen the claimed aside is a sheet, opened from the header. */
function AsideSheet({ claim }: { claim: AsideClaim }): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="secondary" size="sm" />}>{claim.title}</SheetTrigger>
      <SheetContent title={claim.title}>{claim.body}</SheetContent>
    </Sheet>
  )
}

/**
 * The application frame: a header, a rail, the one scrollport, an aside region and, on a phone, a
 * tab bar, all projections of one `nav` declaration. It owns the markup (a CSS grid in
 * `@layer basalt`), so there is nothing to override and nothing to fight.
 *
 * The document never scrolls: `Main` is the scrollport and the `<main>` landmark. The shell also
 * renders what a repeated block needs and a consumer cannot be trusted to remember: a skip link, a
 * polite announcer that says the new page's title after a pathname change, `document.title` as
 * `page · brand`, and the print rules. A `Page` inside claims the breadcrumb, the header actions,
 * the aside and the title through the shell; `Page` itself renders the one `h1`.
 *
 * Needs TanStack Router; another router or none uses `./page` with its own frame.
 *
 * @useWhen an app has more than one destination and wants one rail, header and tab bar from a single `defineNav`
 * @neverWhen the app is one screen or keeps its own frame (use Page, PageBar and Section inside your own main)
 *
 * @example
 * <AppShell nav={NAV} brand={{ name: 'Argo', logo: Mark }} storageKey="argo-sidebar" badges={{ jobs: { dot: true } }}>
 *   <Outlet />
 * </AppShell>
 */
export function AppShell<Id extends string = string>({
  nav,
  brand,
  badges,
  blocks = NO_BLOCKS,
  globalControls,
  globalActions = NO_ACTIONS,
  settings,
  account,
  search,
  storageKey = DEFAULT_STORAGE_KEY,
  compactHeader = 'show',
  chrome = 'web',
  children,
}: AppShellProps<Id>): ReactElement {
  const router = useRouter()
  const declared = nav as unknown as AnyNavConfig
  // Registration is idempotent and runs in render so the server render has it too.
  registerNav(router, declared)

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const runtime = useMemo(
    () =>
      createNavRuntime({
        nav: nav as unknown as CoreNavConfig,
        resolve: (path) => resolveActive(declared, path),
        pathname,
      }),
    // The runtime is built once per declaration; later pathnames reach it through `setPathname`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [nav],
  )
  useIsomorphicLayoutEffect(() => runtime.setPathname(pathname), [runtime, pathname])
  const active = useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState)

  const [shellHost] = useState(createShellHost)
  const attachRoot = useChromeRoot(shellHost.attachRoot, chrome)
  const breadcrumb = useClaim(shellHost.regions.breadcrumb)
  const actions = useClaim(shellHost.regions.actions)
  const titleClaim = useClaim(shellHost.regions.title)
  const asideNode = useClaim(shellHost.regions.aside)

  const activeLabel = useMemo(
    () => flattenNavEntries(declared).find((e) => e.item.id === active.activeId)?.item.label,
    [declared, active.activeId],
  )
  const pageTitle = typeof titleClaim === 'string' ? titleClaim : activeLabel
  useDocumentTitle(composeTitle(pageTitle, brand.name))
  const announcement = useRouteAnnouncement(pathname)

  const sizeClass = useSizeClass()
  const rail = useRailState(storageKey, sizeClass)
  const claim = readAsideClaim(asideNode)
  const model = useAsideModel(claim, sizeClass, rail.state)
  useDocumentFrame()
  usePrintScheme()

  const trail: ReactNode =
    breadcrumb ??
    (activeLabel === undefined ? null : <span data-slot="page-breadcrumb-leaf">{activeLabel}</span>)

  return (
    <PageHostContext value={shellHost.host}>
      <RailControlProvider value={rail}>
        <ShellGrid
          rootRef={attachRoot}
          rail={rail.state}
          compactHeader={compactHeader}
          asideWidth={model.width}
        >
          <SkipLink />
          <RouteAnnouncer message={announcement} />
          <Header
            brand={brand}
            breadcrumb={trail}
            globalControls={globalControls}
            actions={actions}
            globalActions={globalActions}
            asideTrigger={
              claim !== undefined && sizeClass === 'compact' ? <AsideSheet claim={claim} /> : null
            }
            sizeClass={sizeClass}
            chrome={chrome}
          />
          <RailMount
            runtime={runtime}
            brand={brand}
            badges={badges as AppShellProps['badges']}
            blocks={blocks}
            settings={settings}
            account={account}
            search={search}
          />
          <ShellMain>
            <ChromeProvider chrome={chrome}>{children}</ChromeProvider>
          </ShellMain>
          <AsideRegion claim={claim} model={model} />
          <TabBarMount
            runtime={runtime}
            badges={badges as AppShellProps['badges']}
            blocks={blocks}
            globalActions={globalActions}
            settings={settings}
            account={account}
          />
        </ShellGrid>
      </RailControlProvider>
    </PageHostContext>
  )
}
