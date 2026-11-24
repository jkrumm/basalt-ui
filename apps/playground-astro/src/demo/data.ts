/**
 * The demo data of the Astro playground. Charts and tables read the Vite playground's own fixtures
 * (apps/playground/src/demo) so a part looks the same in both playgrounds and the two can be compared.
 */
import tokens from '../basalt.tokens'

export { RUNS } from '../../../playground/src/demo/runs'
export type { Run } from '../../../playground/src/demo/runs'

/** The Vite playground's `demo` series pairs, authored once in `../basalt.tokens`. */
export const DEMO_SERIES = tokens.series.demo

export type Day = { t: Date; sessions: number; signups: number }

const day = (i: number): Date => new Date(Date.UTC(2026, 9, 1 + i))

/** Four weeks of stand-in traffic, deterministic for screenshots. */
export const DAYS: readonly Day[] = Array.from({ length: 28 }, (_, i) => ({
  t: day(i),
  sessions: Math.round(1200 + Math.sin(i / 3) * 240 + i * 14),
  signups: Math.round(80 + Math.cos(i / 4) * 22 + i * 1.5),
}))

/** A week of values, dated, as the stat cells and sparklines take them. */
export const WEEK = [6, 6, 5, 6, 6, 6, 5].map((value, i) => ({
  value,
  at: new Date(Date.UTC(2026, 10, 13 + i, 12)),
}))

/** The declared width every chart demo renders at: the engine's server width (INITIAL_WIDTH). */
export const CHART_WIDTH = 640
