// Doctor's design-board notice and the optional-Playwright probe. A leaf: imports nothing from
// `./index`. Stat-walk only — never reads a file body.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const LAST_SHOT = join('.basalt', 'shots', 'last.json')
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.git'])
const UI_FILE = /\.(tsx|css)$/
/** Entries visited before the walk gives up: the notice is advisory, never worth a slow doctor. */
const WALK_CAP = 5000

export const BOARD_NOTICE =
  'UI changed since the last board — run basalt-ui shot <routes> and the basalt-design-reviewer (/basalt-design)'

/** Newest mtime (ms) among the UI files under `roots`, or null when there are none. */
function newestUiMtime(cwd: string, roots: string[]): number | null {
  let newest: number | null = null
  let visited = 0
  const stack = roots.map((root) => resolve(cwd, root))
  while (stack.length > 0 && visited < WALK_CAP) {
    const dir = stack.pop() as string
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      visited++
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) stack.push(path)
      } else if (UI_FILE.test(entry.name)) {
        const mtime = statSync(path).mtimeMs
        if (newest === null || mtime > newest) newest = mtime
      }
    }
  }
  return newest
}

/** The notice line when a UI file is newer than the last board (or no board exists), else null. */
export function staleBoardNotice(cwd: string, roots: string[]): string | null {
  const newest = newestUiMtime(cwd, roots)
  if (newest === null) return null
  try {
    const last = JSON.parse(readFileSync(resolve(cwd, LAST_SHOT), 'utf8')) as { at?: string }
    const at = Date.parse(last.at ?? '')
    return Number.isNaN(at) || newest > at ? BOARD_NOTICE : null
  } catch {
    return BOARD_NOTICE
  }
}

export const PLAYWRIGHT_INSTALL = 'bun add -d playwright && bunx playwright install chromium'

/** Loads `<id>/package.json` from the consumer; throws when unresolvable. Injectable for tests. */
export type PackageLoader = (id: string) => { version?: string }

/** The consumer's Playwright version (`playwright`, then `playwright-core`), or null when absent. */
export function playwrightVersion(
  cwd: string,
  load: PackageLoader = createRequire(join(cwd, 'package.json')),
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
