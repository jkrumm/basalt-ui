import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { CHANNEL_KEYS } from './analytics-data'

/**
 * The dashboard's state — one `createSearchStore` over seven typed fields
 * (docs/CONTROLS-SPEC.md §4, §10). `validateSearch` goes on `routes/dashboard.tsx`, so the whole
 * `/dashboard/*` subtree resolves every field the same way: URL ⊳ localStorage
 * (`basalt:dashboard-range`) ⊳ fallback (C4).
 *
 * **Two HOMES over one store, and the split below is the whole point** (`docs/ASIDE-SPEC.md` §0's
 * one-home law). The first four fields are what the page READS — the window, the comparison, the
 * unit, the channel set — and their home is the `PageBar`'s `FilterSet`. The last three are how the
 * sales chart is DRAWN, and their home is the page's `PageAside`. Neither set appears in the other
 * home on any viewport: a field bound in both is the twin that law forbids, and it is a twin the
 * `basalt/field-bound-twice` guard cannot catch yet (it waits on a second consumer), so it is the
 * page's own discipline until then.
 *
 * They share ONE store rather than splitting the display half onto a `createLocalStore` because a
 * reading of this page is worth linking WHOLE: `?range=7d&scale=log&smoothing=3` is the chart
 * someone actually looked at. `demo/DashboardPage.tsx`'s `cardViews` is the local lane, and it holds
 * what genuinely is not page state — a single card's bucket, a single list's metric.
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

    // ── The aside's three (`PageAside title="Display"`) ────────────────────────────────────────
    // `linear` at rest: revenue over a 30-day window spans well under one order of magnitude, so a
    // log default would flatten the shape the page exists to show. `log` earns its place anyway —
    // it is what makes the currency switch and a long window readable together.
    scale: field.enum(['linear', 'log'], 'linear'),
    // A CENTERED rolling mean over the plotted series, in points. `0` is off and is the fallback:
    // smoothing is a lens, and a dashboard that ships pre-smoothed is quietly claiming the noise is
    // not there. `int: true` fills the field's own `step` with 1, so `SliderControl` takes the grain
    // off the handle rather than restating it (G7).
    smoothing: field.number({ fallback: 0, min: 0, max: 6, int: true }),
    // The target corridor behind the line, derived from the visible window's own mean — see
    // `DashboardPage`'s `targetBands`. Off at rest: a band drawn under every reading turns a
    // reference into chrome.
    bands: field.boolean(false),
  },
}).labels({
  range: { '1d': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days' },
  compare: { none: 'No comparison', previous: 'Previous period', year: 'Same period last year' },
  currency: { USD: 'US dollar', EUR: 'Euro' },
  scale: { linear: 'Linear', log: 'Logarithmic' },
  channels: {
    direct: 'Direct',
    organic: 'Organic search',
    referral: 'Referral',
    social: 'Social',
    paid: 'Paid',
  },
})
