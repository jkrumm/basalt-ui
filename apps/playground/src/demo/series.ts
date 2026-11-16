/**
 * App-side series colors — the consumer-series pattern.
 *
 * The framework ships NO `VX.series` tree (series colors are domain data). A consumer declares its
 * own series with `defineSeries` (a typed `{ name: ColorPair }` map) and hands the `{ light, dark }`
 * pairs to the chart series, which resolve them per scheme.
 */
import { defineSeries } from 'basalt-ui/tokens'

declare module 'basalt-ui' {
  interface BasaltRegister {
    series: typeof DEMO_SERIES
  }
}

/**
 * Demo series — one per Blueprint-leaning hue, declared as light/dark pairs so each keeps its hue
 * identity but shifts shade across schemes (lighter on dark to avoid glow, deeper on light).
 */
/** The `{ light, dark }` pairs, as v3 chart series take them. */
export const DEMO_SERIES = defineSeries({
  sessions: { light: '#2871c7', dark: '#5190f7' },
  signups: { light: '#10781c', dark: '#65d289' },
  revenue: { light: '#c07e3c', dark: '#f9a13d' },
  churn: { light: '#af293e', dark: '#e46360' },
})

/** Sleep stages (scenario expr-n12): one hue per stage, deep darkest, REM the violet. */
export const SLEEP_SERIES = defineSeries({
  deep: { light: '#2b4a9b', dark: '#6c8cf0' },
  light: { light: '#4f93c9', dark: '#8dbbe6' },
  rem: { light: '#8a4fc7', dark: '#b68cf2' },
  need: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Cut progress (scenario expr-n16): the accent is the question's series; daily readings, lean mass and the plan sit in ink steps. */
export const CUT_SERIES = defineSeries({
  trend: { light: '#2871c7', dark: '#5190f7' },
  daily: { light: '#7a7a7a', dark: '#9c9c9c' },
  plan: { light: '#4a4a4a', dark: '#c4c4c4' },
  lean: { light: '#6b6b6b', dark: '#a8a8a8' },
})

/** Ride windows (scenario expr-n04): rain and wind as a share of the rider's own limits; the limit rule sits in an ink step. */
export const RIDE_SERIES = defineSeries({
  rain: { light: '#7a7a7a', dark: '#9c9c9c' },
  wind: { light: '#1f1f1f', dark: '#ededed' },
  limit: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Job schedule (scenario expr-n09): the accent is the next run; the rest of the 24 h and the later jobs sit in ink steps. */
export const SCHEDULE_SERIES = defineSeries({
  next: { light: '#2871c7', dark: '#5190f7' },
  soon: { light: '#262626', dark: '#e6e6e6' },
  later: { light: '#9a9a9a', dark: '#7d7d7d' },
})
