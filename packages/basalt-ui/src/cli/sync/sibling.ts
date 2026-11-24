/**
 * A sibling install (`basalt.sibling`, docs/v3/concepts/migration-release.md 6.1) keeps its manifest,
 * presets and AGENTS block in its app directory and places what Claude reads at the repo root, where
 * a root session sees it: rules and skills under a `basalt-v3-` name so the root install's own
 * `basalt-*` files are never touched. A ledger path starting `repo:` is relative to the repo root.
 */
import { basename, relative, resolve } from 'node:path'

import { collectWorkspacePackages, findRepoRoot } from '../index'
import { readManifest } from '../manifest'
import type { Manifest } from '../manifest'
import { isSiblingApp } from '../resolver'

export const SIBLING_PREFIX = 'basalt-v3-'
export const REPO = 'repo:'

export type Sibling = {
  /** `basalt-v3-` or `basalt-v3-<dirname>-`: what `basalt-` becomes in a rule or skill name. */
  prefix: string
  repoRoot: string
  /** The app directory relative to the repo root, POSIX. */
  appRel: string
}

/** The sibling placement of the install at `root`, or null when it is not a declared sibling. */
export function siblingOf(root: string, manifest: Manifest): Sibling | null {
  if (!isSiblingApp(root)) return null
  const repoRoot = findRepoRoot(root)
  return {
    prefix: manifest.sibling ?? SIBLING_PREFIX,
    repoRoot,
    appRel: relative(repoRoot, root).replaceAll('\\', '/'),
  }
}

/**
 * The prefix a first `init` claims: the plain one, or the directory-named one when another sibling
 * in the repo already records the plain one. Read from the siblings' tracked manifests, never from
 * the placed `basalt-v3-*` files: those are gitignored, so a fresh clone does not have them.
 */
export function claimPrefix(root: string): string {
  const taken = collectWorkspacePackages(findRepoRoot(root)).packages.some(({ dir }) => {
    const read = readManifest(dir)
    return read !== null && 'manifest' in read && read.manifest.sibling === SIBLING_PREFIX
  })
  return taken ? `${SIBLING_PREFIX}${basename(root)}-` : SIBLING_PREFIX
}

/** `basalt-<name>` -> `<prefix><name>`. */
export const siblingName = (name: string, prefix: string): string =>
  `${prefix}${name.replace(/^basalt-/, '')}`

/**
 * Points a skill's or the block's references at the renamed files: `basalt-<skill>` for each shipped
 * skill (never `basalt-ui` or the unrenamed subagent) and the `basalt-*` glob.
 */
export function renameRefs(text: string, prefix: string, skills: readonly string[]): string {
  const glob = text.replaceAll('`basalt-*`', `\`${prefix}*\``)
  if (skills.length === 0) return glob
  const names = skills.map((s) => s.replace(/^basalt-/, '')).join('|')
  return glob.replace(new RegExp(`basalt-(${names})(?![\\w-])`, 'g'), `${prefix}$1`)
}

/** Where a ledger path lives: `repo:`-prefixed paths under the repo root, the rest under `root`. */
export function unitPath(root: string, repoRoot: string, path: string): string {
  return path.startsWith(REPO) ? resolve(repoRoot, path.slice(REPO.length)) : resolve(root, path)
}
