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
      {
        key: 'content-sanitize',
        label: 'Content sanitize',
        icon: <IconActivity />,
        href: '/content-sanitize',
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
      {
        key: 'agent-chat-subpath',
        label: 'Agent chat (subpath)',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-chat-subpath',
      },
      {
        key: 'agent-wedge',
        label: 'Agent wedge recovery',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-wedge',
      },
      {
        key: 'agent-foreign-parts',
        label: 'Agent foreign parts',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-foreign-parts',
      },
      {
        key: 'agent-tool-lifecycle',
        label: 'Agent tool lifecycle',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-tool-lifecycle',
      },
      {
        key: 'agent-render-budget',
        label: 'Agent render budget',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-render-budget',
      },
      {
        key: 'agent-stop-mid-stream',
        label: 'Agent stop mid-stream',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-stop-mid-stream',
      },
      {
        key: 'agent-fence-registry',
        label: 'Agent fence registry',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-fence-registry',
      },
      {
        key: 'agent-composer',
        label: 'Agent composer',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-composer',
      },
      {
        key: 'threads-adapter',
        label: 'Threads adapter',
        mobile: true,
        icon: <IconActivity />,
        href: '/threads-adapter',
      },
      {
        key: 'agent-thread-feed-inline',
        label: 'Agent thread feed (inline)',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-thread-feed-inline',
      },
      {
        key: 'agent-transcript-virtualize',
        label: 'Agent transcript virtualize',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-transcript-virtualize',
      },
      {
        key: 'agent-inline-feed-virtualized',
        label: 'Agent inline feed (virtualized row)',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-inline-feed-virtualized',
      },
      {
        key: 'agent-anchor-to-end',
        label: 'Agent anchor to end (streaming)',
        mobile: true,
        icon: <IconActivity />,
        href: '/agent-anchor-to-end',
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
