/**
 * App-side series colors — the consumer-series pattern.
 *
 * The framework ships NO `VX.series` tree (series colors are domain data). A consumer declares its
 * own series with `defineSeries` (a typed `{ name: ColorPair }` map), reads stable `var(--vx-*)`
 * token refs via `groupTokens`, and hands the same map to `BasaltProvider`'s
 * `paletteOptions.groups` so the matching `--vx-demo-*` custom properties are emitted into the
 * palette stylesheet. Both halves (CSS emission + token refs) trace back to this single source.
 */
import { defineSeries, groupTokens } from 'basalt-ui/tokens'

declare module 'basalt-ui' {
  interface BasaltRegister {
    series: typeof DEMO_SERIES
  }
}

/** The group prefix the palette CSS uses (`--vx-demo-<key>`). */
const DEMO_GROUP = 'demo'

/**
 * Demo series — one per Blueprint-leaning hue, declared as light/dark pairs so each keeps its hue
 * identity but shifts shade across schemes (lighter on dark to avoid glow, deeper on light).
 */
const DEMO_SERIES = defineSeries({
  sessions: { light: '#2871c7', dark: '#5190f7' },
  signups: { light: '#10781c', dark: '#65d289' },
  revenue: { light: '#c07e3c', dark: '#f9a13d' },
  churn: { light: '#af293e', dark: '#e46360' },
})

/**
 * `groupTokens` now returns an exact-keyed `{ [K in keyof T]: string }` type, so the result is
 * directly usable — `demoColors.sessions` typechecks and a renamed/removed series fails tsc
 * without any manual re-keying.
 */
export const demoColors = groupTokens(DEMO_GROUP, DEMO_SERIES)

/** The `paletteOptions.groups` shape `BasaltProvider` forwards to `buildPaletteCss`. */
export const demoPaletteGroups = [demoColors]
