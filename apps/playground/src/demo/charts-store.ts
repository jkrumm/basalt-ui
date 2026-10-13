import { createSearchStore, field } from 'basalt-ui/state'

/**
 * The charts page's state — the view group and the strip window width. A search store, so every
 * group is a stable deep link (`/charts?tab=strips`, `?tab=strips&buckets=48`) that the evidence
 * screens and keyboard lanes can address; `validateSearch` goes on `routes/charts.tsx`. The URL
 * wins over the `basalt:charts-view` mirror, which wins over the fallback (C4).
 */
export const chartViews = createSearchStore({
  key: 'charts-view',
  fields: {
    tab: field.enum(
      ['linked', 'kinds', 'strips', 'composition', 'panels', 'sparklines', 'cursor'],
      'linked',
    ),
    // The strips' bucket count: 288 folds (sub-pixel bands merge), 48 does not — so the fold is
    // reachable by a click rather than by resizing the window.
    buckets: field.enum(['48', '144', '288'], '288'),
  },
}).labels({
  tab: {
    linked: 'Linked series',
    kinds: 'Standalone kinds',
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
