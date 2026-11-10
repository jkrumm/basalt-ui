/**
 * The playground's navigation — ONE typed definition, and the only place a destination is stated.
 *
 * `defineNav` wraps TanStack's own `linkOptions`, so every `to`/`search` below rides the router's
 * validator against the generated route tree: a typo in a path, a missing required search object,
 * an unknown metadata key or a `mobile.tabs` id that names nothing are all compile errors. There
 * is no `active` plumbing here — `BasaltShell nav={NAV}` in `routes/__root.tsx` resolves it from the router
 * and builds each destination's `<Link>` anchor, which is what deleted the old `withActive` walk
 * and the two render callbacks.
 *
 * Consumed by `routes/__root.tsx` (sidebar + mobile bar). It imports NOTHING from `routes/` or `routeTree.gen`, so either side can read it without
 * a cycle.
 *
 * Seven destinations (issue 616): home, the gallery, cards, table, shell, settings, and the
 * scenarios group built from `SCENARIO_INFO`.
 */
import { Text } from '@mantine/core'
import { linkOptions } from '@tanstack/react-router'
import type { SidebarBlock } from 'basalt-ui'
import { defineNav, navGroup } from 'basalt-ui'
import { SCENARIO_INFO } from '../scenarios/scenario-info'
import { IconActivity, IconChart, IconComponents, IconDashboard, IconSettings } from './icons'

export const NAV = defineNav({
  groups: [
    navGroup({ id: 'overview', label: 'Overview', icon: <IconDashboard /> }, [
      {
        id: 'home',
        label: 'Home',
        icon: <IconDashboard />,
        link: linkOptions({ to: '/' }),
      },
      {
        id: 'gallery',
        label: 'Gallery',
        mobile: 'tab',
        icon: <IconComponents />,
        link: linkOptions({ to: '/gallery' }),
      },
      // Four `mobile: 'tab'` fill the bar: `MOBILE_MAX_TABS_DEFAULT` is 5 INCLUDING the More slot,
      // and the shell always needs More here (account row + sidebar blocks), so four is the ceiling.
      {
        id: 'cards',
        label: 'Cards',
        mobile: 'tab',
        icon: <IconChart />,
        link: linkOptions({ to: '/cards' }),
      },
      {
        id: 'table',
        label: 'Table',
        mobile: 'tab',
        icon: <IconActivity />,
        link: linkOptions({ to: '/table' }),
      },
      {
        id: 'shell',
        label: 'Shell',
        mobile: 'tab',
        icon: <IconDashboard />,
        link: linkOptions({ to: '/shell' }),
      },
    ]),

    // One entry per scenario in the registry.
    navGroup(
      { id: 'scenarios', label: 'Scenarios', icon: <IconDashboard />, collapsible: true },
      SCENARIO_INFO.map(({ id, title }) => ({
        id: `scenario-${id}`,
        label: title,
        icon: <IconDashboard />,
        link: linkOptions({ to: '/scenarios/$name', params: { name: id } }),
      })),
    ),

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
