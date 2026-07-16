import type { SidebarItem, SidebarSection } from 'basalt-ui'
import { NavCountBadge } from 'basalt-ui'
import {
  IconActivity,
  IconChart,
  IconComponents,
  IconDashboard,
  IconSettings,
  IconSparkle,
  IconUser,
} from './icons'

/**
 * The playground's route/navigation model — the single source of truth for both the sidebar
 * sections (with `active` injected per render, see `withActive`) and the Spotlight page actions
 * (`toRouteActions(NAV_MODEL, ...)` in main.tsx).
 */
export const NAV_MODEL: SidebarSection[] = [
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
        badge: <NavCountBadge count={4} />,
        // Child items render text-only against the left rail (no icon) — SidebarItem.icon is
        // a required ReactNode slot, so `undefined` opts out of rendering a left section
        // (see AppSidebar's `leftSection={child.icon}`) rather than omitting the key.
        children: [
          {
            key: 'dashboard-sessions',
            label: 'Sessions',
            icon: undefined,
            href: '/dashboard/sessions',
          },
          {
            key: 'dashboard-traffic',
            label: 'Traffic',
            icon: undefined,
            href: '/dashboard/traffic',
          },
          {
            key: 'dashboard-revenue',
            label: 'Revenue',
            icon: undefined,
            href: '/dashboard/revenue',
          },
        ],
      },
      {
        key: 'activity',
        label: 'Activity',
        mobile: true,
        icon: <IconActivity />,
        href: '/activity',
      },
    ],
  },
  {
    label: 'Charts & components',
    icon: <IconChart />,
    collapsible: true,
    items: [
      {
        key: 'charts',
        label: 'Charts',
        mobile: true,
        icon: <IconChart />,
        href: '/charts',
      },
      {
        key: 'components',
        label: 'Components',
        mobile: true,
        icon: <IconComponents />,
        href: '/components',
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
    label: 'Batteries',
    icon: <IconActivity />,
    items: [
      {
        key: 'query',
        label: 'Query',
        mobile: true,
        icon: <IconActivity />,
        href: '/query',
      },
      {
        key: 'router',
        label: 'Router',
        mobile: true,
        icon: <IconActivity />,
        href: '/router',
      },
      {
        key: 'forms',
        label: 'Forms',
        mobile: true,
        icon: <IconComponents />,
        href: '/forms',
      },
      {
        key: 'notifications',
        label: 'Notifications',
        mobile: true,
        icon: <IconActivity />,
        href: '/notifications',
      },
      {
        key: 'commands',
        label: 'Commands',
        mobile: true,
        icon: <IconComponents />,
        href: '/commands',
      },
      {
        key: 'data',
        label: 'Data',
        mobile: true,
        icon: <IconActivity />,
        href: '/data',
      },
    ],
  },
  {
    label: 'Content',
    icon: <IconActivity />,
    items: [
      {
        key: 'content',
        label: 'Content',
        mobile: true,
        icon: <IconActivity />,
        href: '/content',
      },
      {
        key: 'content-overview',
        label: 'Content overview',
        icon: <IconActivity />,
        href: '/content-overview',
      },
    ],
  },
  {
    label: 'Agent',
    icon: <IconSparkle />,
    items: [
      {
        key: 'agent',
        label: 'Agent',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent',
      },
      {
        key: 'agent-ai-sdk',
        label: 'Agent (AI SDK)',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-ai-sdk',
      },
      {
        key: 'threads',
        label: 'Threads',
        mobile: true,
        icon: <IconActivity />,
        href: '/threads',
      },
    ],
  },
  {
    label: 'System',
    icon: <IconSettings />,
    items: [
      {
        key: 'connectivity',
        label: 'Connectivity',
        mobile: true,
        icon: <IconActivity />,
        href: '/connectivity',
      },
      {
        key: 'settings',
        label: 'Settings',
        mobile: true,
        icon: <IconSettings />,
        href: '/settings',
      },
      {
        key: 'user',
        label: 'User',
        icon: <IconUser />,
        href: '/user',
        mobile: true,
      },
    ],
  },
]

/** Inject the reactive `active` flag from the router onto every href-bearing item (and child). */
export function withActive(
  sections: SidebarSection[],
  isActive: (href: string) => boolean,
): SidebarSection[] {
  const mapItem = (item: SidebarItem): SidebarItem => ({
    ...item,
    ...(item.href !== undefined && { active: isActive(item.href) }),
    ...(item.children !== undefined && { children: item.children.map(mapItem) }),
  })
  return sections.map((section) => ({ ...section, items: section.items.map(mapItem) }))
}
