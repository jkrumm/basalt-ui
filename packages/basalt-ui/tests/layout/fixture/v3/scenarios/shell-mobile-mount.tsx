/**
 * The shell-mobile scenario's browser half: `AppShell` under a memory router, its nav built from a
 * `FixtureSpec` (`sections`, `nav`, `icons`, `density`, `bodyHeight`). `shell-mobile.ts` loads it on
 * mount. The spec describes a nav SHAPE; the rendering is `AppShell`'s, unmodified.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Page } from '../../../../../src/page/page'
import { AppShell } from '../../../../../src/shell/app-shell'
import type { AppShellProps } from '../../../../../src/shell/contract'
import type { FixtureSpec, ItemSpec } from '../../spec'

const RESET = document.createElement('style')
RESET.textContent =
  '*,::before,::after{box-sizing:border-box}body{margin:0}table{border-collapse:collapse}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-shell-mobile]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['shellMobile'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

/** A hand-written glyph: the fixture ships no icon dependency, like a consumer of basalt. */
function Glyph({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  )
}

const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function toItem(spec: ItemSpec, icons: boolean): Record<string, unknown> {
  return {
    id: spec.key,
    label: spec.label,
    ...(spec.short !== undefined && { short: spec.short }),
    ...(icons && { icon: Glyph }),
    link: { to: `/${spec.key}` },
    ...(spec.mobile !== undefined && { mobile: spec.mobile }),
    ...(spec.disabled === true && { disabled: true }),
    ...(spec.children !== undefined && {
      children: spec.children.map((child) => toItem(child, icons)),
    }),
  }
}

function firstActive(items: readonly ItemSpec[]): string | undefined {
  for (const item of items) {
    if (item.active === true) return item.key
    const found = firstActive(item.children ?? [])
    if (found !== undefined) return found
  }
  return undefined
}

function activeKey(sections: FixtureSpec['sections']): string {
  for (const section of sections) {
    const found = firstActive(section.items)
    if (found !== undefined) return found
  }
  return 'home'
}

/** The 2.x knob −3..3 mapped onto v3's three density steps. */
function densityStep(level: number | undefined): 'dense' | 'normal' | 'comfortable' | undefined {
  if (level === undefined) return undefined
  if (level < 0) return 'dense'
  return level > 0 ? 'comfortable' : 'normal'
}

/** The 2.x oracle's scrollport handle, so the shared harness finds `shell-main` on both targets. */
function ScrollportHandle(): null {
  useEffect(() => {
    document.querySelector('[data-slot="shell-main"]')?.setAttribute('data-basalt-scrollport', '')
  }, [])
  return null
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  localStorage.clear()
  const step = densityStep(spec.density)
  if (step === undefined) delete document.documentElement.dataset['density']
  else document.documentElement.dataset['density'] = step

  const icons = spec.icons ?? true
  const nav = {
    sections: spec.sections.map((section) => ({
      id: slug(section.label),
      label: section.label,
      ...(icons && section.tab === true && { icon: Glyph }),
      ...(section.tab === true && { mobile: { tab: true } }),
      items: section.items.map((item) => toItem(item, icons)),
    })),
    mobile: { ...spec.nav },
  } as unknown as AppShellProps['nav']

  const badges: Record<string, { count: number }> = {}
  const visit = (items: readonly ItemSpec[]): void => {
    for (const item of items) {
      if (item.count !== undefined) badges[item.key] = { count: item.count }
      visit(item.children ?? [])
    }
  }
  for (const section of spec.sections) visit(section.items)

  const rootRoute = createRootRoute({
    component: () => (
      <AppShell nav={nav} brand={{ name: 'Basalt' }} badges={badges}>
        <ScrollportHandle />
        <Outlet />
      </AppShell>
    ),
  })
  const body = (): ReactElement => (
    <Page area="mobile">
      <h1 className="sr-only">Overview</h1>
      <div style={{ height: spec.bodyHeight ?? 0 }} />
      <div data-testid="content-end">end of content</div>
    </Page>
  )
  const splat = createRoute({ getParentRoute: () => rootRoute, path: '$', component: body })
  const index = createRoute({ getParentRoute: () => rootRoute, path: '/', component: body })
  const router = createRouter({
    routeTree: rootRoute.addChildren([index, splat]),
    history: createMemoryHistory({ initialEntries: [`/${activeKey(spec.sections)}`] }),
  })
  router.subscribe('onResolved', ({ toLocation }) => {
    window.basaltNavigations.push(toLocation.pathname)
  })
  root = createRoot(container)
  root.render(<RouterProvider router={router} />)
}
