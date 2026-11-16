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

/**
 * `--ignore-path` replaces stylelint's own `.stylelintignore`, as `basalt-ui lint` passes oxlint none:
 * a file the app lists there is linted anyway and `doctor` reports the file. Nothing writes this path.
 */
export const STYLELINT_IGNORE_ARGS = ['--ignore-path', '.basalt/stylelintignore'] as const

/** The v3 lane's oxlint config in an `extends` list: the generated `.oxlintrc.basalt.json` or the shipped app preset. */
export const v3LaneEntry = (entries: unknown): string | undefined =>
  [entries]
    .flat()
    .find((e): e is string => /(?:\.oxlintrc\.basalt|oxlint-app)\.json$/.test(String(e)))
