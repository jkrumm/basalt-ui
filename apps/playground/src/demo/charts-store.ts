import { createSearchStore, field } from 'basalt-ui/state'

/**
 * The charts page's groups. This page used to stack ~20 fixed-height charts in one column with no
 * page bar and no anchor — at 390px that is a single ~6000px scroll a phone has no way to navigate.
 * The groups are the phone treatment: one loads at a time, the switch lives in the bar's `tabs`
 * slot like every other route's, and `ViewTabs` collapses past three options to a `Select` in CSS
 * (law C9). Grouping is also what keeps the cursor claim honest — the shared-cursor demo is the
 * `linked` group, and it stays whole.
 *
 * The charts page's state — the view group and the strip window width. A search store, so every
 * group is a stable deep link (`/charts?tab=strips`, `?tab=strips&buckets=48`) that the evidence
 * screens and keyboard lanes can address; `validateSearch` goes on `routes/charts.tsx`. The URL
 * wins over the `basalt:charts-view` mirror, which wins over the fallback (C4).
 */
export const chartViews = createSearchStore({
  key: 'charts-view',
  fields: {
    tab: field.enum(
      ['linked', 'cartesian', 'strips', 'composition', 'panels', 'sparklines', 'cursor'],
      'linked',
    ),
    // The strips' bucket count: 288 folds (sub-pixel bands merge), 48 does not — so the fold is
    // reachable by a click rather than by resizing the window.
    buckets: field.enum(['48', '144', '288'], '288'),
  },
}).labels({
  tab: {
    linked: 'Linked series',
    cartesian: 'Cartesian kinds',
    strips: 'Strips',
    composition: 'Composition',
    panels: 'Panels',
    sparklines: 'Sparklines',
    cursor: 'Cursor scope',
  },
  buckets: {
    '48': '48 buckets (unfolded)',
    '144': '144 buckets',
    '288': '288 buckets (folds)',
  },
})

/** The `buckets` field's value → the slot count it names; a missing option is a tsc error. */
export const BUCKET_COUNT: Record<'48' | '144' | '288', number> = {
  '48': 48,
  '144': 144,
  '288': 288,
}
