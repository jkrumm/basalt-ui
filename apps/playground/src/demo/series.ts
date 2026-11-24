/**
 * App-side series colors — the consumer-series pattern.
 *
 * The framework ships NO `BASALT.series` tree (series colors are domain data). A consumer declares its
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

/** A calendar week (route /kit/interval-track): meetings take the hue, focus and personal time ink steps, a declined event a hollow grey. */
export const CALENDAR_SERIES = defineSeries({
  meeting: { light: '#2871c7', dark: '#5190f7' },
  focus: { light: '#4a4a4a', dark: '#c4c4c4' },
  personal: { light: '#9a9a9a', dark: '#7d7d7d' },
  declined: { light: '#9a9a9a', dark: '#7d7d7d' },
})

/** Harbour bar (the expression app's n34, which keeps its own copy): tide in the dark ink step, swell in a mid step; the two limits sit in rule steps, the go windows are the accent's tint. */
export const BAR_SERIES = defineSeries({
  tide: { light: '#262626', dark: '#e6e6e6' },
  swell: { light: '#7a7a7a', dark: '#9c9c9c' },
  need: { light: '#4a4a4a', dark: '#c4c4c4' },
  limit: { light: '#6b6b6b', dark: '#a8a8a8' },
})

/** Model router (the `/kit/bar-list-series` page; the expression app's n41 keeps its own copy): one ink step per model in the chart and the list; the accent is not a model colour. Each pair is `light-dark()` in both halves, which the browser resolves per scheme; a plain `{ light, dark }` pair works too, since `BarList` paints both halves. */
export const SERVED_SERIES = defineSeries({
  atlasLarge: { light: 'light-dark(#262626, #ececec)', dark: 'light-dark(#262626, #ececec)' },
  atlasFast: { light: 'light-dark(#5c5c5c, #c4c4c4)', dark: 'light-dark(#5c5c5c, #c4c4c4)' },
  novaCode: { light: 'light-dark(#858585, #9a9a9a)', dark: 'light-dark(#858585, #9a9a9a)' },
  lumenEmbed: { light: 'light-dark(#adadad, #737373)', dark: 'light-dark(#adadad, #737373)' },
  lumenLite: { light: 'light-dark(#d6d6d6, #4a4a4a)', dark: 'light-dark(#d6d6d6, #4a4a4a)' },
})

/** Fleet deploys (route /cycle/shell-6): the status red is a failed deploy, the one outcome that needs a hand; a rolled-back deploy takes the amber, a succeeded one an ink step. */
export const FLEET6_SERIES = defineSeries({
  succeeded: { light: '#6b6b6b', dark: '#a8a8a8' },
  rolledBack: { light: '#c07e3c', dark: '#f9a13d' },
  failed: { light: '#af293e', dark: '#e46360' },
})
