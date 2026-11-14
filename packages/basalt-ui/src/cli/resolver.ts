/**
 * Which basalt installs a repo holds and which of them a command may treat as its own. The 2.x-era
 * root install stays root-owned (`basalt.app`, or a declared root of its manifest); a second install
 * is legal only when its package declares `"basalt": { "sibling": true }` (temporary, for the
 * sibling-app cutover; docs/v3/concepts/migration-release.md 6.1). Any other second install is
 * refused. A leaf over `./index`'s workspace walk, shared by `sync`, `init` and `doctor`.
 */
import { relative, resolve } from 'node:path'

import { collectWorkspacePackages, findRepoRoot, hasViteEntry, readBasaltConfig } from './index'
import type { Manifest } from './manifest'
import { hasDependency } from './source-text'

/** True when `dir` declares itself a sibling install below a repo root of its own. */
export const isSiblingApp = (dir: string): boolean =>
  readBasaltConfig(dir).sibling === true && findRepoRoot(dir) !== dir

/** True when `rel` (below the install root) is, holds or sits inside a declared root. */
export const coveredByRoots = (manifest: Manifest, rel: string): boolean =>
  Object.keys(manifest.roots).some((raw) => {
    const root = raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '')
    return root === '.' || rel === root || rel.startsWith(`${root}/`) || root.startsWith(`${rel}/`)
  })

const posixRel = (root: string, dir: string): string => relative(root, dir).replaceAll('\\', '/')

/**
 * The refusal for an undeclared second install in the workspace under `root`, or null. Candidates
 * are workspace packages that depend on basalt-ui and have a Vite entry; a declared sibling is not
 * one. The root-owned install is `basalt.app` when set, else whatever the manifest's roots cover; a
 * second candidate that neither names covers is the undeclared one.
 */
export function undeclaredInstall(root: string, manifest: Manifest): string | null {
  const owned = collectWorkspacePackages(root).packages.filter(
    (pkg) =>
      pkg.dir !== root &&
      hasDependency(pkg.dir, 'basalt-ui') &&
      hasViteEntry(pkg.dir) &&
      readBasaltConfig(pkg.dir).sibling !== true,
  )
  if (owned.length < 2) return null
  const named = readBasaltConfig(root).app
  const isOwner = (dir: string): boolean =>
    named === undefined
      ? coveredByRoots(manifest, posixRel(root, dir))
      : dir === resolve(root, named)
  if (owned.filter((pkg) => isOwner(pkg.dir)).length === owned.length) return null
  const names = owned.map((pkg) => posixRel(root, pkg.dir)).join(', ')
  return (
    `${owned.length} workspace packages depend on basalt-ui and have a Vite entry (${names}) — ` +
    'cannot tell which is the app. Set `basalt.app` (e.g. `"basalt": { "app": "apps/web" }`) in the ' +
    'root package.json, and declare a second install with `"basalt": { "sibling": true }` in its own package.json.'
  )
}
