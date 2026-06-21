/**
 * Playground app — a full exercise of the basalt-ui surface at runtime.
 *
 * Demonstrates the router-agnostic shell seam: there is NO router. Active state is plain `useState`,
 * each `SidebarItem` carries `active` + `onClick` (the consumer's job), and `href` is set purely so
 * the rail renders real anchors. The Charts section additionally passes a `renderNavLink` to prove
 * the consumer-link seam (here a styled `<a>` standing in for a router `<Link>`).
 *
 * Exercises: BasaltShell, SidebarSection / SidebarItem (collapsible section, mobile flags, disabled
 * "coming soon" item, badges), NavCountBadge, renderNavLink, globalActions, settingsMenuItems,
 * sidebarFooterExtra, AppBreadcrumbs (derived from the active item), useOnlineStatus (badge).
 */
import {
  ActionIcon,
  Badge,
  NavLink as MantineNavLink,
  Text,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import { BasaltShell, NavCountBadge, useOnlineStatus } from 'basalt-ui'
import type { NavLinkRenderer, SidebarSection } from 'basalt-ui'
import { useCallback, useMemo, useState } from 'react'
import { AgentDemoPage } from './demo/AgentDemoPage'
import { ChartsPage } from './demo/ChartsPage'
import { CommandsDemoPage } from './demo/CommandsDemoPage'
import { ComponentsPage } from './demo/ComponentsPage'
import { DashboardPage } from './demo/DashboardPage'
import { DataDemoPage } from './demo/DataDemoPage'
import { FormsDemoPage } from './demo/FormsDemoPage'
import { NotificationsDemoPage } from './demo/NotificationsDemoPage'
import { QueryDemoPage } from './demo/QueryDemoPage'
import { RouterDemoPage } from './demo/RouterDemoPage'
import { SettingsPage } from './demo/SettingsPage'
import {
  IconActivity,
  IconChart,
  IconComponents,
  IconDashboard,
  IconPalette,
  IconSettings,
} from './demo/icons'
import { NotificationBell } from 'basalt-ui/notifications'

type PageKey =
  | 'dashboard'
  | 'charts'
  | 'components'
  | 'activity'
  | 'settings'
  | 'query'
  | 'router'
  | 'forms'
  | 'notifications'
  | 'commands'
  | 'data'
  | 'agent'

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

/**
 * A consumer link renderer standing in for a router `<Link>` — proves the `renderNavLink` seam: the
 * shell hands each item + a precomputed `active` flag, and the consumer owns the actual element.
 * Hoisted (captures nothing) so it isn't recreated per render.
 */
const renderNavLink: NavLinkRenderer = (item, { active }) => (
  <MantineNavLink
    component="a"
    href={item.href ?? '#'}
    label={item.label}
    leftSection={item.icon}
    rightSection={item.badge}
    active={active}
    {...(item.onClick !== undefined && { onClick: item.onClick })}
  />
)

/** Sun/moon glyph for the top-bar scheme toggle. */
function SchemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dark ? (
        <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
      ) : (
        <>
          <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
          <path d="M3 12h1M20 12h1M12 3v1M12 20v1M5.6 5.6l.7 .7M17.7 17.7l.7 .7M5.6 18.4l.7 -.7M17.7 6.3l.7 -.7" />
        </>
      )}
    </svg>
  )
}

export function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const dark = (colorScheme === 'auto' ? 'dark' : colorScheme) === 'dark'
  const online = useOnlineStatus()

  const go = useCallback(
    (key: PageKey) => (e: { preventDefault: () => void }) => {
      e.preventDefault()
      setPage(key)
    },
    [],
  )

  const sections = useMemo<SidebarSection[]>(
    () => [
      {
        label: 'Overview',
        icon: <IconDashboard />,
        items: [
          {
            key: 'dashboard',
            label: 'Dashboard',
            short: 'Home',
            mobile: true,
            icon: <IconDashboard />,
            href: '/dashboard',
            active: page === 'dashboard',
            onClick: go('dashboard'),
            badge: <NavCountBadge count={3} />,
          },
          {
            key: 'activity',
            label: 'Activity',
            mobile: true,
            icon: <IconActivity />,
            href: '/activity',
            active: page === 'activity',
            onClick: go('activity'),
          },
        ],
      },
      {
        label: 'Insights',
        icon: <IconChart />,
        collapsible: true,
        // This section uses the renderNavLink seam (the others fall back to the plain <a> path).
        items: [
          {
            key: 'charts',
            label: 'Charts',
            mobile: true,
            icon: <IconChart />,
            href: '/charts',
            active: page === 'charts',
            onClick: go('charts'),
          },
          {
            key: 'components',
            label: 'Components',
            mobile: true,
            icon: <IconComponents />,
            href: '/components',
            active: page === 'components',
            onClick: go('components'),
          },
          {
            key: 'reports',
            label: 'Reports',
            icon: <IconActivity />,
            disabled: true, // renders the "Coming soon" tooltip path
          },
        ],
      },
      {
        label: 'Data',
        icon: <IconActivity />,
        items: [
          {
            key: 'query',
            label: 'Query',
            mobile: true,
            icon: <IconActivity />,
            href: '/query',
            active: page === 'query',
            onClick: go('query'),
          },
          {
            key: 'router',
            label: 'Router',
            mobile: true,
            icon: <IconActivity />,
            href: '/router',
            active: page === 'router',
            onClick: go('router'),
          },
          {
            key: 'forms',
            label: 'Forms',
            mobile: true,
            icon: <IconComponents />,
            href: '/forms',
            active: page === 'forms',
            onClick: go('forms'),
          },
          {
            key: 'notifications',
            label: 'Notifications',
            mobile: true,
            icon: <IconActivity />,
            href: '/notifications',
            active: page === 'notifications',
            onClick: go('notifications'),
          },
          {
            key: 'commands',
            label: 'Commands',
            mobile: true,
            icon: <IconComponents />,
            href: '/commands',
            active: page === 'commands',
            onClick: go('commands'),
          },
          {
            key: 'data',
            label: 'Data',
            mobile: true,
            icon: <IconActivity />,
            href: '/data',
            active: page === 'data',
            onClick: go('data'),
          },
          {
            key: 'agent',
            label: 'Agent',
            mobile: true,
            icon: <IconActivity />,
            href: '/agent',
            active: page === 'agent',
            onClick: go('agent'),
          },
        ],
      },
      {
        label: 'System',
        icon: <IconSettings />,
        items: [
          {
            key: 'settings',
            label: 'Settings',
            mobile: true,
            icon: <IconSettings />,
            href: '/settings',
            active: page === 'settings',
            onClick: go('settings'),
          },
        ],
      },
    ],
    [page, go],
  )

  return (
    <BasaltShell
      brand={{ name: 'Basalt', version: __APP_VERSION__ }}
      sections={sections}
      renderNavLink={renderNavLink}
      globalActions={
        <>
          {/* useOnlineStatus — renders an online/offline badge in the header */}
          <Tooltip label={online ? 'Connected' : 'Offline'} withArrow>
            <Badge
              size="sm"
              variant="dot"
              color={online ? 'teal' : 'red'}
              style={{ cursor: 'default' }}
            >
              <Text size="xs">{online ? 'Online' : 'Offline'}</Text>
            </Badge>
          </Tooltip>
          <NotificationBell />
          <Tooltip label={dark ? 'Switch to light' : 'Switch to dark'} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={toggleColorScheme}
              aria-label="Toggle color scheme"
            >
              <SchemeIcon dark={dark} />
            </ActionIcon>
          </Tooltip>
        </>
      }
      settingsMenuItems={[
        { key: 'theme', label: 'Theme lab', icon: <IconPalette />, onClick: go('settings') },
      ]}
      sidebarFooterExtra={
        <Text size="xs" c="dimmed" ta="center" py={4}>
          basalt-ui playground
        </Text>
      }
    >
      {page === 'dashboard' && <DashboardPage />}
      {page === 'charts' && <ChartsPage />}
      {page === 'components' && <ComponentsPage />}
      {page === 'settings' && <SettingsPage />}
      {page === 'activity' && <DashboardPage />}
      {page === 'query' && <QueryDemoPage />}
      {page === 'router' && <RouterDemoPage />}
      {page === 'forms' && <FormsDemoPage />}
      {page === 'notifications' && <NotificationsDemoPage />}
      {page === 'commands' && <CommandsDemoPage />}
      {page === 'data' && <DataDemoPage />}
      {page === 'agent' && <AgentDemoPage />}
    </BasaltShell>
  )
}
