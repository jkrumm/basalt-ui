/** Which install root a project-scoped command run inside a workspace package reads — one answer for `doctor` and `sync`. */
import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  MANIFEST_PATH,
  OXLINT_FILES,
  findBasaltInstall,
  isStringArray,
  readSource,
  relativePosix,
  resolveAppDir,
} from './index'
import { hasDependency, parseJsonc } from './source-text'

/** The oxlint plugins the shipped preset switches on — read from the preset, never restated. */
export function readOxlintPresetPlugins(pkgRoot: string): string[] {
  const plugins = parseJsonc(readSource(pkgRoot, OXLINT_FILES.preset) ?? 'null')?.['plugins']
  return isStringArray(plugins) ? plugins : []
}

/**
 * The sentence `doctor` prints when the cwd carries no install but an ancestor does (a package
 * under a configured repo); one text, so no verb prescribes a second `init`.
 */
export function parentInstallAdvice(cwd: string, parent: string, verb: string): string {
  return (
    `This repo's install is at ${relativePosix(cwd, parent)} (${parent}) — run ${verb} there, ` +
    'or set BASALT_CWD to it.'
  )
}

/** The nearest ANCESTOR of `dir` (exclusive) carrying a basalt manifest, or null. */
export function findManifestAbove(dir: string): string | null {
  let current = resolve(dir, '..')
  for (;;) {
    if (existsSync(resolve(current, MANIFEST_PATH))) return current
    const parent = resolve(current, '..')
    if (parent === current) return null
    current = parent
  }
}

function sameInstall(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false
  return a === b || realpathSync(a) === realpathSync(b)
}

/**
 * The install root above `dir`, when `dir` is the APP package of that install: no manifest here,
 * basalt-ui declared here, an ancestor manifest, `resolveAppDir(root)` naming `dir`, and the
 * basalt-ui that resolves from `dir` the same copy (or version) the root uses. Anything else is
 * null — a sub-package with its own basalt-ui is a competing install, not part of the root's.
 */
export function installRootAbove(dir: string): string | null {
  if (existsSync(resolve(dir, MANIFEST_PATH)) || !hasDependency(dir, 'basalt-ui')) return null
  const root = findManifestAbove(dir)
  if (root === null) return null
  const app = resolveAppDir(root)
  if ('error' in app || app.dir !== dir) return null
  const here = findBasaltInstall(dir)
  const there = findBasaltInstall(root)
  const sameVersion = here.version !== null && here.version === there.version
  return sameInstall(here.dir, there.dir) || sameVersion ? root : null
}
