/**
 * `lint [--file p | --changed | --stats [--write-budget]] [--agent] [--hook <event>]`
 * (docs/v3/concepts/skills-agent-layer.md 4.1): oxlint, stylelint and `checkTokens` over the declared
 * roots, then the `.basalt/budget.json` ceilings. Plain output exits 1 on a finding; `--agent` is
 * terse and exits 2 so a hook blocks; `--hook` reads the event JSON on stdin, is called only by the
 * managed shim and is exempt from the unknown-flag exit 1, because a hook that exits 1 reads as a pass.
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import {
  BUDGET_PATH,
  countBreaches,
  countedFigure,
  followWaivers,
  landBudget,
  LINT_RAISABLE,
  raiseCeiling,
  raiseCommand,
  readBudget,
} from '../budget'
import type { LintRaisable } from '../budget'
import { noteRelocation, resolveProjectDir } from '../index'
import { installAllCommand } from '../package-manager'
import { changedFiles, defaultBaseRef, inRoots, loadProject, rootFiles, scan } from './engine'
import type { Finding, Project } from './engine'
import { capFindings, HOOK_EVENTS, runHookEvent } from './hook'
import type { HookEventName, HookInput } from './hook'
import { countEjects, countSource, formatStats, tallyFindings } from './stats'
import type { Counts, Stats } from './stats'

export const LINT_OPTIONS = {
  file: { type: 'string', multiple: true },
  agent: { type: 'boolean' },
  changed: { type: 'boolean' },
  stats: { type: 'boolean' },
  'write-budget': { type: 'boolean' },
  raise: { type: 'string' },
  consumer: { type: 'string' },
  hook: { type: 'string' },
} as const

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** True when argv asks for hook mode, in either spelling. */
export const isHookCall = (flags: readonly string[]): boolean =>
  flags.some((f) => f === '--hook' || f.startsWith('--hook='))

/** The hook entry: every failure is exit 2 with a line naming the fix, never a pass. */
function lintHook(flags: readonly string[], cwd: string): number {
  const fix = `Run ${installAllCommand(cwd)}, then basalt-ui doctor.`
  const fail = (why: string): number => (console.error(`basalt hook: ${why}. ${fix}`), 2)
  let event: string | undefined
  try {
    event = parseArgs({ args: [...flags], options: LINT_OPTIONS, strict: true }).values.hook
  } catch (error) {
    return fail((error as Error).message.replace(/\.$/, ''))
  }
  if (event === undefined || !(HOOK_EVENTS as readonly string[]).includes(event)) {
    return fail(`unknown event "${event ?? ''}" (expected ${HOOK_EVENTS.join(', ')})`)
  }
  try {
    const input = JSON.parse(readFileSync(0, 'utf8')) as HookInput
    const project = loadProject(resolveProjectDir(cwd).dir)
    if ('error' in project) return fail(project.error)
    return runHookEvent(event as HookEventName, project, input)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

/** The install-relative path of a `--file` argument, or why it is not a scannable file. */
function fileArg(project: Project, cwd: string, file: string): { rel: string } | { error: string } {
  const rel = relative(project.root, isAbsolute(file) ? file : resolve(cwd, file)).replaceAll(
    '\\',
    '/',
  )
  return rel.startsWith('..') || !inRoots(project, rel)
    ? {
        error: `${file} is not under a declared root (${project.roots.map(([r]) => r).join(', ')})`,
      }
    : { rel }
}

/** The counted figures a ceiling compares, over every file of a full scan. */
function countAll(project: Project, files: readonly string[], findings: readonly Finding[]): Stats {
  const source = countSource(project, files)
  const counts: Counts = {
    waivers: source.waivers,
    escapes: source.escapes,
    ejects: countEjects(project),
  }
  return {
    scanned: files.length,
    findings: [...findings],
    counts,
    perFinding: tallyFindings(findings),
    perWaiver: source.perWaiver,
    perEscape: source.perEscape,
  }
}

export function lint(flags: readonly string[], invocationCwd: string): number {
  if (isHookCall(flags)) return lintHook(flags, invocationCwd)
  const fail = (why: string): number => (console.error(`✖ basalt-ui lint: ${why}`), 1)
  const { values } = parseArgs({ args: [...flags], options: LINT_OPTIONS, strict: true })
  const files = values.file ?? []
  const wantsStats = values.stats === true
  if (values['write-budget'] === true && !wantsStats) return fail('--write-budget needs --stats')
  const raising = values.raise !== undefined
  if (values.consumer !== undefined && !raising) return fail('--consumer needs --raise <field>')
  if (raising && (wantsStats || files.length > 0 || values.changed === true)) {
    return fail('--raise counts the whole install; drop --stats, --file and --changed')
  }
  if (wantsStats && (files.length > 0 || values.changed === true)) {
    return fail('--stats counts the whole install; drop --file and --changed')
  }
  if (files.length > 0 && values.changed === true)
    return fail('--file and --changed are alternatives')

  const resolved = resolveProjectDir(invocationCwd)
  noteRelocation('lint', resolved)
  const project = loadProject(resolved.dir)
  if ('error' in project) return fail(project.error)

  if (raising) return raise(project, values.raise, values.consumer)

  const partial = files.length > 0 || values.changed === true
  let targets: string[]
  if (files.length > 0) {
    const args = files.map((f) => fileArg(project, resolved.dir, f))
    const bad = args.find((a) => 'error' in a)
    if (bad !== undefined && 'error' in bad) return fail(bad.error)
    targets = args.flatMap((a) => ('rel' in a ? [a.rel] : []))
  } else {
    try {
      targets = values.changed === true ? changedFiles(project) : rootFiles(project)
    } catch (error) {
      return fail((error as Error).message)
    }
  }
  const agent = values.agent === true
  const say = agent ? console.error : console.log
  if (!agent)
    say(`scanned ${plural(targets.length, 'file')} in ${project.roots.map(([r]) => r).join(', ')}`)
  if (targets.length === 0 && values.changed !== true) {
    return fail(
      `scanned 0 files: declare the source roots (\`roots\` in .basalt/manifest.json, or "basalt": { "roots": [...] } in package.json) and check they hold code`,
    )
  }

  let findings: Finding[]
  try {
    findings = scan(project, targets)
  } catch (error) {
    return fail(`${(error as Error).message}`)
  }
  if (findings.length > 0)
    say(
      agent
        ? capFindings(findings)
        : findings.map((f) => `${f.file}:${f.line} ${f.id}: ${f.message}`).join('\n'),
    )

  const code = findings.length > 0 ? (agent ? 2 : 1) : 0
  if (partial) return code

  // A full scan also answers to the ceilings; an install with no manifest has no ledger to read.
  const stats = countAll(project, targets, findings)
  const budget = project.manifest === null ? null : readBudget(project.root)
  const ceilings = budget !== null && 'budget' in budget ? budget.budget : {}
  if (wantsStats) {
    for (const line of formatStats(stats, ceilings)) say(line)
    if (values['write-budget'] === true) return writeBudget(project, stats.counts)
  }
  if (budget !== null && 'error' in budget) return fail(budget.error)
  const followed = budget === null ? null : followWaivers(project.root, stats.counts.waivers)
  if (followed !== null) {
    say(
      `${BUDGET_PATH}: waivers ${followed.from} -> ${followed.to}, recorded (the waiver count is a record: commit it, the diff shows the change)`,
    )
  }
  const breaches = budget === null ? [] : countBreaches(budget.budget, stats.counts)
  for (const b of breaches) {
    say(
      `${countedFigure(b.name, b.count)} above the ceiling ${b.ceiling} in ${BUDGET_PATH}; remove ${b.name}, or raise it with ${raiseCommand(b.name)}`,
    )
  }
  if (breaches.length > 0) return 1
  if (wantsStats) return 0
  if (code === 0 && !agent)
    say(`✓ basalt-ui lint: no findings in ${plural(targets.length, 'file')}.`)
  return code
}

/** `--stats --write-budget`: the counted waivers and escapes land through `landBudget`, the one writer. */
function writeBudget(project: Project, counts: Counts): number {
  const landed = landBudget({
    counts: { waivers: counts.waivers, escapes: counts.escapes },
    baseRef: defaultBaseRef(project),
    dir: project.root,
  })
  if ('error' in landed) return (console.error(`✖ basalt-ui lint: ${landed.error}`), 1)
  console.log(`wrote ${BUDGET_PATH}: waivers ${counts.waivers}, escapes ${counts.escapes}`)
  return 0
}

/**
 * `--raise <field> --consumer "<who>"`: lifts the `waivers` or `escapes` ceiling to the counted
 * figure and records one raises row naming the consumer; `ejects` has its own raise on `eject`. */
function raise(project: Project, field: string | undefined, consumer: string | undefined): number {
  const fail = (why: string): number => (console.error(`✖ basalt-ui lint: ${why}`), 1)
  if (field === 'ejects') return fail(`ejects go up with ${raiseCommand('ejects')}`)
  if (field === 'waivers') {
    return fail('waivers has no ceiling to raise: a full `basalt-ui lint` records the count')
  }
  if (!(LINT_RAISABLE as readonly string[]).includes(field ?? '')) {
    return fail(`--raise takes ${LINT_RAISABLE.join(' or ')}, got "${field ?? ''}"`)
  }
  if (consumer === undefined) {
    return fail(
      `--raise ${field} needs --consumer "<named consumer>": who needs the higher ceiling`,
    )
  }
  let files: string[]
  try {
    files = rootFiles(project)
  } catch (error) {
    return fail((error as Error).message)
  }
  const count = countSource(project, files)[field as LintRaisable]
  const raised = raiseCeiling({ field: field as LintRaisable, count, consumer, dir: project.root })
  if ('error' in raised) return fail(raised.error)
  console.log(`raised ${field} to ${count} in ${BUDGET_PATH} for ${consumer.trim()}`)
  return 0
}
