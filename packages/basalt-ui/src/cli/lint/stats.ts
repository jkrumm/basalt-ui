/**
 * What `lint --stats` counts and what the ceilings compare (guardrails section 9): reasoned waivers,
 * the four `.custom` escapes and the ejects. A directive counts once, except a file-level one in a
 * `deepRender` file, which counts as the findings it suppresses: oxlint 1.93 has no switch to
 * ignore inline directives, so the directive is blanked in a sibling copy and the copy is re-linted.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, basename, join, resolve } from 'node:path'

import { countRows, rowsOfRoot } from '../eject/ledger'
import { JS_FILE, runOxlint, STYLE_FILE } from './engine'
import type { Finding, Project } from './engine'

const MANAGED_ID = /^(?:basalt|shadcn)\//
const DIRECTIVE = /(?:\/\/|\/\*)\s*(oxlint|stylelint)-disable(-next-line|-line)?(?=\s)([^\n]*)/g
const ESCAPE = /\b(?:col|chart|field|filterSlot)\.custom\b/g

export type Counts = { waivers: number; escapes: number; ejects: number }
export type Tally = Record<string, number>

export type Stats = {
  scanned: number
  findings: Finding[]
  counts: Counts
  /** Per rule id: findings, reasoned waivers and escapes by name. */
  perFinding: Tally
  perWaiver: Tally
  perEscape: Tally
}

const bump = (tally: Tally, key: string, by = 1): void => {
  tally[key] = (tally[key] ?? 0) + by
}

/** The ids a directive names: the text before the `--` reason or the comment close. */
function directiveIds(tail: string): string[] {
  const head = tail.split('--')[0]?.split('*/')[0] ?? ''
  return head.split(/[\s,]+/).filter((id) => id !== '')
}

type Directive = { tool: string; kind: string; ids: string[]; text: string; at: number }

function directivesOf(text: string): Directive[] {
  return [...text.matchAll(DIRECTIVE)].map((m) => ({
    tool: m[1] ?? '',
    kind: m[2] ?? '',
    ids: directiveIds(m[3] ?? ''),
    text: m[0],
    at: m.index,
  }))
}

/** Findings of `ids` in a copy of `rel` with `blank` spaced out: what the directive was holding back. */
function suppressedBy(project: Project, rel: string, text: string, blank: Directive): number {
  const start = blank.at
  const closeAt = text.indexOf('*/', start)
  const spanEnd = closeAt === -1 ? start + blank.text.length : closeAt + 2
  // Spaces keep every offset and line, so the re-lint reports the same positions.
  const copy = `${text.slice(0, start)}${text.slice(start, spanEnd).replace(/[^\n]/g, ' ')}${text.slice(spanEnd)}`
  const sibling = join(dirname(rel), `${basename(rel, extname(rel))}.basalt-recount${extname(rel)}`)
  const abs = resolve(project.root, sibling)
  if (existsSync(abs)) return 0
  try {
    writeFileSync(abs, copy, 'utf8')
    return runOxlint(project, [sibling]).filter((f) => blank.ids.includes(f.id)).length
  } finally {
    rmSync(abs, { force: true })
  }
}

/** Reasoned waivers and escapes over `files`, with the per-rule split. */
export function countSource(
  project: Project,
  files: readonly string[],
): { waivers: number; escapes: number; perWaiver: Tally; perEscape: Tally } {
  const deepRender = new Set(project.manifest?.deepRender ?? [])
  const perWaiver: Tally = {}
  const perEscape: Tally = {}
  let waivers = 0
  let escapes = 0
  for (const rel of files) {
    const text = readFileSync(resolve(project.root, rel), 'utf8')
    for (const name of text.match(ESCAPE) ?? []) {
      escapes += 1
      bump(perEscape, name)
    }
    const tool = JS_FILE.test(rel) ? 'oxlint' : STYLE_FILE.test(rel) ? 'stylelint' : null
    if (tool === null) continue
    for (const d of directivesOf(text)) {
      const ids = d.ids.filter((id) => (tool === 'oxlint' ? MANAGED_ID.test(id) : id !== ''))
      if (d.tool !== tool || ids.length === 0) continue
      const fileLevel = tool === 'oxlint' && d.kind === '' && deepRender.has(rel)
      const weight = fileLevel ? suppressedBy(project, rel, text, { ...d, ids }) : 1
      waivers += weight
      for (const id of ids) bump(perWaiver, id, fileLevel ? weight : 1)
    }
  }
  return { waivers, escapes, perWaiver, perEscape }
}

/** The largest per-root eject count: the ceiling is per root, like `doctor` check 11. */
export function countEjects(project: Project): number {
  const { manifest } = project
  if (manifest === null) return 0
  return Math.max(
    0,
    ...project.roots.map(([root]) => countRows(rowsOfRoot(manifest, root).rows).ejects),
  )
}

export function tallyFindings(findings: readonly Finding[]): Tally {
  const tally: Tally = {}
  for (const f of findings) bump(tally, f.id)
  return tally
}

const list = (tally: Tally): string =>
  Object.entries(tally)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([id, n]) => `${id} ${n}`)
    .join(', ')

/** The `--stats` report: one line per figure, ceilings alongside when the budget reads. */
export function formatStats(
  stats: Stats,
  ceilings: Partial<Record<keyof Counts, number>>,
): string[] {
  const of = (key: keyof Counts): string =>
    ceilings[key] === undefined ? '' : ` of ${ceilings[key]}`
  const detail = (tally: Tally): string =>
    Object.keys(tally).length === 0 ? '' : ` (${list(tally)})`
  return [
    `findings: ${stats.findings.length}${detail(stats.perFinding)}`,
    `waivers: ${stats.counts.waivers}${of('waivers')}${detail(stats.perWaiver)}`,
    `escapes: ${stats.counts.escapes}${of('escapes')}${detail(stats.perEscape)}`,
    `ejects: ${stats.counts.ejects}${of('ejects')}`,
  ]
}
