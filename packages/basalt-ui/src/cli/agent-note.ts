/**
 * The session note `init` and `sync` print when their run changed a file a coding agent reads at
 * session start: `.claude/`, the hook shim and the managed AGENTS.md. The note names no agent product
 * and no terminal, because the CLI detects neither. A run that changes none of them prints nothing.
 */
import { readdirSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { SHIM } from './lint/settings'
import { AGENTS_FILE } from './sync/engine'

export const SESSION_NOTE =
  'Agent sessions: a coding agent reads these files when its session starts. A session that was already running, the one that ran this command included, may still lack the new rules, skills and hook. If you are an agent: tell the user, finish or save what is in flight without committing, and continue in a new session before you write app code.'

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
    if (before.get(path) !== after.get(path)) return SESSION_NOTE
  }
  return null
}
