/**
 * The playground's navigation: ONE typed `defineNav` declaration, and the only place a destination
 * is stated. `AppShell nav={NAV}` in `routes/__root.tsx` projects it onto the rail, the phone tab
 * bar, the breadcrumb and the document title.
 *
 * `defineNav` wraps TanStack's `linkOptions`, so every `to` rides the router's validator against the
 * generated route tree. It is PURE (no registration, no global), so this file imports nothing from
 * `routes/` and either side can read it without a cycle.
 *
 * Destinations: the Tour first (the landing page and its stops, in order; `demo/tour.ts` holds each stop's line),
 * then the Reference pages, the Kit (one page per capability), its Forms group and the routed recipes,
 * each folded until opened. Trial builds and test fixtures have no entry (apps/playground/AGENTS.md).
 * Settings is the shell's `settings` menu, not a nav item.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav } from 'basalt-ui/router'
import {
  Boxes,
  CalendarDays,
  ChartColumn as Chart,
  ChartLine,
  Compass,
  Factory,
  FileText,
  Kanban,
  Notebook,
  Image,
  LayoutDashboard as Dashboard,
  Layers,
  Mail,
  MessagesSquare,
  PanelLeft as Layout,
  PanelRight as Panel,
  SlidersHorizontal as Sliders,
  Smartphone,
  Table,
  TextCursorInput as Form,
  Workflow,
} from 'lucide-react'

export const NAV = defineNav({
  sections: [
    // The tour: the landing page, then one page per way of using v3, in the order the landing lists them.
    {
      id: 'tour',
      label: 'Tour',
      items: [
        {
          id: 'home',
          label: 'Start',
          icon: Compass,
          mobile: 'tab',
          link: linkOptions({ to: '/' }),
        },
        {
          id: 'shell',
          label: 'Shell',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/shell' }),
        },
        {
          id: 'ref-parts',
          label: 'Parts',
          icon: Boxes,
          mobile: 'tab',
          link: linkOptions({ to: '/ref/parts' }),
        },
        {
          id: 'table',
          label: 'Ledger',
          icon: Table,
          mobile: 'more',
          link: linkOptions({ to: '/table' }),
        },
        {
          id: 'board',
          label: 'Board',
          icon: Kanban,
          mobile: 'more',
          link: linkOptions({ to: '/kit/board' }),
        },
        {
          id: 'ref-supplier',
          label: 'Supplier',
          icon: Factory,
          mobile: 'more',
          link: linkOptions({ to: '/ref/suppliers/$id', params: { id: 'sup-1' } }),
        },
        {
          id: 'ref-settings',
          label: 'Settings',
          icon: Sliders,
          mobile: 'tab',
          link: linkOptions({ to: '/ref/settings' }),
        },
        {
          id: 'forms',
          label: 'Forms',
          icon: Form,
          mobile: 'more',
          link: linkOptions({ to: '/kit/forms/whole' }),
        },
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: Dashboard,
          mobile: 'tab',
          link: linkOptions({ to: '/overview' }),
        },
        {
          id: 'charts',
          label: 'Charts',
          icon: ChartLine,
          mobile: 'more',
          link: linkOptions({ to: '/charts' }),
        },
        {
          id: 'content',
          label: 'Content',
          icon: FileText,
          mobile: 'more',
          link: linkOptions({ to: '/kit/content' }),
        },
        {
          id: 'states',
          label: 'States',
          icon: Layers,
          mobile: 'more',
          link: linkOptions({ to: '/kit/states' }),
        },
        {
          id: 'phone',
          label: 'Phone',
          icon: Smartphone,
          mobile: 'more',
          link: linkOptions({ to: '/kit/mobile-nav' }),
        },
      ],
    },
    // The reference pages: one inventory domain built only from shipped parts, one page per archetype.
    {
      id: 'reference',
      label: 'Reference',
      collapsible: true,
      defaultCollapsed: true,
      items: [
        {
          id: 'ref-notes',
          label: 'Notes',
          icon: Notebook,
          mobile: 'more',
          link: linkOptions({ to: '/ref/notes' }),
        },
        {
          id: 'ref-mail',
          label: 'Mail',
          icon: Mail,
          mobile: 'more',
          link: linkOptions({ to: '/ref/mail' }),
        },
        {
          id: 'ref-schedule',
          label: 'Schedule',
          icon: CalendarDays,
          mobile: 'more',
          link: linkOptions({ to: '/ref/schedule' }),
        },
        {
          id: 'ref-flow',
          label: 'Reorder workflow',
          icon: Workflow,
          mobile: 'more',
          link: linkOptions({ to: '/ref/flow' }),
        },
        {
          id: 'ref-assistant',
          label: 'Assistant',
          icon: MessagesSquare,
          mobile: 'more',
          link: linkOptions({ to: '/ref/assistant' }),
        },
      ],
    },
    // The kit, one destination per capability: what the owner and an agent read as the reference.
    {
      id: 'kit',
      label: 'Kit',
      collapsible: true,
      defaultCollapsed: true,
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
          id: 'kit-stat-states',
          label: 'Stat states',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/stat-states' }),
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
          id: 'kit-overlays',
          label: 'Overlays',
          icon: Layout,
          mobile: 'more',
          link: linkOptions({ to: '/kit/overlays' }),
        },
      ],
    },
    // The kit's forms: every shipped control in its states, then three whole forms on TanStack Form.
    {
      id: 'kit-forms',
      label: 'Kit: Forms',
      collapsible: true,
      defaultCollapsed: true,
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
      ],
    },
    // The recipes a doc page copies, each rendered as a page.
    {
      id: 'recipes',
      label: 'Recipes',
      collapsible: true,
      defaultCollapsed: true,
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
  ],
})
