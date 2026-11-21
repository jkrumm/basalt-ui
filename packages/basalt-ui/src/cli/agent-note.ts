/**
 * The session note `init` and `sync` print when their run changed a file a coding agent reads at
 * session start: `.claude/`, the hook shim and the managed AGENTS.md. The note names no agent product
 * and no terminal, because the CLI detects neither. A run that changes none of them prints nothing.
 */
import { readdirSync, statSync } from 'node:fs'
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

const stamp = (path: string): string | null => {
  try {
    const info = statSync(path)
    return info.isFile() ? `${info.size}:${info.mtimeMs}` : null
  } catch {
    return null
  }
}

function walk(dir: string, skip: string, out: AgentFiles): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (path !== skip) walk(path, skip, out)
      continue
    }
    const value = entry.isFile() ? stamp(path) : null
    if (value !== null) out.set(path, value)
  }
}

/** The agent-read files under each base directory (the install root, and its repo root when a sibling). */
export function agentFiles(bases: readonly string[]): AgentFiles {
  const out: AgentFiles = new Map()
  for (const base of new Set(bases)) {
    walk(join(base, '.claude'), join(base, WORKTREES), out)
    for (const rel of [SHIM, AGENTS_FILE]) {
      const path = join(base, rel)
      const value = stamp(path)
      if (value !== null) out.set(path, value)
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
