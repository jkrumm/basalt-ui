/**
 * The session note `init` and `sync` print when their run changed a file a coding agent reads at
 * session start: `.claude/`, the hook shim and the managed AGENTS.md. The note names no agent product
 * and no terminal, because the CLI detects neither. A run that changes none of them prints nothing.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SHIM } from './lint/settings'
import { AGENTS_FILE } from './sync/engine'

export const SESSION_NOTE =
  'Agent sessions: a coding agent reads these files when its session starts. A session that was already running, the one that ran this command included, may still lack the new rules, skills and hook. If you are an agent: tell the user, commit or finish what is in flight, and continue in a new session before you write app code.'

/** The bytes of each agent-read file, by absolute path. */
export type AgentFiles = Map<string, string>

/** `.claude/worktrees` holds other checkouts of this repo, not this install. */
const WORKTREES = join('.claude', 'worktrees')

const readText = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8')
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
    const text = entry.isFile() ? readText(path) : null
    if (text !== null) out.set(path, text)
  }
}

/** The agent-read files under each base directory (the install root, and its repo root when a sibling). */
export function agentFiles(bases: readonly string[]): AgentFiles {
  const out: AgentFiles = new Map()
  for (const base of new Set(bases)) {
    walk(join(base, '.claude'), join(base, WORKTREES), out)
    for (const rel of [SHIM, AGENTS_FILE]) {
      const path = join(base, rel)
      const text = readText(path)
      if (text !== null) out.set(path, text)
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
