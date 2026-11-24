/** Which install root a project-scoped command run inside a workspace package reads — one answer for `doctor` and `sync`. */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { MANIFEST_PATH, readManifest } from './manifest'
import type { Manifest } from './manifest'

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

/** A declared root as written or as typed (`./src/`): no leading `./`, no trailing slash. */
export const normalizeRoot = (raw: string): string =>
  raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.'

/**
 * The install `eject` and `add` write into: a manifest at `projectDir`, else the nearest one
 * above it. `profile` names the `init` the refusal suggests.
 */
export function locateInstall(
  projectDir: string,
  profile: string,
): { installRoot: string; manifest: Manifest } | { error: string } {
  const installRoot = readManifest(projectDir) === null ? findManifestAbove(projectDir) : projectDir
  if (installRoot === null) {
    return {
      error: `no ${MANIFEST_PATH} at ${projectDir} or above; run \`basalt-ui init --profile ${profile}\` first.`,
    }
  }
  const read = readManifest(installRoot)
  if (read === null || 'error' in read) return { error: read?.error ?? `${MANIFEST_PATH} vanished` }
  return { installRoot, manifest: read.manifest }
}

/** The root a write targets: `--app` matched against the declared roots, else the only one. */
export function pickDeclaredRoot(
  roots: string[],
  app: string | undefined,
): string | { error: string } {
  if (app !== undefined) {
    const wanted = normalizeRoot(app)
    const hit = roots.find((r) => normalizeRoot(r) === wanted)
    return hit ?? { error: `--app ${app} is not a declared root. Roots: ${roots.join(', ')}` }
  }
  if (roots.length > 1) {
    return {
      error: `the manifest declares ${roots.length} roots; pass --app <root>. Roots: ${roots.join(', ')}`,
    }
  }
  return roots[0] as string
}
