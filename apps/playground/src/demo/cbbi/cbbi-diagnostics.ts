/**
 * Per-metric TRUST, computed at runtime from the series alone — the data half of the panel's
 * `Diagnostics` section and of its `Presets`.
 *
 * The whole point is that nothing here knows a cycle date, a top, a bottom or a verdict. Every
 * number falls out of {@link peerMedian}: on any day, the median of the OTHER eight metrics is a
 * cycle-position estimate that does not involve the metric being judged, so "does this metric agree
 * with its peers when they agree with each other" is answerable without labels. The offline study
 * behind the thresholds is `ANALYSIS.md` §3 and its closing "What the runtime should implement";
 * the numbers below are that list, not a re-derivation of it.
 *
 * The one thing to hold while reading a verdict: **this measures trust, not accuracy.** §4 of the
 * analysis shows every weighting separating tops from bottoms within 0.02, so dropping a broken
 * metric does not buy a better forecast — it buys an index that only averages inputs the reader
 * still believes.
 */
import { CBBI_METRIC_KEYS } from './cbbi-data'
import type { CbbiMetricKey, CbbiRow } from './cbbi-data'

/** A peer median at or above this reads as "the other eight agree a top is near". */
export const CONSENSUS_TOP = 0.85
/** A metric at or above this is "firing" — the threshold TPR and FA are measured at. */
export const METRIC_FIRING = 0.8
/** A metric at or above this is "hot" — the threshold the noisy heuristic counts. */
export const METRIC_HOT = 0.9
/** Four years of daily rows — one halving cycle, the window every rate below is measured over. */
export const DIAGNOSTIC_WINDOW = 1461
/** Below this many consensus days in the window, J is noise and the verdict is `insufficient`. */
export const MIN_CONSENSUS_DAYS = 60
/** `J < 0.50` is broken. The nearest non-flagged metric sits at 0.67, so the gap is 0.37 wide. */
export const BROKEN_J = 0.5
/** Two missing days at the series end is a publication lag worth stating, not a death. */
export const STALE_TAIL = 2
/**
 * Three missing readings in the trailing 90 days is the second staleness signal.
 *
 * Three, not one: at 90 days a SINGLE missing reading is 1.1%, so a 1% floor made every one-day
 * publication lag `stale` and left {@link STALE_TAIL}'s two-day tolerance unreachable. The tail and
 * the share now say different things — a lag at the END versus scattered gaps across the window —
 * and Woobull still flags on the tail (2 missing, 2.2% share) without the share firing on a lag.
 */
export const STALE_NULL_SHARE = 0.03
/** The trailing window the null share is measured over. */
export const NULL_SHARE_DAYS = 90
/** Hot this often relative to its own lifetime rate and the metric reads high by habit. */
export const NOISY_MULTIPLE = 3

/**
 * The median of the OTHER eight metrics that day — the peer consensus a metric is judged against.
 * `null` when no peer has a reading (the first days of the series).
 */
export function peerMedian(row: CbbiRow, key: CbbiMetricKey): number | null {
  const peers: number[] = []
  for (const other of CBBI_METRIC_KEYS) {
    if (other === key) continue
    const value = row.metrics[other]
    if (value === null || !Number.isFinite(value)) continue
    peers.push(value)
  }
  if (peers.length === 0) return null
  peers.sort((a, b) => a - b)
  return medianOfSorted(peers)
}

/** Median of an ASCENDING array. Even lengths take the mean of the two middle values. */
function medianOfSorted(sorted: readonly number[]): number {
  const mid = sorted.length >> 1
  const high = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return high
  return (high + (sorted[mid - 1] ?? high)) / 2
}

export type MetricVerdict = 'ok' | 'broken' | 'stale' | 'noisy' | 'insufficient'

export type MetricHealth = {
  readonly key: CbbiMetricKey
  /** `P(v ≥ 0.80 | peer consensus)` over the window. */
  readonly tpr: number
  /** `P(v ≥ 0.80 | no peer consensus)` over the window — the false-alarm rate. */
  readonly fa: number
  /** Youden's J, `tpr − fa`. Reported for EVERY verdict, including `stale`. */
  readonly j: number
  /** How many window days carried both a reading and a peer consensus. */
  readonly consensusDays: number
  /** Consecutive missing readings at the END of the series. */
  readonly nullTail: number
  /** Share of missing readings across the trailing {@link NULL_SHARE_DAYS} days. */
  readonly nullShare90: number
  /** Share of window readings at or above {@link METRIC_HOT}. */
  readonly hotShareWindow: number
  /** The same share across the whole series — what the window one is compared against. */
  readonly hotShareAll: number
  readonly verdict: MetricVerdict
  /** One line, carrying the numbers the verdict was reached on. Rendered as the row's hint. */
  readonly reason: string
}

/**
 * One metric's health.
 *
 * **`stale` is evaluated first and separately from `broken`, deliberately** — Woobull carries the
 * best J of all nine AND a two-day null tail, so folding the two into one badge would either hide a
 * publication gap or slander the strongest metric. The verdict states the staleness; `j` stays in
 * the record so the panel can print both.
 *
 * `insufficient` outranks `broken` for the same reason in the other direction: under 60 consensus
 * days a J of 0.1 is a sample-size artefact, not a finding.
 *
 * Priority: `stale` > `insufficient` > `broken` > `noisy` > `ok`.
 */
export function metricHealth(
  rows: readonly CbbiRow[],
  key: CbbiMetricKey,
  options?: { readonly window?: number },
): MetricHealth {
  const window = options?.window ?? DIAGNOSTIC_WINDOW
  const windowRows = rows.slice(Math.max(0, rows.length - window))

  let consensusDays = 0
  let hits = 0
  let quietDays = 0
  let falseAlarms = 0
  let hotWindow = 0
  let finiteWindow = 0

  for (const row of windowRows) {
    const value = row.metrics[key]
    if (value === null) continue
    finiteWindow += 1
    if (value >= METRIC_HOT) hotWindow += 1
    const peer = peerMedian(row, key)
    if (peer === null) continue
    if (peer >= CONSENSUS_TOP) {
      consensusDays += 1
      if (value >= METRIC_FIRING) hits += 1
    } else {
      quietDays += 1
      if (value >= METRIC_FIRING) falseAlarms += 1
    }
  }

  let hotAll = 0
  let finiteAll = 0
  for (const row of rows) {
    const value = row.metrics[key]
    if (value === null) continue
    finiteAll += 1
    if (value >= METRIC_HOT) hotAll += 1
  }

  let nullTail = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]?.metrics[key] !== null) break
    nullTail += 1
  }

  const tailRows = rows.slice(Math.max(0, rows.length - NULL_SHARE_DAYS))
  const missing = tailRows.reduce((count, row) => count + (row.metrics[key] === null ? 1 : 0), 0)
  const nullShare90 = tailRows.length === 0 ? 0 : missing / tailRows.length

  const tpr = consensusDays === 0 ? 0 : hits / consensusDays
  const fa = quietDays === 0 ? 0 : falseAlarms / quietDays
  const j = tpr - fa
  const hotShareWindow = finiteWindow === 0 ? 0 : hotWindow / finiteWindow
  const hotShareAll = finiteAll === 0 ? 0 : hotAll / finiteAll

  const verdict = resolveVerdict({
    j,
    consensusDays,
    nullTail,
    nullShare90,
    hotShareWindow,
    hotShareAll,
  })

  return {
    key,
    tpr,
    fa,
    j,
    consensusDays,
    nullTail,
    nullShare90,
    hotShareWindow,
    hotShareAll,
    verdict,
    reason: reasonFor(verdict, {
      key,
      tpr,
      fa,
      j,
      consensusDays,
      nullTail,
      nullShare90,
      hotShareWindow,
      hotShareAll,
      window,
    }),
  }
}

type VerdictInputs = {
  readonly j: number
  readonly consensusDays: number
  readonly nullTail: number
  readonly nullShare90: number
  readonly hotShareWindow: number
  readonly hotShareAll: number
}

function resolveVerdict(input: VerdictInputs): MetricVerdict {
  if (input.nullTail >= STALE_TAIL || input.nullShare90 >= STALE_NULL_SHARE) return 'stale'
  if (input.consensusDays < MIN_CONSENSUS_DAYS) return 'insufficient'
  if (input.j < BROKEN_J) return 'broken'
  if (input.hotShareAll > 0 && input.hotShareWindow > NOISY_MULTIPLE * input.hotShareAll) {
    return 'noisy'
  }
  return 'ok'
}

/** `0.233` → `23%`. One decimal below 10% so a 2.2% null share does not read as 2%. */
function share(value: number): string {
  const percent = value * 100
  return `${percent >= 10 ? Math.round(percent) : percent.toFixed(1)}%`
}

function reasonFor(
  verdict: MetricVerdict,
  input: VerdictInputs & {
    readonly key: CbbiMetricKey
    readonly tpr: number
    readonly fa: number
    readonly window: number
  },
): string {
  const j = `J ${input.j.toFixed(2)}`
  const discrimination = `fires on ${share(input.tpr)} of consensus tops and ${share(input.fa)} of other days`
  if (verdict === 'stale') {
    return `${input.nullTail} missing reading(s) at the series end, ${share(input.nullShare90)} of the last ${NULL_SHARE_DAYS} days — ${j} otherwise.`
  }
  if (verdict === 'insufficient') {
    return `Only ${input.consensusDays} consensus days in the last ${input.window} — under ${MIN_CONSENSUS_DAYS}, so ${j} says nothing yet.`
  }
  if (verdict === 'broken') {
    return `Barely separates: ${discrimination} — ${j}, under the ${BROKEN_J.toFixed(2)} floor.`
  }
  if (verdict === 'noisy') {
    return `Reads ≥${METRIC_HOT} on ${share(input.hotShareWindow)} of the last ${input.window} days against ${share(input.hotShareAll)} lifetime — ${j}, so noisy rather than broken.`
  }
  return `Separates cleanly: ${discrimination} — ${j}.`
}

/** Every metric's health in one record — what the panel renders and the suggestions read. */
export function diagnoseAll(
  rows: readonly CbbiRow[],
  options?: { readonly window?: number },
): Record<CbbiMetricKey, MetricHealth> {
  const out = {} as Record<CbbiMetricKey, MetricHealth>
  for (const key of CBBI_METRIC_KEYS) out[key] = metricHealth(rows, key, options ?? {})
  return out
}

// ── Presets ──────────────────────────────────────────────────────────────────────────────────────

export type CbbiPresetKey = 'official' | 'upstream' | 'data' | 'peak' | 'bottom'

export type CbbiPreset = {
  readonly key: CbbiPresetKey
  readonly label: string
  readonly hint: string
  /** A weight of `0` means DISABLED — the metric leaves the selection rather than contributing 0. */
  readonly weights: Record<CbbiMetricKey, number>
}

/** The nine weights in `CBBI_METRICS` order — the shape `ANALYSIS.md` §4's table is written in. */
function vector(values: readonly number[]): Record<CbbiMetricKey, number> {
  const out = {} as Record<CbbiMetricKey, number>
  CBBI_METRIC_KEYS.forEach((key, index) => {
    out[key] = values[index] ?? 0
  })
  return out
}

/**
 * The five compositions from `ANALYSIS.md` §4, verbatim.
 *
 * Their separation spans 0.88–0.90 and their median top-lag 96–101 days, so none of them forecasts
 * better than another — the only material difference is TODAY's reading, which moves 0.34–0.47 as
 * the distrusted metrics drop out. That is what a preset is for.
 */
export const CBBI_PRESETS: readonly CbbiPreset[] = [
  {
    key: 'official',
    label: 'Official',
    hint: 'All nine at weight 1 — reproduces the published index exactly.',
    weights: vector([1, 1, 1, 1, 1, 1, 1, 1, 1]),
  },
  {
    key: 'upstream',
    label: 'Upstream five',
    hint: 'The five metrics the upstream config keeps: RUPL, RHODL, Puell, 2YMA, MVRV.',
    weights: vector([0, 1, 1, 1, 1, 0, 1, 0, 0]),
  },
  {
    key: 'data',
    label: 'Data-driven',
    hint: 'Weighted by measured separation, with the two flagged metrics dropped.',
    weights: vector([0, 2, 2, 1.75, 1.75, 0, 2, 2, 2]),
  },
  {
    key: 'peak',
    label: 'Peak-sensitive',
    hint: 'Weighted by how high each metric reads at cycle tops.',
    weights: vector([0.25, 2, 1.5, 1.75, 2, 0.5, 2, 1.25, 1.25]),
  },
  {
    key: 'bottom',
    label: 'Bottom-sensitive',
    hint: 'Weighted by how low each metric reads at cycle bottoms.',
    weights: vector([1.25, 1.25, 2, 0.25, 1.75, 1.5, 2, 2, 1.25]),
  },
]

/**
 * Which preset the current composition IS, or `null`.
 *
 * A preset's `0` means "not in the selection", so a disabled metric's WEIGHT is not compared — only
 * its absence. Anything enabled has to match the vector exactly.
 */
export function activePreset(
  weights: Record<CbbiMetricKey, number>,
  enabled: ReadonlySet<CbbiMetricKey>,
): CbbiPresetKey | null {
  for (const preset of CBBI_PRESETS) {
    let matches = true
    for (const key of CBBI_METRIC_KEYS) {
      const target = preset.weights[key]
      if (target === 0) {
        if (enabled.has(key)) matches = false
      } else if (!enabled.has(key) || weights[key] !== target) {
        matches = false
      }
      if (!matches) break
    }
    if (matches) return preset.key
  }
  return null
}
