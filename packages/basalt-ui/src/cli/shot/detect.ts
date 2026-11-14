/**
 * `basalt-ui shot detect [--out <dir>] [--lint <oxlint-json-file>]` — the deterministic floor under
 * the design reviewer: the [measured] items, read from `metrics.json` with no model in the loop,
 * plus the `basalt/*` diagnostics of an `oxlint --format json` report. Contrast is axe's, not read.
 *
 * Severity (P0 = broken, P1 = a rubric item fails, P2 = degraded, P3 = polish). P0 and P1 fail the
 * run (exit 2); P2 and P3 are listed (exit 0). Findings run content → layout → style.
 *
 * | rule                            | layer   | severity                                    |
 * |-|-|-|
 * | scan/shot-error, scan/no-anchors| content | P0                                          |
 * | craft-7/states-ignored          | content | P1                                          |
 * | craft-1/scale-error             | layout  | P1                                          |
 * | craft-1/off-scale-inset, -gap   | layout  | P1; P3 when every off value is within 1 px  |
 * | craft-3/empty-region            | layout  | P1                                          |
 * | craft-6/overlap, -hit-floor, -document-overflow | layout | P1                      |
 * | craft-1/off-scale-radius        | style   | P1; P3 within 1 px (never a nested one)     |
 * | craft-1/nested-radius-step      | style   | P1                                          |
 * | craft-2/font-sizes              | style   | P1                                          |
 * | lint/basalt/<rule>              | style   | P1 for an error, P2 for a warning           |
 *
 * Score = 100 − (25·P0 + 10·P1 + 3·P2 + 1·P3), floored at 0; null when no anchor resolved.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { LAST_SHOT, PAGE_ANCHOR } from './types'
import type { AnchorMetrics, Scale, ShotMetrics, Sides } from './types'

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'
export type Layer = 'content' | 'layout' | 'style'

export type Finding = {
  /** Stable id: `<craft-n | scan | lint>/<kebab-name>`. */
  rule: string
  severity: Severity
  layer: Layer
  /** The component (anchor name), or the source file of a lint diagnostic. */
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

export type DetectDeps = { now?: () => Date; log?: (line: string) => void }

const LAYERS: readonly Layer[] = ['content', 'layout', 'style']
const SEVERITIES: readonly Severity[] = ['P0', 'P1', 'P2', 'P3']
const WEIGHT: Record<Severity, number> = { P0: 25, P1: 10, P2: 3, P3: 1 }
const FONT_SIZE_LIMIT = 3
const EMPTY_LIMIT = 0.4
const NESTED_MIN_STEP_PX = 3
const POLISH_PX = 1
const USAGE_LINE = 'usage: basalt-ui shot detect [--out <dir>] [--lint <oxlint-json-file>]'

class DetectError extends Error {}

export const scoreOf = (findings: readonly Finding[]): number =>
  Math.max(0, 100 - findings.reduce((sum, f) => sum + WEIGHT[f.severity], 0))

const countsOf = (findings: readonly Finding[]): Record<Severity, number> =>
  Object.fromEntries(
    SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]),
  ) as Record<Severity, number>

const where = (a: { scheme: string; viewport: string }): string => `${a.scheme}/${a.viewport}`
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

/** The findings of one measured anchor in one scheme × viewport. */
function anchorFindings(a: AnchorMetrics, scale: Scale | undefined): Draft[] {
  const base = { anchor: a.name, route: a.route, where: where(a) }
  const cite = (field: string): string => `metrics.json anchors[${a.name} ${where(a)}].${field}`
  const out: Draft[] = []
  const add = (rule: string, severity: Severity, layer: Layer, field: string, defect: string) =>
    out.push({ ...base, rule, severity, layer, cite: cite(field), defect })

  if (scale) {
    const sides = SIDE_NAMES.map((side) => ({ at: side, v: a.padding[side], nested: false }))
    const gaps = (['row', 'column'] as const).map((axis) => ({
      at: axis,
      v: a.gap[axis],
      nested: false,
    }))
    const radii = [
      { at: '', v: a.radius, nested: false },
      ...a.nested.map((n) => ({ at: `nested ${n.path}`, v: n.radius, nested: true })),
    ]
    const groups = [
      ['inset', 'layout', 'Padding', 'padding', scale.spacing, sides],
      ['gap', 'layout', 'Gap', 'gap', scale.spacing, gaps],
      ['radius', 'style', 'Radius', 'radius', scale.radius, radii],
    ] as const
    for (const [rule, layer, label, field, steps, items] of groups) {
      const off = items.flatMap(({ at, v, nested }) => {
        const d = offScale(v, Object.values(steps))
        return d === null ? [] : [{ at, v, d, nested }]
      })
      if (off.length === 0) continue
      const polish = off.every((o) => o.d <= POLISH_PX)
      add(
        `craft-1/off-scale-${rule}`,
        off.some((o) => o.nested) || !polish ? 'P1' : 'P3',
        layer,
        field,
        `${label} ${off.map((o) => `${o.at} ${o.v}px`.trim()).join(', ')} is not a ${steps === scale.radius ? 'radius' : 'spacing'} step (${stepsText(steps)}).`,
      )
    }
  }
  // Each nested surface against its nearest painted ancestor (the longest path prefix), else the anchor.
  for (const child of a.nested) {
    const parent = a.nested
      .filter((n) => n !== child && child.path.startsWith(`${n.path} > `))
      .sort((x, y) => y.path.length - x.path.length)[0]
    const parentRadius = parent ? parent.radius : a.radius
    if (typeof parentRadius !== 'number' || typeof child.radius !== 'number') continue
    if (parentRadius === 0 || child.radius === 0) continue
    if (Math.abs(parentRadius - child.radius) >= NESTED_MIN_STEP_PX) continue
    add(
      'craft-1/nested-radius-step',
      'P1',
      'style',
      `nested[${child.path}]`,
      `Nested surface radius ${child.radius}px is within ${NESTED_MIN_STEP_PX}px of its parent's ${parentRadius}px.`,
    )
  }
  const sizes = [...new Set(a.fontSizes)]
  if (sizes.length > FONT_SIZE_LIMIT)
    add(
      'craft-2/font-sizes',
      'P1',
      'style',
      'fontSizes',
      `${sizes.length} distinct font sizes (${sizes.sort((x, y) => x - y).join(', ')}px); the limit is ${FONT_SIZE_LIMIT}.`,
    )
  if (a.emptyRatio >= EMPTY_LIMIT)
    add(
      'craft-3/empty-region',
      'P1',
      'layout',
      'emptyRatio',
      `${Math.round(a.emptyRatio * 100)}% of the component's height is an empty region; the limit is ${EMPTY_LIMIT * 100}%.`,
    )
  const listed = (items: string[]): string =>
    `${items.slice(0, 3).join('; ')}${items.length > 3 ? '; …' : ''}`
  const [overlaps, small] = [a.overlaps ?? [], a.small ?? []]
  if (overlaps.length > 0)
    add(
      'craft-6/overlap',
      'P1',
      'layout',
      'overlaps',
      `Text boxes cover each other: ${listed(overlaps)}.`,
    )
  if (small.length > 0)
    add(
      'craft-6/hit-floor',
      'P1',
      'layout',
      'small',
      `Controls under the 24 px hit floor: ${listed(small)}.`,
    )
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
  if (m.anchors.length === 0)
    drafts.push({
      ...scan,
      rule: 'scan/no-anchors',
      severity: 'P0',
      anchor: '—',
      cite: 'metrics.json anchors',
      defect: 'The round measured no component: no anchor rendered.',
    })
  for (const s of m.shots) {
    const at = `${s.name} ${s.scheme}/${s.viewport}/${s.state}`
    if (s.status === 'error')
      drafts.push({
        ...scan,
        rule: 'scan/shot-error',
        severity: 'P0',
        anchor: s.name === PAGE_ANCHOR ? `${PAGE_ANCHOR} (full page)` : s.name,
        route: s.route,
        where: `${s.scheme}/${s.viewport}/${s.state}`,
        cite: `metrics.json shots[${at}]`,
        defect: `The shot failed${s.note ? `: ${s.note}` : ''}.`,
      })
    if (s.ignored)
      drafts.push({
        ...scan,
        rule: 'craft-7/states-ignored',
        severity: 'P1',
        anchor: s.name,
        route: s.route,
        where: `${s.scheme}/${s.viewport}`,
        cite: `metrics.json shots[${at}].ignored`,
        defect: `The ${s.state} crop is identical to the ready crop: the page ignored ?shot-state=${s.state}, so the state was never scored.`,
      })
  }
  for (const p of m.pages ?? [])
    if (p.overflowX > 0)
      drafts.push({
        ...scan,
        layer: 'layout',
        rule: 'craft-6/document-overflow',
        severity: 'P1',
        anchor: PAGE_ANCHOR,
        route: p.route,
        where: where(p),
        cite: `metrics.json pages[${p.route} ${where(p)}].overflowX`,
        defect: `The document is ${p.overflowX}px wider than the viewport.`,
      })
  if (m.scaleError || m.scale.length === 0)
    drafts.push({
      ...scan,
      layer: 'layout',
      rule: 'craft-1/scale-error',
      severity: 'P1',
      anchor: '—',
      cite: 'metrics.json scale',
      defect: `The theme scale was not read${m.scaleError ? ` (${m.scaleError})` : ''}, so Craft 1 is unverified.`,
    })
  for (const a of m.anchors)
    drafts.push(
      ...anchorFindings(
        a,
        m.scale.find(
          (s) =>
            s.scheme === a.scheme && s.viewport === a.viewport && (s.route ?? a.route) === a.route,
        ),
      ),
    )
  if (lint) drafts.push(...lintFindings(lint))

  const grouped = new Map<string, Finding>()
  for (const d of drafts) {
    const key = [d.rule, d.route ?? '', d.anchor, d.cite.replace(/ \S+\/\S+/, ''), d.defect].join(
      '|',
    )
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
  if (!m || m.version !== 1 || !Array.isArray(m.anchors) || !Array.isArray(m.shots))
    throw new DetectError(
      `metrics.json ${path} is not a shot output (version 1 with anchors and shots)`,
    )
  return { ...m, scale: Array.isArray(m.scale) ? m.scale : [] } as ShotMetrics
}

function readLint(path: string): LintReport {
  const report = readJson(path, '--lint file') as Partial<LintReport> | null
  if (!report || !Array.isArray(report.diagnostics))
    throw new DetectError(
      `--lint file ${path} is not an oxlint JSON report (no "diagnostics" array)`,
    )
  return report as LintReport
}

/** The out dir to read: `--out`, else the last round's (`.basalt/last-shot.json`). */
function outDirOf(cwd: string, out: string | undefined): string {
  if (out) return resolve(cwd, out)
  const named = (readJson(join(cwd, LAST_SHOT), LAST_SHOT) as { out?: unknown } | null)?.out
  if (typeof named !== 'string' || !named) throw new DetectError(`${LAST_SHOT} names no out dir`)
  return resolve(cwd, named)
}

/** A compact, plain-text table: severity, rule, component, where, defect. */
function table(findings: readonly Finding[]): string[] {
  const rows = findings.map((f) => [
    f.severity,
    f.rule,
    f.route ? `${f.route} ${f.anchor}` : f.anchor,
    f.where.length >= 4 ? 'all' : f.where.join(','),
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
      const parsed = parseArgs({
        args: [...flags],
        options: { out: { type: 'string' }, lint: { type: 'string' } },
        allowPositionals: true,
      })
      const [positional] = parsed.positionals
      if (positional !== undefined)
        throw new DetectError(
          `detect takes --out <dir>, not a positional ('${positional}'): basalt-ui shot detect --out ${positional}`,
        )
      values = parsed.values
    } catch (error) {
      throw new DetectError(
        `${error instanceof Error ? error.message : String(error)}\n${USAGE_LINE}`,
      )
    }
    const outDir = outDirOf(cwd, values.out)
    const metrics = readMetrics(join(outDir, 'metrics.json'))
    const findings = detectFindings(
      metrics,
      values.lint ? readLint(resolve(cwd, values.lint)) : undefined,
    )
    const counts = countsOf(findings)
    const score = metrics.anchors.length === 0 ? null : scoreOf(findings)
    const at = (deps.now ?? (() => new Date()))().toISOString()
    const rel = relative(cwd, join(outDir, 'detect.json'))
    try {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(
        join(outDir, 'detect.json'),
        JSON.stringify(
          { version: 1, at, out: relative(cwd, outDir), counts, score, findings },
          null,
          2,
        ) + '\n',
      )
    } catch (error) {
      throw new DetectError(
        `cannot write ${rel}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const summary = SEVERITIES.filter((s) => counts[s] > 0)
      .map((s) => `${s} ${counts[s]}`)
      .join(', ')
    log(
      `[detect] ${findings.length === 0 ? 'no findings' : `${findings.length} findings (${summary})`} · ${score === null ? 'nothing measured (no anchor resolved: not a score)' : `score ${score}`} · ${rel}`,
    )
    for (const line of table(findings)) log(line)
    return counts.P0 + counts.P1 > 0 ? 2 : 0
  } catch (error) {
    if (!(error instanceof DetectError)) throw error
    console.error(`basalt-ui shot detect: ${error.message}`)
    return 1
  }
}
