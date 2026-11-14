/**
 * `sync` on ejected files (primitives-distribution section 6): carry a seed change into the app's
 * copy without a silent overwrite. Per `manifest.ejected` row:
 *
 * 1. `origin: 'local'` is skipped and named; a matching `seedDigest` merges nothing (a guard that
 *    differs from the shipped one is still restored). `origin: 'adopted'` shares no ancestry with
 *    a seed: the base, `fromVersion`, `seedDigest` and guard advance, the file is never touched,
 *    and the `git diff` that shows the seed change is printed.
 * 2. The header line is split off, and local, base and shipped are run through the project
 *    formatter (CE3); with none resolved the merge is raw and the run says so.
 * 3. `git merge-file --diff3` with the labels `local`, `base@<from>`, `shipped@<to>`.
 * 4. Header plus result is written, and the base (the raw seed, never a formatted one), the
 *    `fromVersion` and the `seedDigest` advance even on a conflict, so a second run finds nothing
 *    to do instead of stacking markers.
 *
 * `planEjected` reads and merges in temp only; `applyEjected` writes. `--check` is the plan alone.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

import { basePath, readRow } from '../eject/ledger'
import type { EjectedRow } from '../eject/ledger'
import { formatText, resolveFormatter } from '../merge/formatter'
import type { Formatter } from '../merge/formatter'
import { stripHeader, withHeader } from '../merge/header'
import { mergeFile } from '../merge/merge-file'
import { ejectedGuard, ejectedSource, readSeed } from '../merge/seed'
import type { Manifest } from '../manifest'

/** A file to write under the install root; `null` content deletes it. */
export type EjectedWrite = { path: string; content: string | null }

export type EjectedPlan = {
  writes: EjectedWrite[]
  /** `manifest.ejected` after the run. */
  ejected: Manifest['ejected']
  /** One line per row with something to say, in key order. */
  lines: string[]
  /** Rows with anything to write: `--check` is red on any. */
  work: number
  /** Paths left with conflict markers. */
  conflicts: string[]
  /** Rows that could not be synced at all; each is also a line. */
  errors: string[]
}

type Input = { root: string; manifest: Manifest; pkgRoot: string; version: string }

const guardPathOf = (tsxPath: string): string => tsxPath.replace(/\.tsx$/, '.guard.ts')

const read = (root: string, rel: string): string | null => {
  const path = resolve(root, rel)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

type Shipped = { source: string; guard: string | null; digest: string }

function shippedOf(pkgRoot: string, name: string): Shipped | { error: string } {
  const seed = readSeed(pkgRoot, name)
  if (seed === null) {
    return {
      error: `${name} is no longer shipped; run \`basalt-ui eject --undo ${name}\` or keep it with \`--adopt\``,
    }
  }
  const source = ejectedSource(seed.seed)
  if ('error' in source) return { error: `the shipped ${name} seed ${source.error}` }
  if (seed.guard === null) return { source: source.text, guard: null, digest: seed.digest }
  const guard = ejectedGuard(seed.guard, name)
  if ('error' in guard) return { error: `the shipped ${name} guard ${guard.error}` }
  return { source: source.text, guard: guard.text, digest: seed.digest }
}

/** The write that makes the guard beside `path` match the shipped one, or null when it does. */
function guardWrite(root: string, path: string, guard: string | null): EjectedWrite | null {
  const at = guardPathOf(path)
  const current = read(root, at)
  if (current === guard) return null
  return { path: at, content: guard }
}

type Merged = { text: string; conflicts: number; raw: boolean } | { error: string }

/** Steps 2-3 on a header-less body. The formatter runs only when the copy really diverged. */
function merge(
  body: string,
  base: string,
  shipped: string,
  labels: { base: string; shipped: string },
  formatter: () => Formatter | null,
  filePath: string,
): Merged {
  if (body === base) return { text: shipped, conflicts: 0, raw: false }
  if (body === shipped) return { text: body, conflicts: 0, raw: false }
  const fmt = formatter()
  const formatted =
    fmt === null ? null : [body, base, shipped].map((text) => formatText(fmt, text, filePath))
  const inputs = formatted?.every((t) => t !== null) === true ? (formatted as string[]) : null
  const [local, from, to] = inputs ?? [body, base, shipped]
  const result = mergeFile({
    local: local as string,
    base: from as string,
    shipped: to as string,
    labels: { local: 'local', ...labels },
  })
  if ('error' in result) return result
  return { ...result, raw: inputs === null }
}

/** Steps 1-3 for every row; reads the tree and writes nothing. */
export function planEjected({ root, manifest, pkgRoot, version }: Input): EjectedPlan {
  const plan: EjectedPlan = {
    writes: [],
    ejected: { ...manifest.ejected },
    lines: [],
    work: 0,
    conflicts: [],
    errors: [],
  }
  let resolved: Formatter | null | undefined
  const formatter = (): Formatter | null => (resolved ??= resolveFormatter(root))
  let mergedRaw = false
  const error = (line: string): void => {
    plan.errors.push(line)
    plan.lines.push(`✖ ${line}`)
  }

  for (const key of Object.keys(manifest.ejected).toSorted()) {
    const hash = key.lastIndexOf('#')
    const row = readRow(manifest.ejected[key] ?? {})
    if (hash === -1 || row === null) {
      error(`manifest.ejected["${key}"] is malformed; fix or remove the row`)
      continue
    }
    const ejectRoot = key.slice(0, hash)
    const name = key.slice(hash + 1)
    if (row.origin === 'local') {
      plan.lines.push(`skipped ${row.path}: origin local, ported by hand`)
      continue
    }
    const shipped = shippedOf(pkgRoot, name)
    if ('error' in shipped) {
      error(`${row.path}: ${shipped.error}`)
      continue
    }
    const guard = guardWrite(root, row.path, shipped.guard)
    const advanced: EjectedRow = { ...row, fromVersion: version, seedDigest: shipped.digest }
    const base = basePath(ejectRoot, name)

    if (row.seedDigest === shipped.digest) {
      if (guard === null) continue
      plan.work++
      plan.writes.push(guard)
      plan.lines.push(`restored ${guard.path}: the guard differed from the shipped one`)
      continue
    }

    plan.work++
    if (row.origin === 'adopted') {
      plan.writes.push({ path: base, content: shipped.source }, ...(guard === null ? [] : [guard]))
      plan.ejected[key] = advanced
      plan.lines.push(
        `adopted ${row.path}: left byte-identical (${row.fromVersion} -> ${version}); port the seed change by hand, see \`git diff -- ${base}\``,
      )
      continue
    }

    const local = read(root, row.path)
    const from = read(root, base)
    if (local === null || from === null) {
      error(
        `${local === null ? row.path : base} is missing, so ${row.path} has nothing to merge; restore it from git, or \`basalt-ui eject --undo ${name}\``,
      )
      continue
    }
    const { header, body } = stripHeader(local)
    const merged = merge(
      body,
      from,
      shipped.source,
      { base: `base@${row.fromVersion}`, shipped: `shipped@${version}` },
      formatter,
      row.path,
    )
    if ('error' in merged) {
      error(`${row.path}: ${merged.error}`)
      continue
    }
    mergedRaw ||= merged.raw
    const result = header === null ? merged.text : withHeader(header, merged.text)
    plan.writes.push(
      ...(result === local ? [] : [{ path: row.path, content: result }]),
      { path: base, content: shipped.source },
      ...(guard === null ? [] : [guard]),
    )
    plan.ejected[key] = advanced
    const span = `${row.fromVersion} -> ${version}`
    if (merged.conflicts > 0) {
      plan.conflicts.push(row.path)
      plan.lines.push(
        `✖ conflict ${row.path} (${span}): ${merged.conflicts} conflict(s), markers labelled local, base@${row.fromVersion}, shipped@${version}; resolve them, the base already advanced`,
      )
    } else {
      plan.lines.push(`merged ${row.path} (${span})`)
    }
  }
  if (mergedRaw) {
    plan.lines.push(
      'no project formatter resolved (oxfmt, prettier or biome in package.json with its bin installed): merged raw',
    )
  }
  return plan
}

/** Writes a plan under `root`; a path that resolves outside it is refused. */
export function applyEjected(root: string, plan: EjectedPlan): void {
  for (const { path, content } of plan.writes) {
    const abs = resolve(root, path)
    if (relative(root, abs).startsWith('..')) throw new Error(`${path} resolves outside ${root}`)
    if (content === null) rmSync(abs, { force: true })
    else {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content)
    }
  }
}
