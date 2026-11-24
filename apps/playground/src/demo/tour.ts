/**
 * The tour the landing page lists: one line and the parts it proves for each stop of the nav's
 * `tour` section, keyed by the nav item id. The order and the links are the nav's.
 */
export type TourStop = { line: string; parts: string }

export const TOUR: Readonly<Record<string, TourStop>> = {
  shell: {
    line: 'One nav declaration drives the rail, the phone section bar, the breadcrumb and the title.',
    parts: 'AppShell, defineNav, CommandPalette, PageAside',
  },
  'ref-parts': {
    line: 'A list page with counted views, a summary strip, a grouped table and a board view.',
    parts: 'list-page block, ViewTabs, DataTable, BulkBar',
  },
  table: {
    line: 'A server table in the reading look: filters, totals, selection and a record panel.',
    parts: 'DataTable, useDataTable, detailState, TableToolbar',
  },
  board: {
    line: 'Work in stages: drag a card between columns, or move it from its menu.',
    parts: 'Board, KanbanCard, applyMove',
  },
  'ref-supplier': {
    line: 'A record page: identity in the band, properties edited in place, tabs and a feed.',
    parts: 'record-page block, PageBar identity, PropertyList',
  },
  'ref-settings': {
    line: 'Settings in panes with one save, and the reader’s appearance.',
    parts: 'settings-page block, SettingsLayout, AppearanceSwitcher',
  },
  forms: {
    line: 'Four whole forms: a create dialog, a settings page, a multi-step flow and a wizard.',
    parts: 'useAppForm, FormSection, Stepper, WizardDialog',
  },
  dashboard: {
    line: 'A dashboard on one range, with a widget that overrides it.',
    parts: 'StatGroup, StatCard, ChartCard, BarList, EventList',
  },
  charts: {
    line: 'Lines with a mean and gaps, a second axis, one x domain, faded bars, a lone point.',
    parts: 'CartesianChart, ChartCard',
  },
  content: {
    line: 'An authored MDX article with an on-this-page rail and links to the next stop.',
    parts: 'ArticleLayout, mdxComponents, CodeBlock',
  },
  states: {
    line: 'One list loading, empty and failed; the connection and the age of the data; overlays.',
    parts: 'shotState, EmptyState, ConnectionIndicator, RefreshButton, OverlayHost, StepRail',
  },
  phone: {
    line: 'Every stop at 390 wide: one slot per nav section, a short drawer per tap, More for the sidebar.',
    parts: 'the section bar, its drawer, More, the keyboard inset',
  },
}
