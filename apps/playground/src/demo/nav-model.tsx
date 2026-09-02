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
 * Shrunk from ~45 destinations to 14 (consolidation wave C3, audit E §7): every route this file
 * once linked to that got merged into another page as a TAB is gone from here too — the tab lives
 * inside the destination it merged into, not as a second nav row pointing at the same URL.
 */
import { Text } from '@mantine/core'
import { linkOptions } from '@tanstack/react-router'
import type { SidebarBlock } from 'basalt-ui'
import { defineNav, navGroup } from 'basalt-ui/router-tanstack'
import { cbbiFilters } from './cbbi/cbbi-store'
import { dashboardFilters } from './dashboard-range-store'
import {
  IconActivity,
  IconBattery,
  IconBook,
  IconChart,
  IconComponents,
  IconDashboard,
  IconPalette,
  IconSettings,
  IconSparkle,
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
        link: linkOptions({ to: '/dashboard', search: dashboardFilters.linkSearch }),
        // The ONE nested proof left (audit E §7) — `/dashboard/sessions` and `/dashboard/traffic`
        // were identical `SubPage` stubs and are gone.
        children: [
          {
            id: 'dashboard-revenue',
            label: 'Revenue',
            link: linkOptions({ to: '/dashboard/revenue', search: dashboardFilters.linkSearch }),
          },
        ],
      },
    ]),

    // The one group that is not a framework surface: a whole page built ON basalt rather than a
    // demonstration OF one piece of it. `cbbi` is the evidence page for a future right-hand aside,
    // so it links with its own store's reader (C10) like every other store-backed destination.
    navGroup({ id: 'examples', label: 'Examples', icon: <IconChart /> }, [
      {
        id: 'cbbi',
        label: 'CBBI (live data)',
        short: 'CBBI',
        icon: <IconChart />,
        link: linkOptions({ to: '/cbbi', search: cbbiFilters.linkSearch }),
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
          id: 'components',
          label: 'Components',
          icon: <IconComponents />,
          link: linkOptions({ to: '/components' }),
        },
      ],
    ),

    navGroup(
      { id: 'batteries', label: 'Batteries', icon: <IconBattery />, mobile: { tab: true } },
      [
        { id: 'data', label: 'Data', icon: <IconActivity />, link: linkOptions({ to: '/data' }) },
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
        {
          id: 'content',
          label: 'Content',
          icon: <IconBook />,
          link: linkOptions({ to: '/content' }),
        },
      ],
    ),

    navGroup({ id: 'agent', label: 'Agent', icon: <IconSparkle /> }, [
      { id: 'agent', label: 'Agent', icon: <IconSparkle />, link: linkOptions({ to: '/agent' }) },
    ]),

    navGroup({ id: 'system', label: 'System', icon: <IconSettings /> }, [
      {
        id: 'settings',
        label: 'Settings',
        icon: <IconSettings />,
        link: linkOptions({ to: '/settings' }),
      },
    ]),
  ],
})

/**
 * The sidebar's declared blocks (`docs/CONTROLS-SPEC.md` §2.3) — all three kinds, which is what
 * gates the promotion: a list with a count and a `max`, a bottom-pinned progress row, and a
 * `kind: 'custom'` node (the shape that replaced `sidebarNavExtra`).
 *
 * Hoisted to module scope for the same reason `navBadges` in `routes/__root.tsx` is: it is static
 * here, and a fresh array per render would be a fresh identity into the shell's mobile-nav memo.
 * A real app builds this from a query result and memoizes it there.
 *
 * `awaiting` is the one that exercises every projection at once: `count: 3` earns the rail dot,
 * `max: 3` earns the "Show more" toggle, and the default `mobile: 'more'` puts it in the More sheet
 * as ONE row (`Awaiting action · 3`) that opens a nested sheet of the six items.
 */
export const SIDEBAR_BLOCKS: SidebarBlock[] = [
  {
    kind: 'list',
    key: 'awaiting',
    label: 'Awaiting action',
    icon: <IconActivity />,
    count: 3,
    max: 3,
    collapsible: true,
    items: [
      { key: 'review', label: 'Review the charts spec', tone: 'warn', meta: '2h' },
      { key: 'contract', label: 'Sign the contract', tone: 'bad', meta: '1d' },
      { key: 'reply', label: 'Reply to the handover', tone: 'good' },
      { key: 'triage', label: 'Triage the guard ledger' },
      { key: 'audit', label: 'Audit the waivers' },
      { key: 'release', label: 'Cut the minor' },
    ],
  },
  {
    kind: 'list',
    key: 'recents',
    label: 'Recents',
    // Plain text rows — no `Anchor`, `href` or `onClick`, so basalt renders them as text rather
    // than as links with nowhere to go. `mobile: 'hidden'`: a recents list is ambient context on a
    // wide sidebar, not something worth a row in a phone's More sheet.
    mobile: 'hidden',
    items: [
      { key: 'r1', label: 'Controls spec', meta: 'today' },
      { key: 'r2', label: 'Charts spec', meta: 'yesterday' },
      { key: 'r3', label: 'Design core', meta: '3d' },
    ],
  },
  {
    kind: 'custom',
    key: 'legend',
    // Desktop only, hidden in the rail — exactly what `sidebarNavExtra` was, now one block among
    // three instead of a second prop with its own projection story.
    node: (
      <Text size="xs" c="dimmed" ta="center" py={4}>
        basalt-ui playground
      </Text>
    ),
  },
  {
    kind: 'progress',
    key: 'getting-started',
    label: 'Getting started',
    value: 1,
    total: 5,
    // Bottom-placed by default, and its rail form is the ring on the settings row.
    onClick: () => {},
  },
]
