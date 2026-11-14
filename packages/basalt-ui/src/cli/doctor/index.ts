/**
 * `doctor` (v3): twelve checks, each pass, fail or SKIPPED, and SKIPPED exits non-zero. A check that
 * cannot run is not a check that passed (invariant 2); `doctor` reports, and the gates that enforce
 * are `lint`, `sync --check` and `make check`. The checks are grouped by what they read:
 * `install` 1-3, `wiring` 4-7, `hook` 8-9, `guards` 10-11, `app` 12.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { designLoopLines } from '../board-freshness'
import { findBasaltInstall, noteRelocation, packageRoot, resolveProjectDir } from '../index'
import { findManifestAbove } from '../install-root'
import { MANIFEST_PATH, readManifest } from '../manifest'
import { appChecks } from './app'
import { guardChecks } from './guards'
import { hookChecks } from './hook'
import { installChecks } from './install'
import { Skip } from './types'
import type { Check, Ctx, DoctorOptions, Result } from './types'
import { wiringChecks } from './wiring'

export type { DoctorOptions, Result, Status } from './types'

export const CHECKS: readonly Check[] = [
  ...installChecks,
  ...wiringChecks,
  ...hookChecks,
  ...guardChecks,
  ...appChecks,
]

/** The install root for `dir`: where the manifest is, or the nearest ancestor that holds one. */
function installRoot(dir: string): string {
  return existsSync(resolve(dir, MANIFEST_PATH)) ? dir : (findManifestAbove(dir) ?? dir)
}

export function buildContext(dir: string, options: DoctorOptions): Ctx {
  const root = installRoot(dir)
  const read = readManifest(root)
  const base = { root, pkgRoot: options.pkgRoot ?? packageRoot(), options }
  if (read === null) {
    return {
      ...base,
      manifest: null,
      manifestError: `${MANIFEST_PATH} is missing: run \`basalt-ui init --profile <tokens|bridge|parts|app>\``,
    }
  }
  return 'error' in read
    ? { ...base, manifest: null, manifestError: read.error }
    : { ...base, manifest: read.manifest, manifestError: null }
}

/** Runs every check in order; a thrown `Skip` (or any throw) is a SKIPPED result, never a pass. */
export async function runChecks(ctx: Ctx, only?: readonly number[]): Promise<Result[]> {
  const results: Result[] = []
  for (const check of CHECKS.filter((c) => only === undefined || only.includes(c.id))) {
    const { id, name } = check
    try {
      results.push({ id, name, ...(await check.run(ctx)) })
    } catch (error) {
      const why = error instanceof Skip ? error.message : `cannot run (${(error as Error).message})`
      results.push({ id, name, status: 'skipped', detail: why })
    }
  }
  return results
}

const MARK = { pass: '✓', fail: '✖', skipped: '⚠ SKIPPED' } as const

export async function doctor(
  cwd: string,
  flags: readonly string[] = [],
  options: DoctorOptions = {},
): Promise<number> {
  const project = resolveProjectDir(cwd)
  noteRelocation('doctor', project)
  if (flags.includes('--from')) {
    console.log(
      '`doctor --from` no longer prints the upgrade notes: read the version rows in MIGRATING.md, then run `basalt-ui migrate --check`.',
    )
  }
  const ctx = buildContext(project.dir, options)
  const results = await runChecks(ctx)

  for (const r of results) {
    const line = `${MARK[r.status]} ${r.id} ${r.name}: ${r.detail}`
    if (r.status === 'pass') console.log(line)
    else console.error(line)
  }
  const failed = results.filter((r) => r.status === 'fail').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const passed = results.length - failed - skipped

  const install = findBasaltInstall(ctx.root)
  if (install.dir !== null) {
    const where = (rel: string): string =>
      `${install.dir}/${rel}${existsSync(resolve(install.dir ?? '', rel)) ? '' : ' (missing)'}`
    console.log(`docs/ resolves at ${where('docs')}; llms.txt at ${where('llms.txt')}`)
  }
  for (const line of designLoopLines(ctx.root, Object.keys(ctx.manifest?.roots ?? {}))) {
    console.log(line)
  }

  if (failed + skipped === 0) {
    console.log(`All ${results.length} checks passed.`)
    return 0
  }
  console.error(
    `${passed} passed, ${failed} failed, ${skipped} SKIPPED (SKIPPED fails: a check that cannot run is not a pass).`,
  )
  return 1
}
