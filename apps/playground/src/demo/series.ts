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

/** Factory health (scenario expr-n27): one ink step for every measure's weekly line; the delta pill carries the only hue. */
export const HEALTH_SERIES = defineSeries({
  weekly: { light: '#4a4a4a', dark: '#c4c4c4' },
  median: { light: '#9a9a9a', dark: '#7d7d7d' },
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

/** Host memory (scenario expr-n17): the accent is the pressure the question asks about; swap and the limit rule sit in ink steps. */
export const MEM_SERIES = defineSeries({
  pressure: { light: '#2871c7', dark: '#5190f7' },
  swap: { light: '#7a7a7a', dark: '#9c9c9c' },
  limit: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Queue waits (scenario expr-n18): finished wait hours sit in an ink step; the accent is the wait still open. */
export const WAIT_SERIES = defineSeries({
  done: { light: '#6b6b6b', dark: '#a8a8a8' },
  open: { light: '#2871c7', dark: '#5190f7' },
})

/** Training load (scenario expr-n03): the accent is this week, done and planned; past weeks and the average rule sit in ink steps. */
export const LOAD_SERIES = defineSeries({
  past: { light: '#7a7a7a', dark: '#9c9c9c' },
  done: { light: '#2871c7', dark: '#5190f7' },
  planned: { light: '#2871c7', dark: '#5190f7' },
  out: { light: '#c07e3c', dark: '#f9a13d' },
  average: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Observing nights (scenario expr-n07): the accent is the best night; go sits in ink, marginal in a mid step, ruled-out nights in a pale step. */
export const NIGHT_SERIES = defineSeries({
  best: { light: '#2871c7', dark: '#5190f7' },
  go: { light: '#262626', dark: '#e6e6e6' },
  marginal: { light: '#6b6b6b', dark: '#a3a3a3' },
  out: { light: '#b0b0b0', dark: '#666666' },
})

/** Household wealth (scenario expr-n14): the accent is the depot, the account that moves; cash and the rest sit in ink steps, and money paid in is the depot's baseline. */
export const WEALTH_SERIES = defineSeries({
  cash: { light: '#3d3d3d', dark: '#d4d4d4' },
  depot: { light: '#2871c7', dark: '#5190f7' },
  rest: { light: '#a3a3a3', dark: '#757575' },
  paidIn: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Wind models (scenario expr-n10): one hue per forecast model; the ensemble band sits in the neutral `other` grey. */
export const WIND_SERIES = defineSeries({
  ecmwf: { light: '#2871c7', dark: '#5190f7' },
  gfs: { light: '#c07e3c', dark: '#f9a13d' },
  icon: { light: '#10781c', dark: '#65d289' },
  arome: { light: '#8a4fc7', dark: '#b68cf2' },
  other: { light: '#7a7a7a', dark: '#9c9c9c' },
})

/** Weekly volume (scenario expr-n20): the accent is the work sets that count toward the range; warm-ups, drop sets and AMRAPs sit in ink steps, the typical rule in a mid step. */
export const VOLUME_SERIES = defineSeries({
  warmup: { light: '#c2c2c2', dark: '#5c5c5c' },
  work: { light: '#2871c7', dark: '#5190f7' },
  drop: { light: '#8a8a8a', dark: '#8f8f8f' },
  amrap: { light: '#262626', dark: '#e6e6e6' },
  out: { light: '#c07e3c', dark: '#f9a13d' },
  typical: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Line interventions (scenario expr-n21): the accent is the drop a reboot met; other actions sit in an ink step, drops left alone in a pale one, the median rule in a mid step. */
export const LINE_SERIES = defineSeries({
  rebooted: { light: '#2871c7', dark: '#5190f7' },
  other: { light: '#5c5c5c', dark: '#c8c8c8' },
  alone: { light: '#9a9a9a', dark: '#7d7d7d' },
  median: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Backup radio path (scenario expr-n19): the accent is the Wi-Fi signal and its round trip; noise and the limit sit in ink steps, the wired path in the neutral `other` grey. */
export const RADIO_SERIES = defineSeries({
  signal: { light: '#2871c7', dark: '#5190f7' },
  noise: { light: '#8a8a8a', dark: '#8f8f8f' },
  limit: { light: '#4a4a4a', dark: '#c4c4c4' },
  other: { light: '#7a7a7a', dark: '#9c9c9c' },
})

/** Walking pad (scenario expr-n15): the accent is the week's minutes and the pace the question asks about; the weekly target and the prior-pace rule sit in an ink step. */
export const WALK_SERIES = defineSeries({
  minutes: { light: '#2871c7', dark: '#5190f7' },
  pace: { light: '#2871c7', dark: '#5190f7' },
  target: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Model choice (scenario expr-c16): the accent is the recommended model; models that can take the chat sit in an ink step, models that cannot in a pale one, the current model's cost rule in a mid step. */
export const MODEL_SERIES = defineSeries({
  pick: { light: '#2871c7', dark: '#5190f7' },
  fits: { light: '#262626', dark: '#e6e6e6' },
  blocked: { light: '#9a9a9a', dark: '#7d7d7d' },
  current: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** AI gateway spend (scenario expr-n24): the accent is production, the share the question asks about; eval, verify and other sit in ink steps, spend with no purpose in a pale one. */
export const SPEND_SERIES = defineSeries({
  production: { light: '#2871c7', dark: '#5190f7' },
  eval: { light: '#262626', dark: '#ececec' },
  verify: { light: '#6b6b6b', dark: '#b4b4b4' },
  other: { light: '#a0a0a0', dark: '#7f7f7f' },
  unset: { light: '#d6d6d6', dark: '#4a4a4a' },
})

/** Reading goal (scenario expr-n25): the accent is the books finished; the even pace the goal implies and the goal rule sit in an ink step. */
export const READING_SERIES = defineSeries({
  finished: { light: '#2871c7', dark: '#5190f7' },
  pace: { light: '#4a4a4a', dark: '#c4c4c4' },
  stalled: { light: '#af293e', dark: '#e46360' },
  reading: { light: '#6b6b6b', dark: '#a8a8a8' },
})

/** Line path (scenario expr-n26): the accent is the hop the answer names; the others sit in ink steps. */
export const PATH_SERIES = defineSeries({
  culprit: { light: '#2871c7', dark: '#5190f7' },
  strong: { light: '#4a4a4a', dark: '#d4d4d4' },
  mid: { light: '#7a7a7a', dark: '#9c9c9c' },
  soft: { light: '#b0b0b0', dark: '#666666' },
})

/** Fitness trend (scenario expr-n22): the accent is resting heart rate; HRV sits in an ink step, the change threshold in a mid step. */
export const FITNESS_SERIES = defineSeries({
  rhr: { light: '#2871c7', dark: '#5190f7' },
  hrv: { light: '#262626', dark: '#e6e6e6' },
  limit: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Shipped Issues (scenario expr-n31): the accent is features; fixes and chores sit in ink steps, the deploy rule in an ink step. */
export const SHIP_SERIES = defineSeries({
  feat: { light: '#2871c7', dark: '#5190f7' },
  fix: { light: '#4a4a4a', dark: '#c4c4c4' },
  chore: { light: '#9a9a9a', dark: '#7d7d7d' },
  deploy: { light: '#262626', dark: '#e6e6e6' },
})

/** Household spending (scenario expr-n28): the accent is the category that moved most or is in focus; other categories and months sit in an ink step, the last complete month in a dark one, the partial month in a pale one. */
export const HOUSEHOLD_SERIES = defineSeries({
  mover: { light: '#2871c7', dark: '#5190f7' },
  rest: { light: '#6b6b6b', dark: '#a8a8a8' },
  partial: { light: '#b8b8b8', dark: '#5c5c5c' },
  october: { light: '#262626', dark: '#e6e6e6' },
})

/** Owner queue (scenario expr-n38): the accent is the decision, the kind that waits on a person; reviews sit in a dark ink step, chores in a pale one, the 24 h rule in a mid step. */
export const OWNER_SERIES = defineSeries({
  decision: { light: '#2871c7', dark: '#5190f7' },
  review: { light: '#4a4a4a', dark: '#d4d4d4' },
  chore: { light: '#9a9a9a', dark: '#7d7d7d' },
  rule: { light: '#6b6b6b', dark: '#a8a8a8' },
  soon: { light: '#c07e3c', dark: '#f9a13d' },
})

/** Harbour bar (scenario expr-n34): tide in the dark ink step, swell in a mid step; the two limits sit in rule steps, the go windows are the accent's tint. */
export const BAR_SERIES = defineSeries({
  tide: { light: '#262626', dark: '#e6e6e6' },
  swell: { light: '#7a7a7a', dark: '#9c9c9c' },
  need: { light: '#4a4a4a', dark: '#c4c4c4' },
  limit: { light: '#6b6b6b', dark: '#a8a8a8' },
})

/** Sprint (scenario expr-n37): the accent is the done work, from highlight; the other statuses sit in an ink step, the pace rule in a mid step. */
export const SPRINT_SERIES = defineSeries({
  points: { light: '#6b6b6b', dark: '#a8a8a8' },
  pace: { light: '#262626', dark: '#e6e6e6' },
})

/** Task list (scenario expr-n40): overdue takes the status red, the tasks due today the accent, later ones an ink step; in the weekly backlog the list that keeps growing takes the dark ink step and the other lists share a mid one, tasks done per day sit in a dark ink step and the today rule in the same one. */
export const TASK_SERIES = defineSeries({
  overdue: { light: '#af293e', dark: '#e46360' },
  today: { light: '#2871c7', dark: '#5190f7' },
  later: { light: '#7a7a7a', dark: '#9c9c9c' },
  grows: { light: '#262626', dark: '#e6e6e6' },
  lists: { light: '#6b6b6b', dark: '#a8a8a8' },
  done: { light: '#3d3d3d', dark: '#d4d4d4' },
  rule: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Router health (scenario expr-n42): the accent is memory, the load that rose before the drop; CPU sits in an ink step, the healthy limit in a mid step, the line events in the dark one. */
export const ROUTER_SERIES = defineSeries({
  memory: { light: '#2871c7', dark: '#5190f7' },
  cpu: { light: '#4a4a4a', dark: '#c4c4c4' },
  limit: { light: '#6b6b6b', dark: '#a8a8a8' },
  event: { light: '#262626', dark: '#e6e6e6' },
})

/** Night frost (scenario expr-n39): the accent is the one model that runs warm; the other two models sit in ink steps, the dew point in a pale step, the 0 °C rule in a mid step. */
export const FROST_SERIES = defineSeries({
  warm: { light: '#2871c7', dark: '#5190f7' },
  first: { light: '#262626', dark: '#e6e6e6' },
  second: { light: '#6b6b6b', dark: '#a8a8a8' },
  dew: { light: '#a3a3a3', dark: '#757575' },
  limit: { light: '#4a4a4a', dark: '#c4c4c4' },
})

/** Model router (scenario expr-n41): one ink step per model in the chart and the list; the accent is not a model colour. Each pair is `light-dark()` in both halves (cycle-expression-10: BarList paints only the light half while the scheme is auto-dark), which the browser resolves per scheme. */
export const SERVED_SERIES = defineSeries({
  atlasLarge: { light: 'light-dark(#262626, #ececec)', dark: 'light-dark(#262626, #ececec)' },
  atlasFast: { light: 'light-dark(#5c5c5c, #c4c4c4)', dark: 'light-dark(#5c5c5c, #c4c4c4)' },
  novaCode: { light: 'light-dark(#858585, #9a9a9a)', dark: 'light-dark(#858585, #9a9a9a)' },
  lumenEmbed: { light: 'light-dark(#adadad, #737373)', dark: 'light-dark(#adadad, #737373)' },
  lumenLite: { light: 'light-dark(#d6d6d6, #4a4a4a)', dark: 'light-dark(#d6d6d6, #4a4a4a)' },
})
