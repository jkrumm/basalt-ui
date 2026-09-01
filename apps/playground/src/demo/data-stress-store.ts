import { createSearchStore, field } from 'basalt-ui/router-tanstack'

/**
 * `/data-stress`'s filter state — a `RangeFilter` + `SearchFilter` pair, store-bound like every
 * other filter in the playground (law C2/C10), driving BOTH the sticky toolbar's controls and the
 * manually-paginated table below it.
 */
export const dataStressFilters = createSearchStore({
  key: 'data-stress',
  fields: {
    range: field.range({ presets: ['7d', '30d', '90d'], fallback: '90d' }),
    query: field.string({ max: 60 }),
  },
}).labels({
  range: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
})
