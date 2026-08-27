/**
 * The playground's navigation — ONE typed definition, and the only place a destination is stated.
 *
 * `defineNav` wraps TanStack's own `linkOptions`, so every `to`/`search` below rides the router's
 * validator against the generated route tree: a typo in a path, a missing required search object,
 * an unknown metadata key or a `mobile.tabs` id that names nothing are all compile errors. There
 * is no `active` plumbing here — `useNav(NAV)` in `routes/__root.tsx` resolves it from the router
 * and builds each destination's `<Link>` anchor, which is what deleted the old `withActive` walk
 * and the two render callbacks.
 *
 * Consumed by `routes/__root.tsx` (sidebar + mobile bar) and `demo/palette-actions.tsx` (Spotlight
 * pages). It imports NOTHING from `routes/` or `routeTree.gen`, so either side can read it without
 * a cycle.
 *
 * ## What the mobile bar does with this
 *
 * `SidebarItem.mobile` is the placement field and the ONLY mobile configuration here. The bar this
 * definition produces shows all three slot surfaces side by side, which is the point of the
 * playground — it is the surface where the design gets looked at:
 *
 *   Home · Activity · Charts · Batteries · More
 *   └──── three `link` slots ────┘ └ sheet ┘ └ sheet ┘
 *
 * - `mobile: 'tab'` on `dashboard` / `activity` / `charts` makes each a **link** slot: one tap,
 *   one navigation, no overlay to dismiss.
 * - `mobile: { tab: true }` on the **Batteries** group makes the whole section one slot. It holds
 *   eight destinations — past `menuMax` (6), the ceiling for a menu that pops out of the bar
 *   without ever rendering below the fold — so it resolves to a **sheet**, same surface as More.
 *   Dropping to six or fewer (with no config change) would make it a menu instead.
 * - Everything else (Components, Content, the sixteen Agent pages, System, plus the dashboard
 *   sub-pages) falls into **More**, which is far past six rows and so resolves to a **sheet**.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav, navGroup } from 'basalt-ui/router-tanstack'
import { articleFilters } from './article-filter-stores'
import { mobileFilters } from './controls-mobile-store'
import { dashboardFilters } from './dashboard-range-store'
import {
  IconActivity,
  IconBattery,
  IconBook,
  IconChart,
  IconComponents,
  IconDashboard,
  IconDots,
  IconPalette,
  IconSearch,
  IconSettings,
  IconSparkle,
  IconTrash,
  IconUser,
  IconWifi,
} from './icons'

export const NAV = defineNav({
  groups: [
    navGroup({ id: 'overview', label: 'Overview', icon: <IconDashboard /> }, [
      {
        id: 'dashboard',
        label: 'Dashboard',
        short: 'Home',
        mobile: 'tab',
        icon: <IconDashboard />,
        // Law C10 — the store's OWN reader, passed BY REFERENCE and set per destination so only
        // the /dashboard sub-tree inherits the filter and every other link below stays clean.
        //
        // A `search:` object literal here would pin the fallback on every click; a hand-rolled
        // thunk restating '30d' would drift from the store the moment a preset is added. A bare
        // `search: true` is not available either: `/dashboard`'s `validateSearch` always returns
        // every field, so the router requires the keys. `linkSearch` is the typed answer to all
        // three — `linkOptions` accepts a function form and `<Link>` re-evaluates it at CLICK
        // time, so it reads whatever the filters last persisted.
        link: linkOptions({ to: '/dashboard', search: dashboardFilters.linkSearch }),
        // Child rows render text-only against the sidebar's left rail — omitting `icon` is what
        // opts out of a left section, and the mobile More sheet indents them the same way.
        children: [
          {
            id: 'dashboard-sessions',
            label: 'Sessions',
            link: linkOptions({ to: '/dashboard/sessions', search: dashboardFilters.linkSearch }),
          },
          {
            id: 'dashboard-traffic',
            label: 'Traffic',
            link: linkOptions({ to: '/dashboard/traffic', search: dashboardFilters.linkSearch }),
          },
          {
            id: 'dashboard-revenue',
            label: 'Revenue',
            link: linkOptions({ to: '/dashboard/revenue', search: dashboardFilters.linkSearch }),
          },
        ],
      },
      {
        id: 'activity',
        label: 'Activity',
        mobile: 'tab',
        icon: <IconActivity />,
        link: linkOptions({ to: '/activity' }),
      },
    ]),

    navGroup(
      { id: 'charts', label: 'Charts & components', icon: <IconChart />, collapsible: true },
      [
        {
          id: 'charts-page',
          label: 'Charts',
          mobile: 'tab',
          icon: <IconChart />,
          link: linkOptions({ to: '/charts' }),
        },
        {
          id: 'band-strip',
          label: 'Band strip',
          icon: <IconChart />,
          link: linkOptions({ to: '/band-strip' }),
        },
        {
          id: 'mirrored-bars',
          label: 'Mirrored bars',
          icon: <IconChart />,
          link: linkOptions({ to: '/mirrored-bars' }),
        },
        {
          id: 'components',
          label: 'Components',
          icon: <IconComponents />,
          link: linkOptions({ to: '/components' }),
        },
        {
          id: 'mobile-nav-pill',
          label: 'Mobile nav pill',
          icon: <IconDots />,
          link: linkOptions({ to: '/mobile-nav-pill' }),
        },
        {
          id: 'controls-mobile',
          label: 'Controls (mobile)',
          short: 'Controls',
          icon: <IconSettings />,
          // Its own store validates six fields, so the destination carries all of them — same
          // by-reference reader as every other store-backed link (law C10).
          link: linkOptions({ to: '/controls-mobile', search: mobileFilters.linkSearch }),
        },
        {
          id: 'reports',
          label: 'Reports',
          icon: <IconActivity />,
          // The "Coming soon" tooltip path. A disabled destination still needs a `link` — it is
          // never followed (`disabled` short-circuits before the anchor is used), so it points at
          // a real route rather than inventing one. Deliberately NOT `/charts`: a placeholder
          // pointing at a route that owns a bar slot would make BOTH that slot and More read as
          // active on it, so it borrows the route of a sibling that already lives inside More.
          disabled: true,
          link: linkOptions({ to: '/components' }),
        },
      ],
    ),

    // `mobile: { tab: true }` — the one SECTION that owns a bar slot. The surface is inferred
    // from how many rows it holds, never configured: eight destinations, past `menuMax` (6), so
    // it resolves to a sheet rather than a menu that grows upward out of the tab.
    navGroup(
      { id: 'batteries', label: 'Batteries', icon: <IconBattery />, mobile: { tab: true } },
      [
        {
          id: 'query',
          label: 'Query',
          icon: <IconActivity />,
          link: linkOptions({ to: '/query' }),
        },
        {
          id: 'query-state',
          label: 'Query state',
          short: 'State',
          icon: <IconActivity />,
          link: linkOptions({ to: '/query-state' }),
        },
        {
          id: 'router',
          label: 'Router',
          icon: <IconActivity />,
          link: linkOptions({ to: '/router' }),
        },
        {
          id: 'forms',
          label: 'Forms',
          icon: <IconComponents />,
          link: linkOptions({ to: '/forms' }),
        },
        {
          id: 'notifications',
          label: 'Notifications',
          short: 'Notify',
          icon: <IconActivity />,
          link: linkOptions({ to: '/notifications' }),
        },
        {
          id: 'commands',
          label: 'Commands',
          icon: <IconPalette />,
          link: linkOptions({ to: '/commands' }),
        },
        { id: 'data', label: 'Data', icon: <IconActivity />, link: linkOptions({ to: '/data' }) },
        {
          id: 'data-table-chrome',
          label: 'Table chrome',
          short: 'Table',
          icon: <IconActivity />,
          link: linkOptions({ to: '/data-table-chrome' }),
        },
      ],
    ),

    navGroup({ id: 'content', label: 'Content', icon: <IconBook /> }, [
      {
        id: 'content',
        label: 'Content',
        icon: <IconBook />,
        link: linkOptions({ to: '/content' }),
      },
      {
        id: 'content-overview',
        label: 'Content overview',
        short: 'Overview',
        icon: <IconSearch />,
        // Same by-reference reader as the dashboard — one store, both of this route's params.
        link: linkOptions({ to: '/content-overview', search: articleFilters.linkSearch }),
      },
      {
        id: 'content-sanitize',
        label: 'Content sanitize',
        short: 'Sanitize',
        icon: <IconTrash />,
        link: linkOptions({ to: '/content-sanitize' }),
      },
    ]),

    navGroup({ id: 'agent', label: 'Agent', icon: <IconSparkle /> }, [
      { id: 'agent', label: 'Agent', icon: <IconSparkle />, link: linkOptions({ to: '/agent' }) },
      {
        id: 'agent-ai-sdk',
        label: 'Agent (AI SDK)',
        icon: <IconSparkle />,
        link: linkOptions({ to: '/agent-ai-sdk' }),
      },
      {
        id: 'threads',
        label: 'Threads',
        icon: <IconActivity />,
        link: linkOptions({ to: '/threads' }),
      },
      {
        id: 'threads-adapter',
        label: 'Threads adapter',
        icon: <IconActivity />,
        link: linkOptions({ to: '/threads-adapter' }),
      },
      {
        id: 'agent-chat-subpath',
        label: 'Agent chat (subpath)',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-chat-subpath' }),
      },
      {
        id: 'agent-wedge',
        label: 'Agent wedge recovery',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-wedge' }),
      },
      {
        id: 'agent-foreign-parts',
        label: 'Agent foreign parts',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-foreign-parts' }),
      },
      {
        id: 'agent-tool-lifecycle',
        label: 'Agent tool lifecycle',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-tool-lifecycle' }),
      },
      {
        id: 'agent-render-budget',
        label: 'Agent render budget',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-render-budget' }),
      },
      {
        id: 'agent-stop-mid-stream',
        label: 'Agent stop mid-stream',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-stop-mid-stream' }),
      },
      {
        id: 'agent-fence-registry',
        label: 'Agent fence registry',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-fence-registry' }),
      },
      {
        id: 'agent-composer',
        label: 'Agent composer',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-composer' }),
      },
      {
        id: 'agent-thread-feed-inline',
        label: 'Agent thread feed (inline)',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-thread-feed-inline' }),
      },
      {
        id: 'agent-transcript-virtualize',
        label: 'Agent transcript virtualize',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-transcript-virtualize' }),
      },
      {
        id: 'agent-inline-feed-virtualized',
        label: 'Agent inline feed (virtualized row)',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-inline-feed-virtualized' }),
      },
      {
        id: 'agent-anchor-to-end',
        label: 'Agent anchor to end (streaming)',
        icon: <IconActivity />,
        link: linkOptions({ to: '/agent-anchor-to-end' }),
      },
    ]),

    navGroup({ id: 'system', label: 'System', icon: <IconSettings /> }, [
      {
        id: 'connectivity',
        label: 'Connectivity',
        icon: <IconWifi />,
        link: linkOptions({ to: '/connectivity' }),
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: <IconSettings />,
        link: linkOptions({ to: '/settings' }),
      },
      { id: 'user', label: 'User', icon: <IconUser />, link: linkOptions({ to: '/user' }) },
    ]),
  ],
})
