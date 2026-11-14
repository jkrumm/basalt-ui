/**
 * `lint --hook <post-edit|stop|pre-edit>`: what the managed shim runs (skills-agent-layer 4.2,
 * guardrails section 8). The event JSON arrives on stdin; the answer is the exit code. Exit 2 blocks
 * and its stderr reaches the model: a finding list for `post-edit` and `stop`, a denial for
 * `pre-edit`. Every other failure is the shim's to turn into exit 2 with a fix line, so nothing
 * here may fail open: a thrown error is caught by the caller and exits 2 as well.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

import { OXLINT_PRESET_FILE, STYLELINT_PRESET_FILE } from '../presets'
import { parseJsonc } from '../source-text'
import { changedFiles, isScanned, scan } from './engine'
import type { Finding, Project } from './engine'
import { SETTINGS_PATH, SHIM } from './settings'

export const HOOK_EVENTS = ['post-edit', 'stop', 'pre-edit'] as const
export type HookEventName = (typeof HOOK_EVENTS)[number]

/** The fields of the Claude Code event this verb reads. */
export type HookInput = {
  cwd?: unknown
  session_id?: unknown
  stop_hook_active?: unknown
  tool_input?: {
    file_path?: unknown
    content?: unknown
    old_string?: unknown
    new_string?: unknown
  } & {
    replace_all?: unknown
    edits?: unknown
  }
}

/** What reaches the model: at most this many finding lines and characters. */
const MAX_LINES = 10
const MAX_CHARS = 2000

const posix = (path: string): string => path.replaceAll('\\', '/')

export function findingLine(f: Finding): string {
  return `${f.file}:${f.line} ${f.id}: ${f.message}`
}

/** The capped finding text: ten lines, 2,000 characters, and a count of what was left out. */
export function capFindings(findings: readonly Finding[]): string {
  const lines = findings.map(findingLine)
  const more =
    lines.length > MAX_LINES ? `\n…and ${lines.length - MAX_LINES} more; run basalt-ui lint.` : ''
  return `${lines.slice(0, MAX_LINES).join('\n')}${more}`.slice(0, MAX_CHARS)
}

function report(findings: readonly Finding[]): number {
  if (findings.length === 0) return 0
  console.error(capFindings(findings))
  return 2
}

/** The path with symlinks resolved (macOS temp dirs are one); a file not written yet resolves through its directory. */
function real(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    const dir = dirname(path)
    return dir === path ? path : join(real(dir), basename(path))
  }
}

/** The edited file as an install-relative path, or null when the event names none inside the project. */
function editedFile(project: Project, input: HookInput): { abs: string; rel: string } | null {
  const file = input.tool_input?.file_path
  if (typeof file !== 'string' || file === '') return null
  const base = typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : project.root
  const abs = real(isAbsolute(file) ? file : resolve(base, file))
  const rel = posix(relative(real(project.root), abs))
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? null : { abs, rel }
}

function postEdit(project: Project, input: HookInput): number {
  const edited = editedFile(project, input)
  if (edited === null || !existsSync(edited.abs) || !isScanned(project, edited.rel)) return 0
  return report(scan(project, [edited.rel]))
}

/** The Stop counter: one block per session, kept beside the temp files the OS clears. */
function stopCounter(project: Project, session: string): string {
  const key = createHash('sha256').update(`${project.root}\0${session}`).digest('hex').slice(0, 16)
  return join(tmpdir(), `basalt-stop-${key}`)
}

/**
 * Stop: re-check what changed, at most once per session. `stop_hook_active` is the per-turn bound;
 * the counter is the ceiling, and with no `session_id` there is nothing to key it on, so it never blocks.
 */
function stop(project: Project, input: HookInput): number {
  const session = input.session_id
  if (input.stop_hook_active === true || typeof session !== 'string' || session === '') return 0
  const counter = stopCounter(project, session)
  if (existsSync(counter)) return 0
  const findings = scan(project, changedFiles(project))
  if (findings.length === 0) return 0
  writeFileSync(counter, '1')
  return report(findings)
}

// ── pre-edit ────────────────────────────────────────────────────────────────────────────────────

/** The file's text after the tool call, or null when it cannot be told (a missing file, no old string). */
function after(current: string | null, input: NonNullable<HookInput['tool_input']>): string | null {
  if (typeof input.content === 'string') return input.content
  const apply = (text: string, edit: Record<string, unknown>): string | null => {
    const { old_string: from, new_string: to, replace_all: all } = edit
    if (typeof from !== 'string' || typeof to !== 'string' || !text.includes(from)) return null
    return all === true ? text.replaceAll(from, () => to) : text.replace(from, () => to)
  }
  if (current === null) return null
  const edits = Array.isArray(input.edits) ? (input.edits as Record<string, unknown>[]) : [input]
  let text: string | null = current
  for (const edit of edits) {
    if (text === null) return null
    text = apply(text, edit)
  }
  return text
}

const MANAGED_ID = /^(?:basalt|shadcn)\//

/** Managed rule ids set by hand in `rules` or any `overrides[].rules` of an oxlint config text. */
function managedIds(text: string): Set<string> {
  const config = parseJsonc(text)
  const tables = [
    config?.['rules'],
    ...(Array.isArray(config?.['overrides'])
      ? config['overrides'].map((o: { rules?: unknown }) => o?.rules)
      : []),
  ]
  return new Set(
    tables.flatMap((t) =>
      typeof t === 'object' && t !== null ? Object.keys(t).filter((id) => MANAGED_ID.test(id)) : [],
    ),
  )
}

const count = (text: string, needle: string): number => text.split(needle).length - 1
const MANAGED_CLAUDE = /^\.claude\/(?:rules|skills|agents)\/basalt-/

/** The reason an edit of `rel` is denied, or null: the paths and entries the guard cannot do without. */
function denial(
  project: Project,
  rel: string,
  next: string | null,
  current: string | null,
): string | null {
  if (rel === '.basalt' || rel.startsWith('.basalt/')) {
    return ".basalt/** is basalt-ui's ledger and shim; change it with `basalt-ui sync` or `basalt-ui eject <name> --reason`, never by hand."
  }
  if (MANAGED_CLAUDE.test(rel) || Object.hasOwn(project.manifest?.managed ?? {}, rel)) {
    return `${rel} is managed by basalt-ui; \`basalt-ui sync\` rewrites it. Eject the part (\`basalt-ui eject <name> --reason\`) to change it.`
  }
  if (rel === OXLINT_PRESET_FILE || rel === STYLELINT_PRESET_FILE) {
    return `${rel} is generated by \`basalt-ui sync\`. Waive one finding with a reasoned directive instead.`
  }
  if (
    rel === SETTINGS_PATH &&
    current !== null &&
    next !== null &&
    count(next, SHIM) < count(current, SHIM)
  ) {
    return `this edit removes a basalt hook entry from ${SETTINGS_PATH}; \`basalt-ui sync\` keeps it in place.`
  }
  if (/^\.oxlintrc\.jsonc?$/.test(rel) && next !== null) {
    const before = current === null ? new Set<string>() : managedIds(current)
    const added = [...managedIds(next)].filter((id) => !before.has(id))
    if (added.length > 0) {
      return `${rel} would set the managed rule ${added.join(', ')} by hand; waive with \`// oxlint-disable-next-line <id> -- <why>\` on the line.`
    }
  }
  return null
}

function preEdit(project: Project, input: HookInput): number {
  const edited = editedFile(project, input)
  if (edited === null) return 0
  const current = existsSync(edited.abs) ? readFileSync(edited.abs, 'utf8') : null
  const next = after(current, input.tool_input ?? {})
  const why = denial(project, edited.rel, next, current)
  if (why === null) return 0
  console.error(`basalt hook: denied. ${why}`)
  return 2
}

/** Runs one hook event; the caller turns a throw into exit 2. */
export function runHookEvent(event: HookEventName, project: Project, input: HookInput): number {
  if (event === 'post-edit') return postEdit(project, input)
  if (event === 'stop') return stop(project, input)
  return preEdit(project, input)
}
