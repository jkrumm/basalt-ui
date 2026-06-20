/**
 * App-side series colors — the consumer-series pattern.
 *
 * The framework ships NO `VX.series` tree (series colors are domain data). A consumer declares its
 * own series with `defineSeries` (a typed `{ name: ColorPair }` map), reads stable `var(--vx-*)`
 * token refs via `groupTokens`, and hands the same map to `BasaltProvider`'s
 * `paletteOptions.groups` so the matching `--vx-demo-*` custom properties are emitted into the
 * palette stylesheet. Both halves (CSS emission + token refs) trace back to this single source.
 */
import { defineSeries, groupTokens, type SeriesKey } from 'basalt-ui/charts'

declare module 'basalt-ui' {
  interface BasaltRegister {
    series: typeof DEMO_SERIES
  }
}

/** The group prefix the palette CSS uses (`--vx-demo-<key>`). */
export const DEMO_GROUP = 'demo'

/**
 * Demo series — one per Blueprint-leaning hue, declared as light/dark pairs so each keeps its hue
 * identity but shifts shade across schemes (lighter on dark to avoid glow, deeper on light).
 */
export const DEMO_SERIES = defineSeries({
  sessions: { light: '#4f78a4', dark: '#7099c4' },
  signups: { light: '#3f8a63', dark: '#62c08f' },
  revenue: { light: '#d9822b', dark: '#f0a868' },
  churn: { light: '#c23030', dark: '#f08c8c' },
})

/**
 * `groupTokens` now returns an exact-keyed `{ [K in keyof T]: string }` type, so the result is
 * directly usable — `demoColors.sessions` typechecks and a renamed/removed series fails tsc
 * without any manual re-keying.
 */
export const demoColors = groupTokens(DEMO_GROUP, DEMO_SERIES)

/** Exact-keyed accessor for the dynamic-group/donut call sites — no cast, no fallback. */
export function demoColor(key: SeriesKey): string {
  return demoColors[key]
}

/** The `paletteOptions.groups` shape `BasaltProvider` forwards to `buildPaletteCss`. */
export const demoPaletteGroups = { [`${DEMO_GROUP}-`]: DEMO_SERIES }
