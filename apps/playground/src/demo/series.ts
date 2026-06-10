/**
 * App-side series colors — the consumer-series pattern.
 *
 * The framework ships NO `VX.series` tree (series colors are domain data). A consumer declares its
 * own series with `defineSeries` (a typed `{ name: ColorPair }` map), reads stable `var(--vx-*)`
 * token refs via `groupTokens`, and hands the same map to `BasaltProvider`'s
 * `paletteOptions.groups` so the matching `--vx-demo-*` custom properties are emitted into the
 * palette stylesheet. Both halves (CSS emission + token refs) trace back to this single source.
 */
import { defineSeries, groupTokens } from 'basalt-ui/charts'

/** The group prefix the palette CSS uses (`--vx-demo-<key>`). */
export const DEMO_GROUP = 'demo'

/**
 * Demo series — one per Blueprint-leaning hue, declared as light/dark pairs so each keeps its hue
 * identity but shifts shade across schemes (lighter on dark to avoid glow, deeper on light).
 */
export const DEMO_SERIES = defineSeries({
  sessions: { light: '#2965cc', dark: '#7da9f5' },
  signups: { light: '#0f9960', dark: '#62d6a0' },
  revenue: { light: '#d9822b', dark: '#f0a868' },
  churn: { light: '#c23030', dark: '#f08c8c' },
})

/**
 * `groupTokens` → `{ sessions: 'var(--vx-demo-sessions)', ... }`. The framework returns a
 * `Record<string, string>`; we re-key it into a literal-keyed object (explicit named properties,
 * not an index signature) so call sites read clean property access — `demoColors.sessions` — and a
 * renamed/removed series fails tsc.
 */
const rawDemoTokens = groupTokens(DEMO_GROUP, DEMO_SERIES)
export const demoColors = {
  sessions: rawDemoTokens['sessions']!,
  signups: rawDemoTokens['signups']!,
  revenue: rawDemoTokens['revenue']!,
  churn: rawDemoTokens['churn']!,
} satisfies Record<keyof typeof DEMO_SERIES, string>

/** Exact-keyed accessor for the dynamic-group/donut call sites (no index-signature widening). */
export function demoColor(key: string): string {
  return (rawDemoTokens as Record<string, string | undefined>)[key] ?? 'var(--vx-line)'
}

/** The `paletteOptions.groups` shape `BasaltProvider` forwards to `buildPaletteCss`. */
export const demoPaletteGroups = { [`${DEMO_GROUP}-`]: DEMO_SERIES }
