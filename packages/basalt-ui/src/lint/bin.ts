/**
 * Where a project's own tool binary lives. A leaf module: `basalt-ui lint` and `doctor`'s seeded
 * check both resolve oxlint through it, so the check runs the binary the verb runs.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/** The first `node_modules/.bin/<name>` found from each declared root (and the install root) upward. */
export function findBin(
  project: { root: string; roots: readonly (readonly [string, unknown])[] },
  name: string,
): string | null {
  const starts = [...project.roots.map(([r]) => resolve(project.root, r)), project.root]
  for (const start of starts) {
    for (let at = start; ; at = dirname(at)) {
      const path = resolve(at, 'node_modules/.bin', name)
      if (existsSync(path)) return path
      if (at === project.root || dirname(at) === at) break
    }
  }
  return null
}
