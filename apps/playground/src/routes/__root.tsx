/**
 * Root route — the persistent app shell for the playground.
 *
 * This is the mature counterpart to the old `useState` page-switcher: the playground is now a real
 * TanStack Router app on browser history, so the URL is the single source of truth for "where am
 * I". The shell stays exactly as router-agnostic as it ships — we drive it through the documented
 * seams:
 *   - `active` comes from the shipped `useBasaltNav().isActive(href)` adapter (reactive to the URL),
 *   - `renderNavLink` renders a real TanStack `<Link>` so clicks update the URL + enable
 *     intent-preloading + back/forward,
 *   - the shell's own breadcrumb (`findActiveCrumb`) follows `active`, so it tracks the route for
 *     free.
 * Page content renders through `<Outlet />`; each destination is a file route under `routes/`.
 */
import {
  ActionIcon,
  Badge,
  NavLink as MantineNavLink,
  Text,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core'
import { Link, Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { BasaltShell, NavCountBadge, useOnlineStatus } from 'basalt-ui'
import type { NavLinkRenderer, SidebarSection } from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { NotificationBell } from 'basalt-ui/notifications'
import { useMemo } from 'react'
import {
  IconActivity,
  IconChart,
  IconComponents,
  IconDashboard,
  IconPalette,
  IconSettings,
} from '../demo/icons'

// Build-time constant injected by `basaltViteConfig`'s `define`. The `__name__` form is the
// preset's own convention, so the dangle is expected here.
// oxlint-disable-next-line no-underscore-dangle
declare const __APP_VERSION__: string

/**
 * A consumer link renderer wiring the shell's router seam to a real TanStack `<Link>`. Hoisted
 * (captures nothing) so it isn't recreated per render.
 *
 * `item.href` is a plain `string` by the shell's router-agnostic contract, while TanStack's typed
 * `<Link to>` wants a registered route literal. Casting at this single seam boundary is correct:
 * the hrefs ARE real routes, and keeping the shell string-typed is what makes it router-agnostic.
 */
const renderNavLink: NavLinkRenderer = (item, { active }) => (
  <MantineNavLink
    component={Link}
    to={(item.href ?? '/') as never}
    label={item.label}
    leftSection={item.icon}
    rightSection={item.badge}
    active={active}
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

function RootLayout() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const dark = (colorScheme === 'auto' ? 'dark' : colorScheme) === 'dark'
  const online = useOnlineStatus()
  const { isActive } = useBasaltNav()
  const navigate = useNavigate()

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
            active: isActive('/dashboard'),
            badge: <NavCountBadge count={3} />,
          },
          {
            key: 'activity',
            label: 'Activity',
            mobile: true,
            icon: <IconActivity />,
            href: '/activity',
            active: isActive('/activity'),
          },
        ],
      },
      {
        label: 'Insights',
        icon: <IconChart />,
        collapsible: true,
        items: [
          {
            key: 'charts',
            label: 'Charts',
            mobile: true,
            icon: <IconChart />,
            href: '/charts',
            active: isActive('/charts'),
          },
          {
            key: 'components',
            label: 'Components',
            mobile: true,
            icon: <IconComponents />,
            href: '/components',
            active: isActive('/components'),
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
            active: isActive('/query'),
          },
          {
            key: 'router',
            label: 'Router',
            mobile: true,
            icon: <IconActivity />,
            href: '/router',
            active: isActive('/router'),
          },
          {
            key: 'forms',
            label: 'Forms',
            mobile: true,
            icon: <IconComponents />,
            href: '/forms',
            active: isActive('/forms'),
          },
          {
            key: 'notifications',
            label: 'Notifications',
            mobile: true,
            icon: <IconActivity />,
            href: '/notifications',
            active: isActive('/notifications'),
          },
          {
            key: 'commands',
            label: 'Commands',
            mobile: true,
            icon: <IconComponents />,
            href: '/commands',
            active: isActive('/commands'),
          },
          {
            key: 'data',
            label: 'Data',
            mobile: true,
            icon: <IconActivity />,
            href: '/data',
            active: isActive('/data'),
          },
          {
            key: 'agent',
            label: 'Agent',
            mobile: true,
            icon: <IconActivity />,
            href: '/agent',
            active: isActive('/agent'),
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
            active: isActive('/settings'),
          },
        ],
      },
    ],
    [isActive],
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
        {
          key: 'theme',
          label: 'Theme lab',
          icon: <IconPalette />,
          onClick: () => navigate({ to: '/settings' }),
        },
      ]}
      sidebarFooterExtra={
        <Text size="xs" c="dimmed" ta="center" py={4}>
          basalt-ui playground
        </Text>
      }
    >
      <Outlet />
    </BasaltShell>
  )
}

export const Route = createRootRoute({
  staticData: { title: 'Home' },
  component: RootLayout,
})
