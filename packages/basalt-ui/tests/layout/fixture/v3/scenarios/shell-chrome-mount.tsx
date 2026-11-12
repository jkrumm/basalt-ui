/**
 * The shell-chrome scenario's browser half: `AppShell` under a memory router, built from the 2.x
 * nav-shape spec. The spec describes a NAV SHAPE; the rendering is the v3 shell's, unmodified.
 * `shell-chrome.ts` loads it on mount.
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
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { ControlsSlot, IconComponent } from '../../../../../src/core/ports'
import { Page } from '../../../../../src/page/page'
import { PageAside } from '../../../../../src/page/page-aside'
import { PageBar } from '../../../../../src/page/page-bar'
import { Section } from '../../../../../src/page/section'
import { AppShell } from '../../../../../src/shell/app-shell'
import type {
  Account,
  AppShellProps,
  GlobalAction,
  NavBadges,
  NavConfig,
  NavItem,
  SettingsConfig,
} from '../../../../../src/shell/contract'
import type { FixtureSpec, ItemSpec, SectionSpec } from '../../spec'
import type { ShellChromeSpec } from './shell-chrome'

const RESET = document.createElement('style')
RESET.textContent = '*,::before,::after{box-sizing:border-box}body{margin:0}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-shell-chrome]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['shellChrome'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

const Glyph: IconComponent = ({ className }) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const slug = (label: string, index: number): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `section-${index}`

function toItem(item: ItemSpec, icons: boolean): NavItem {
  return {
    id: item.key,
    label: item.label,
    ...(item.short !== undefined && { short: item.short }),
    ...(icons && { icon: Glyph }),
    link: { to: `/${item.key}` },
    mobile: item.mobile ?? 'more',
    ...(item.children !== undefined && {
      children: item.children.map((child) => ({
        id: child.key,
        label: child.label,
        link: { to: `/${child.key}` },
      })),
    }),
  }
}

function toSection(section: SectionSpec, index: number, icons: boolean): NavConfig['sections'][0] {
  return {
    id: slug(section.label, index),
    label: section.label,
    items: section.items.map((item) => toItem(item, icons)),
    // The core reads these two off the declaration; the frozen `NavSection` type omits them.
    ...(section.collapsible === true && { collapsible: true }),
    ...(section.defaultCollapsed === true && { defaultCollapsed: true }),
  } as NavConfig['sections'][0]
}

function flatItems(sections: readonly SectionSpec[]): ItemSpec[] {
  return sections.flatMap((section) => section.items.flatMap((i) => [i, ...(i.children ?? [])]))
}

const noop = (): void => {}

const ACCOUNT: Account = {
  status: 'signed-in',
  name: 'Ada Lovelace',
  detail: 'ada@example.com',
  rows: [{ label: 'Manage account', onClick: noop }],
  onSignOut: noop,
}

function globalActions(count: number): GlobalAction[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: 'button' as const,
    id: `global-${i}`,
    label: `Action ${i + 1}`,
    icon: Glyph,
    onClick: noop,
    // A consumer's cluster: the first action never yields, the rest yield by tier and leave the
    // phone bar for the tab bar's More.
    priority: Math.min(i + 1, 3),
    ...(i > 0 && { mobile: 'more' as const }),
  }))
}

/**
 * Spike S6's cluster, in declaration order: one status `custom` (3 badges, long text at the expanded
 * size class and short below), job progress at priority 2 and two quick actions at priority 3.
 */
function clusterActions(): GlobalAction[] {
  return [
    {
      kind: 'custom',
      id: 'status',
      label: 'Status',
      render: ({ sizeClass }) => {
        const long = sizeClass === 'expanded'
        const badges = long
          ? ['Card · 40 new', 'Queue · 3 jobs', 'Disk · 82% used']
          : ['Card 40', 'Queue 3', 'Disk 82%']
        return (
          <span data-testid="cluster-status" className="flex items-center gap-1.5 text-xs">
            {badges.map((badge) => (
              <span key={badge} className="rounded-full bg-inset px-2.5 py-0.5 whitespace-nowrap">
                {badge}
              </span>
            ))}
          </span>
        )
      },
    },
    {
      kind: 'custom',
      id: 'progress',
      label: 'Export progress',
      priority: 2,
      render: () => (
        <span className="flex items-center gap-2 text-xs whitespace-nowrap">
          Export 412 / 1,800
          <span className="block h-1.5 w-24 rounded-full bg-inset" />
        </span>
      ),
    },
    { kind: 'button', id: 'import', label: 'Import', icon: Glyph, priority: 3, onClick: noop },
    { kind: 'button', id: 'tag', label: 'Tag selection', icon: Glyph, priority: 3, onClick: noop },
  ]
}

/** Production-length labels: a loaded bar, so the row has to fit what a real page puts in it. */
const BAR_LABELS = ['New experiment', 'Export report', 'Share dashboard', 'Schedule digest']

function controls(count: number): ControlsSlot {
  return {
    kind: 'controls-slot',
    count,
    render: () => (
      <>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" className="h-ctl rounded-ctrl bg-secondary px-3 text-sm">
            Filter {i + 1}
          </button>
        ))}
      </>
    ),
  }
}

function Body({ spec }: { spec: FixtureSpec }): ReactElement {
  const { bar, aside } = spec
  const actions =
    bar?.actions === undefined
      ? undefined
      : Array.from({ length: Math.min(bar.actions, 5) }, (_, i) => ({
          id: `action-${i}`,
          label: BAR_LABELS[i % BAR_LABELS.length] ?? `Action ${i + 1}`,
          ...(bar.actionIcons === true && { icon: Glyph }),
          ...(i === 0 && { primary: true }),
          onClick: noop,
        }))
  return (
    <Page area="chrome">
      {bar !== undefined && (
        <PageBar
          {...(bar.pills !== undefined && bar.pills > 0 && { controls: controls(bar.pills) })}
          {...(actions !== undefined && {
            actions: actions as unknown as NonNullable<
              React.ComponentProps<typeof PageBar>['actions']
            >,
          })}
        />
      )}
      <Section title="Overview">
        <div style={{ height: spec.bodyHeight ?? 200 }} data-testid="content-end" />
      </Section>
      {aside !== undefined && <PageAside title={aside.title} dock="always" />}
    </Page>
  )
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  localStorage.clear()
  const options = spec as ShellChromeSpec
  if (options.rail !== undefined) {
    localStorage.setItem(
      'basalt:basalt-sidebar-collapsed',
      JSON.stringify({ v: 1, value: options.rail === 'collapsed' }),
    )
  }

  const icons = spec.icons !== false
  const nav: NavConfig = { sections: spec.sections.map((s, i) => toSection(s, i, icons)) }
  const items = flatItems(spec.sections)
  const badges: NavBadges = Object.fromEntries(
    items.flatMap((item) => (item.count === undefined ? [] : [[item.key, { count: item.count }]])),
  )
  const active = items.find((item) => item.active === true) ?? items[0]
  const settings: SettingsConfig | undefined =
    spec.sidebar?.settings === undefined
      ? undefined
      : {
          mode: 'menu',
          items: Array.from({ length: spec.sidebar.settings }, (_, i) => ({
            id: `setting-${i}`,
            label: `Setting ${i + 1}`,
            onClick: noop,
          })),
        }
  const props: AppShellProps = {
    nav,
    brand: { name: 'Basalt' },
    badges,
    ...(spec.globals !== undefined && { globalActions: globalActions(spec.globals) }),
    ...(options.cluster === true && { globalActions: clusterActions() }),
    ...(settings !== undefined && { settings }),
    ...(spec.sidebar?.account === true && { account: ACCOUNT }),
  }

  const rootRoute = createRootRoute({
    component: () => (
      <AppShell {...props}>
        <Outlet />
      </AppShell>
    ),
  })
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => <Body spec={spec} />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: [`/${active?.key ?? ''}`] }),
  })
  root = createRoot(container)
  root.render(<RouterProvider router={router} />)
}
