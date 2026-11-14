/**
 * `sync [--check] [--force]` (v3): render every managed file in memory and compare bytes with the
 * tree. It refreshes an install `init` made, never creates one, never touches `CLAUDE.md`.
 * Resolution is the shared one: `BASALT_CWD`, else the cwd, then the manifest there or above.
 */
import { relative } from 'node:path'

import { noteRelocation, packageRoot, readFrameworkVersion, resolveProjectDir } from '../index'
import { findManifestAbove } from '../install-root'
import { MANIFEST_PATH, readManifest, writeManifest } from '../manifest'
import type { Manifest } from '../manifest'
import { applySync, differences, planSync } from './engine'
import { presetFilesFor } from '../presets'
import { renderBlock, renderManaged } from './render'
import type { PresetFiles } from './render'

export type SyncOptions = {
  force?: boolean
  check?: boolean
  /** Shipped-source root; defaults to this package. Tests point it at a fixture package. */
  pkgRoot?: string
  /** The generated preset files. Defaults to the shipped presets of `pkgRoot`. */
  presetFiles?: PresetFiles
}

const MAKE_ONE = 'run `basalt-ui init --profile <tokens|bridge|parts|app>`'

/** True when `rel` (below the install root) is, holds or sits inside a declared root. */
const covered = (manifest: Manifest, rel: string): boolean =>
  Object.keys(manifest.roots).some((raw) => {
    const root = raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '')
    return root === '.' || rel === root || rel.startsWith(`${root}/`) || root.startsWith(`${rel}/`)
  })

/** The install this run belongs to: a manifest here, or one above that declares this directory. */
function locate(dir: string): { root: string; manifest: Manifest } | { error: string } {
  const above = readManifest(dir) === null ? findManifestAbove(dir) : dir
  if (above === null) {
    return {
      error: `no ${MANIFEST_PATH} at ${dir} or above — sync never creates an install; ${MAKE_ONE}.`,
    }
  }
  const read = readManifest(above)
  if (read === null || 'error' in read) return { error: read?.error ?? `${MANIFEST_PATH} vanished` }
  const rel = relative(above, dir).replaceAll('\\', '/')
  if (rel !== '' && !covered(read.manifest, rel)) {
    return {
      error:
        `${dir} is not under a declared root of the install at ${above} — an undeclared second ` +
        `consumer. Add its root to \`roots\` there, or give it an install of its own: ${MAKE_ONE}.`,
    }
  }
  if (above !== dir)
    console.log(`basalt-ui sync: ${dir} belongs to the install at ${above}; syncing there.`)
  return { root: above, manifest: read.manifest }
}

export function sync(opts: SyncOptions = {}, invocationCwd: string = process.cwd()): number {
  const project = resolveProjectDir(invocationCwd)
  noteRelocation('sync', project)
  const fail = (why: string): number => (console.error(`✖ basalt-ui sync: ${why}`), 1)

  const found = locate(project.dir)
  if ('error' in found) return fail(found.error)
  const { root, manifest } = found
  const pkgRoot = opts.pkgRoot ?? packageRoot()
  const version = readFrameworkVersion(pkgRoot)
  const block = renderBlock(pkgRoot, manifest, version)
  if (block === null) return fail(`${pkgRoot} ships no agent/templates/AGENTS-block.md.tpl.`)

  let plan
  try {
    const units = [
      ...renderManaged(pkgRoot, manifest),
      ...(opts.presetFiles ?? presetFilesFor(pkgRoot))(manifest).map((u) => ({
        ...u,
        generated: true,
      })),
    ]
    plan = planSync(root, manifest, units, block)
  } catch (error) {
    return fail((error as Error).message)
  }
  if ('error' in plan.block) return fail(plan.block.error)

  if (opts.check === true) {
    const diff = differences(plan)
    if (diff.length === 0)
      return (console.log('✓ basalt-ui sync --check: all managed files current.'), 0)
    console.error(`✖ basalt-ui sync --check: ${diff.length} difference(s):`)
    for (const line of diff) console.error(`  ${line}`)
    console.error('Run `basalt-ui sync` to apply (`--force` overwrites locally edited files).')
    return 1
  }

  const applied = applySync(root, manifest, plan, opts.force === true)
  writeManifest(root, { ...applied.manifest, version })
  console.log(
    `basalt-ui sync: ${applied.written} written, ${applied.removed} retired, ${applied.left.length} left (edited).`,
  )
  if (applied.left.length > 0) {
    console.log('Locally edited files were left as they are (run with --force to overwrite):')
    for (const path of applied.left) console.log(`  ${path}`)
  }
  return 0
}
