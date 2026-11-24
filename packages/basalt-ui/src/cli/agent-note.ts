/**
 * The session note `init` and `sync` print when their run changed a file a coding agent reads:
 * `.claude/`, the hook shim and the managed AGENTS.md. It says what already reaches a running session
 * (the path-scoped rules, the edit hook) and what does not (skills, the reviewer agent), and how an
 * agent that cannot start a new session works without them. It names no agent product and no
 * terminal, because the CLI detects neither. A run that changes none of them prints nothing.
 */
import { readdirSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { SHIM } from './lint/settings'
import { AGENTS_FILE } from './sync/engine'

/** The `basalt-*` entries of `<base>/<dir>` that hold `file(name)`, as `<dir>/<file>`. */
function under(base: string, dir: string, file: (name: string) => string | null): string[] {
  try {
    return readdirSync(join(base, dir))
      .filter((name) => name.startsWith('basalt-'))
      .flatMap((name) => {
        const rel = file(name)
        return rel !== null && statOf(join(base, dir, rel)) !== null ? [join(dir, rel)] : []
      })
      .toSorted()
  } catch {
    return []
  }
}

const listed = (paths: string[]): string =>
  paths.length === 0 ? '(none placed)' : paths.join(', ')

/** The placed skill and agent files, install-relative, so the note can name each one. */
function placed(bases: readonly string[]): { skills: string[]; agents: string[] } {
  const skills = new Set<string>()
  const agents = new Set<string>()
  for (const base of new Set(bases)) {
    for (const p of under(base, '.claude/skills', (n) => join(n, 'SKILL.md'))) skills.add(p)
    for (const p of under(base, '.claude/agents', (n) => (n.endsWith('.md') ? n : null)))
      agents.add(p)
  }
  return { skills: [...skills], agents: [...agents] }
}

/** The note's first line: what a running session already has and what it lacks. */
export const SESSION_NOTE =
  'Agent sessions: a running session, the one that ran this command included, already has the path-scoped rules (.claude/rules, read when a file under a root is opened) and the edit hook (.basalt/hook.mjs). Skills and the reviewer agent load only when a session starts.'

/** The note: what is live now, what loads only at session start, and the way on without a restart. */
export function sessionNoteText(bases: readonly string[]): string {
  const { skills, agents } = placed(bases)
  return [
    SESSION_NOTE,
    'An agent that cannot start a new session goes on in this one: read the SKILL.md of each skill the task needs (' +
      listed(skills) +
      '), run `basalt-ui lint --changed` after each edit, and run the reviewer by handing its file (' +
      listed(agents) +
      ') to a general-purpose agent as its prompt.',
  ].join('\n')
}

/**
 * The `size:mtime` stamp of each agent-read file, by absolute path. A write always moves the mtime, and
 * `init` and `sync` write only what differs, so a stamp tells a change without reading the bytes. That
 * needs an mtime finer than a second (APFS and ext4 keep one): on a coarser filesystem a same-size rewrite
 * within the same second would go unseen.
 */
export type AgentFiles = Map<string, string>

/** `.claude/worktrees` holds other checkouts of this repo, not this install. */
const WORKTREES = join('.claude', 'worktrees')

/** Follows links: a symlinked rule or directory is stamped as what it points at. Null when absent or broken. */
const statOf = (path: string) => {
  try {
    return statSync(path)
  } catch {
    return null
  }
}

const realOf = (path: string): string | null => {
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

/** Stamps the regular files under `dir`. A directory is entered once by its real path, so a link cycle ends. */
function walk(dir: string, skip: string, seen: Set<string>, out: AgentFiles): void {
  const real = realOf(dir)
  if (real === null || seen.has(real)) return
  seen.add(real)
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    const path = join(dir, name)
    const info = statOf(path)
    if (info === null) continue
    if (info.isDirectory()) {
      if (path !== skip) walk(path, skip, seen, out)
    } else if (info.isFile()) {
      out.set(path, `${info.size}:${info.mtimeMs}`)
    }
  }
}

/** The agent-read files under each base directory (the install root, and its repo root when a sibling). */
export function agentFiles(bases: readonly string[]): AgentFiles {
  const out: AgentFiles = new Map()
  for (const base of new Set(bases)) {
    walk(join(base, '.claude'), join(base, WORKTREES), new Set(), out)
    for (const rel of [SHIM, AGENTS_FILE]) {
      const path = join(base, rel)
      const info = statOf(path)
      if (info !== null && info.isFile()) out.set(path, `${info.size}:${info.mtimeMs}`)
    }
  }
  return out
}

/** The session note when any agent-read file was written, changed or removed since `before`; null otherwise. */
export function sessionNote(before: AgentFiles, bases: readonly string[]): string | null {
  const after = agentFiles(bases)
  const paths = new Set([...before.keys(), ...after.keys()])
  for (const path of paths) {
    if (before.get(path) !== after.get(path)) return sessionNoteText(bases)
  }
  return null
}
