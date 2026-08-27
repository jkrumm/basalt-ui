import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { CHANNEL_KEYS } from './analytics-data'

/**
 * The dashboard's filter state — one `createSearchStore` over four typed fields
 * (docs/CONTROLS-SPEC.md §4, §10). `validateSearch` goes on `routes/dashboard.tsx`, so the whole
 * `/dashboard/*` subtree resolves every field the same way: URL ⊳ localStorage
 * (`basalt:dashboard-range`) ⊳ fallback (C4).
 *
 * Nothing here reads or writes a param by hand. Each field is handed to a control as a
 * `FieldHandle` — `<RangeFilter field={dashboardFilters.field.range}/>` and friends inside
 * `PageBar.filters` own both lanes (C2) — and every nav destination carries the live selection
 * through `search: dashboardFilters.linkSearch`, passed BY REFERENCE (C10).
 *
 * `range` keeps the param name and the store key it had as a `createSearchParamStore`, so existing
 * `?range=7d` deep links still resolve. `custom: true` adds the `'custom'` preset plus the
 * `from`/`to` ISO params the `DateRangePicker` writes — three URL params for one field, which is
 * what lets a custom window deep-link without changing the other two params' shape.
 */
export const dashboardFilters = createSearchStore({
  key: 'dashboard-range',
  fields: {
    range: field.range({ presets: ['1d', '7d', '30d'], fallback: '30d', custom: true }),
    // `'previous'`, not `'none'` — a dashboard whose default is "no comparison" ships with every
    // delta badge hidden, which is the page's whole trend layer switched off at rest. A period
    // comparison is what a reader of a KPI wants first; `'none'` stays reachable in the pill.
    compare: field.enum(['none', 'previous', 'year'], 'previous'),
    currency: field.enum(['USD', 'EUR'], 'USD'),
    channels: field.multi(CHANNEL_KEYS, []),
  },
}).labels({
  range: { '1d': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days' },
  compare: { none: 'No comparison', previous: 'Previous period', year: 'Same period last year' },
  currency: { USD: 'US dollar', EUR: 'Euro' },
  channels: {
    direct: 'Direct',
    organic: 'Organic search',
    referral: 'Referral',
    social: 'Social',
    paid: 'Paid',
  },
})
