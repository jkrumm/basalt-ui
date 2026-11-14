/**
 * The playground's navigation: ONE typed `defineNav` declaration, and the only place a destination
 * is stated. `AppShell nav={NAV}` in `routes/__root.tsx` projects it onto the rail, the phone tab
 * bar, the breadcrumb and the document title.
 *
 * `defineNav` wraps TanStack's `linkOptions`, so every `to` rides the router's validator against the
 * generated route tree. It is PURE (no registration, no global), so this file imports nothing from
 * `routes/` and either side can read it without a cycle.
 *
 * Destinations: home, the gallery, cards, table, shell, the scenarios section built from
 * `SCENARIO_INFO`. Settings is the shell's `settings` menu, not a nav item.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav } from 'basalt-ui/router'
import type { ReactNode } from 'react'
import { SCENARIO_INFO } from '../scenarios/scenario-info'

/** A 24-unit outline glyph; the shell sizes it with `className`. */
function glyph(paths: ReactNode): (props: { className?: string }) => ReactNode {
  return function NavGlyph({ className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    )
  }
}

const Dashboard = glyph(
  <>
    <path d="M4 4h6v8H4z" />
    <path d="M4 16h6v4H4z" />
    <path d="M14 4h6v4h-6z" />
    <path d="M14 12h6v8h-6z" />
  </>,
)
const Components = glyph(
  <>
    <path d="M4 4h6v6H4z" />
    <path d="M14 4h6v6h-6z" />
    <path d="M4 14h6v6H4z" />
    <path d="M14 17h6" />
    <path d="M17 14v6" />
  </>,
)
const Chart = glyph(
  <>
    <path d="M4 19h16" />
    <path d="M7 16v-5" />
    <path d="M12 16V7" />
    <path d="M17 16v-8" />
  </>,
)
const Table = glyph(
  <>
    <path d="M4 5h16v14H4z" />
    <path d="M4 10h16" />
    <path d="M10 10v9" />
  </>,
)
const Layout = glyph(
  <>
    <path d="M4 5h16v14H4z" />
    <path d="M9 5v14" />
  </>,
)
const Flask = glyph(
  <>
    <path d="M10 4h4" />
    <path d="M11 4v5l-5 9a1 1 0 0 0 1 2h10a1 1 0 0 0 1-2l-5-9V4" />
  </>,
)
export const NAV = defineNav({
  sections: [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        {
          id: 'home',
          label: 'Home',
          icon: Dashboard,
          mobile: 'tab',
          link: linkOptions({ to: '/' }),
        },
        {
          id: 'gallery',
          label: 'Gallery',
          icon: Components,
          mobile: 'tab',
          link: linkOptions({ to: '/gallery' }),
        },
        {
          id: 'cards',
          label: 'Cards',
          icon: Chart,
          mobile: 'tab',
          link: linkOptions({ to: '/cards' }),
        },
        {
          id: 'table',
          label: 'Table',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/table' }),
        },
        {
          id: 'shell',
          label: 'Shell',
          icon: Layout,
          mobile: 'tab',
          link: linkOptions({ to: '/shell' }),
        },
        {
          id: 'cycle-state',
          label: 'Orders (state cycle)',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle-state' }),
        },
      ],
    },
    // One entry per scenario in the registry.
    {
      id: 'scenarios',
      label: 'Scenarios',
      collapsible: true,
      items: SCENARIO_INFO.map(({ id, title }) => ({
        id: `scenario-${id}`,
        label: title,
        icon: Flask,
        link: linkOptions({ to: '/scenarios/$name', params: { name: id } }),
      })),
    },
  ],
})
