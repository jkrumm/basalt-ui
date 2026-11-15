/**
 * check-recipes-lint: every shipped recipe file lints clean under the app preset. A recipe page
 * carries the code of `apps/playground/src/recipes/`, so an agent that copies one as told gets
 * these files' lint: a red recipe teaches it to waive. Warnings count: the preset's `--deny-warnings`
 * is the bar a consumer's own gate sets.
 *
 * The config is `apps/playground/.oxlintrc.recipes.json`, which extends the SHIPPED `oxlint-app.json`
 * and nothing else, so the playground's own rule overrides never soften the check. It needs the built
 * package (`basalt-ui/lint` resolves through `dist`), so it runs in `pre`, after the build.
 *
 * Usage: bun packages/basalt-ui/scripts/check-recipes-lint.ts [<path>...]   (default: src/recipes)
 * Exit 0 clean; otherwise oxlint's exit code, with its findings on stdout.
 */
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
const PLAYGROUND = join(ROOT, 'apps', 'playground')

export function checkRecipesLint(args: readonly string[] = []): number {
  const paths = args.length > 0 ? args : ['src/recipes']
  const result = Bun.spawnSync(
    [
      join(ROOT, 'node_modules', '.bin', 'oxlint'),
      '-c',
      '.oxlintrc.recipes.json',
      '--deny-warnings',
      ...paths,
    ],
    { cwd: PLAYGROUND, stdout: 'inherit', stderr: 'inherit' },
  )
  return result.exitCode
}

if (import.meta.main) process.exit(checkRecipesLint(process.argv.slice(2)))
