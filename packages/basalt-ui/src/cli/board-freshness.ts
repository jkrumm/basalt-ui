// Doctor's design-loop section: the stale-board notice and the optional-Playwright probe. A leaf:
// imports nothing from `./index`. Stat-walk only — never reads a file body, never throws.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const LAST_SHOT = join('.basalt', 'shots', 'last.json')
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.git', '.basalt'])
const UI_FILE = /\.(tsx|css)$/
/** Directories plus UI files visited before the walk gives up; other files are free, so a big non-UI tree cannot pin the notice on. */
const WALK_CAP = 5000

export const BOARD_NOTICE =
  'UI changed since the last board — run basalt-ui shot <routes> and the basalt-design-reviewer (/basalt-design)'
export const PLAYWRIGHT_INSTALL = 'bun add -d playwright && bunx playwright install chromium'

/** `newest`: latest UI mtime in ms, null when none. `truncated`: the cap hit, so `newest` may be stale. */
type Walk = { newest: number | null; truncated: boolean }

function mtimeOf(path: string): number | null {
  try {
    return statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? null
  } catch {
    return null
  }
}

function walkUi(cwd: string, roots: string[], cap: number): Walk {
  const walk: Walk = { newest: null, truncated: false }
  const stack = roots.map((root) => resolve(cwd, root))
  let visited = 0
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop()) {
    if (++visited > cap) return { ...walk, truncated: true }
    let entries: Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch (error) {
      // Only a missing dir means "no UI here"; anything else leaves the scan unknown.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') walk.truncated = true
      continue
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) stack.push(path)
        continue
      }
      if (!UI_FILE.test(entry.name)) continue
      if (++visited > cap) return { ...walk, truncated: true }
      const mtime = mtimeOf(path)
      if (mtime !== null && (walk.newest === null || mtime > walk.newest)) walk.newest = mtime
    }
  }
  return walk
}

/** The last board's time (ms), or null when `last.json` is absent, corrupt or has no parseable `at`. */
function lastBoardAt(cwd: string): number | null {
  try {
    const last: unknown = JSON.parse(readFileSync(resolve(cwd, LAST_SHOT), 'utf8'))
    if (typeof last !== 'object' || last === null) return null
    const at = (last as { at?: unknown }).at
    if (typeof at !== 'string') return null
    const ms = Date.parse(at)
    return Number.isNaN(ms) ? null : ms
  } catch {
    return null
  }
}

/**
 * The notice line when a UI file is newer than the last board, no valid board exists, or the walk
 * hit its cap (unknown is reported, never "fresh"); else null. The signal is mtime-based, so a
 * checkout or rebase can fire it on unchanged UI — a documented trade-off for a stat-only check.
 */
export function staleBoardNotice(
  cwd: string,
  roots: string[],
  walkCap: number = WALK_CAP,
): string | null {
  const { newest, truncated } = walkUi(cwd, roots, walkCap)
  if (truncated) return BOARD_NOTICE
  if (newest === null) return null
  const at = lastBoardAt(cwd)
  return at === null || newest > at ? BOARD_NOTICE : null
}

/** Loads `<id>/package.json` from the consumer; throws when unresolvable. Injectable for tests. */
export type PackageLoader = (id: string) => { version?: string }

/** The consumer's Playwright version (`playwright`, then `playwright-core`), or null when absent. */
export function playwrightVersion(
  cwd: string,
  load: PackageLoader = createRequire(resolve(cwd, 'package.json')),
): string | null {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return load(`${name}/package.json`).version ?? 'unknown'
    } catch {
      // try the next candidate
    }
  }
  return null
}

/** Test seams for {@link designLoopLines}. */
export type DesignLoopProbes = {
  notice?: (cwd: string, roots: string[]) => string | null
  playwright?: (cwd: string) => string | null
}

/**
 * Doctor's design-loop section: advisory info lines only. They never count as a warning, so they
 * cannot change doctor's verdict or its "All checks passed" line.
 */
export function designLoopLines(
  cwd: string,
  roots: string[],
  probes: DesignLoopProbes = {},
): string[] {
  const lines: string[] = []
  const notice = (probes.notice ?? staleBoardNotice)(cwd, roots)
  if (notice !== null) lines.push(`  → ${notice}`)
  const playwright = (probes.playwright ?? playwrightVersion)(cwd)
  lines.push(
    playwright === null
      ? `  → playwright is not installed (optional, needed by basalt-ui shot): ${PLAYWRIGHT_INSTALL}`
      : `  ✓ playwright resolves (${playwright === 'unknown' ? 'version unknown' : playwright}; optional: basalt-ui shot)`,
  )
  return lines
}
