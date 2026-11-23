/**
 * The playground's navigation: ONE typed `defineNav` declaration, and the only place a destination
 * is stated. `AppShell nav={NAV}` in `routes/__root.tsx` projects it onto the rail, the phone tab
 * bar, the breadcrumb and the document title.
 *
 * `defineNav` wraps TanStack's `linkOptions`, so every `to` rides the router's validator against the
 * generated route tree. It is PURE (no registration, no global), so this file imports nothing from
 * `routes/` and either side can read it without a cycle.
 *
 * Destinations: the overview pages, then the Kit (one page per capability), its Forms group and the routed recipes, then the
 * trial evidence (the cycle apps and the scenarios built from `SCENARIO_INFO`), labelled as such.
 * Settings is the shell's `settings` menu, not a nav item.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav } from 'basalt-ui/router'
import {
  Boxes,
  CalendarDays,
  ChartColumn as Chart,
  Factory,
  Notebook,
  FlaskConical as Flask,
  Image,
  LayoutDashboard as Dashboard,
  PanelLeft as Layout,
  PanelRight as Panel,
  SlidersHorizontal as Sliders,
  Table,
  TextCursorInput as Form,
  Workflow,
} from 'lucide-react'
import { SCENARIO_INFO } from '../scenarios/scenario-info'

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
          id: 'widgets',
          label: 'Widgets',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/overview' }),
        },
      ],
    },
    // The reference pages: one inventory domain built only from shipped parts, one page per archetype.
    {
      id: 'reference',
      label: 'Reference',
      items: [
        {
          id: 'ref-parts',
          label: 'Parts',
          icon: Boxes,
          mobile: 'more',
          link: linkOptions({ to: '/ref/parts' }),
        },
        {
          id: 'ref-notes',
          label: 'Notes',
          icon: Notebook,
          mobile: 'more',
          link: linkOptions({ to: '/ref/notes' }),
        },
        {
          id: 'ref-supplier',
          label: 'Supplier',
          icon: Factory,
          mobile: 'more',
          link: linkOptions({ to: '/ref/suppliers/$id', params: { id: 'sup-1' } }),
        },
        {
          id: 'ref-schedule',
          label: 'Schedule',
          icon: CalendarDays,
          mobile: 'more',
          link: linkOptions({ to: '/ref/schedule' }),
        },
        {
          id: 'ref-settings',
          label: 'Inventory settings',
          icon: Sliders,
          mobile: 'more',
          link: linkOptions({ to: '/ref/settings' }),
        },
        {
          id: 'ref-flow',
          label: 'Reorder workflow',
          icon: Workflow,
          mobile: 'more',
          link: linkOptions({ to: '/ref/flow' }),
        },
      ],
    },
    // The kit, one destination per capability: what the owner and an agent read as the reference.
    {
      id: 'kit',
      label: 'Kit',
      items: [
        {
          id: 'kit-controls',
          label: 'Page controls',
          icon: Sliders,
          mobile: 'more',
          link: linkOptions({ to: '/kit/controls' }),
        },
        {
          id: 'kit-aside',
          label: 'Inspector aside',
          icon: Panel,
          mobile: 'more',
          link: linkOptions({ to: '/kit/aside' }),
        },
        {
          id: 'kit-peek',
          label: 'Peek',
          icon: Panel,
          mobile: 'more',
          link: linkOptions({ to: '/kit/peek' }),
        },
        {
          id: 'kit-list',
          label: 'List (fill)',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/list' }),
        },
        {
          id: 'kit-projects',
          label: 'Projects (monitoring)',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/kit/projects' }),
        },
        {
          id: 'kit-split',
          label: 'Split page',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/split' }),
        },
        {
          id: 'kit-interval-track',
          label: 'Interval track',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/interval-track' }),
        },
        {
          id: 'kit-bar-list-series',
          label: 'BarList by series',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/bar-list-series' }),
        },
        {
          id: 'kit-board',
          label: 'Board',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/board' }),
        },
        {
          id: 'kit-layouts',
          label: 'Layouts',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/kit/layouts' }),
        },
        {
          id: 'kit-chain',
          label: 'Dependency chain',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/kit/chain' }),
        },
        {
          id: 'kit-library',
          label: 'Library (reference)',
          icon: Image,
          mobile: 'more',
          link: linkOptions({ to: '/kit/library' }),
        },
        {
          id: 'kit-motion',
          label: 'Motion',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/motion' }),
        },
        {
          id: 'kit-avatars',
          label: 'Avatars',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/avatars' }),
        },
      ],
    },
    // The kit's forms: every shipped control in its states, then three whole forms on TanStack Form.
    {
      id: 'kit-forms',
      label: 'Kit: Forms',
      items: [
        {
          id: 'kit-forms-inputs',
          label: 'Inputs and states',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/inputs' }),
        },
        {
          id: 'kit-forms-choices',
          label: 'Choices',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/choices' }),
        },
        {
          id: 'kit-forms-lists',
          label: 'Option lists',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/lists' }),
        },
        {
          id: 'kit-forms-dates',
          label: 'Dates and numbers',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/dates' }),
        },
        {
          id: 'kit-forms-buttons',
          label: 'Buttons',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/buttons' }),
        },
        {
          id: 'kit-forms-whole',
          label: 'Whole forms',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/whole' }),
        },
      ],
    },
    // The recipes a doc page copies, each rendered as a page.
    {
      id: 'recipes',
      label: 'Recipes',
      items: [
        {
          id: 'recipe-view-switch',
          label: 'View switch',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/recipes/view-switch' }),
        },
        {
          id: 'recipe-saved-views',
          label: 'Saved views',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/recipes/saved-views' }),
        },
        {
          id: 'recipe-two-pane',
          label: 'Two panes',
          icon: Chart,
          mobile: 'more',
          link: linkOptions({ to: '/recipes/two-pane' }),
        },
      ],
    },
    // Trial evidence: the pages the state and dogfood cycles built, kept as they were judged.
    {
      id: 'trial-cycles',
      label: 'Trial evidence: state and dogfood cycles',
      collapsible: true,
      items: [
        {
          id: 'cycle-state-2',
          label: 'Tickets (state cycle 2)',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/state-2' }),
        },
        {
          id: 'cycle-state-3',
          label: 'Orders (state cycle 3)',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/state-3' }),
        },
        {
          id: 'cycle-state-4',
          label: 'Invoices (state cycle 4)',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/state-4' }),
        },
        {
          id: 'cycle-dogfood',
          label: 'Flow (dogfood cycle)',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/dogfood' }),
        },
        {
          id: 'cycle-dogfood-2',
          label: 'Flow (dogfood cycle 2)',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/dogfood-2' }),
        },
        {
          id: 'cycle-dogfood-3',
          label: 'Flow (dogfood cycle 3)',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/dogfood-3' }),
        },
        {
          id: 'cycle-dogfood-4',
          label: 'Overview (dogfood cycle 4)',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/dogfood-4' }),
        },
        {
          id: 'cycle-dogfood-5',
          label: 'Overview (dogfood cycle 5)',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/dogfood-5' }),
        },
      ],
    },
    // Shell cycle 2 (docs/v3/cycles/shell-2.md): the fleet app's three pages.
    {
      id: 'fleet',
      label: 'Trial evidence: fleet, shell cycle 2',
      collapsible: true,
      items: [
        {
          id: 'fleet-overview',
          label: 'Fleet overview',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-2' }),
        },
        {
          id: 'fleet-services',
          label: 'Services',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-2/services' }),
        },
        {
          id: 'fleet-settings',
          label: 'Fleet settings',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-2/settings' }),
        },
      ],
    },
    // Shell cycle 3 (docs/v3/cycles/shell-3.md): the fleet app's three pages, rebuilt.
    {
      id: 'fleet-3',
      label: 'Trial evidence: fleet, shell cycle 3',
      collapsible: true,
      items: [
        {
          id: 'fleet-3-overview',
          label: 'Fleet overview',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-3' }),
        },
        {
          id: 'fleet-3-services',
          label: 'Services',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-3/services' }),
        },
        {
          id: 'fleet-3-settings',
          label: 'Fleet settings',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-3/settings' }),
        },
      ],
    },
    // Shell cycle 4 (docs/v3/cycles/shell-4.md): the fleet app's three pages, rebuilt.
    {
      id: 'fleet-4',
      label: 'Trial evidence: fleet, shell cycle 4',
      collapsible: true,
      items: [
        {
          id: 'fleet-4-overview',
          label: 'Fleet overview',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-4' }),
        },
        {
          id: 'fleet-4-services',
          label: 'Services',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-4/services' }),
        },
        {
          id: 'fleet-4-settings',
          label: 'Fleet settings',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-4/settings' }),
        },
      ],
    },
    // Shell cycle 5 (docs/v3/cycles/shell-5.md): the fleet app's three pages, rebuilt.
    {
      id: 'fleet-5',
      label: 'Trial evidence: fleet, shell cycle 5',
      collapsible: true,
      items: [
        {
          id: 'fleet-5-overview',
          label: 'Fleet overview',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-5' }),
        },
        {
          id: 'fleet-5-services',
          label: 'Services',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-5/services' }),
        },
        {
          id: 'fleet-5-settings',
          label: 'Fleet settings',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-5/settings' }),
        },
      ],
    },
    // Shell cycle 6 (owner review 2): the fleet app's three pages, rebuilt.
    {
      id: 'fleet-6',
      label: 'Trial evidence: fleet, shell cycle 6',
      collapsible: true,
      items: [
        {
          id: 'fleet-6-overview',
          label: 'Fleet overview',
          icon: Dashboard,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-6' }),
        },
        {
          id: 'fleet-6-services',
          label: 'Services',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-6/services' }),
        },
        {
          id: 'fleet-6-settings',
          label: 'Fleet settings',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/cycle/shell-6/settings' }),
        },
      ],
    },
    // One entry per scenario in the registry.
    {
      id: 'scenarios',
      label: 'Trial evidence: scenarios',
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
