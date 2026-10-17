/**
 * `basalt-ui shot detect [--out <dir>] [--lint <oxlint-json-file>]` — the deterministic second
 * review pass: every [measured] item of the design reviewer, read from `metrics.json` with no model
 * in the loop, plus the `basalt/*` diagnostics of an `oxlint --format json` report.
 *
 * Severity (P0 = broken or unreadable, P1 = a rubric item fails, P2 = degraded, P3 = polish):
 *
 * | rule                         | layer   | severity                                          |
 * |-|-|-|
 * | scan/shot-error              | content | P0                                                |
 * | scan/no-anchors              | content | P0                                                |
 * | craft-5/contrast             | content | P0                                                |
 * | craft-5/assumed-backdrop     | content | P2                                                |
 * | craft-1/scale-error, -missing| layout  | P1                                                |
 * | craft-1/off-scale-inset, -gap| layout  | P1; P3 when every off value is within 1 px of a step |
 * | craft-3/empty-region         | layout  | P1                                                |
 * | craft-1/off-scale-radius     | style   | P1; P3 when every off value is within 1 px of a step |
 * | craft-1/nested-radius-step   | style   | P1                                                |
 * | craft-2/font-sizes           | style   | P1                                                |
 * | lint/basalt/<rule>           | style   | P1 for an error, P2 for a warning                 |
 *
 * P0 and P1 fail the run (exit 2); P2 and P3 are listed findings that do not (exit 0).
 * Findings run content → layout → style, the order the reviewer reports in.
 * Score = 100 − (25·P0 + 10·P1 + 3·P2 + 1·P3), floored at 0.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { PAGE_ANCHOR, SHOT_HOME } from './types'
import type { AnchorMetrics, Scale, ShotMetrics, Sides } from './types'

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'
export type Layer = 'content' | 'layout' | 'style'

export type Finding = {
  /** Stable id: `<craft-n | scan | lint>/<kebab-name>`. */
  rule: string
  severity: Severity
  layer: Layer
  /** The component (`data-shot` name), or the source file of a lint diagnostic. */
  anchor: string
  route?: string
  /** `<scheme>/<viewport>` of every render showing the defect. */
  where: string[]
  /** The file and field the defect is read from. */
  cite: string
  defect: string
}

/** The slice of an `oxlint --format json` report detect reads. */
export type LintReport = {
  diagnostics: {
    message?: string
    code?: string
    severity?: string
    filename?: string
    labels?: { span?: { line?: number; column?: number } }[]
  }[]
}

export type DetectDeps = {
  now?: () => Date
  log?: (line: string) => void
  /** The short HEAD hash for the history entry; undefined outside a git checkout. */
  commit?: (cwd: string) => string | undefined
}

export type HistoryEntry = {
  at: string
  out: string
  commit?: string
  counts: Record<Severity, number>
  score: number
}

const LAYERS: readonly Layer[] = ['content', 'layout', 'style']
const SEVERITIES: readonly Severity[] = ['P0', 'P1', 'P2', 'P3']
const WEIGHT: Record<Severity, number> = { P0: 25, P1: 10, P2: 3, P3: 1 }
const FONT_SIZE_LIMIT = 3
const EMPTY_LIMIT = 0.4
const NESTED_MIN_STEP_PX = 3
const POLISH_PX = 1
const TREND_RUNS = 5
const USAGE_LINE = 'usage: basalt-ui shot detect [--out <dir>] [--lint <oxlint-json-file>]'

class DetectError extends Error {}

export const scoreOf = (findings: readonly Finding[]): number =>
  Math.max(0, 100 - findings.reduce((sum, f) => sum + WEIGHT[f.severity], 0))

const countsOf = (findings: readonly Finding[]): Record<Severity, number> => ({
  P0: findings.filter((f) => f.severity === 'P0').length,
  P1: findings.filter((f) => f.severity === 'P1').length,
  P2: findings.filter((f) => f.severity === 'P2').length,
  P3: findings.filter((f) => f.severity === 'P3').length,
})

const where = (a: AnchorMetrics): string => `${a.scheme}/${a.viewport}`
const SIDE_NAMES: (keyof Sides)[] = ['top', 'right', 'bottom', 'left']

type Draft = Omit<Finding, 'where'> & { where: string }

/** Distance from `value` to the nearest step; 0 and `'full'` need no step. */
function offScale(value: number | 'full', steps: readonly number[]): number | null {
  if (value === 'full' || value === 0 || steps.length === 0) return null
  const nearest = Math.min(...steps.map((s) => Math.abs(s - value)))
  return nearest < 0.011 ? null : nearest
}

const stepsText = (steps: Record<string, number>): string =>
  [...new Set(Object.values(steps))].sort((a, b) => a - b).join(', ')

/** P1, or P3 when every off value is a rounding away from a step. */
const sizing = (distances: number[]): Severity =>
  distances.every((d) => d <= POLISH_PX) ? 'P3' : 'P1'

function craftOne(a: AnchorMetrics, scale: Scale | undefined): Draft[] {
  if (!scale) return []
  const base = { anchor: a.name, route: a.route, where: where(a) }
  const out: Draft[] = []
  const spacing = Object.values(scale.spacing)
  const radii = Object.values(scale.radius)

  const inset = SIDE_NAMES.map((side) => ({ side, v: a.padding[side] })).flatMap(({ side, v }) => {
    const d = offScale(v, spacing)
    return d === null ? [] : [{ side, v, d }]
  })
  if (inset.length > 0) {
    out.push({
      ...base,
      rule: 'craft-1/off-scale-inset',
      severity: sizing(inset.map((i) => i.d)),
      layer: 'layout',
      cite: `metrics.json anchors[${a.name} ${where(a)}].padding`,
      defect: `Padding ${inset.map((i) => `${i.side} ${i.v}px`).join(', ')} is not a spacing step (${stepsText(scale.spacing)}).`,
    })
  }

  const gap = (['row', 'column'] as const).flatMap((axis) => {
    const d = offScale(a.gap[axis], spacing)
    return d === null ? [] : [{ axis, v: a.gap[axis], d }]
  })
  if (gap.length > 0) {
    out.push({
      ...base,
      rule: 'craft-1/off-scale-gap',
      severity: sizing(gap.map((g) => g.d)),
      layer: 'layout',
      cite: `metrics.json anchors[${a.name} ${where(a)}].gap`,
      defect: `Gap ${gap.map((g) => `${g.axis} ${g.v}px`).join(', ')} is not a spacing step (${stepsText(scale.spacing)}).`,
    })
  }

  const radius = offScale(a.radius, radii)
  if (radius !== null) {
    out.push({
      ...base,
      rule: 'craft-1/off-scale-radius',
      severity: sizing([radius]),
      layer: 'style',
      cite: `metrics.json anchors[${a.name} ${where(a)}].radius`,
      defect: `Radius ${String(a.radius)}px is not a radius step (${stepsText(scale.radius)}).`,
    })
  }
  return out
}

/** Each nested surface against its nearest painted ancestor (the longest path prefix), else the anchor. */
function nestedRadius(a: AnchorMetrics): Draft[] {
  const out: Draft[] = []
  for (const child of a.nested) {
    const parent = a.nested
      .filter((n) => n !== child && child.path.startsWith(`${n.path} > `))
      .sort((x, y) => y.path.length - x.path.length)[0]
    const parentRadius = parent ? parent.radius : a.radius
    if (typeof parentRadius !== 'number' || typeof child.radius !== 'number') continue
    if (parentRadius === 0 || child.radius === 0) continue
    if (Math.abs(parentRadius - child.radius) >= NESTED_MIN_STEP_PX) continue
    out.push({
      rule: 'craft-1/nested-radius-step',
      severity: 'P1',
      layer: 'style',
      anchor: a.name,
      route: a.route,
      where: where(a),
      cite: `metrics.json anchors[${a.name} ${where(a)}].nested[${child.path}]`,
      defect: `Nested surface radius ${child.radius}px is within ${NESTED_MIN_STEP_PX}px of its parent's ${parentRadius}px.`,
    })
  }
  return out
}

function anchorFindings(a: AnchorMetrics, scale: Scale | undefined): Draft[] {
  const base = { anchor: a.name, route: a.route, where: where(a) }
  const cite = (field: string): string => `metrics.json anchors[${a.name} ${where(a)}].${field}`
  const out: Draft[] = [...craftOne(a, scale), ...nestedRadius(a)]
  const sizes = new Set(a.fontSizes)
  if (sizes.size > FONT_SIZE_LIMIT) {
    out.push({
      ...base,
      rule: 'craft-2/font-sizes',
      severity: 'P1',
      layer: 'style',
      cite: cite('fontSizes'),
      defect: `${sizes.size} distinct font sizes (${[...sizes].sort((x, y) => x - y).join(', ')}px); the limit is ${FONT_SIZE_LIMIT}.`,
    })
  }
  if (a.emptyRatio >= EMPTY_LIMIT) {
    out.push({
      ...base,
      rule: 'craft-3/empty-region',
      severity: 'P1',
      layer: 'layout',
      cite: cite('emptyRatio'),
      defect: `${Math.round(a.emptyRatio * 100)}% of the component's height is an empty region; the limit is ${EMPTY_LIMIT * 100}%.`,
    })
  }
  const failures = a.contrast.failures
  if (failures.length > 0) {
    const worst = failures.reduce((lo, f) => (f.ratio < lo.ratio ? f : lo))
    out.push({
      ...base,
      rule: 'craft-5/contrast',
      severity: 'P0',
      layer: 'content',
      cite: cite('contrast.failures'),
      defect: `${failures.length} text run${failures.length === 1 ? '' : 's'} below the AA contrast threshold; lowest ${worst.ratio}:1 on "${worst.text}" (${worst.fontSize}px).`,
    })
  }
  if (a.contrast.backdrop === 'assumed-white') {
    out.push({
      ...base,
      rule: 'craft-5/assumed-backdrop',
      severity: 'P2',
      layer: 'content',
      cite: cite('contrast.backdrop'),
      defect:
        'Some text sat on no opaque background and white was assumed, so its contrast is unproven.',
    })
  }
  return out
}

function lintFindings(report: LintReport): Draft[] {
  return report.diagnostics.flatMap((d) => {
    const id = /^basalt\((.+)\)$/.exec(d.code ?? '')?.[1]
    if (!id) return []
    const span = d.labels?.[0]?.span
    const file = d.filename ?? '?'
    return [
      {
        rule: `lint/basalt/${id}`,
        severity: d.severity === 'error' ? 'P1' : 'P2',
        layer: 'style',
        anchor: file,
        where: '',
        cite: `${file}:${span?.line ?? 0}:${span?.column ?? 0}`,
        defect: d.message ?? `basalt/${id}`,
      } satisfies Draft,
    ]
  })
}

/** Every deterministic finding of one round, grouped across scheme × viewport, content → layout → style. */
export function detectFindings(m: ShotMetrics, lint?: LintReport): Finding[] {
  const drafts: Draft[] = []
  const scan = { layer: 'content', where: '' } as const
  if (m.anchors.length === 0) {
    drafts.push({
      ...scan,
      rule: 'scan/no-anchors',
      severity: 'P0',
      anchor: '—',
      cite: 'metrics.json anchors',
      defect: 'The round measured no component: no data-shot anchor rendered.',
    })
  }
  for (const s of m.shots) {
    if (s.status !== 'error') continue
    drafts.push({
      ...scan,
      rule: 'scan/shot-error',
      severity: 'P0',
      anchor: s.name === PAGE_ANCHOR ? `${PAGE_ANCHOR} (full page)` : s.name,
      route: s.route,
      where: `${s.scheme}/${s.viewport}/${s.state}`,
      cite: `metrics.json shots[${s.name} ${s.scheme}/${s.viewport}/${s.state}]`,
      defect: `The shot failed${s.note ? `: ${s.note}` : ''}.`,
    })
  }
  if (m.scaleError || m.scale.length === 0) {
    drafts.push({
      ...scan,
      layer: 'layout',
      rule: 'craft-1/scale-error',
      severity: 'P1',
      anchor: '—',
      cite: 'metrics.json scale',
      defect: `The theme scale was not read${m.scaleError ? ` (${m.scaleError})` : ''}, so Craft 1 is unverified.`,
    })
  }
  for (const a of m.anchors) {
    const scale = m.scale.find((s) => s.scheme === a.scheme && s.viewport === a.viewport)
    if (!scale && m.scale.length > 0) {
      drafts.push({
        rule: 'craft-1/scale-missing',
        severity: 'P1',
        layer: 'layout',
        anchor: a.name,
        route: a.route,
        where: where(a),
        cite: `metrics.json scale[${where(a)}]`,
        defect: `No theme scale was read for ${where(a)}, so Craft 1 is unverified there.`,
      })
    }
    drafts.push(...anchorFindings(a, scale))
  }
  if (lint) drafts.push(...lintFindings(lint))

  const grouped = new Map<string, Finding>()
  for (const d of drafts) {
    const key = [
      d.rule,
      d.route ?? '',
      d.anchor,
      d.cite.replace(/ (light|dark)\/(desktop|mobile)/, ''),
      d.defect,
    ].join('|')
    const hit = grouped.get(key)
    if (hit) {
      if (d.where && !hit.where.includes(d.where)) hit.where.push(d.where)
    } else {
      grouped.set(key, { ...d, where: d.where ? [d.where] : [] })
    }
  }
  return [...grouped.values()].sort(
    (x, y) =>
      LAYERS.indexOf(x.layer) - LAYERS.indexOf(y.layer) ||
      SEVERITIES.indexOf(x.severity) - SEVERITIES.indexOf(y.severity),
  )
}

function readJson(path: string, what: string): unknown {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    throw new DetectError(`${what} ${path} is unreadable: ${(error as Error).message}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new DetectError(`${what} ${path} is not valid JSON`)
  }
}

function readMetrics(path: string): ShotMetrics {
  const m = readJson(path, 'metrics.json') as Partial<ShotMetrics> | null
  if (!m || m.version !== 1 || !Array.isArray(m.anchors) || !Array.isArray(m.shots)) {
    throw new DetectError(
      `metrics.json ${path} is not a shot output (version 1 with anchors and shots)`,
    )
  }
  return { ...m, scale: Array.isArray(m.scale) ? m.scale : [] } as ShotMetrics
}

function readLint(path: string): LintReport {
  const report = readJson(path, '--lint file') as Partial<LintReport> | null
  if (!report || !Array.isArray(report.diagnostics)) {
    throw new DetectError(
      `--lint file ${path} is not an oxlint JSON report (no "diagnostics" array)`,
    )
  }
  return report as LintReport
}

/** The out dir to read: `--out`, else the last run's (`last.json`), else the default. */
function outDirOf(cwd: string, out: string | undefined): string {
  if (out) return resolve(cwd, out)
  const last = join(cwd, SHOT_HOME, 'last.json')
  try {
    const named = (JSON.parse(readFileSync(last, 'utf8')) as { out?: unknown }).out
    if (typeof named === 'string' && named) return resolve(cwd, named)
  } catch {
    // No last run recorded: the default dir.
  }
  return join(cwd, SHOT_HOME, 'latest')
}

const gitHead = (cwd: string): string | undefined => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return undefined
  }
}

/** Runs an fs step; any I/O failure becomes a clean `DetectError`. */
function io<T>(what: string, step: () => T): T {
  try {
    return step()
  } catch (error) {
    throw new DetectError(
      `cannot ${what}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * The runs on record plus `entry`. A history that is not an array of runs is moved to
 * `history.json.bak` (never overwritten in place) and a new one starts.
 */
function nextHistory(
  path: string,
  entry: HistoryEntry,
  log: (line: string) => void,
): HistoryEntry[] {
  if (!existsSync(path)) return [entry]
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(parsed)) throw new TypeError('not an array')
    return [...(parsed as HistoryEntry[]), entry]
  } catch {
    io(`move the unreadable ${path} aside`, () => renameSync(path, `${path}.bak`))
    log(`[detect] ${path} was unreadable; kept as history.json.bak, starting a new history`)
    return [entry]
  }
}

/**
 * Writes `detect.json` and `history.json` through temp files and renames both only after both are
 * written, so a failed write never leaves one without the other. Returns the last scores.
 */
function persist(
  files: { detectPath: string; report: object; home: string; entry: HistoryEntry },
  log: (line: string) => void,
): number[] {
  const { detectPath, report, home, entry } = files
  const historyPath = join(home, 'history.json')
  return io('write detect.json or history.json', () => {
    mkdirSync(home, { recursive: true })
    if (!existsSync(join(home, '.gitignore'))) writeFileSync(join(home, '.gitignore'), '*\n')
    const runs = nextHistory(historyPath, entry, log)
    const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'
    writeFileSync(`${historyPath}.tmp`, json(runs))
    writeFileSync(`${detectPath}.tmp`, json(report))
    renameSync(`${historyPath}.tmp`, historyPath)
    renameSync(`${detectPath}.tmp`, detectPath)
    return runs.slice(-TREND_RUNS).map((r) => r.score)
  })
}

const compactWhere = (w: string[]): string => (w.length >= 4 ? 'all' : w.join(','))

/** A compact, plain-text table: severity, rule, component, where, defect. */
function table(findings: readonly Finding[]): string[] {
  const rows = findings.map((f) => [
    f.severity,
    f.rule,
    f.route ? `${f.route} ${f.anchor}` : f.anchor,
    compactWhere(f.where),
    f.defect,
  ])
  const widths = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => (r[i] ?? '').length)))
  return rows.map((r) =>
    r
      .map((cell, i) => (i < 4 ? cell.padEnd(widths[i] ?? 0) : cell))
      .join('  ')
      .trimEnd(),
  )
}

/** `shot detect`: exit 0 (none, or only P2/P3), 2 on a P0/P1 finding, 1 scan failure. */
export async function detect(
  flags: readonly string[],
  cwd: string,
  deps: DetectDeps = {},
): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line))
  try {
    let values: { out?: string | undefined; lint?: string | undefined }
    try {
      values = parseArgs({
        args: [...flags],
        options: { out: { type: 'string' }, lint: { type: 'string' } },
        strict: true,
      }).values
    } catch (error) {
      throw new DetectError(
        `${error instanceof Error ? error.message : String(error)}\n${USAGE_LINE}`,
      )
    }
    const outDir = outDirOf(cwd, values.out)
    const metrics = readMetrics(join(outDir, 'metrics.json'))
    const lint = values.lint ? readLint(resolve(cwd, values.lint)) : undefined
    const findings = detectFindings(metrics, lint)
    const counts = countsOf(findings)
    const score = scoreOf(findings)
    const at = (deps.now ?? (() => new Date()))().toISOString()
    const rel = relative(cwd, outDir)
    const out = rel === '' || rel.startsWith('..') || isAbsolute(rel) ? outDir : rel
    const commit = (deps.commit ?? gitHead)(cwd)
    const trend = persist(
      {
        detectPath: join(outDir, 'detect.json'),
        report: { version: 1, at, out, ...(commit && { commit }), counts, score, findings },
        home: join(cwd, SHOT_HOME),
        entry: { at, out, ...(commit && { commit }), counts, score },
      },
      log,
    )
    const summary = SEVERITIES.filter((s) => counts[s] > 0)
      .map((s) => `${s} ${counts[s]}`)
      .join(', ')
    log(
      `[detect] ${findings.length === 0 ? 'no findings' : `${findings.length} findings (${summary})`} · score ${score}`,
    )
    for (const line of table(findings)) log(line)
    log(`[detect] trend ${trend.join(' → ')} · ${relative(cwd, join(outDir, 'detect.json'))}`)
    return counts.P0 + counts.P1 > 0 ? 2 : 0
  } catch (error) {
    if (!(error instanceof DetectError)) throw error
    console.error(`basalt-ui shot detect: ${error.message}`)
    return 1
  }
}
